import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { AptitudeAttempt } from "../models/AptitudeAttempt";

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
