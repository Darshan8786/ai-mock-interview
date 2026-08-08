import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { AptitudeAttempt } from "../models/AptitudeAttempt";
import { AptitudeQuestion } from "../models/AptitudeQuestion";
import { AptitudeTopic } from "../models/AptitudeTopic";
import { AptitudeTestConfig } from "../models/AptitudeTestConfig";
import { AptitudeQuestionHistory } from "../models/AptitudeQuestionHistory";
import mongoose from "mongoose";

const CATEGORIES = ["Quantitative", "Logical Reasoning", "Verbal Ability", "Data Interpretation"];

/** Strip the correct answer & explanation from a question before it reaches the student. */
const toPublicQuestion = (q: any, options?: string[]) => ({
  id: q._id,
  category: q.category,
  topic: q.topic,
  subtopic: q.subtopic,
  difficulty: q.difficulty,
  question: q.question,
  options: options || q.options,
  estimatedTime: q.estimatedTime,
  companyTags: q.companyTags,
});

const shuffle = (arr: any[]) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

/** Randomize option order and return the new option array + the correct index in that order. */
const randomizeQuestion = (q: any) => {
  const indices = q.options.map((_: any, i: number) => i);
  const order = shuffle(indices);
  return {
    servedOptions: order.map((i: number) => q.options[i]),
    servedCorrect: order.indexOf(q.correctAnswer),
  };
};

const objectId = (s: any) => new mongoose.Types.ObjectId(String(s));

/**
 * Select up to `needed` questions for a user from a filter, applying the
 * no-repeat rule (never re-show a question until the matching pool is
 * exhausted). When the unseen pool is too small it first relaxes the topic
 * filter (related questions in the same category), then reuses the questions
 * the user saw the longest time ago, marking them as repeated.
 */
const selectQuestions = async (
  userId: mongoose.Types.ObjectId,
  filter: Record<string, any>,
  needed: number
): Promise<{ questions: any[]; repeated: boolean }> => {
  if (needed <= 0) return { questions: [], repeated: false };
  const seenIds = await AptitudeQuestionHistory.distinct("question", { user: userId });

  let base: any[] = await AptitudeQuestion.find({
    ...filter,
    _id: { $nin: seenIds },
    isActive: true,
  }).lean();

  if (base.length < needed) {
    const relaxed = { ...filter };
    delete relaxed.topic;
    const wider: any[] = await AptitudeQuestion.find({
      ...relaxed,
      _id: { $nin: seenIds },
      isActive: true,
    }).lean();
    if (wider.length > base.length) base = wider;
  }

  let repeated = false;
  let reused: any[] = [];
  if (base.length < needed) {
    const oldHistory: any[] = await AptitudeQuestionHistory.find({ user: userId })
      .sort({ shownAt: 1 })
      .select("question")
      .lean();
    const oldIds = oldHistory.map((h) => h.question);
    if (oldIds.length) {
      const seenQ: any[] = await AptitudeQuestion.find({
        ...filter,
        _id: { $in: oldIds },
        isActive: true,
      }).lean();
      if (seenQ.length) {
        const shownAtById = new Map(oldHistory.map((h) => [h.question.toString(), h.shownAt.getTime()]));
        seenQ.sort(
          (a, b) =>
            (shownAtById.get(a._id.toString()) || 0) - (shownAtById.get(b._id.toString()) || 0)
        );
        reused = seenQ.slice(0, needed - base.length);
        repeated = true;
      }
    }
  }

  const questions = [...shuffle(base), ...reused].slice(0, needed);
  return { questions, repeated };
};

/** Persist "shown" rows immediately so abandoned tests never re-serve the same questions. */
const recordShown = async (
  userId: mongoose.Types.ObjectId,
  attemptId: mongoose.Types.ObjectId | null,
  testType: string,
  prepared: { doc: any; servedOptions: string[]; servedCorrect: number; repeated: boolean }[]
) => {
  if (!prepared.length) return;
  await AptitudeQuestionHistory.insertMany(
    prepared.map((p) => ({
      user: userId,
      question: p.doc._id,
      attempt: attemptId,
      testType,
      servedOptions: p.servedOptions,
      servedCorrect: p.servedCorrect,
      repeated: p.repeated,
    }))
  );
};

