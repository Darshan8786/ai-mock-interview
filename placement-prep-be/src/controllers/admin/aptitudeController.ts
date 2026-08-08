import { Request, Response } from "express";
import { AptitudeAttempt } from "../../models/AptitudeAttempt";
import { asyncHandler } from "../../utils/asyncHandler";
import { parsePagination, buildSearch } from "../../utils/queryHelpers";

export const getAptitudeResults = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, sort, skip } = parsePagination(req.query);

  const filter: Record<string, any> = {};
  if (req.query.minScore) filter.score = { $gte: Number(req.query.minScore) };
  if (req.query.maxScore) filter.score = { ...(filter.score || {}), $lte: Number(req.query.maxScore) };

  const search = buildSearch(req.query, ["user.name", "user.email", "user.usn"]);
  if (search) filter.$and = [search];

  const [total, docs] = await Promise.all([
    AptitudeAttempt.countDocuments(filter),
    AptitudeAttempt.find(filter)
      .populate("user", "name email usn department year semester")
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

export const getAptitudeResultDetail = asyncHandler(async (req: Request, res: Response) => {
  const attempt = await AptitudeAttempt.findById(req.params.id)
    .populate("user", "name email usn department year semester")
    .lean();
  if (!attempt) {
    return res.status(404).json({ status: "fail", message: "Aptitude attempt not found" });
  }
  res.json({ status: "success", data: attempt });
});

export const getAptitudeStats = asyncHandler(async (_req: Request, res: Response) => {
  const attempts = await AptitudeAttempt.find().lean();
  const scores = attempts.map((a: any) => a.score || 0);

  res.json({
    status: "success",
    data: {
      total: scores.length,
      average: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      highest: scores.length ? Math.max(...scores) : 0,
      lowest: scores.length ? Math.min(...scores) : 0,
    },
  });
});
