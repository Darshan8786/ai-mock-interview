import { Request, Response } from "express";
import { CheatingEvent } from "../../models/CheatingEvent";
import { asyncHandler } from "../../utils/asyncHandler";
import { parsePagination, buildSearch } from "../../utils/queryHelpers";

export const getProctoringLogs = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, sort, skip } = parsePagination(req.query);

  const filter: Record<string, any> = {};
  if (req.query.severity) filter["warnings.severity"] = req.query.severity;
  if (req.query.type) filter.type = req.query.type;

  const search = buildSearch(req.query, ["user.name", "user.email", "description"]);
  if (search) filter.$and = [search];

  const [total, docs] = await Promise.all([
    CheatingEvent.countDocuments(filter),
    CheatingEvent.find(filter)
      .populate("user", "name email usn department")
      .populate("interview", "jobRole status interviewType difficulty")
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

export const getProctoringStats = asyncHandler(async (_req: Request, res: Response) => {
  const total = await CheatingEvent.countDocuments();
  const byType = await CheatingEvent.aggregate([
    { $group: { _id: "$type", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  res.json({
    status: "success",
    data: {
      total,
      today: await CheatingEvent.countDocuments({
        timestamp: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      }),
      byType: Object.fromEntries(byType.map((t) => [t._id, t.count])),
    },
  });
});
