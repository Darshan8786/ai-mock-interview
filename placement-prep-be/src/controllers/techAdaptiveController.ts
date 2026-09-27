/**
 * Adaptive, AI-generated Tech Practice (Python / Java / C / C++ / SQL / HTML / CSS / JavaScript / React / Node.js),
 * one question at a time - same loop as aptitudeAdaptiveController:
 *
 *   start -> generate Q1 -> answer -> evaluate (ai-services tech_answer_evaluator on the stored record) -> store
 *         -> adapt difficulty + weak-topic targeting -> generate next in the background -> ... -> report
 *
 * The full question record (answer key included) is stored server-side in TechQuizAttempt.questions[].record and
 * stripped by publicQuestion() before anything reaches the client. If evaluation is unavailable, MCQs are graded
 * exactly here from the stored key; free-text answers are saved and marked pending (source "fallback") - never a
 * made-up score - and re-evaluated when the report is opened. The classic quiz flow in techQuizController.ts is untouched.
 */
import { Response } from "express";
import mongoose from "mongoose";
import { AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { TechQuizAttempt } from "../models/TechQuizAttempt";
import { TechPerformanceProfile } from "../models/TechPerformanceProfile";
import { TechQuestionHistory } from "../models/TechQuestionHistory";
import {
  Level, LEVELS, attemptComparison, buildPlan, chooseTopic, compareWithPrevious, nextDifficulty, summarize, toLevel,
} from "../services/adaptiveEngine";
import { evaluateTechRecord, generateTechQuestion, TechEvaluation } from "../services/questionEngineClient";

const TECHNOLOGIES = ["Python", "Java", "SQL", "C++", "C", "HTML", "CSS", "JavaScript", "React", "Node.js"];
const QUESTION_TYPES = ["mcq", "conceptual", "output_prediction", "debugging", "coding", "mixed"];
// "mixed" rotation - MCQ-heavy, every other type represented
const MIXED_ROTATION = ["mcq", "conceptual", "mcq", "output_prediction", "mcq", "debugging", "conceptual", "coding"];
const MAX_PRACTICE_ATTEMPTS = 10;
const CAP: Record<Level, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };
const ADAPTED_MESSAGE = "Next question adapted to your performance.";
const PRIVATE = new Set(["answer", "explanation", "correct_option", "expected_solution", "fixed_code", "verification",
  "model_rejections", "rejection_reasons", "generation_ms", "repeated", "domain", "question_kind"]);

/** Question as the client may see it BEFORE answering: no key, no explanation, no expected outputs. */
export function publicQuestion(q: any, index: number) {
  const r = q.record || {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(r)) if (!PRIVATE.has(k)) out[k] = v;
  if (Array.isArray(r.test_cases)) out.test_cases = r.test_cases.map((t: any) => ({ input: t?.input ?? "" }));
  return {
    ...out, index, topic: q.topic, difficulty: q.difficulty, question_type: q.questionType, source: q.source,
    focusArea: q.focusArea, topicReason: q.topicReason, difficultyReason: q.difficultyReason,
  };
}

async function loadAdaptive(req: AuthRequest) {
  if (!mongoose.isValidObjectId(req.params.attemptId)) throw new AppError("Session not found", 404);
  const attempt: any = await TechQuizAttempt.findOne({ _id: req.params.attemptId, user: req.user._id, mode: "adaptive" });
  if (!attempt) throw new AppError("Session not found", 404);
  return attempt;
}

/** Answered tech history rows (topic, correct, responseTime) for one technology, newest first. */
async function historyRows(userId: any, technology: string) {
  const attempts: any[] = await TechQuizAttempt.find({ user: userId, technology }).sort({ createdAt: -1 }).limit(40).select("questions").lean();
  return attempts.flatMap((a) => (a.questions || []).filter((q: any) => q.answered && q.isCorrect !== null)
    .map((q: any) => ({ topic: q.topic, correct: !!q.isCorrect, responseTime: q.responseTime ?? null })));
}

function levelOf(q: any): Level {
  return toLevel(q.difficulty, "medium");
}

