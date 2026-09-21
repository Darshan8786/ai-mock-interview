import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { TechQuizAttempt } from "../models/TechQuizAttempt";
import { TechPerformanceProfile } from "../models/TechPerformanceProfile";
import { TechQuestionHistory } from "../models/TechQuestionHistory";
import axios from "axios";

// Question selection, and every correct answer + explanation, come from the
// local trained dataset served by ai-services (tech_question_engine.py /
// tech_answer_evaluator.py) - no external AI API is used anywhere in this
// controller. This service only owns session persistence, scoring
// aggregation, and the adaptive per-user/per-technology performance profile
// (weak topics, difficulty progression) - mirroring how mockInterviewController
// and aptitudeController already split "local AI logic in ai-services" from
// "session/user state in Mongo".
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:5001";
const AI_SERVICE_KEY = process.env.AI_SERVICE_KEY || "mindprep-ai-key-2026";
const aiServiceHeaders = { "X-AI-Service-Key": AI_SERVICE_KEY };

const SUPPORTED_TECHNOLOGIES = [
  "Python", "Java", "SQL", "C++", "C", "HTML", "CSS", "JavaScript", "React", "Node.js",
];
const ALLOWED_COUNTS = [5, 10, 20];
const ALLOWED_DIFFICULTIES = ["Easy", "Medium", "Hard", "Mixed"];
const DIFFICULTY_ORDER = ["Easy", "Medium", "Hard"];

// A topic needs at least this many prior answers before its accuracy is
// trusted enough to bias selection - otherwise one unlucky early question
// would look like a "weak topic" forever.
const MIN_TOPIC_SAMPLE_FOR_WEIGHTING = 3;
const WEAK_TOPIC_ACCURACY_THRESHOLD = 0.6;
const WEAK_TOPIC_WEIGHT = 3;

const STRENGTH_THRESHOLD = 70;
const WEAKNESS_THRESHOLD = 60;

async function getOrCreateProfile(userId: string, technology: string) {
  let profile = await TechPerformanceProfile.findOne({ user: userId, technology });
  if (!profile) {
    profile = await TechPerformanceProfile.create({ user: userId, technology, currentDifficulty: "Easy", topicStats: [] });
  }
  return profile;
}

function topicWeightsFromProfile(profile: any): Record<string, number> {
  const weights: Record<string, number> = {};
  for (const stat of profile.topicStats || []) {
    if (stat.total < MIN_TOPIC_SAMPLE_FOR_WEIGHTING) continue;
    const accuracy = stat.correct / stat.total;
    if (accuracy < WEAK_TOPIC_ACCURACY_THRESHOLD) {
      weights[stat.topic] = WEAK_TOPIC_WEIGHT;
    }
  }
  return weights;
}

