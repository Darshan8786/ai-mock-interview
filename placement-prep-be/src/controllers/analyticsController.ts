import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { buildAnalytics } from "../services/analyticsService";

/** GET /analytics/me → the signed-in student's performance analytics. */
export const getMyAnalytics = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = await buildAnalytics(req.user._id);
  res.json({ status: "success", data });
});