async function generateNext(attemptId: string): Promise<void> {
  try {
    const attempt: any = await TechQuizAttempt.findById(attemptId).lean();
    if (!attempt || attempt.status === "completed" || !attempt.adaptive) return;
    const ad = attempt.adaptive;
    const qs: any[] = attempt.questions || [];
    if (qs.length >= attempt.totalQuestions) {
      await TechQuizAttempt.updateOne({ _id: attemptId }, { $set: { "adaptive.nextStatus": "done" } });
      return;
    }
    const level = toLevel(ad.currentDifficulty, "easy");
    const topics: string[] = ad.personalization?.availableTopics || [];
    const choice = chooseTopic({
      fixedTopic: ad.topic || undefined,
      candidates: ad.topic ? [ad.topic] : topics,
      plan: ad.personalization,
      items: qs.map((q) => ({ topic: q.topic, answered: q.answered, correct: q.isCorrect })),
    });
    const questionType = ad.questionType === "mixed" ? MIXED_ROTATION[qs.length % MIXED_ROTATION.length] : ad.questionType;
    const seen: any[] = await TechQuestionHistory.find({ user: attempt.user, technology: attempt.technology })
      .sort({ shownAt: -1 }).limit(400).select("question questionText").lean();

    const gen = await generateTechQuestion({
      technology: attempt.technology,
      topic: choice.topic || "",
      difficulty: level,
      questionType,
      exclude: seen.map((s) => s.questionText).filter(Boolean),
      session: qs.map((q) => q.questionText).filter(Boolean),
      excludeIds: [...seen.map((s) => s.question), ...qs.map((q) => q.questionId)],
    });
    if (!gen || (gen as any).error || !gen.question) {
      await TechQuizAttempt.updateOne({ _id: attemptId }, {
        $set: { "adaptive.nextStatus": "failed", "adaptive.nextError": "The local question engine is unavailable. Retry in a moment." },
      });
      return;
    }
    const entry = {
      questionId: gen.id,
      topic: gen.topic,
      difficulty: String(gen.difficulty || CAP[level]),
      questionType: gen.question_type,
      record: gen,
      questionText: gen.question,
      source: gen.source,
      verification: gen.verification,
      focusArea: choice.focus ? choice.topic : "",
      topicReason: choice.reason,
      difficultyReason: ad.lastDecision || `Starting at ${level}.`,
      shownAt: new Date(),
    };
    const pushed = await TechQuizAttempt.updateOne(
      { _id: attemptId, status: "in-progress", questions: { $size: qs.length } },
      { $push: { questions: entry }, $set: { "adaptive.nextStatus": "ready", "adaptive.nextError": "" } }
    );
    if (pushed.modifiedCount) {
      await TechQuestionHistory.create({
        user: attempt.user, technology: attempt.technology, question: gen.id, attempt: attempt._id,
        repeated: !!gen.repeated, questionText: gen.question, topic: gen.topic,
      });
    }
  } catch (err: any) {
    console.error(`[tech-adaptive] generateNext failed for ${attemptId}: ${err?.message}`);
    await TechQuizAttempt.updateOne({ _id: attemptId }, { $set: { "adaptive.nextStatus": "failed", "adaptive.nextError": "Question generation failed." } }).catch(() => {});
  }
}

async function kickGeneration(attemptId: string) {
  const claimed = await TechQuizAttempt.updateOne(
    { _id: attemptId, status: "in-progress", "adaptive.nextStatus": { $ne: "generating" } },
    { $set: { "adaptive.nextStatus": "generating" } }
  );
  if (claimed.modifiedCount) void generateNext(attemptId);
}