/** Resolve the drawing/meta config for a test/practice start request. */
const resolveStartMeta = async (body: any) => {
  const cap = (n: number) => Math.min(50, Math.max(1, Number(n) || 10));

  if (body.testId) {
    const test: any = await AptitudeTestConfig.findById(body.testId).lean();
    if (!test || !test.isActive) throw new AppError("Test not found", 404);
    const filter: Record<string, any> = { isActive: true };
    if (test.category) filter.category = test.category;
    if (test.topics?.length) filter.topic = { $in: test.topics };
    if (test.difficulty) filter.difficulty = test.difficulty;
    return {
      testType: test.testType || "mock",
      title: test.title,
      durationMinutes: test.durationMinutes || 20,
      marksPerQuestion: test.marksPerQuestion ?? 1,
      negativeMarksPerQuestion: test.negativeMarksPerQuestion || 0,
      passingScore: test.passingScore ?? 50,
      filter,
      count: test.questionCount || 20,
      difficulty: test.difficulty || "",
      curatedIds: test.questionIds?.length ? test.questionIds : null,
    };
  }

  const mode = body.mode || "practice";

  if (mode === "mixed") {
    const dist = body.distribution && typeof body.distribution === "object"
      ? body.distribution
      : { Quantitative: 5, "Logical Reasoning": 5, "Verbal Ability": 5, "Data Interpretation": 5 };
    const count = CATEGORIES.reduce((sum, c) => sum + (Number(dist[c]) || 0), 0);
    return {
      testType: "mixed",
      title: "Mixed Aptitude Test",
      durationMinutes: Math.max(5, Math.ceil(count / 1.5)),
      marksPerQuestion: 1,
      negativeMarksPerQuestion: 0.25,
      passingScore: 50,
      filter: { isActive: true },
      count: Math.max(1, count),
      difficulty: "",
      curatedIds: null,
      distribution: dist,
    };
  }

  if (mode === "daily") {
    const count = cap(body.count || 20);
    return {
      testType: "daily",
      title: "Daily Aptitude Test",
      durationMinutes: Math.max(5, Math.ceil(count / 1.5)),
      marksPerQuestion: 1,
      negativeMarksPerQuestion: 0.25,
      passingScore: 50,
      filter: { isActive: true },
      count,
      difficulty: "",
      curatedIds: null,
      distribution: equalSplit(count),
    };
  }

  if (mode === "company") {
    if (!body.tag) throw new AppError("tag is required for company practice", 400);
    return {
      testType: "company",
      title: `${body.tag} Practice`,
      durationMinutes: Math.max(5, Math.ceil(cap(body.count || 10) / 1.5)),
      marksPerQuestion: 1,
      negativeMarksPerQuestion: 0.25,
      passingScore: 50,
      filter: { isActive: true, "companyTags.name": body.tag },
      count: cap(body.count || 10),
      difficulty: "",
      curatedIds: null,
      distribution: null,
    };
  }

  if (mode === "difficulty") {
    if (!body.difficulty) throw new AppError("difficulty is required", 400);
    return {
      testType: "difficulty",
      title: `${body.difficulty} Difficulty Test`,
      durationMinutes: Math.max(5, Math.ceil(cap(body.count || 10) / 1.5)),
      marksPerQuestion: 1,
      negativeMarksPerQuestion: 0.25,
      passingScore: 50,
      filter: { isActive: true, difficulty: body.difficulty },
      count: cap(body.count || 10),
      difficulty: body.difficulty,
      curatedIds: null,
      distribution: null,
    };
  }

  // mode === "practice"
  const filter: Record<string, any> = { isActive: true };
  if (body.category) filter.category = body.category;
  if (body.topic) filter.topic = body.topic;
  if (body.difficulty) filter.difficulty = body.difficulty;
  if (body.tag) filter["companyTags.name"] = body.tag;
  return {
    testType: "practice",
    title: body.topic ? `${body.topic} Practice` : body.category ? `${body.category} Practice` : "Practice Session",
    durationMinutes: Math.max(5, Math.ceil(cap(body.count || 10) / 1.5)),
    marksPerQuestion: 1,
    negativeMarksPerQuestion: 0,
    passingScore: 50,
    filter,
    count: cap(body.count || 10),
    difficulty: body.difficulty || "",
    curatedIds: null,
    distribution: null,
  };
};

const equalSplit = (count: number): Record<string, number> => {
  const per = Math.floor(count / 4);
  let rem = count % 4;
  return {
    Quantitative: per + (rem-- > 0 ? 1 : 0),
    "Logical Reasoning": per + (rem-- > 0 ? 1 : 0),
    "Verbal Ability": per + (rem-- > 0 ? 1 : 0),
    "Data Interpretation": per,
  };
};

/** Draw + randomize + persist "shown" history. Used by both start and legacy endpoints. */
const prepareSession = async (
  user: any,
  meta: any
): Promise<{ prepared: any[]; poolSize: number; repeated: boolean }> => {
  let docs: any[] = [];
  let repeated = false;
  let poolSize = 0;

  if (meta.curatedIds?.length) {
    docs = await AptitudeQuestion.find({ _id: { $in: meta.curatedIds }, isActive: true }).lean();
  } else if (meta.distribution) {
    for (const category of CATEGORIES) {
      const n = Number(meta.distribution[category]) || 0;
      if (n <= 0) continue;
      const { questions, repeated: rep } = await selectQuestions(user._id, { isActive: true, category }, n);
      docs.push(...questions);
      if (rep) repeated = true;
    }
  } else {
    const { questions, repeated: rep } = await selectQuestions(user._id, meta.filter, meta.count);
    docs = questions;
    repeated = rep;
  }

  poolSize = docs.length;
  const prepared = docs.map((doc) => {
    const { servedOptions, servedCorrect } = randomizeQuestion(doc);
    return { doc, servedOptions, servedCorrect, repeated };
  });
  return { prepared, poolSize, repeated };
};

