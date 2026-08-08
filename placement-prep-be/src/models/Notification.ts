import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    body: { type: String, required: true },
    type: {
      type: String,
      enum: ["notification", "placement", "interview_schedule", "exam_schedule", "quiz_schedule"],
      default: "notification",
    },
    // Targeting: when empty arrays, targets all students
    departments: { type: [String], default: [] },
    years: { type: [String], default: [] },
    semesters: { type: [String], default: [] },
    // Specific student ids (for "Selected Students" targeting)
    studentIds: { type: [mongoose.Schema.Types.ObjectId], ref: "User", default: [] },
    // After resolution, the actual recipient ids are stored here
    recipients: { type: [mongoose.Schema.Types.ObjectId], ref: "User", default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

notificationSchema.index({ createdAt: -1 });

export const Notification =
  mongoose.models.Notification || mongoose.model("Notification", notificationSchema);