/** Evaluation with a truthful fallback: exact MCQ grading from the stored key, otherwise "pending" (no fake score). */
async function evaluate(record: any, answer: unknown): Promise<TechEvaluation & { pending?: boolean }> {
  const ev = await evaluateTechRecord(record, answer);
  if (ev && typeof ev.isCorrect === "boolean") return ev;
  if (record.question_type === "MCQ" && Array.isArray(record.options)) {
    const selected = Number(answer);
    const isCorrect = Number.isInteger(selected) && selected === record.correct_option;
    return {
      isCorrect, score: isCorrect ? 100 : 0, correctAnswer: record.options[record.correct_option] ?? "",
      explanation: record.explanation || "", expectedConcepts: record.keywords || [], missingConcepts: [],
      recommendation: isCorrect ? "" : `Review ${record.topic}.`, evaluationSource: "backend-exact",
    };
  }
  return {
    isCorrect: false, score: 0, correctAnswer: record.answer || "", explanation: record.explanation || "",
    expectedConcepts: record.keywords || [], missingConcepts: [], evaluationSource: "fallback", pending: true,
    recommendation: "The evaluator was unavailable - your answer is saved and will be graded when you open the report.",
  };
}

// ── Endpoints ────────────────────────────────────────────────────────────────

export const getTechPersonalization = asyncHandler(async (req: AuthRequest, res: Response) => {
  const technology = String(req.query.technology || "");
  if (!TECHNOLOGIES.includes(technology)) throw new AppError("Unknown technology", 400);
  const topic = String(req.query.topic || "");
  res.json({ success: true, data: buildPlan(await historyRows(req.user._id, technology), topic ? [topic] : undefined) });
});

export const startAdaptiveTech = asyncHandler(async (req: AuthRequest, res: Response) => {
  const technology = String(req.body.technology || "");
  const topic = String(req.body.topic || "");
  const questionType = String(req.body.questionType || "mixed");
  const count = Number(req.body.count || 10);
  const timeLimitMinutes = Number(req.body.timeLimitMinutes || 0);
  const startRaw = String(req.body.difficulty || "adaptive").toLowerCase();
  const availableTopics: string[] = Array.isArray(req.body.availableTopics) ? req.body.availableTopics.map(String).slice(0, 60) : [];
  if (!TECHNOLOGIES.includes(technology)) throw new AppError(`Unsupported technology. Choose one of: ${TECHNOLOGIES.join(", ")}`, 400);
  if (!QUESTION_TYPES.includes(questionType)) throw new AppError(`questionType must be one of: ${QUESTION_TYPES.join(", ")}`, 400);
  if (!Number.isInteger(count) || count < 3 || count > 30) throw new AppError("count must be an integer between 3 and 30", 400);
  if (!Number.isFinite(timeLimitMinutes) || timeLimitMinutes < 0 || timeLimitMinutes > 120) throw new AppError("timeLimitMinutes must be 0-120", 400);
  if (!["adaptive", ...LEVELS].includes(startRaw)) throw new AppError("difficulty must be adaptive, easy, medium or hard", 400);
  if (topic.length > 80) throw new AppError("Invalid topic", 400);

  const profile: any = await TechPerformanceProfile.findOne({ user: req.user._id, technology }).lean();
  const rows = await historyRows(req.user._id, technology);
  const plan: any = buildPlan(rows, topic ? [topic] : undefined);
  // topics the session may rotate through: those the client listed from the technology metadata, else history topics
  plan.availableTopics = availableTopics.length ? availableTopics : Array.from(new Set(rows.map((r) => r.topic)));
  const start: Level = startRaw === "adaptive" ? toLevel(profile?.currentDifficulty, "easy") : (startRaw as Level);

  const attempt = await TechQuizAttempt.create({
    user: req.user._id,
    technology,
    difficulty: startRaw === "adaptive" ? "Adaptive" : CAP[start],
    totalQuestions: count,
    mode: "adaptive",
    questions: [],
    adaptive: {
      topic, questionType, startDifficulty: start, currentDifficulty: start, timeLimitMinutes, nextStatus: "idle",
      lastDecision: startRaw === "adaptive" ? (profile ? `Starting at ${start} from your ${technology} profile.` : "No history yet - starting at easy.") : `Starting at ${start} (your choice).`,
      personalization: plan,
    },
  });
  await kickGeneration(String(attempt._id));
  res.status(201).json({ success: true, data: { attemptId: attempt._id, technology, topic, questionType, count, timeLimitMinutes, startDifficulty: start, personalization: plan } });
});