// ── Unified test/practice session ────────────────────────

export const startAptitudeTest = asyncHandler(async (req: AuthRequest, res: Response) => {
  const meta = await resolveStartMeta(req.body || {});
  const { prepared, poolSize } = await prepareSession(req.user, meta);

  const attempt = await AptitudeAttempt.create({
    user: req.user._id,
    status: "started",
    testType: meta.testType,
    difficulty: meta.difficulty,
    title: meta.title,
    marksPerQuestion: meta.marksPerQuestion,
    negativeMarksPerQuestion: meta.negativeMarksPerQuestion,
    passingScore: meta.passingScore,
    totalQuestions: prepared.length,
    questions: prepared.map((p) => ({
      question: p.doc._id,
      servedOptions: p.servedOptions,
      servedCorrect: p.servedCorrect,
      repeated: p.repeated,
    })),
    startedAt: new Date(),
  });

  await recordShown(req.user._id, attempt._id, meta.testType, prepared);

  res.status(201).json({
    status: "success",
    data: {
      attemptId: attempt._id,
      test: {
        title: meta.title,
        testType: meta.testType,
        difficulty: meta.difficulty,
        durationMinutes: meta.durationMinutes,
        marksPerQuestion: meta.marksPerQuestion,
        negativeMarksPerQuestion: meta.negativeMarksPerQuestion,
        passingScore: meta.passingScore,
        count: prepared.length,
      },
      poolSize,
      repeatedIds: prepared.filter((p) => p.repeated).map((p) => p.doc._id),
      questions: prepared.map((p) => toPublicQuestion(p.doc, p.servedOptions)),
    },
  });
});

export const getActiveAttempt = asyncHandler(async (req: AuthRequest, res: Response) => {
  const attempt: any = await AptitudeAttempt.findOne({
    _id: req.params.attemptId,
    user: req.user._id,
  }).lean();
  if (!attempt) throw new AppError("Attempt not found", 404);
  if (attempt.status === "completed") throw new AppError("Attempt already completed", 409);

  const byId = new Map<string, any>(attempt.questions.map((s: any) => [s.question.toString(), s]));
  const docs: any[] = await AptitudeQuestion.find({
    _id: { $in: attempt.questions.map((s: any) => s.question) },
    isActive: true,
  }).lean();

  res.json({
    status: "success",
    data: {
      attemptId: attempt._id,
      test: {
        title: attempt.title,
        testType: attempt.testType,
        difficulty: attempt.difficulty,
        durationMinutes: Math.ceil((attempt.totalQuestions || 0) / 1.5),
        marksPerQuestion: attempt.marksPerQuestion,
        negativeMarksPerQuestion: attempt.negativeMarksPerQuestion,
        passingScore: attempt.passingScore,
        count: attempt.totalQuestions,
      },
      questions: docs.map((d: any) => {
        const s = byId.get(d._id.toString());
        return toPublicQuestion(d, s?.servedOptions || d.options);
      }),
    },
  });
});

export const submitAptitudeTest = asyncHandler(async (req: AuthRequest, res: Response) => {
  const attempt: any = await AptitudeAttempt.findOne({
    _id: req.params.attemptId,
    user: req.user._id,
  }).lean();
  if (!attempt) throw new AppError("Attempt not found", 404);

  if (attempt.status === "completed") {
    return res.json({ status: "success", data: buildResultResponse(attempt, attempt.questions || []) });
  }

  const answers: Record<string, number> = req.body.answers || {};
  const timeTaken = Number(req.body.timeTaken || 0);
  const tabWarnings = Number(req.body.tabWarnings || 0);

  const byId = new Map<string, any>(attempt.questions.map((s: any) => [s.question.toString(), s]));
  const docs: any[] = await AptitudeQuestion.find({
    _id: { $in: attempt.questions.map((s: any) => s.question) },
    isActive: true,
  }).lean();
  const fullById = new Map<string, any>(docs.map((d: any) => [d._id.toString(), d]));

  const scored = scoreSession(attempt, answers, byId, fullById);
  const attemptDoc = await AptitudeAttempt.findByIdAndUpdate(
    attempt._id,
    {
      status: "completed",
      correctAnswers: scored.correct,
      wrongAnswers: scored.wrong,
      unattempted: scored.unattempted,
      score: scored.score,
      accuracy: scored.accuracy,
      marks: scored.marks,
      timeTaken,
      tabWarnings,
      completedAt: new Date(),
      categoryScores: scored.categoryScores,
      answers: scored.review.map((r: any) => ({
        question: r.question,
        selected: r.selected,
        correct: r.correct,
        isCorrect: r.isCorrect,
        category: r.category,
      })),
    },
    { new: true }
  ).lean();

  await markHistoryAnswered(req.user._id, attempt._id, answers, byId);

  res.status(200).json({
    status: "success",
    data: buildResultResponse(attemptDoc, attempt.questions || [], { answers, timeTaken, tabWarnings }),
  });
});