export const startTechQuiz = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { technology, totalQuestions, questionTypes } = req.body;
  const difficulty = req.body.difficulty || "Mixed";

  if (!SUPPORTED_TECHNOLOGIES.includes(technology)) {
    throw new AppError(`Unsupported technology. Choose one of: ${SUPPORTED_TECHNOLOGIES.join(", ")}`, 400);
  }
  if (!ALLOWED_COUNTS.includes(Number(totalQuestions))) {
    throw new AppError("totalQuestions must be 5, 10, or 20", 400);
  }
  if (!ALLOWED_DIFFICULTIES.includes(difficulty)) {
    throw new AppError(`difficulty must be one of: ${ALLOWED_DIFFICULTIES.join(", ")}`, 400);
  }

  const profile = await getOrCreateProfile(req.user._id.toString(), technology);
  const topicWeights = topicWeightsFromProfile(profile);

  // EVERY question this user has ever been shown for this technology - not
  // just recent attempts - so a question genuinely never repeats for them
  // until the whole pool is exhausted. Mirrors AptitudeQuestionHistory's role
  // for the aptitude system exactly.
  const seenIds = await TechQuestionHistory.distinct("question", { user: req.user._id, technology });

  const selectFromEngine = async (excludeIds: string[], count: number) => {
    try {
      const response = await axios.post(
        `${AI_SERVICE_URL}/tech-questions/select`,
        {
          technology,
          difficulty,
          count,
          questionTypes: questionTypes || undefined,
          excludeIds,
          topicWeights,
        },
        { timeout: 10000, headers: aiServiceHeaders }
      );
      return response.data;
    } catch (err: any) {
      console.error(`Tech-question selection failed: ${err?.message}`);
      throw new AppError("The local question engine is unavailable. Please try again.", 502);
    }
  };

  const requestedCount = Number(totalQuestions);
  const primary = await selectFromEngine(seenIds, requestedCount);
  let questions: any[] = primary.questions || [];
  const repeatedIds = new Set<string>();

  // The unseen pool for this user+technology (+difficulty/type filters) is
  // too small to fill the quiz - reuse the least-important exclusion (their
  // own seen-question history) rather than failing outright, same fallback
  // aptitudeController's selectQuestions() uses when its unseen pool runs out.
  if (primary.insufficient && questions.length < requestedCount) {
    const shortfall = requestedCount - questions.length;
    const alreadyPicked = questions.map((q) => q.id);
    const backfill = await selectFromEngine(alreadyPicked, shortfall);
    for (const q of backfill.questions || []) {
      repeatedIds.add(q.id);
    }
    questions = questions.concat(backfill.questions || []);
  }

  if (questions.length === 0) {
    throw new AppError("No questions are available for this selection yet.", 404);
  }

  const attempt = await TechQuizAttempt.create({
    user: req.user._id,
    technology,
    difficulty,
    totalQuestions: questions.length,
    questions: questions.map((q: any) => ({
      questionId: q.id,
      topic: q.topic,
      difficulty: q.difficulty,
      questionType: q.question_type,
    })),
  });

  await TechQuestionHistory.insertMany(
    questions.map((q: any) => ({
      user: req.user._id,
      technology,
      question: q.id,
      attempt: attempt._id,
      repeated: repeatedIds.has(q.id),
    }))
  );

  res.status(201).json({
    success: true,
    data: {
      attemptId: attempt._id,
      technology,
      difficulty,
      totalQuestions: questions.length,
      insufficient: questions.length < requestedCount,
      repeatedCount: repeatedIds.size,
      recommendedDifficulty: profile.currentDifficulty,
      questions,
    },
  });
});

export const submitTechQuizAnswer = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { questionId, answer } = req.body;
  if (!questionId) throw new AppError("questionId is required", 400);

  const attempt = await TechQuizAttempt.findOne({ _id: req.params.attemptId, user: req.user._id });
  if (!attempt) throw new AppError("Attempt not found", 404);
  if (attempt.status === "completed") throw new AppError("This quiz has already finished", 400);

  const questionEntry = (attempt.questions as any[]).find((q) => q.questionId === questionId);
  if (!questionEntry) throw new AppError("Question not found in this attempt", 404);
  if (questionEntry.answered) {
    throw new AppError("This question has already been answered", 409);
  }

  let evaluation: any;
  try {
    const response = await axios.post(
      `${AI_SERVICE_URL}/tech-questions/evaluate`,
      { questionId, answer },
      { timeout: 10000, headers: aiServiceHeaders }
    );
    evaluation = response.data;
  } catch (err: any) {
    console.error(`Tech-answer evaluation failed: ${err?.message}`);
    throw new AppError("The local answer evaluator is unavailable. Please try again.", 502);
  }

  questionEntry.submittedAnswer = answer;
  questionEntry.answered = true;
  questionEntry.isCorrect = !!evaluation.isCorrect;
  questionEntry.score = evaluation.score ?? (evaluation.isCorrect ? 100 : 0);

  if (evaluation.isCorrect) attempt.correctAnswers += 1;
  else attempt.wrongAnswers += 1;

  await attempt.save();

  res.json({
    success: true,
    data: {
      isCorrect: evaluation.isCorrect,
      score: evaluation.score,
      correctAnswer: evaluation.correctAnswer,
      explanation: evaluation.explanation,
      testCases: evaluation.testCases,
      matchedKeywords: evaluation.matchedKeywords,
      missedKeywords: evaluation.missedKeywords,
      answeredCount: (attempt.questions as any[]).filter((q) => q.answered).length,
      totalQuestions: attempt.totalQuestions,
    },
  });
});

function nextDifficulty(current: string, overallScore: number): string {
  const idx = DIFFICULTY_ORDER.indexOf(current);
  if (idx === -1) return "Easy";
  if (overallScore >= 80 && idx < DIFFICULTY_ORDER.length - 1) return DIFFICULTY_ORDER[idx + 1];
  if (overallScore < 50 && idx > 0) return DIFFICULTY_ORDER[idx - 1];
  return current;
}