export const getAdaptiveTechState = asyncHandler(async (req: AuthRequest, res: Response) => {
  const attempt = await loadAdaptive(req);
  const ad = attempt.adaptive;
  const qs = attempt.questions as any[];
  const last = qs.length - 1;
  const current = last >= 0 && !qs[last].answered ? qs[last] : null;
  res.json({
    success: true,
    data: {
      attemptId: attempt._id, status: attempt.status, technology: attempt.technology, topic: ad.topic, questionType: ad.questionType,
      nextStatus: ad.nextStatus, nextError: ad.nextError, totalQuestions: attempt.totalQuestions,
      answered: qs.filter((q) => q.answered).length, correct: qs.filter((q) => q.isCorrect).length,
      currentDifficulty: ad.currentDifficulty, timeLimitMinutes: ad.timeLimitMinutes, startedAt: attempt.startedAt,
      personalization: ad.personalization, currentQuestion: current ? publicQuestion(current, last) : null,
    },
  });
});

export const retryAdaptiveTech = asyncHandler(async (req: AuthRequest, res: Response) => {
  const attempt = await loadAdaptive(req);
  if (attempt.status !== "in-progress") throw new AppError("Session already finished", 400);
  const qs = attempt.questions as any[];
  if ((!qs.length || qs[qs.length - 1].answered) && qs.length < attempt.totalQuestions) await kickGeneration(String(attempt._id));
  res.json({ success: true, data: { nextStatus: "generating" } });
});

export const answerAdaptiveTech = asyncHandler(async (req: AuthRequest, res: Response) => {
  const index = Number(req.body.index);
  const answer = req.body.answer;
  const responseTime = Math.max(0, Math.min(3600, Number(req.body.responseTime) || 0));
  if (!Number.isInteger(index) || index < 0) throw new AppError("index is required", 400);
  if (answer !== null && answer !== undefined && typeof answer !== "number" && typeof answer !== "string") throw new AppError("Invalid answer", 400);
  if (typeof answer === "string" && answer.length > 20000) throw new AppError("Answer is too long", 400);

  const attempt = await loadAdaptive(req);
  if (attempt.status !== "in-progress") throw new AppError("Session already finished", 400);
  const qs = attempt.questions as any[];
  const q = qs[index];
  if (!q || index !== qs.length - 1) throw new AppError("That question is not the current one", 409);
  if (q.answered) throw new AppError("This question has already been answered", 409);

  const skipped = answer === null || answer === undefined || answer === "";
  const ev = skipped
    ? { isCorrect: false, score: 0, correctAnswer: q.record?.question_type === "MCQ" ? q.record.options?.[q.record.correct_option] : q.record?.answer,
        explanation: q.record?.explanation || "", expectedConcepts: q.record?.keywords || [], missingConcepts: q.record?.keywords || [],
        recommendation: `Review ${q.topic}.`, evaluationSource: "skipped" }
    : await evaluate(q.record, answer);
  q.submittedAnswer = skipped ? null : answer;
  q.answered = true;
  q.isCorrect = (ev as any).pending ? null : !!ev.isCorrect;
  q.score = (ev as any).pending ? 0 : ev.score;
  q.responseTime = responseTime;
  q.evaluation = { ...ev, pending: !!(ev as any).pending };
  q.attempts = [{ attemptNumber: 1, answer: q.submittedAnswer, isCorrect: q.isCorrect, score: (ev as any).pending ? null : ev.score, timeTaken: responseTime, createdAt: new Date(), evaluationSource: ev.evaluationSource }];
  if (q.isCorrect) attempt.correctAnswers += 1;
  else if (q.isCorrect === false) attempt.wrongAnswers += 1;

  const ad = attempt.adaptive;
  const decision = nextDifficulty(
    toLevel(ad.currentDifficulty, "easy"),
    qs.filter((x) => x.answered && x.isCorrect !== null).map((x) => ({ topic: x.topic, difficulty: levelOf(x), correct: !!x.isCorrect, responseTime: x.responseTime, expectedTime: 90 }))
  );
  ad.currentDifficulty = decision.level;
  ad.lastDecision = decision.reason;
  const answeredCount = qs.filter((x) => x.answered).length;
  const isLast = answeredCount >= attempt.totalQuestions;
  ad.nextStatus = isLast ? "done" : "idle";
  attempt.markModified("questions");
  attempt.markModified("adaptive");
  await attempt.save();
  await TechQuestionHistory.updateOne({ user: req.user._id, attempt: attempt._id, question: q.questionId }, { $set: { answered: !skipped, correct: q.isCorrect } });
  if (!isLast) await kickGeneration(String(attempt._id));

  res.json({
    success: true,
    data: {
      index, isCorrect: q.isCorrect, pending: !!(ev as any).pending, skipped, score: ev.score, correctAnswer: ev.correctAnswer,
      explanation: ev.explanation, expectedConcepts: ev.expectedConcepts || [], missingConcepts: ev.missingConcepts || [],
      matchedKeywords: ev.matchedKeywords, testCases: ev.testCases, referenceFixedCode: ev.referenceFixedCode,
      recommendation: ev.recommendation, evaluationSource: ev.evaluationSource, weakConcept: q.isCorrect ? null : q.topic,
      adaptation: { ...decision, message: isLast ? "" : ADAPTED_MESSAGE },
      answered: answeredCount, correct: qs.filter((x) => x.isCorrect).length, total: attempt.totalQuestions, isLast,
    },
  });
});