const scoreSession = (attempt: any, answers: Record<string, number>, byId: Map<string, any>, fullById: Map<string, any>) => {
  let correct = 0;
  let wrong = 0;
  let unattempted = 0;

  const review = attempt.questions.map((s: any) => {
    const id = s.question.toString();
    const fullQ = fullById.get(id) || { category: "", topic: "", question: "" };
    const selected = answers[id];
    const isCorrect = selected !== undefined && selected === s.servedCorrect;
    if (selected === undefined) unattempted++;
    else if (isCorrect) correct++;
    else wrong++;
    return {
      id,
      question: fullQ.question || s.question,
      category: fullQ.category || "",
      topic: fullQ.topic || "",
      difficulty: fullQ.difficulty || "",
      options: s.servedOptions,
      selected: selected === undefined ? undefined : selected,
      correct: s.servedCorrect,
      isCorrect,
      explanation: fullQ.explanation || "",
    };
  });

  const totalQuestions = attempt.questions.length;
  const answered = correct + wrong;
  const marks = correct * (attempt.marksPerQuestion ?? 1) - wrong * (attempt.negativeMarksPerQuestion ?? 0);
  const score = totalQuestions ? Math.round((correct / totalQuestions) * 100) : 0;
  const accuracy = answered ? Math.round((correct / answered) * 100) : 0;

  const categoryScores = CATEGORIES.map((category) => {
    const qs = review.filter((r: any) => r.category === category);
    const done = qs.filter((r: any) => r.isCorrect).length;
    return {
      category,
      score: qs.length ? Math.round((done / qs.length) * 100) : 0,
      correct: done,
      total: qs.length,
    };
  });

  return { correct, wrong, unattempted, score, accuracy, marks, totalQuestions, categoryScores, review };
};

const buildResultResponse = (attempt: any, snapshots: any[], extra?: { answers: Record<string, number>; timeTaken: number; tabWarnings: number }) => {
  const answers = extra?.answers || {};
  const byId = new Map(snapshots.map((s: any) => [s.question.toString(), s]));
  const review = snapshots.map((s: any) => {
    const selected = answers[s.question.toString()];
    return {
      id: s.question.toString(),
      question: "",
      category: "",
      topic: "",
      difficulty: "",
      options: s.servedOptions,
      selected: selected === undefined ? undefined : selected,
      correct: s.servedCorrect,
      isCorrect: selected !== undefined && selected === s.servedCorrect,
      explanation: "",
    };
  });
  return {
    attemptId: attempt._id,
    totalQuestions: attempt.totalQuestions,
    correctAnswers: attempt.correctAnswers,
    wrongAnswers: attempt.wrongAnswers,
    unattempted: attempt.unattempted,
    score: attempt.score,
    accuracy: attempt.accuracy,
    marks: attempt.marks,
    marksPerQuestion: attempt.marksPerQuestion ?? 1,
    negativeMarksPerQuestion: attempt.negativeMarksPerQuestion ?? 0,
    passingScore: attempt.passingScore ?? 50,
    passed: (attempt.score ?? 0) >= (attempt.passingScore ?? 50),
    timeTaken: extra?.timeTaken ?? attempt.timeTaken,
    tabWarnings: extra?.tabWarnings ?? attempt.tabWarnings,
    categoryScores: attempt.categoryScores || [],
    questions: review,
  };
};

const markHistoryAnswered = async (
  userId: mongoose.Types.ObjectId,
  attemptId: mongoose.Types.ObjectId,
  answers: Record<string, number>,
  byId: Map<string, any>
) => {
  const entries = Object.entries(answers);
  if (!entries.length) return;
  for (const [qid, selected] of entries) {
    const snap = byId.get(qid);
    if (!snap) continue;
    await AptitudeQuestionHistory.updateMany(
      { user: userId, attempt: attemptId, question: objectId(qid) },
      { answered: true, selected, correct: selected === snap.servedCorrect }
    );
  }
};

// ── Progress & history ───────────────────────────────────

