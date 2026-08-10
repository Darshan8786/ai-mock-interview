import { Response } from "express";
import mongoose from "mongoose";
import { AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { StudentNotification } from "../models/StudentNotification";

const shapeNotification = (n: any) => ({
  id: n._id,
  type: n.type,
  title: n.title,
  body: n.body,
  read: n.read,
  createdAt: n.createdAt,
  job: n.job || null,
});

export const getMyNotifications = asyncHandler(async (req: AuthRequest, res: Response) => {
  const [notifications, unreadCount] = await Promise.all([
    StudentNotification.find({ studentId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
    StudentNotification.countDocuments({ studentId: req.user._id, read: false }),
  ]);

  res.json({
    status: "success",
    data: {
      unread: unreadCount,
      notifications: notifications.map(shapeNotification),
    },
  });
});

export const markNotificationRead = asyncHandler(
  async (req: AuthRequest, res: Response, next: any) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return next(new AppError("Invalid notification id", 400));
    }
    const notification = await StudentNotification.findOneAndUpdate(
      { _id: req.params.id, studentId: req.user._id },
      { read: true },
      { new: true }
    );
    if (!notification) {
      return next(new AppError("Notification not found", 404));
    }
    res.json({ status: "success", data: { notification: shapeNotification(notification) } });
  }
);

export const markAllNotificationsRead = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    await StudentNotification.updateMany(
      { studentId: req.user._id, read: false },
      { read: true }
    );
    res.json({ status: "success", message: "All notifications marked as read" });
  }
);

export const deleteNotification = asyncHandler(
  async (req: AuthRequest, res: Response, next: any) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return next(new AppError("Invalid notification id", 400));
    }
    const notification = await StudentNotification.findOneAndDelete({
      _id: req.params.id,
      studentId: req.user._id,
    });
    if (!notification) {
      return next(new AppError("Notification not found", 404));
    }
    res.json({ status: "success", message: "Notification deleted" });
  }
);