/** Re-grades answers saved while the evaluator was down (bounded; failures leave them pending). */
async function regradePending(attempt: any): Promise<boolean> {
  let changed = false;
  for (const q of attempt.questions as any[]) {
    if (!q.evaluation?.pending || q.submittedAnswer === null) continue;
    const ev = await evaluateTechRecord(q.record, q.submittedAnswer);
    if (!ev || typeof ev.isCorrect !== "boolean") continue;
    q.isCorrect = ev.isCorrect;
    q.score = ev.score;
    q.evaluation = { ...ev, pending: false };
    if (q.attempts?.[0]) q.attempts[0] = { ...q.attempts[0], isCorrect: ev.isCorrect, score: ev.score, evaluationSource: ev.evaluationSource };
    changed = true;
  }
  if (changed) {
    attempt.correctAnswers = attempt.questions.filter((q: any) => q.isCorrect).length;
    attempt.wrongAnswers = attempt.questions.filter((q: any) => q.answered && q.isCorrect === false).length;
    attempt.markModified("questions");
  }
  return changed;
}

async function buildReport(attempt: any, userId: any) {
  const qs = attempt.questions as any[];
  const summary = summarize(qs.map((q) => ({
    topic: q.topic, difficulty: levelOf(q), questionType: q.questionType, answered: q.answered && q.submittedAnswer !== null && q.isCorrect !== null,
    correct: !!q.isCorrect, score: q.score || 0, responseTime: q.responseTime,
  })));
  const previous: any = await TechQuizAttempt.findOne({
    user: userId, technology: attempt.technology, mode: "adaptive", status: "completed", _id: { $ne: attempt._id }, createdAt: { $lt: attempt.createdAt },
  }).sort({ createdAt: -1 }).select("score correctAnswers wrongAnswers").lean();
  const prevAcc = previous && previous.correctAnswers + previous.wrongAnswers ? Math.round((previous.correctAnswers / (previous.correctAnswers + previous.wrongAnswers)) * 100) : 0;
  return {
    attemptId: attempt._id, technology: attempt.technology, status: attempt.status, topic: attempt.adaptive.topic,
    questionType: attempt.adaptive.questionType, startDifficulty: attempt.adaptive.startDifficulty, finalDifficulty: attempt.adaptive.currentDifficulty,
    timeTaken: attempt.timeTaken, summary,
    comparison: compareWithPrevious(summary, previous ? { score: previous.score, accuracy: prevAcc } : null),
    pendingEvaluations: qs.filter((q) => q.evaluation?.pending).length,
    personalizationApplied: attempt.adaptive.personalization,
    nextSession: buildPlan(await historyRows(userId, attempt.technology)),
    sources: qs.reduce((m: Record<string, number>, q) => ({ ...m, [q.source || "unknown"]: (m[q.source || "unknown"] || 0) + 1 }), {}),
    items: qs.map((q, index) => ({
      index, question: q.record?.question || q.questionText, questionType: q.questionType, topic: q.topic, difficulty: q.difficulty,
      options: q.record?.options, code: q.record?.code_snippet || q.record?.buggy_code || "", submittedAnswer: q.submittedAnswer,
      isCorrect: q.isCorrect, score: q.score, evaluation: q.evaluation, source: q.source, verification: q.verification,
      focusArea: q.focusArea, responseTime: q.responseTime, attempts: q.attempts || [], comparison: attemptComparison(q.attempts || []),
      canPractice: attempt.status === "completed" && q.answered && (q.attempts || []).length < MAX_PRACTICE_ATTEMPTS,
    })),
  };
}