export const getAptitudeProgress = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user._id;
  const history = await AptitudeQuestionHistory.aggregate([
    { $match: { user: userId } },
    {
      $lookup: {
        from: "aptitudequestions",
        localField: "question",
        foreignField: "_id",
        as: "q",
      },
    },
    { $unwind: { path: "$q", preserveNullAndEmptyArrays: true } },
  ]);

  const seenIds = new Set<string>();
  let answered = 0;
  let correct = 0;
  const topicMap = new Map<string, { answered: number; correct: number }>();
  const diffMap = new Map<string, { answered: number; correct: number }>();

  history.forEach((h: any) => {
    seenIds.add(h.question.toString());
    if (h.answered) {
      answered++;
      if (h.correct) correct++;
    }
    const topic = h.q?.topic || "Unknown";
    const diff = h.q?.difficulty || "unknown";
    topicMap.set(topic, {
      answered: (topicMap.get(topic)?.answered || 0) + (h.answered ? 1 : 0),
      correct: (topicMap.get(topic)?.correct || 0) + (h.correct ? 1 : 0),
    });
    diffMap.set(diff, {
      answered: (diffMap.get(diff)?.answered || 0) + (h.answered ? 1 : 0),
      correct: (diffMap.get(diff)?.correct || 0) + (h.correct ? 1 : 0),
    });
  });

  const toAccuracy = (x: { answered: number; correct: number }) =>
    x.answered ? Math.round((x.correct / x.answered) * 100) : 0;

  const topicWise = Array.from(topicMap.entries()).map(([topic, v]) => ({
    topic,
    answered: v.answered,
    correct: v.correct,
    accuracy: toAccuracy(v),
    weak: v.answered > 0 && toAccuracy(v) < 60,
  }));
  const difficultyWise = Array.from(diffMap.entries()).map(([difficulty, v]) => ({
    difficulty,
    answered: v.answered,
    correct: v.correct,
    accuracy: toAccuracy(v),
  }));

  const totalPool = await AptitudeQuestion.countDocuments({ isActive: true });
  const completedAttempts = await AptitudeAttempt.countDocuments({ user: userId, status: "completed" });

  res.json({
    status: "success",
    data: {
      totalSeen: seenIds.size,
      totalAnswered: answered,
      totalCorrect: correct,
      totalIncorrect: Math.max(0, answered - correct),
      accuracy: answered ? Math.round((correct / answered) * 100) : 0,
      completedTests: completedAttempts,
      questionsRemaining: Math.max(0, totalPool - seenIds.size),
      questionsCompleted: seenIds.size,
      weakTopics: topicWise.filter((t) => t.weak).map((t) => t.topic),
      strongTopics: topicWise.filter((t) => t.answered > 0 && t.accuracy >= 70).map((t) => t.topic),
      topicWise,
      difficultyWise,
    },
  });
});

export const getAptitudeHistory = asyncHandler(async (req: AuthRequest, res: Response) => {
  const attempts = await AptitudeAttempt.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  res.json({
    status: "success",
    data: attempts.map((a: any) => ({
      attemptId: a._id,
      title: a.title || "Aptitude Session",
      testType: a.testType || "",
      difficulty: a.difficulty || "",
      status: a.status,
      totalQuestions: a.totalQuestions,
      correctAnswers: a.correctAnswers,
      wrongAnswers: a.wrongAnswers,
      unattempted: a.unattempted,
      score: a.score,
      accuracy: a.accuracy,
      marks: a.marks,
      timeTaken: a.timeTaken,
      startedAt: a.startedAt || a.createdAt,
      completedAt: a.completedAt,
      createdAt: a.createdAt,
    })),
  });
});

export const getAptitudeHistoryDetail = asyncHandler(async (req: AuthRequest, res: Response) => {
  const attempt: any = await AptitudeAttempt.findOne({
    _id: req.params.attemptId,
    user: req.user._id,
  }).lean();
  if (!attempt) throw new AppError("Attempt not found", 404);

  const byId = new Map<string, any>(attempt.questions.map((s: any) => [s.question.toString(), s]));
  const docs: any[] = await AptitudeQuestion.find({
    _id: { $in: attempt.questions.map((s: any) => s.question) },
    isActive: true,
  }).lean();
  const fullById = new Map<string, any>(docs.map((d: any) => [d._id.toString(), d]));
  const answeredById = new Map<string, any>(
    (
      await AptitudeQuestionHistory.find({ user: req.user._id, attempt: attempt._id }).lean()
    ).map((h: any) => [h.question.toString(), h])
  );

  const questions = attempt.questions.map((s: any) => {
    const id = s.question.toString();
    const fullQ = fullById.get(id) || {};
    const h = answeredById.get(id);
    return {
      id,
      question: fullQ.question || "",
      category: fullQ.category || "",
      topic: fullQ.topic || "",
      difficulty: fullQ.difficulty || "",
      options: s.servedOptions,
      repeated: s.repeated,
      selected: h?.selected ?? undefined,
      correct: s.servedCorrect,
      answered: h?.answered || false,
      isCorrect: h?.correct ?? false,
      explanation: attempt.status === "completed" ? fullQ.explanation || "" : "",
    };
  });

  res.json({
    status: "success",
    data: {
      attemptId: attempt._id,
      title: attempt.title,
      testType: attempt.testType,
      difficulty: attempt.difficulty,
      status: attempt.status,
      totalQuestions: attempt.totalQuestions,
      correctAnswers: attempt.correctAnswers,
      wrongAnswers: attempt.wrongAnswers,
      unattempted: attempt.unattempted,
      score: attempt.score,
      accuracy: attempt.accuracy,
      marks: attempt.marks,
      timeTaken: attempt.timeTaken,
      startedAt: attempt.startedAt || attempt.createdAt,
      completedAt: attempt.completedAt,
      createdAt: attempt.createdAt,
      questions,
    },
  });
});

