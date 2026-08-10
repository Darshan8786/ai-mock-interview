import mongoose from "mongoose";
import { Job } from "../models/Job";
import { User } from "../models/User";
import { JobEligibility } from "../models/JobEligibility";
import { computeJobEligibility, EligibilityResult } from "../utils/jobEligibility";

export interface RecalcResult {
  total: number;
  eligible: number;
  ineligible: number;
  checkedAt: Date;
}

/**
 * Recomputes eligibility for ALL students against a single job and upserts the
 * snapshots. Old snapshots for students who no longer exist are pruned.
 */
export async function recalculateJobEligibility(jobId: string): Promise<RecalcResult> {
  const job = await Job.findById(jobId);
  if (!job) {
    throw new Error("Job not found");
  }

  const students = await User.find({ role: "user" }).lean();

  const results: EligibilityResult[] = [];
  const ops = students.map((s) => {
    const r = computeJobEligibility(job, s);
    results.push(r);
    return {
      updateOne: {
        filter: { jobId: job._id, studentId: s._id },
        update: {
          $set: { eligible: r.eligible, reasons: r.reasons, checkedAt: new Date() },
        },
        upsert: true,
      },
    };
  });

  if (ops.length > 0) {
    await JobEligibility.bulkWrite(ops, { ordered: false });
  }

  // Remove stale snapshots for students no longer in the database.
  if (students.length > 0) {
    const studentIds = students.map((s) => s._id);
    await JobEligibility.deleteMany({ jobId: job._id, studentId: { $nin: studentIds } });
  }

  const eligible = results.filter((r) => r.eligible).length;
  return {
    total: students.length,
    eligible,
    ineligible: students.length - eligible,
    checkedAt: new Date(),
  };
}

export async function getEligibilityCounts(jobId: mongoose.Types.ObjectId | string) {
  const snapshots = await JobEligibility.find({ jobId }).lean();
  const eligible = snapshots.filter((s) => s.eligible).length;
  const total = snapshots.length;
  return {
    total,
    eligible,
    ineligible: total - eligible,
  };
}
