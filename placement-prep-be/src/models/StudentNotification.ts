import mongoose from "mongoose";

const jobSnapshotSchema = new mongoose.Schema(
  {
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", default: null },
    companyName: { type: String, default: "" },
    jobTitle: { type: String, default: "" },
    package: { type: String, default: "" },
    location: { type: String, default: "" },
    lastDateToApply: { type: Date, default: null },
  },
  { _id: false }
);

/**
 * Per-student notification feed.
 *
 * One document per (student, job, type). The unique index guarantees a single
 * eligibility notification per student+job — re-notifying is a no-op.
 */
const studentNotificationSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      default: null,
      index: true,
    },
    type: {
      type: String,
      enum: ["job_eligible", "job_status", "general"],
      default: "job_eligible",
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    job: { type: jobSnapshotSchema, default: () => ({}) },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Only one notification per (student, job, type).
studentNotificationSchema.index(
  { studentId: 1, jobId: 1, type: 1 },
  { unique: true }
);
studentNotificationSchema.index({ studentId: 1, read: 1, createdAt: -1 });

export const StudentNotification =
  mongoose.models.StudentNotification ||
  mongoose.model("StudentNotification", studentNotificationSchema);