// ── Public question bank (no answers) ────────────────────

export const getAptitudeQuestions = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { category, topic, difficulty, tag, limit, skip } = req.query;
  const filter: Record<string, any> = { isActive: true };
  if (category) filter.category = category;
  if (topic) filter.topic = topic;
  if (difficulty) filter.difficulty = difficulty;
  if (tag) filter["companyTags.name"] = tag;

  const l = Math.min(100, Math.max(1, Number(limit) || 20));
  const s = Math.max(0, Number(skip) || 0);
  const [total, docs] = await Promise.all([
    AptitudeQuestion.countDocuments(filter),
    AptitudeQuestion.find(filter).sort({ topic: 1 }).skip(s).limit(l).lean(),
  ]);
  res.json({
    status: "success",
    data: {
      total,
      limit: l,
      skip: s,
      questions: docs.map((q: any) => toPublicQuestion(q)),
    },
  });
});

// ── Legacy persistence endpoints (kept for compatibility) ─

export const saveAptitudeResult = asyncHandler(async (req: AuthRequest, res: Response) => {
  const {
    totalQuestions,
    correctAnswers,
    wrongAnswers,
    unattempted,
    score,
    marks,
    timeTaken,
    tabWarnings,
    categoryScores,
    answers,
  } = req.body;

  if (totalQuestions === undefined || correctAnswers === undefined || score === undefined) {
    throw new AppError("totalQuestions, correctAnswers and score are required", 400);
  }

  const attempt = await AptitudeAttempt.create({
    user: req.user._id,
    status: "completed",
    testType: req.body.testType || "",
    totalQuestions: Number(totalQuestions),
    correctAnswers: Number(correctAnswers),
    wrongAnswers: Number(wrongAnswers || 0),
    unattempted: Number(unattempted || 0),
    score: Number(score),
    accuracy: Number(correctAnswers) && Number(totalQuestions) ? Math.round((Number(correctAnswers) / Number(totalQuestions)) * 100) : 0,
    marks: Number(marks || 0),
    timeTaken: Number(timeTaken || 0),
    tabWarnings: Number(tabWarnings || 0),
    categoryScores: Array.isArray(categoryScores) ? categoryScores : [],
    answers: Array.isArray(answers) ? answers : [],
    startedAt: new Date(),
    completedAt: new Date(),
  });

  res.status(201).json({ status: "success", data: attempt });
});

export const getMyAptitudeResults = asyncHandler(async (req: AuthRequest, res: Response) => {
  const attempts = await AptitudeAttempt.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  res.json({ status: "success", data: attempts });
});

export const getMyAptitudeStats = asyncHandler(async (req: AuthRequest, res: Response) => {
  const attempts = await AptitudeAttempt.find({ user: req.user._id, status: "completed" }).lean();
  const scores = attempts.map((a: any) => a.score || 0);
  res.json({
    status: "success",
    data: {
      total: attempts.length,
      average: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      best: scores.length ? Math.max(...scores) : 0,
    },
  });
});

// ── Topics & configured tests (student-facing) ───────────

export const getAptitudeTopics = asyncHandler(async (_req: Request, res: Response) => {
  const counts = await AptitudeQuestion.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: { category: "$category", topic: "$topic" }, count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [`${c._id.category}::${c._id.topic}`, c.count]));
  const topics = await AptitudeTopic.find({ isActive: true }).sort({ order: 1 }).lean();
  const grouped: Record<string, any[]> = {};
  topics.forEach((t: any) => {
    (grouped[t.category] = grouped[t.category] || []).push({
      id: t._id,
      name: t.name,
      description: t.description,
      questionCount: countMap.get(`${t.category}::${t.name}`) || 0,
    });
  });
  res.json({ status: "success", data: grouped });
});

