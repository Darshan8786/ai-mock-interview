import { Request, Response } from "express";
import { Announcement } from "../../models/Announcement";
import { AuthRequest } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { AppError } from "../../utils/AppError";

export const getAnnouncements = asyncHandler(async (_req: Request, res: Response) => {
  const announcements = await Announcement.find()
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
  res.json({ status: "success", data: announcements });
});

export const getPublishedAnnouncements = asyncHandler(async (_req: Request, res: Response) => {
  const now = new Date();
  const announcements = await Announcement.find({
    $or: [
      { status: "published" },
      { status: "scheduled", scheduledAt: { $lte: now } },
    ],
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  res.json({ status: "success", data: announcements });
});

export const createAnnouncement = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { title, body, audience, priority, status, scheduledAt } = req.body;
  if (!title || !body) {
    throw new AppError("Title and body are required", 400);
  }

  const announcement = await Announcement.create({
    title,
    body,
    audience: audience || "all",
    priority: priority || "normal",
    status: status || "published",
    scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
    publishedAt: status === "published" || !status ? new Date() : undefined,
    createdBy: req.user?._id,
  });
  res.status(201).json({ status: "success", data: announcement });
});

export const updateAnnouncement = asyncHandler(async (req: Request, res: Response) => {
  const { title, body, audience, priority, status, scheduledAt } = req.body;

  const update: Record<string, any> = {};
  if (title !== undefined) update.title = title;
  if (body !== undefined) update.body = body;
  if (audience !== undefined) update.audience = audience;
  if (priority !== undefined) update.priority = priority;
  if (status !== undefined) update.status = status;
  if (scheduledAt !== undefined) update.scheduledAt = new Date(scheduledAt);
  if (status === "published") update.publishedAt = new Date();

  const announcement = await Announcement.findByIdAndUpdate(req.params.id, update, {
    new: true,
    runValidators: true,
  });
  if (!announcement) {
    return res.status(404).json({ status: "fail", message: "Announcement not found" });
  }
  res.json({ status: "success", data: announcement });
});

export const deleteAnnouncement = asyncHandler(async (req: Request, res: Response) => {
  const announcement = await Announcement.findByIdAndDelete(req.params.id);
  if (!announcement) {
    return res.status(404).json({ status: "fail", message: "Announcement not found" });
  }
  res.json({ status: "success", message: "Announcement deleted" });
});
