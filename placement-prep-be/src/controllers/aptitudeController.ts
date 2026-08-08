import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { AptitudeAttempt } from "../models/AptitudeAttempt";
import { AptitudeQuestion } from "../models/AptitudeQuestion";
import { AptitudeTopic } from "../models/AptitudeTopic";
import { AptitudeTestConfig } from "../models/AptitudeTestConfig";

/** Strip the correct answer & explanation from a question before it reaches the student. */
const toPublicQuestion = (q: any) => ({
  id: q._id,
  category: q.category,
  topic: q.topic,
  subtopic: q.subtopic,
  difficulty: q.difficulty,
  question: q.question,
  options: q.options,
  estimatedTime: q.estimatedTime,
  companyTags: q.companyTags,
});

/**
 * Score a set of answers against the correct questions, applying a test's
 * marking scheme. Returns the attempt fields the AptitudeAttempt model needs.
 */
const scoreAttempt = ({
  questions,
  answers,
  marksPerQuestion,
  negativeMarksPerQuestion,
}: {
  questions: any[];
  answers: Record<string, number>;
  marksPerQuestion: number;
  negativeMarksPerQuestion: number;
}) => {
  let correct = 0;
  let wrong = 0;
  let unattempted = 0;

  const review = questions.map((q: any) => {
    const selected = answers[q._id.toString()];
    const isCorrect = selected !== undefined && selected === q.correctAnswer;
    if (selected === undefined) unattempted++;
    else if (isCorrect) correct++;
    else wrong++;
    return {
      id: q._id,
      question: q.question,
      category: q.category,
      topic: q.topic,
      difficulty: q.difficulty,
      options: q.options,
      selected,
      correct: q.correctAnswer,
      isCorrect,
      explanation: q.explanation,
    };
  });

  const totalQuestions = questions.length;
  const marks = correct * marksPerQuestion - wrong * negativeMarksPerQuestion;
  const score = totalQuestions ? Math.round((correct / totalQuestions) * 100) : 0;

  const categoryScores = ["Quantitative", "Logical Reasoning", "Verbal Ability", "Data Interpretation"].map(
    (category) => {
      const qs = questions.filter((q: any) => q.category === category);
      const done = qs.filter((q: any) => {
        const sel = answers[q._id.toString()];
        return sel !== undefined && sel === q.correctAnswer;
      }).length;
      return {
        category,
        score: qs.length ? Math.round((done / qs.length) * 100) : 0,
        correct: done,
        total: qs.length,
      };
    }
  );

  return { correct, wrong, unattempted, score, marks, totalQuestions, categoryScores, review };
};

/**
 * Persists an aptitude test result for the logged-in student so it
 * immediately shows up in the admin panel.
 * Body: { totalQuestions, correctAnswers, wrongAnswers, unattempted,
 *         score, marks, timeTaken, tabWarnings, categoryScores[], answers[] }
 */
export const saveAptitudeResult = asyncHandler(
  async (req: AuthRequest, res: Response) => {
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

    if (
      totalQuestions === undefined ||
      correctAnswers === undefined ||
      score === undefined
    ) {
      throw new AppError("totalQuestions, correctAnswers and score are required", 400);
    }

    const attempt = await AptitudeAttempt.create({
      user: req.user._id,
      totalQuestions: Number(totalQuestions),
      correctAnswers: Number(correctAnswers),
      wrongAnswers: Number(wrongAnswers || 0),
      unattempted: Number(unattempted || 0),
      score: Number(score),
      marks: Number(marks || 0),
      timeTaken: Number(timeTaken || 0),
      tabWarnings: Number(tabWarnings || 0),
      categoryScores: Array.isArray(categoryScores) ? categoryScores : [],
      answers: Array.isArray(answers) ? answers : [],
    });

    res.status(201).json({ status: "success", data: attempt });
  }
);

export const getMyAptitudeResults = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const attempts = await AptitudeAttempt.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json({ status: "success", data: attempts });
  }
);

export const getMyAptitudeStats = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const attempts = await AptitudeAttempt.find({ user: req.user._id }).lean();
    const scores = attempts.map((a: any) => a.score || 0);
    res.json({
      status: "success",
      data: {
        total: attempts.length,
        average: scores.length
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : 0,
        best: scores.length ? Math.max(...scores) : 0,
      },
    });
  }
);

// ── Topics & Tests (student-facing) ───────────────────────

export const getAptitudeTopics = asyncHandler(
  async (_req: Request, res: Response) => {
    const topics = await AptitudeTopic.find({ isActive: true })
      .sort({ order: 1 })
      .lean();
    const grouped: Record<string, any[]> = {};
    topics.forEach((t: any) => {
      (grouped[t.category] = grouped[t.category] || []).push({
        id: t._id,
        name: t.name,
        description: t.description,
        questionCount: t.questionCount || 0,
      });
    });
    res.json({ status: "success", data: grouped });
  }
);

