import { Request, Response } from "express";
import { AttemptModel } from "../../db";
import { getQuestionModel } from "../../models/Question";
import { asyncHandler } from "../../utils/asyncHandler";
import { parsePagination, buildSearch } from "../../utils/queryHelpers";

export const getQuizAttempts = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, sort, skip } = parsePagination(req.query);

  const filter: Record<string, any> = {};
  if (req.query.subject) filter.subject = req.query.subject;

  const search = buildSearch(req.query, ["userId.name", "userId.email", "subject"]);
  if (search) filter.$and = [search];

  const [total, docs] = await Promise.all([
    AttemptModel.countDocuments(filter),
    AttemptModel.find(filter)
      .populate("userId", "name email usn department")
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  res.json({
    status: "success",
    results: docs.length,
    total,
    page,
    limit,
    data: docs,
  });
});

export const getQuizStats = asyncHandler(async (_req: Request, res: Response) => {
  const attempts = await AttemptModel.find().lean();
  const subjects: Record<string, { total: number; correct: number }> = {};

  attempts.forEach((a: any) => {
    if (!subjects[a.subject]) subjects[a.subject] = { total: 0, correct: 0 };
    subjects[a.subject].total++;
    if (a.correct) subjects[a.subject].correct++;
  });

  const bySubject = Object.entries(subjects).map(([subject, s]) => ({
    subject,
    attempts: s.total,
    accuracy: s.total ? Math.round((s.correct / s.total) * 100) : 0,
  }));

  const total = attempts.length;
  const correct = attempts.filter((a: any) => a.correct).length;

  res.json({
    status: "success",
    data: {
      total,
      averageAccuracy: total ? Math.round((correct / total) * 100) : 0,
      bySubject,
    },
  });
});

export const getSubjects = asyncHandler(async (_req: Request, res: Response) => {
  const questions = await getQuestionModel("__subjects_meta__").find().limit(1).lean().catch(() => []);
  void questions;
  // Subjects are derived from the attempts collection
  const subjects = await AttemptModel.distinct("subject");
  res.json({ status: "success", data: subjects });
});
