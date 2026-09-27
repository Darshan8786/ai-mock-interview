/**
 * Adaptive, AI-generated Aptitude practice (one question at a time):
 *
 *   start -> generate Q1 -> student answers -> evaluate (exact, server-side) -> store -> adapt difficulty/topic
 *         -> generate Q(n+1) in the background while the student reads the explanation -> ... -> report
 *
 * Mirrors mockInterviewController: the session is created immediately and question generation runs detached
 * (the client polls GET /state), so a slow model can never block or break the session. Questions come from the local
 * ai-services question engine (v2 model -> validator + deterministic numeric check -> templates -> verified seed bank);
 * if the ai-service is unreachable the backend falls back to the aptitude bank in Mongo. The answer key
 * (servedCorrect) never leaves the server before the student has answered.
 *
 * The classic test/practice flows in aptitudeController.ts are untouched.
 */
import { Response } from "express";
import mongoose from "mongoose";
import { AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { AptitudeAttempt } from "../models/AptitudeAttempt";
import { AptitudeQuestion } from "../models/AptitudeQuestion";
import { AptitudeQuestionHistory } from "../models/AptitudeQuestionHistory";
import { aptitudeTopics } from "../data/aptitudeTopics";
import {
  Level, LEVELS, attemptComparison, buildPlan, chooseTopic, compareWithPrevious, nextDifficulty, summarize, toLevel,
} from "../services/adaptiveEngine";
import { generateAptitudeQuestion, GeneratedAptitude } from "../services/questionEngineClient";

const CATEGORIES = ["Quantitative", "Logical Reasoning", "Verbal Ability", "Data Interpretation"];
const LEVEL_TO_DB: Record<Level, string> = { easy: "beginner", medium: "intermediate", hard: "advanced" };
const MAX_PRACTICE_ATTEMPTS = 10;
const ADAPTED_MESSAGE = "Next question adapted to your performance.";

const shuffle = <T>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const topicsFor = (category: string) => aptitudeTopics.filter((t) => t.category === category).map((t) => t.name);

/** The student's answered history (newest first) as {topic, correct, responseTime} rows. */
async function historyRows(userId: mongoose.Types.ObjectId, limit = 500) {
  const rows = await AptitudeQuestionHistory.aggregate([
    { $match: { user: userId, answered: true } },
    { $sort: { shownAt: -1 } },
    { $limit: limit },
    { $lookup: { from: "aptitudequestions", localField: "question", foreignField: "_id", as: "q" } },
    { $unwind: { path: "$q", preserveNullAndEmptyArrays: true } },
    { $project: { topic: { $ifNull: [{ $cond: [{ $eq: ["$topic", ""] }, "$q.topic", "$topic"] }, "$q.topic"] }, correct: 1, responseTime: 1 } },
  ]);
  return rows.map((r: any) => ({ topic: r.topic || "", correct: !!r.correct, responseTime: r.responseTime ?? null }));
}

/** Texts + ids of questions this student has already been shown (duplicate prevention across sessions). */
async function seenQuestions(userId: mongoose.Types.ObjectId) {
  const rows = await AptitudeQuestionHistory.aggregate([
    { $match: { user: userId } },
    { $sort: { shownAt: -1 } },
    { $limit: 300 },
    { $lookup: { from: "aptitudequestions", localField: "question", foreignField: "_id", as: "q" } },
    { $unwind: "$q" },
    { $project: { _id: "$q._id", text: "$q.question" } },
  ]);
  return { ids: rows.map((r: any) => r._id), texts: rows.map((r: any) => String(r.text || "")) };
}

async function persistGenerated(gen: GeneratedAptitude) {
  if (gen.source === "bank") {
    const existing = await AptitudeQuestion.findOne({ question: gen.question }).select("_id").lean();
    if (existing) return (existing as any)._id;
  }
  const doc = await AptitudeQuestion.create({
    category: CATEGORIES.includes(gen.category) ? gen.category : "Quantitative",
    topic: gen.topic,
    difficulty: LEVEL_TO_DB[toLevel(gen.difficulty)],
    question: gen.question,
    options: gen.options,
    correctAnswer: gen.answer_index,
    explanation: gen.explanation,
    estimatedTime: gen.estimated_time || 60,
    companyTags: (gen.companies || []).map((name) => ({ name, style: "general" })),
    source: gen.source,
    verified: true,
    verification: gen.verification,
    // generated items live outside the curated bank: they never appear in the classic tests / topic counts
    isActive: gen.source === "bank",
  });
  return doc._id;
}

/** Last-resort fallback when the ai-service is down: an unseen, active bank question from Mongo. */
async function dbBankQuestion(userId: mongoose.Types.ObjectId, category: string, topic: string, level: Level, seenIds: any[]) {
  const filters = [
    { topic, difficulty: LEVEL_TO_DB[level] },
    { topic },
    { category, difficulty: LEVEL_TO_DB[level] },
    { category },
  ];
  for (const f of filters) {
    const docs = await AptitudeQuestion.aggregate([
      { $match: { ...f, isActive: true, _id: { $nin: seenIds } } },
      { $sample: { size: 1 } },
    ]);
    if (docs.length) return docs[0];
  }
  const any = await AptitudeQuestion.aggregate([{ $match: { topic, isActive: true } }, { $sample: { size: 1 } }]);
  return any[0] || null;
}

/** Generates the next question for a session and stores it. Detached from requests; never throws. */
async function generateNext(attemptId: string): Promise<void> {
  try {
    const attempt: any = await AptitudeAttempt.findById(attemptId).lean();
    if (!attempt || attempt.status === "completed" || !attempt.adaptive) return;
    const ad = attempt.adaptive;
    if (ad.items.length >= attempt.totalQuestions) {
      await AptitudeAttempt.updateOne({ _id: attemptId }, { $set: { "adaptive.nextStatus": "done" } });
      return;
    }
    const level = toLevel(ad.currentDifficulty, "easy");
    const choice = chooseTopic({
      fixedTopic: ad.topic || undefined,
      candidates: ad.topic ? [ad.topic] : topicsFor(ad.category),
      plan: ad.personalization,
      items: ad.items.map((i: any) => ({ topic: i.topic, answered: i.answered, correct: i.isCorrect })),
    });
    const seen = await seenQuestions(attempt.user);
    const sessionDocs: any[] = await AptitudeQuestion.find({ _id: { $in: ad.items.map((i: any) => i.question) } }).select("question").lean();

    let questionId: any = null;
    let meta = { category: ad.category, topic: choice.topic, level, source: "", verification: "", estimatedTime: 60 };
    const gen = await generateAptitudeQuestion({
      category: ad.category, topic: choice.topic, difficulty: level,
      exclude: seen.texts, session: sessionDocs.map((d) => d.question),
    });
    if (gen && !(gen as any).error && Array.isArray(gen.options) && gen.options.length === 4 && gen.answer_index >= 0) {
      questionId = await persistGenerated(gen);
      meta = { category: gen.category, topic: gen.topic, level: toLevel(gen.difficulty, level), source: gen.source,
               verification: gen.verification, estimatedTime: gen.estimated_time || 60 };
    } else {
      const doc = await dbBankQuestion(attempt.user, ad.category, choice.topic, level, [...seen.ids, ...ad.items.map((i: any) => i.question)]);
      if (doc) {
        questionId = doc._id;
        meta = { category: doc.category, topic: doc.topic, level: toLevel(doc.difficulty, level), source: "bank-db",
                 verification: doc.verified ? "curated" : "human_authored", estimatedTime: doc.estimatedTime || 60 };
      }
    }
    if (!questionId) {
      await AptitudeAttempt.updateOne({ _id: attemptId }, { $set: { "adaptive.nextStatus": "failed", "adaptive.nextError": "No question could be prepared." } });
      return;
    }

    const full: any = await AptitudeQuestion.findById(questionId).lean();
    const order = shuffle(full.options.map((_: string, i: number) => i));
    const servedOptions = order.map((i: number) => full.options[i]);
    const servedCorrect = order.indexOf(full.correctAnswer);
    const item = {
      question: questionId, category: meta.category, topic: meta.topic, difficulty: meta.level, servedOptions, servedCorrect,
      source: meta.source, verification: meta.verification, focusArea: choice.focus ? choice.topic : "",
      topicReason: choice.reason, difficultyReason: ad.lastDecision || `Starting at ${level}.`, estimatedTime: meta.estimatedTime,
      shownAt: new Date(),
    };
    // guarded push: only into a still-running session that has not grown meanwhile
    const pushed = await AptitudeAttempt.updateOne(
      { _id: attemptId, status: "started", "adaptive.items": { $size: ad.items.length } },
      {
        $push: { "adaptive.items": item, questions: { question: questionId, servedOptions, servedCorrect, repeated: false } },
        $set: { "adaptive.nextStatus": "ready", "adaptive.nextError": "" },
      }
    );
    if (pushed.modifiedCount) {
      await AptitudeQuestionHistory.create({
        user: attempt.user, question: questionId, attempt: attempt._id, testType: "adaptive", servedOptions, servedCorrect,
        topic: meta.topic, difficulty: meta.level, source: meta.source,
      });
    }
  } catch (err: any) {
    console.error(`[aptitude-adaptive] generateNext failed for ${attemptId}: ${err?.message}`);
    await AptitudeAttempt.updateOne({ _id: attemptId }, { $set: { "adaptive.nextStatus": "failed", "adaptive.nextError": "Question generation failed." } }).catch(() => {});
  }
}

/** Marks the session as generating (atomically - at most one generation per session) and starts it detached. */
async function kickGeneration(attemptId: string) {
  const claimed = await AptitudeAttempt.updateOne(
    { _id: attemptId, status: "started", "adaptive.nextStatus": { $ne: "generating" } },
    { $set: { "adaptive.nextStatus": "generating" } }
  );
  if (claimed.modifiedCount) void generateNext(attemptId);
}

function publicItem(item: any, index: number, doc: any) {
  return {
    itemIndex: index,
    question: doc?.question || "",
    options: item.servedOptions,
    category: item.category,
    topic: item.topic,
    difficulty: item.difficulty,
    focusArea: item.focusArea,
    topicReason: item.topicReason,
    difficultyReason: item.difficultyReason,
    source: item.source,
    verification: item.verification,
    estimatedTime: item.estimatedTime,
  };
}

async function loadAdaptive(req: AuthRequest) {
  if (!mongoose.isValidObjectId(req.params.attemptId)) throw new AppError("Session not found", 404);
  const attempt: any = await AptitudeAttempt.findOne({ _id: req.params.attemptId, user: req.user._id, mode: "adaptive" });
  if (!attempt) throw new AppError("Session not found", 404);
  return attempt;
}

// ── Endpoints ────────────────────────────────────────────────────────────────

/** What the next adaptive session in this category/topic will be tailored to (shown before starting). */
export const getAdaptivePersonalization = asyncHandler(async (req: AuthRequest, res: Response) => {
  const category = String(req.query.category || "");
  const topic = String(req.query.topic || "");
  const allowed = topic ? [topic] : CATEGORIES.includes(category) ? topicsFor(category) : undefined;
  res.json({ status: "success", data: buildPlan(await historyRows(req.user._id), allowed) });
});

export const startAdaptiveAptitude = asyncHandler(async (req: AuthRequest, res: Response) => {
  const category = String(req.body.category || "");
  const topic = String(req.body.topic || "");
  const count = Number(req.body.count || 10);
  const timeLimitMinutes = Number(req.body.timeLimitMinutes || 0);
  const startRaw = String(req.body.difficulty || "adaptive").toLowerCase();
  if (!CATEGORIES.includes(category)) throw new AppError(`category must be one of: ${CATEGORIES.join(", ")}`, 400);
  if (topic && !topicsFor(category).includes(topic)) throw new AppError("Unknown topic for this category", 400);
  if (!Number.isInteger(count) || count < 3 || count > 30) throw new AppError("count must be an integer between 3 and 30", 400);
  if (!Number.isFinite(timeLimitMinutes) || timeLimitMinutes < 0 || timeLimitMinutes > 120) throw new AppError("timeLimitMinutes must be 0-120", 400);
  if (!["adaptive", ...LEVELS].includes(startRaw)) throw new AppError("difficulty must be adaptive, easy, medium or hard", 400);

  const rows = await historyRows(req.user._id);
  const plan = buildPlan(rows, topic ? [topic] : topicsFor(category));
  // "adaptive" starts where the student's history suggests (easy with no history), otherwise the chosen level
  const topicAcc = rows.filter((r) => (topic ? r.topic === topic : topicsFor(category).includes(r.topic)));
  const acc = topicAcc.length >= 5 ? topicAcc.filter((r) => r.correct).length / topicAcc.length : null;
  const start: Level = startRaw === "adaptive" ? (acc === null ? "easy" : acc >= 0.8 ? "hard" : acc >= 0.5 ? "medium" : "easy") : (startRaw as Level);

  const attempt = await AptitudeAttempt.create({
    user: req.user._id,
    mode: "adaptive",
    status: "started",
    testType: "adaptive",
    difficulty: startRaw,
    title: `${topic || category} - Adaptive Practice`,
    marksPerQuestion: 1,
    negativeMarksPerQuestion: 0,
    passingScore: 50,
    totalQuestions: count,
    startedAt: new Date(),
    adaptive: {
      category, topic, startDifficulty: start, currentDifficulty: start, timeLimitMinutes, nextStatus: "idle",
      lastDecision: startRaw === "adaptive" ? (acc === null ? "No history yet - starting at easy." : `Starting at ${start} from your history (${Math.round(acc * 100)}% accuracy).`) : `Starting at ${start} (your choice).`,
      personalization: plan,
      items: [],
    },
  });
  await kickGeneration(String(attempt._id));
  res.status(201).json({
    status: "success",
    data: { attemptId: attempt._id, category, topic, count, timeLimitMinutes, startDifficulty: start, personalization: plan },
  });
});

export const getAdaptiveAptitudeState = asyncHandler(async (req: AuthRequest, res: Response) => {
  const attempt = await loadAdaptive(req);
  const ad = attempt.adaptive;
  const answered = ad.items.filter((i: any) => i.answered).length;
  const lastIdx = ad.items.length - 1;
  const current = lastIdx >= 0 && !ad.items[lastIdx].answered ? ad.items[lastIdx] : null;
  const doc = current ? await AptitudeQuestion.findById(current.question).select("question").lean() : null;
  res.json({
    status: "success",
    data: {
      attemptId: attempt._id,
      status: attempt.status,
      nextStatus: ad.nextStatus,
      nextError: ad.nextError,
      category: ad.category,
      topic: ad.topic,
      totalQuestions: attempt.totalQuestions,
      answered,
      correct: ad.items.filter((i: any) => i.isCorrect).length,
      currentDifficulty: ad.currentDifficulty,
      timeLimitMinutes: ad.timeLimitMinutes,
      startedAt: attempt.startedAt,
      personalization: ad.personalization,
      currentQuestion: current ? publicItem(current, lastIdx, doc) : null,
    },
  });
});

export const retryAdaptiveAptitude = asyncHandler(async (req: AuthRequest, res: Response) => {
  const attempt = await loadAdaptive(req);
  if (attempt.status !== "started") throw new AppError("Session already finished", 400);
  const ad = attempt.adaptive;
  const pending = ad.items.length && !ad.items[ad.items.length - 1].answered;
  if (!pending && ad.items.length < attempt.totalQuestions) await kickGeneration(String(attempt._id));
  res.json({ status: "success", data: { nextStatus: "generating" } });
});

export const answerAdaptiveAptitude = asyncHandler(async (req: AuthRequest, res: Response) => {
  const itemIndex = Number(req.body.itemIndex);
  const selected = req.body.selected === null || req.body.selected === undefined ? null : Number(req.body.selected);
  const responseTime = Math.max(0, Math.min(3600, Number(req.body.responseTime) || 0));
  if (!Number.isInteger(itemIndex) || itemIndex < 0) throw new AppError("itemIndex is required", 400);
  if (selected !== null && !(Number.isInteger(selected) && selected >= 0 && selected <= 5)) throw new AppError("selected must be an option index or null", 400);

  const attempt = await loadAdaptive(req);
  if (attempt.status !== "started") throw new AppError("Session already finished", 400);
  const ad = attempt.adaptive;
  const item = ad.items[itemIndex];
  if (!item || itemIndex !== ad.items.length - 1) throw new AppError("That question is not the current one", 409);
  if (item.answered) throw new AppError("This question has already been answered", 409);

  const isCorrect = selected !== null && selected === item.servedCorrect;
  item.answered = true;
  item.selected = selected;
  item.isCorrect = isCorrect;
  item.responseTime = responseTime;
  item.answeredAt = new Date();
  item.attempts = [{ attemptNumber: 1, selectedText: selected === null ? "" : item.servedOptions[selected] || "", isCorrect, score: isCorrect ? 100 : 0, timeTaken: responseTime }];

  const decision = nextDifficulty(
    toLevel(ad.currentDifficulty, "easy"),
    ad.items.filter((i: any) => i.answered).map((i: any) => ({
      topic: i.topic, difficulty: toLevel(i.difficulty), correct: i.isCorrect, responseTime: i.responseTime, expectedTime: i.estimatedTime,
    }))
  );
  ad.currentDifficulty = decision.level;
  ad.lastDecision = decision.reason;
  const answeredCount = ad.items.filter((i: any) => i.answered).length;
  const isLast = answeredCount >= attempt.totalQuestions;
  ad.nextStatus = isLast ? "done" : "idle";
  attempt.markModified("adaptive");
  await attempt.save();

  await AptitudeQuestionHistory.updateOne(
    { user: req.user._id, question: item.question, attempt: attempt._id },
    { $set: { answered: selected !== null, selected, correct: isCorrect, responseTime, topic: item.topic, difficulty: item.difficulty } }
  );
  if (!isLast) await kickGeneration(String(attempt._id));

  const doc: any = await AptitudeQuestion.findById(item.question).select("explanation").lean();
  res.json({
    status: "success",
    data: {
      itemIndex,
      isCorrect,
      skipped: selected === null,
      correctIndex: item.servedCorrect,
      correctOption: item.servedOptions[item.servedCorrect],
      explanation: doc?.explanation || "",
      topic: item.topic,
      weakConcept: isCorrect ? null : item.topic,
      recommendation: isCorrect ? `Good - ${item.topic} at ${item.difficulty} is under control.` : `Revisit ${item.topic}: read the working above, then use Practice Again from the report.`,
      adaptation: { ...decision, message: isLast ? "" : ADAPTED_MESSAGE },
      answered: answeredCount,
      correct: ad.items.filter((i: any) => i.isCorrect).length,
      total: attempt.totalQuestions,
      isLast,
    },
  });
});

async function buildReport(attempt: any, userId: mongoose.Types.ObjectId) {
  const ad = attempt.adaptive;
  const docs: any[] = await AptitudeQuestion.find({ _id: { $in: ad.items.map((i: any) => i.question) } }).lean();
  const byId = new Map(docs.map((d) => [String(d._id), d]));
  const summary = summarize(ad.items.map((i: any) => ({
    topic: i.topic, difficulty: toLevel(i.difficulty), answered: i.answered && i.selected !== null, correct: i.isCorrect,
    score: i.isCorrect ? 100 : 0, responseTime: i.responseTime,
  })));
  const previous: any = await AptitudeAttempt.findOne({
    user: userId, mode: "adaptive", status: "completed", _id: { $ne: attempt._id },
    "adaptive.category": ad.category, "adaptive.topic": ad.topic, createdAt: { $lt: attempt.createdAt },
  }).sort({ createdAt: -1 }).select("score accuracy createdAt").lean();
  const allowed = ad.topic ? [ad.topic] : topicsFor(ad.category);
  return {
    attemptId: attempt._id,
    title: attempt.title,
    status: attempt.status,
    category: ad.category,
    topic: ad.topic,
    startDifficulty: ad.startDifficulty,
    finalDifficulty: ad.currentDifficulty,
    timeTaken: attempt.timeTaken,
    summary,
    comparison: compareWithPrevious(summary, previous),
    personalizationApplied: ad.personalization,
    nextSession: buildPlan(await historyRows(userId), allowed),
    sources: ad.items.reduce((m: Record<string, number>, i: any) => ({ ...m, [i.source || "unknown"]: (m[i.source || "unknown"] || 0) + 1 }), {}),
    items: ad.items.map((i: any, idx: number) => {
      const d = byId.get(String(i.question)) || {};
      return {
        itemIndex: idx,
        question: d.question || "",
        options: i.servedOptions,
        selected: i.selected,
        correct: i.servedCorrect,
        isCorrect: i.isCorrect,
        answered: i.answered,
        explanation: d.explanation || "",
        topic: i.topic,
        difficulty: i.difficulty,
        focusArea: i.focusArea,
        source: i.source,
        verification: i.verification,
        responseTime: i.responseTime,
        attempts: i.attempts || [],
        comparison: attemptComparison(i.attempts || []),
        canPractice: attempt.status === "completed" && i.answered && (i.attempts || []).length < MAX_PRACTICE_ATTEMPTS,
      };
    }),
  };
}

export const finishAdaptiveAptitude = asyncHandler(async (req: AuthRequest, res: Response) => {
  const attempt = await loadAdaptive(req);
  if (attempt.status !== "completed") {
    const ad = attempt.adaptive;
    const items = ad.items;
    const correct = items.filter((i: any) => i.isCorrect).length;
    const wrong = items.filter((i: any) => i.answered && i.selected !== null && !i.isCorrect).length;
    const total = attempt.totalQuestions;
    attempt.status = "completed";
    attempt.correctAnswers = correct;
    attempt.wrongAnswers = wrong;
    attempt.unattempted = Math.max(0, total - correct - wrong);
    attempt.score = total ? Math.round((correct / total) * 100) : 0;
    attempt.accuracy = correct + wrong ? Math.round((correct / (correct + wrong)) * 100) : 0;
    attempt.marks = correct;
    attempt.timeTaken = Math.max(0, Math.min(86400, Number(req.body.timeTaken) || 0));
    attempt.tabWarnings = Math.max(0, Number(req.body.tabWarnings) || 0);
    attempt.terminationReason = ["TIME_LIMIT_REACHED", "TAB_SWITCH_LIMIT_EXCEEDED"].includes(req.body.terminationReason) ? req.body.terminationReason : "";
    attempt.completedAt = new Date();
    ad.nextStatus = "done";
    attempt.categoryScores = [{ category: ad.category, score: attempt.score, correct, total }];
    attempt.answers = items.map((i: any) => ({ question: String(i.question), selected: i.selected ?? undefined, correct: i.servedCorrect, isCorrect: i.isCorrect, category: i.category }));
    attempt.markModified("adaptive");
    await attempt.save();
  }
  res.json({ status: "success", data: await buildReport(attempt, req.user._id) });
});

export const getAdaptiveAptitudeReport = asyncHandler(async (req: AuthRequest, res: Response) => {
  const attempt = await loadAdaptive(req);
  if (attempt.status !== "completed") throw new AppError("Finish the session to see its report", 400);
  res.json({ status: "success", data: await buildReport(attempt, req.user._id) });
});

/** Practice Again on one question of a finished session: a new attempt is appended, attempt 1 is never overwritten. */
export const reattemptAdaptiveAptitude = asyncHandler(async (req: AuthRequest, res: Response) => {
  const attempt = await loadAdaptive(req);
  if (attempt.status !== "completed") throw new AppError("Practice Again is available once the session is finished", 400);
  const idx = Number(req.params.itemIndex);
  const item = attempt.adaptive.items[idx];
  if (!Number.isInteger(idx) || !item) throw new AppError("Question not found", 404);
  if (!item.answered) throw new AppError("This question was not reached in the session", 400);
  const selectedText = String(req.body.selectedText ?? "");
  if (!item.servedOptions.includes(selectedText)) throw new AppError("selectedText must be one of the options", 400);
  const existing = (item.attempts || []).length;
  if (existing >= MAX_PRACTICE_ATTEMPTS) throw new AppError(`At most ${MAX_PRACTICE_ATTEMPTS} attempts per question`, 400);

  const isCorrect = selectedText === item.servedOptions[item.servedCorrect];
  const newAttempt = {
    attemptNumber: existing + 1, selectedText, isCorrect, score: isCorrect ? 100 : 0,
    timeTaken: Math.max(0, Math.min(3600, Number(req.body.timeTaken) || 0)), createdAt: new Date(),
  };
  const path = `adaptive.items.${idx}.attempts`;
  const updated: any = await AptitudeAttempt.findOneAndUpdate(
    { _id: attempt._id, user: req.user._id, [path]: { $size: existing } },
    { $push: { [path]: newAttempt } },
    { new: true }
  );
  if (!updated) throw new AppError("Another attempt was saved at the same time - please try again", 409);
  const attempts = updated.adaptive.items[idx].attempts;
  const doc: any = await AptitudeQuestion.findById(item.question).select("explanation").lean();
  res.status(201).json({
    status: "success",
    data: {
      attempt: newAttempt,
      attempts,
      comparison: attemptComparison(attempts),
      correctOption: item.servedOptions[item.servedCorrect],
      explanation: doc?.explanation || "",
      weakConcept: isCorrect ? null : item.topic,
      recommendation: isCorrect ? `Recovered - try a new ${item.topic} session to confirm.` : `Still tricky: re-read the working and practise more ${item.topic}.`,
    },
  });
});