export const finishAdaptiveTech = asyncHandler(async (req: AuthRequest, res: Response) => {
  const attempt = await loadAdaptive(req);
  if (attempt.status !== "completed") {
    const qs = attempt.questions as any[];
    await regradePending(attempt);
    const total = attempt.totalQuestions;
    const correct = qs.filter((q) => q.isCorrect).length;
    const byTopic = new Map<string, { correct: number; total: number }>();
    for (const q of qs.filter((x) => x.answered)) {
      const b = byTopic.get(q.topic) || { correct: 0, total: 0 };
      b.total++;
      if (q.isCorrect) b.correct++;
      byTopic.set(q.topic, b);
    }
    attempt.topicScores = Array.from(byTopic.entries()).map(([topic, v]) => ({ topic, ...v, score: Math.round((v.correct / v.total) * 100) }));
    attempt.strengths = attempt.topicScores.filter((t: any) => t.score >= 70).map((t: any) => t.topic);
    attempt.weaknesses = attempt.topicScores.filter((t: any) => t.score < 60).map((t: any) => t.topic);
    attempt.correctAnswers = correct;
    attempt.wrongAnswers = qs.filter((q) => q.answered && q.isCorrect === false).length;
    attempt.unanswered = Math.max(0, total - correct - attempt.wrongAnswers);
    attempt.score = total ? Math.round((correct / total) * 100) : 0;
    attempt.timeTaken = Math.max(0, Math.min(86400, Number(req.body.timeTaken) || 0));
    attempt.status = "completed";
    attempt.completedAt = new Date();
    attempt.adaptive.nextStatus = "done";
    attempt.markModified("adaptive");
    await attempt.save();

    // performance profile: accumulate topic stats and keep the level the session ended at
    const profile: any = (await TechPerformanceProfile.findOne({ user: req.user._id, technology: attempt.technology }))
      || new TechPerformanceProfile({ user: req.user._id, technology: attempt.technology, currentDifficulty: "Easy", topicStats: [] });
    for (const q of qs.filter((x) => x.answered && x.isCorrect !== null)) {
      let s = profile.topicStats.find((t: any) => t.topic === q.topic);
      if (!s) {
        profile.topicStats.push({ topic: q.topic, correct: 0, total: 0 });
        s = profile.topicStats[profile.topicStats.length - 1];
      }
      s.total += 1;
      if (q.isCorrect) s.correct += 1;
      if (q.responseTime) {
        s.responseTimeTotal = (s.responseTimeTotal || 0) + q.responseTime;
        s.timedAnswers = (s.timedAnswers || 0) + 1;
      }
      s.lastSeen = new Date();
    }
    profile.totalAttempts += 1;
    profile.currentDifficulty = CAP[toLevel(attempt.adaptive.currentDifficulty, "easy")];
    await profile.save();
  }
  res.json({ success: true, data: await buildReport(attempt, req.user._id) });
});