export const finishTechQuiz = asyncHandler(async (req: AuthRequest, res: Response) => {
  const attempt = await TechQuizAttempt.findOne({ _id: req.params.attemptId, user: req.user._id });
  if (!attempt) throw new AppError("Attempt not found", 404);

  if (attempt.status === "completed") {
    return res.json({ success: true, data: buildResult(attempt) });
  }

  const timeTaken = Number(req.body.timeTaken || 0);
  const questions = attempt.questions as any[];
  const total = questions.length;
  const correct = questions.filter((q) => q.isCorrect).length;
  const wrong = questions.filter((q) => q.answered && !q.isCorrect).length;
  const unanswered = questions.filter((q) => !q.answered).length;
  const score = total ? Math.round((correct / total) * 100) : 0;

  const byTopic = new Map<string, { correct: number; total: number }>();
  for (const q of questions) {
    const bucket = byTopic.get(q.topic) || { correct: 0, total: 0 };
    bucket.total += 1;
    if (q.isCorrect) bucket.correct += 1;
    byTopic.set(q.topic, bucket);
  }
  const topicScores = Array.from(byTopic.entries()).map(([topic, v]) => ({
    topic,
    correct: v.correct,
    total: v.total,
    score: v.total ? Math.round((v.correct / v.total) * 100) : 0,
  }));

  const strengths = topicScores.filter((t) => t.score >= STRENGTH_THRESHOLD).map((t) => t.topic);
  const weaknesses = topicScores.filter((t) => t.score < WEAKNESS_THRESHOLD).map((t) => t.topic);

  attempt.status = "completed";
  attempt.correctAnswers = correct;
  attempt.wrongAnswers = wrong;
  attempt.unanswered = unanswered;
  attempt.score = score;
  attempt.topicScores = topicScores;
  attempt.strengths = strengths;
  attempt.weaknesses = weaknesses;
  attempt.timeTaken = timeTaken;
  attempt.completedAt = new Date();
  await attempt.save();

  // Update the adaptive profile: accumulate topic accuracy, then step
  // difficulty up/down by exactly one level based on this session's overall
  // score (never an unpredictable jump - see nextDifficulty()).
  const profile = await getOrCreateProfile(req.user._id.toString(), attempt.technology);
  for (const t of topicScores) {
    const existing = profile.topicStats.find((s: any) => s.topic === t.topic);
    if (existing) {
      existing.correct += t.correct;
      existing.total += t.total;
    } else {
      profile.topicStats.push({ topic: t.topic, correct: t.correct, total: t.total });
    }
  }
  profile.totalAttempts += 1;
  profile.currentDifficulty = nextDifficulty(profile.currentDifficulty, score);
  await profile.save();

  res.json({ success: true, data: { ...buildResult(attempt), recommendedNextDifficulty: profile.currentDifficulty } });
});

function buildResult(attempt: any) {
  return {
    attemptId: attempt._id,
    technology: attempt.technology,
    difficulty: attempt.difficulty,
    totalQuestions: attempt.totalQuestions,
    correctAnswers: attempt.correctAnswers,
    wrongAnswers: attempt.wrongAnswers,
    unanswered: attempt.unanswered,
    score: attempt.score,
    topicScores: attempt.topicScores,
    strengths: attempt.strengths,
    weaknesses: attempt.weaknesses,
    timeTaken: attempt.timeTaken,
  };
}

export const getTechQuizHistory = asyncHandler(async (req: AuthRequest, res: Response) => {
  const attempts = await TechQuizAttempt.find({ user: req.user._id, status: "completed" })
    .sort({ createdAt: -1 })
    .limit(50)
    .select("technology difficulty totalQuestions correctAnswers score createdAt")
    .lean();
  res.json({ success: true, data: attempts });
});

export const getTechnologies = asyncHandler(async (_req: AuthRequest, res: Response) => {
  try {
    const response = await axios.get(`${AI_SERVICE_URL}/tech-questions/technologies`, { timeout: 8000 });
    res.json({ success: true, data: response.data.technologies });
  } catch (err: any) {
    console.error(`Failed to fetch technology metadata: ${err?.message}`);
    throw new AppError("The local question engine is unavailable. Please try again.", 502);
  }
});