export const getAptitudeTests = asyncHandler(async (_req: Request, res: Response) => {
  const tests = await AptitudeTestConfig.find({ isActive: true })
    .sort({ createdAt: -1 })
    .lean();
  res.json({
    status: "success",
    data: tests.map((t: any) => ({
      id: t._id,
      title: t.title,
      description: t.description,
      testType: t.testType || "mock",
      category: t.category,
      topics: t.topics,
      difficulty: t.difficulty,
      questionCount: t.questionCount,
      durationMinutes: t.durationMinutes,
      marksPerQuestion: t.marksPerQuestion,
      negativeMarksPerQuestion: t.negativeMarksPerQuestion,
      passingScore: t.passingScore,
    })),
  });
});

export const getAptitudeTest = asyncHandler(async (req: Request, res: Response) => {
  const test: any = await AptitudeTestConfig.findById(req.params.id).lean();
  if (!test || !test.isActive) {
    throw new AppError("Test not found", 404);
  }
  res.json({
    status: "success",
    data: {
      id: test._id,
      title: test.title,
      description: test.description,
      testType: test.testType || "mock",
      category: test.category,
      topics: test.topics,
      difficulty: test.difficulty,
      questionCount: test.questionCount,
      durationMinutes: test.durationMinutes,
      marksPerQuestion: test.marksPerQuestion,
      negativeMarksPerQuestion: test.negativeMarksPerQuestion,
      passingScore: test.passingScore,
    },
  });
});

// ── Legacy GET questions (kept; now records "shown" history + randomizes) ─

const buildLegacySession = async (user: any, meta: any) => {
  const { prepared } = await prepareSession(user, meta);
  await recordShown(user._id, null, meta.testType, prepared);
  return {
    drawnQuestionIds: prepared.map((p) => p.doc._id),
    questions: prepared.map((p) => toPublicQuestion(p.doc, p.servedOptions)),
    servedCorrectById: new Map(prepared.map((p) => [p.doc._id.toString(), p.servedCorrect])),
  };
};

export const getTestQuestions = asyncHandler(async (req: AuthRequest, res: Response) => {
  const meta = await resolveStartMeta({ testId: req.params.id });
  const session = await buildLegacySession(req.user, meta);
  res.json({
    status: "success",
    data: {
      test: {
        id: req.params.id,
        title: meta.title,
        durationMinutes: meta.durationMinutes,
        marksPerQuestion: meta.marksPerQuestion,
        negativeMarksPerQuestion: meta.negativeMarksPerQuestion,
        passingScore: meta.passingScore,
      },
      seenReset: false,
      poolSize: session.drawnQuestionIds.length,
      drawnQuestionIds: session.drawnQuestionIds,
      questions: session.questions,
    },
  });
});

export const submitTest = asyncHandler(async (req: AuthRequest, res: Response) => {
  const test: any = await AptitudeTestConfig.findById(req.params.id).lean();
  if (!test || !test.isActive) throw new AppError("Test not found", 404);

  const answers: Record<string, number> = req.body.answers || {};
  const timeTaken = Number(req.body.timeTaken || 0);
  const tabWarnings = Number(req.body.tabWarnings || 0);

  const { docs, servedCorrectById } = await loadMappingForAnswers(req.user._id, answers);
  const attempt: any = {
    _id: new mongoose.Types.ObjectId(),
    user: req.user._id,
    status: "completed",
    testType: test.testType || "mock",
    difficulty: test.difficulty || "",
    title: test.title,
    marksPerQuestion: test.marksPerQuestion,
    negativeMarksPerQuestion: test.negativeMarksPerQuestion,
    passingScore: test.passingScore,
    totalQuestions: Object.keys(answers).length,
    questions: Object.keys(answers).map((id) => ({
      question: objectId(id),
      servedOptions: docs.find((d: any) => d._id.toString() === id)?.options || [],
      servedCorrect: servedCorrectById.get(id) ?? 0,
      repeated: false,
    })),
  };

  const result = scoreSession(attempt, answers, servedCorrectById, new Map(docs.map((d: any) => [d._id.toString(), d])));
  const created = await AptitudeAttempt.create({
    user: req.user._id,
    status: "completed",
    testType: test.testType || "mock",
    difficulty: test.difficulty || "",
    title: test.title,
    marksPerQuestion: test.marksPerQuestion,
    negativeMarksPerQuestion: test.negativeMarksPerQuestion,
    passingScore: test.passingScore,
    totalQuestions: result.totalQuestions,
    correctAnswers: result.correct,
    wrongAnswers: result.wrong,
    unattempted: result.unattempted,
    score: result.score,
    accuracy: result.accuracy,
    marks: result.marks,
    timeTaken,
    tabWarnings,
    completedAt: new Date(),
    categoryScores: result.categoryScores,
    answers: result.review.map((r: any) => ({ question: r.question, selected: r.selected, correct: r.correct, isCorrect: r.isCorrect, category: r.category })),
  });

  await markHistoryAnswered(req.user._id, created._id, answers, servedCorrectById);

  res.status(201).json({
    status: "success",
    data: {
      attemptId: created._id,
      totalQuestions: result.totalQuestions,
      correctAnswers: result.correct,
      wrongAnswers: result.wrong,
      unattempted: result.unattempted,
      score: result.score,
      marks: result.marks,
      marksPerQuestion: test.marksPerQuestion,
      negativeMarksPerQuestion: test.negativeMarksPerQuestion,
      passed: result.score >= (test.passingScore ?? 50),
      passingScore: test.passingScore,
      timeTaken,
      tabWarnings,
      categoryScores: result.categoryScores,
      questions: result.review,
    },
  });
});

