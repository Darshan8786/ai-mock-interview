import { Request, Response } from "express";
import { Interview } from "../../models/Interview";
import { InterviewReport } from "../../models/InterviewReport";
import { CheatingEvent } from "../../models/CheatingEvent";
import { asyncHandler } from "../../utils/asyncHandler";
import { buildFilter, parsePagination, buildSearch } from "../../utils/queryHelpers";

export const getInterviews = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, sort, skip } = parsePagination(req.query);

  const filter: Record<string, any> = {};
  Object.assign(filter, buildFilter(req.query, [
    "status", "interviewType", "difficulty", "experienceLevel",
  ]));
  if (req.query.minScore) filter.overallScore = { ...(filter.overallScore || {}), $gte: Number(req.query.minScore) };
  if (req.query.maxScore) filter.overallScore = { ...(filter.overallScore || {}), $lte: Number(req.query.maxScore) };

  const search = buildSearch(req.query, ["jobRole", "user.name", "user.email", "user.usn"]);
  if (search) filter.$and = [search];

  const [total, docs] = await Promise.all([
    Interview.countDocuments(filter),
    Interview.find(filter)
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

export const getInterviewDetail = asyncHandler(async (req: Request, res: Response) => {
  const interview = await Interview.findById(req.params.id)
    .populate("user", "name email usn department year semester")
    .lean();
  if (!interview) {
    return res.status(404).json({ status: "fail", message: "Interview not found" });
  }

  const [report, cheatingEvents] = await Promise.all([
    InterviewReport.findOne({ interview: interview._id }).lean(),
    CheatingEvent.find({ interview: interview._id }).sort({ timestamp: -1 }).lean(),
  ]);

  res.json({ status: "success", data: { interview, report, cheatingEvents } });
});

export const getInterviewStats = asyncHandler(async (_req: Request, res: Response) => {
  const reports = await InterviewReport.find().lean();
  const scores = reports.map((r: any) => r.overallScore || 0);
  const counts = await Interview.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  res.json({
    status: "success",
    data: {
      total: scores.length,
      average: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      highest: scores.length ? Math.max(...scores) : 0,
      lowest: scores.length ? Math.min(...scores) : 0,
      byStatus: Object.fromEntries(counts.map((c) => [c._id, c.count])),
    },
  });
});