export const getAdaptiveTechReport = asyncHandler(async (req: AuthRequest, res: Response) => {
  const attempt = await loadAdaptive(req);
  if (attempt.status !== "completed") throw new AppError("Finish the session to see its report", 400);
  if (await regradePending(attempt)) await attempt.save();
  res.json({ success: true, data: await buildReport(attempt, req.user._id) });
});

export const reattemptAdaptiveTech = asyncHandler(async (req: AuthRequest, res: Response) => {
  const attempt = await loadAdaptive(req);
  if (attempt.status !== "completed") throw new AppError("Practice Again is available once the session is finished", 400);
  const index = Number(req.params.index);
  const q = (attempt.questions as any[])[index];
  if (!Number.isInteger(index) || !q) throw new AppError("Question not found", 404);
  if (!q.answered) throw new AppError("This question was not reached in the session", 400);
  const answer = req.body.answer;
  if (answer === null || answer === undefined || answer === "" || (typeof answer !== "number" && typeof answer !== "string")) throw new AppError("answer is required", 400);
  if (typeof answer === "string" && answer.length > 20000) throw new AppError("Answer is too long", 400);
  const existing = (q.attempts || []).length;
  if (existing >= MAX_PRACTICE_ATTEMPTS) throw new AppError(`At most ${MAX_PRACTICE_ATTEMPTS} attempts per question`, 400);

  const ev = await evaluate(q.record, answer);
  const pending = !!(ev as any).pending;
  const newAttempt = {
    attemptNumber: existing + 1, answer, isCorrect: pending ? null : ev.isCorrect, score: pending ? null : ev.score,
    timeTaken: Math.max(0, Math.min(3600, Number(req.body.timeTaken) || 0)), createdAt: new Date(), evaluationSource: ev.evaluationSource,
    missingConcepts: ev.missingConcepts || [],
  };
  const path = `questions.${index}.attempts`;
  const updated: any = await TechQuizAttempt.findOneAndUpdate(
    { _id: attempt._id, user: req.user._id, [path]: { $size: existing } },
    { $push: { [path]: newAttempt } },
    { new: true }
  );
  if (!updated) throw new AppError("Another attempt was saved at the same time - please try again", 409);
  const attempts = updated.questions[index].attempts;
  res.status(201).json({
    success: true,
    data: {
      attempt: newAttempt, attempts, comparison: attemptComparison(attempts), pending,
      correctAnswer: ev.correctAnswer, explanation: ev.explanation, expectedConcepts: ev.expectedConcepts || [],
      missingConcepts: ev.missingConcepts || [], recommendation: ev.recommendation, weakConcept: ev.isCorrect ? null : q.topic,
    },
  });
});

/** Topic-wise / type-wise progress for one technology across all sessions (classic + adaptive). */
export const getTechProgress = asyncHandler(async (req: AuthRequest, res: Response) => {
  const technology = String(req.query.technology || "");
  if (!TECHNOLOGIES.includes(technology)) throw new AppError("Unknown technology", 400);
  const attempts: any[] = await TechQuizAttempt.find({ user: req.user._id, technology, status: "completed" })
    .sort({ createdAt: 1 }).limit(100).select("questions score createdAt mode").lean();
  const answered = attempts.flatMap((a) => (a.questions || []).filter((q: any) => q.answered && q.isCorrect !== null));
  const summary = summarize(answered.map((q: any) => ({ topic: q.topic, difficulty: levelOf(q), questionType: q.questionType, answered: true, correct: !!q.isCorrect, score: q.score || 0, responseTime: q.responseTime })));
  const profile: any = await TechPerformanceProfile.findOne({ user: req.user._id, technology }).lean();
  res.json({
    success: true,
    data: {
      technology, sessions: attempts.length, currentDifficulty: profile?.currentDifficulty || null,
      summary, plan: buildPlan(answered.map((q: any) => ({ topic: q.topic, correct: !!q.isCorrect }))),
      trend: attempts.map((a) => ({ attemptId: a._id, date: a.createdAt, score: a.score, mode: a.mode || "classic" })),
    },
  });
});