export const getPracticeQuestions = asyncHandler(async (req: AuthRequest, res: Response) => {
  const meta = await resolveStartMeta({ mode: "practice", ...req.query });
  const session = await buildLegacySession(req.user, meta);
  res.json({
    status: "success",
    data: {
      config: {
        category: req.query.category || "",
        topic: req.query.topic || "",
        difficulty: req.query.difficulty || "",
        count: session.drawnQuestionIds.length,
        marksPerQuestion: 1,
        negativeMarksPerQuestion: 0,
      },
      seenReset: false,
      poolSize: session.drawnQuestionIds.length,
      drawnQuestionIds: session.drawnQuestionIds,
      questions: session.questions,
    },
  });
});

export const submitPractice = asyncHandler(async (req: AuthRequest, res: Response) => {
  const answers: Record<string, number> = req.body.answers || {};
  const timeTaken = Number(req.body.timeTaken || 0);
  const tabWarnings = Number(req.body.tabWarnings || 0);
  const marksPerQuestion = Number(req.body.marksPerQuestion || 1);
  const negativeMarksPerQuestion = Number(req.body.negativeMarksPerQuestion || 0);

  const { docs, servedCorrectById } = await loadMappingForAnswers(req.user._id, answers);
  const attempt: any = {
    _id: new mongoose.Types.ObjectId(),
    user: req.user._id,
    status: "completed",
    testType: "practice",
    difficulty: req.body.difficulty || "",
    title: "Practice Session",
    marksPerQuestion,
    negativeMarksPerQuestion,
    passingScore: 50,
    totalQuestions: Object.keys(answers).length,
    questions: Object.keys(answers).map((id) => ({
      question: objectId(id),
      servedOptions: docs.find((d: any) => d._id.toString() === id)?.options || [],
      servedCorrect: servedCorrectById.get(id) ?? 0,
      repeated: false,
    })),
  };

  const result = scoreSession(attempt, answers, servedCorrectById, new Map(docs.map((d: any) => [d._id.toString(), d])));
  const created = await AptitudeAttempt.create({
    user: req.user._id,
    status: "completed",
    testType: "practice",
    difficulty: req.body.difficulty || "",
    title: "Practice Session",
    marksPerQuestion,
    negativeMarksPerQuestion,
    passingScore: 50,
    totalQuestions: result.totalQuestions,
    correctAnswers: result.correct,
    wrongAnswers: result.wrong,
    unattempted: result.unattempted,
    score: result.score,
    accuracy: result.accuracy,
    marks: result.marks,
    timeTaken,
    tabWarnings,
    completedAt: new Date(),
    categoryScores: result.categoryScores,
    answers: result.review.map((r: any) => ({ question: r.question, selected: r.selected, correct: r.correct, isCorrect: r.isCorrect, category: r.category })),
  });

  await markHistoryAnswered(req.user._id, created._id, answers, servedCorrectById);

  res.status(201).json({
    status: "success",
    data: {
      attemptId: created._id,
      totalQuestions: result.totalQuestions,
      correctAnswers: result.correct,
      wrongAnswers: result.wrong,
      unattempted: result.unattempted,
      score: result.score,
      marks: result.marks,
      marksPerQuestion,
      negativeMarksPerQuestion,
      timeTaken,
      tabWarnings,
      categoryScores: result.categoryScores,
      questions: result.review,
    },
  });
});

/** Resolve servedCorrect for each answered question from the latest history row (fallback: canonical). */
const loadMappingForAnswers = async (userId: mongoose.Types.ObjectId, answers: Record<string, number>) => {
  const ids = Object.keys(answers);
  const rows = await AptitudeQuestionHistory.find({ user: userId, question: { $in: ids.map(objectId) } })
    .sort({ shownAt: -1 })
    .lean();
  const map = new Map<string, number>();
  rows.forEach((r: any) => {
    if (!map.has(r.question.toString())) map.set(r.question.toString(), r.servedCorrect);
  });
  const docs = await AptitudeQuestion.find({ _id: { $in: ids.map(objectId) }, isActive: true }).lean();
  docs.forEach((d: any) => {
    if (!map.has(d._id.toString())) map.set(d._id.toString(), d.correctAnswer);
  });
  return { docs, servedCorrectById: map };
};