export const getAptitudeTests = asyncHandler(
  async (_req: Request, res: Response) => {
    const tests = await AptitudeTestConfig.find({ isActive: true })
      .sort({ createdAt: -1 })
      .lean();
    res.json({
      status: "success",
      data: tests.map((t: any) => ({
        id: t._id,
        title: t.title,
        description: t.description,
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
  }
);

export const getAptitudeTest = asyncHandler(
  async (req: Request, res: Response) => {
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
  }
);

/** Random question draw honouring a test config (no answers exposed). */
export const getTestQuestions = asyncHandler(
  async (req: Request, res: Response) => {
    const test: any = await AptitudeTestConfig.findById(req.params.id).lean();
    if (!test || !test.isActive) {
      throw new AppError("Test not found", 404);
    }

    const filter: Record<string, any> = { isActive: true };
    if (test.category) filter.category = test.category;
    if (test.topics?.length) filter.topic = { $in: test.topics };
    if (test.difficulty) filter.difficulty = test.difficulty;

    let questions: any[];
    if (test.questionIds?.length) {
      questions = await AptitudeQuestion.find({ _id: { $in: test.questionIds }, isActive: true }).lean();
    } else {
      questions = await AptitudeQuestion.find(filter).lean();
      // Adaptive hint: ensure a spread of difficulties when pool is large
      if (questions.length > test.questionCount) {
        questions = questions.sort(() => Math.random() - 0.5).slice(0, test.questionCount);
      }
    }

    res.json({
      status: "success",
      data: {
        test: {
          id: test._id,
          title: test.title,
          durationMinutes: test.durationMinutes,
          marksPerQuestion: test.marksPerQuestion,
          negativeMarksPerQuestion: test.negativeMarksPerQuestion,
          passingScore: test.passingScore,
        },
        questions: questions.map(toPublicQuestion),
      },
    });
  }
);

/** Server-side scoring of a full test. Creates + returns the stored attempt. */
export const submitTest = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const test: any = await AptitudeTestConfig.findById(req.params.id).lean();
    if (!test || !test.isActive) {
      throw new AppError("Test not found", 404);
    }

    const answers: Record<string, number> = req.body.answers || {};
    const timeTaken = Number(req.body.timeTaken || 0);
    const tabWarnings = Number(req.body.tabWarnings || 0);

    const filter: Record<string, any> = { _id: { $in: Object.keys(answers) }, isActive: true };
    const questions = await AptitudeQuestion.find(filter).lean();

    const result = scoreAttempt({
      questions,
      answers,
      marksPerQuestion: test.marksPerQuestion,
      negativeMarksPerQuestion: test.negativeMarksPerQuestion,
    });

    const attempt = await AptitudeAttempt.create({
      user: req.user._id,
      totalQuestions: result.totalQuestions,
      correctAnswers: result.correct,
      wrongAnswers: result.wrong,
      unattempted: result.unattempted,
      score: result.score,
      marks: result.marks,
      timeTaken,
      tabWarnings,
      categoryScores: result.categoryScores,
      answers: result.review.map((r: any) => ({
        question: r.question,
        selected: r.selected,
        correct: r.correct,
        isCorrect: r.isCorrect,
        category: r.category,
      })),
    });

    res.status(201).json({
      status: "success",
      data: {
        attemptId: attempt._id,
        totalQuestions: result.totalQuestions,
        correctAnswers: result.correct,
        wrongAnswers: result.wrong,
        unattempted: result.unattempted,
        score: result.score,
        marks: result.marks,
        marksPerQuestion: test.marksPerQuestion,
        negativeMarksPerQuestion: test.negativeMarksPerQuestion,
        passed: result.score >= test.passingScore,
        passingScore: test.passingScore,
        timeTaken,
        tabWarnings,
        categoryScores: result.categoryScores,
        questions: result.review,
      },
    });
  }
);

// ── Practice (random questions by filters) ────────────────

export const getPracticeQuestions = asyncHandler(
  async (req: Request, res: Response) => {
    const { category, topic, difficulty, count, tag } = req.query;
    const filter: Record<string, any> = { isActive: true };
    if (category) filter.category = category;
    if (topic) filter.topic = topic;
    if (difficulty) filter.difficulty = difficulty;
    if (tag) filter["companyTags.name"] = tag;

    const limit = Math.min(50, Math.max(1, Number(count) || 10));
    const questions = await AptitudeQuestion.aggregate([
      { $match: filter },
      { $sample: { size: limit } },
    ]);

    res.json({
      status: "success",
      data: {
        config: {
          category: category || "",
          topic: topic || "",
          difficulty: difficulty || "",
          count: questions.length,
          marksPerQuestion: 1,
          negativeMarksPerQuestion: 0,
        },
        questions: questions.map(toPublicQuestion),
      },
    });
  }
);

export const submitPractice = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const answers: Record<string, number> = req.body.answers || {};
    const timeTaken = Number(req.body.timeTaken || 0);
    const tabWarnings = Number(req.body.tabWarnings || 0);
    const marksPerQuestion = Number(req.body.marksPerQuestion || 1);
    const negativeMarksPerQuestion = Number(req.body.negativeMarksPerQuestion || 0);

    const questions = await AptitudeQuestion.find({
      _id: { $in: Object.keys(answers) },
      isActive: true,
    }).lean();

    const result = scoreAttempt({
      questions,
      answers,
      marksPerQuestion,
      negativeMarksPerQuestion,
    });

    const attempt = await AptitudeAttempt.create({
      user: req.user._id,
      totalQuestions: result.totalQuestions,
      correctAnswers: result.correct,
      wrongAnswers: result.wrong,
      unattempted: result.unattempted,
      score: result.score,
      marks: result.marks,
      timeTaken,
      tabWarnings,
      categoryScores: result.categoryScores,
      answers: result.review.map((r: any) => ({
        question: r.question,
        selected: r.selected,
        correct: r.correct,
        isCorrect: r.isCorrect,
        category: r.category,
      })),
    });

    res.status(201).json({
      status: "success",
      data: {
        attemptId: attempt._id,
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
  }
);
