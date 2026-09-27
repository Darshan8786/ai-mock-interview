import { StudentNotification } from "../../models/StudentNotification";
import { Request, Response } from "express";
import { Notification } from "../../models/Notification";
import { User } from "../../models/User";
import { AuthRequest } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { AppError } from "../../utils/AppError";

const VALID_TYPES = ["notification", "placement", "interview_schedule", "exam_schedule", "quiz_schedule"];

/**
 * Resolves recipients from targeting filters:
 * - empty departments/years/semesters + empty studentIds => ALL students
 * - otherwise students matching any of the provided filters (OR across filters)
 */
async function resolveRecipients(payload: {
  departments?: string[];
  years?: string[];
  semesters?: string[];
  studentIds?: string[];
}): Promise<string[]> {
  const { departments = [], years = [], semesters = [], studentIds = [] } = payload;

  if (
    departments.length === 0 &&
    years.length === 0 &&
    semesters.length === 0 &&
    studentIds.length === 0
  ) {
    const all = await User.find({ role: "user" }).select("_id").lean();
    return all.map((u) => u._id.toString());
  }

  const filter: Record<string, any> = { role: "user" };
  const or: Record<string, any>[] = [];
  if (departments.length) or.push({ department: { $in: departments } });
  if (years.length) or.push({ year: { $in: years } });
  if (semesters.length) or.push({ semester: { $in: semesters } });
  if (studentIds.length) or.push({ _id: { $in: studentIds } });
  if (or.length) filter.$or = or;

  const users = await User.find(filter).select("_id").lean();
  return users.map((u) => u._id.toString());
}

export const createNotification = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { title, body, type, departments, years, semesters, studentIds } = req.body;

  if (!title || !body) {
    throw new AppError("Title and body are required", 400);
  }
  if (type && !VALID_TYPES.includes(type)) {
    throw new AppError(`Invalid notification type. Valid: ${VALID_TYPES.join(", ")}`, 400);
  }

  const recipients = await resolveRecipients({
    departments: departments || [],
    years: years || [],
    semesters: semesters || [],
    studentIds: studentIds || [],
  });

  const notification = await Notification.create({
    title,
    body,
    type: type || "notification",
    departments: departments || [],
    years: years || [],
    semesters: semesters || [],
    studentIds: studentIds || [],
    recipients,
    createdBy: req.user?._id,
  });

  // Deliver it to every recipient's notification feed (the student bell reads StudentNotification). For "general"
  // rows jobId carries this notification's id: it is only the uniqueness key of StudentNotification's existing
  // (studentId, jobId, type) index - students are shown the empty job snapshot, never jobId, so no job link appears.
  if (recipients.length) {
    await StudentNotification.insertMany(
      recipients.map((studentId) => ({ studentId, jobId: notification._id, type: "general", title, body })),
      { ordered: false }
    ).catch((err: any) => {
      if (err?.code !== 11000) throw err; // a duplicate just means that student already has it
    });
  }

  res.status(201).json({ status: "success", data: notification, delivered: recipients.length });
});

export const getNotifications = asyncHandler(async (_req: Request, res: Response) => {
  const notifications = await Notification.find().sort({ createdAt: -1 }).limit(100).lean();
  res.json({ status: "success", data: notifications });
});

export const getMyNotifications = asyncHandler(async (req: AuthRequest, res: Response) => {
  const notifications = await Notification.find({
    $or: [{ recipients: req.user._id }, { recipients: { $size: 0 } }],
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  res.json({ status: "success", data: notifications });
});

export const deleteNotification = asyncHandler(async (req: Request, res: Response) => {
  const notification = await Notification.findByIdAndDelete(req.params.id);
  if (!notification) {
    return res.status(404).json({ status: "fail", message: "Notification not found" });
  }
  await StudentNotification.deleteMany({ jobId: notification._id, type: "general" });
  res.json({ status: "success", message: "Notification deleted" });
});
