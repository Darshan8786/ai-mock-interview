import mongoose from "mongoose";

/**
 * Per-student eligibility snapshot for a job.
 *
 * Stored so the admin can quickly view eligible / ineligible lists with reasons
 * without recomputing on every request. Recalculated automatically whenever a
 * job is created or its eligibility criteria change (see eligibilityService).
 */
const jobEligibilitySchema = new mongoose.Schema(
  {
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    eligible: { type: Boolean, required: true },
    reasons: { type: [String], default: [] },
    checkedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// One snapshot per (student, job).
jobEligibilitySchema.index({ jobId: 1, studentId: 1 }, { unique: true });
jobEligibilitySchema.index({ jobId: 1, eligible: 1 });

export const JobEligibility =
  mongoose.models.JobEligibility ||
  mongoose.model("JobEligibility", jobEligibilitySchema);
