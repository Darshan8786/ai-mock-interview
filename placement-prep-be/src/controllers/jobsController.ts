import { Request, Response } from "express";
import mongoose from "mongoose";
import { AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { Job } from "../models/Job";
import { Application } from "../models/Application";
import { computeJobEligibility } from "../utils/jobEligibility";

const shapeJob = (job: any, extra: Record<string, any> = {}) => ({
  id: job._id,
  companyName: job.companyName,
  jobTitle: job.jobTitle,
  jobDescription: job.jobDescription,
  location: job.location,
  jobType: job.jobType,
  package: job.package,
  requiredSkills: job.requiredSkills || [],
  eligibility: job.eligibility || {},
  lastDateToApply: job.lastDateToApply,
  numberOfOpenings: job.numberOfOpenings,
  companyWebsite: job.companyWebsite,
  applicationLink: job.applicationLink,
  experience: job.experience,
  responsibilities: job.responsibilities,
  qualifications: job.qualifications,
  selectionProcess: job.selectionProcess,
  status: job.status,
  postedAt: job.createdAt,
  ...extra,
});

/**
 * List all jobs a student is allowed to apply to (active + not past deadline),
 * with eligibility computed against the authenticated student.
 */
export const listJobs = asyncHandler(async (req: AuthRequest, res: Response) => {
  const now = new Date();

  const filter: Record<string, any> = {
    status: "active",
    lastDateToApply: { $gte: now },
  };

  const { q, jobType, location, company, department, sort } = req.query;

  if (q) {
    const qStr = String(q).trim();
    filter.$or = [
      { companyName: { $regex: qStr, $options: "i" } },
      { jobTitle: { $regex: qStr, $options: "i" } },
    ];
  }
  if (jobType) filter.jobType = String(jobType);
  if (company) filter.companyName = { $regex: String(company), $options: "i" };
  if (location) filter.location = { $regex: String(location), $options: "i" };
  if (department) {
    // Jobs open to this department OR open to all departments.
    const dept = String(department).trim().toLowerCase();
    filter.$and = [
      {
        $or: [
          { "eligibility.allowedDepartments": { $size: 0 } },
          { "eligibility.allowedDepartments": { $elemMatch: { $regex: new RegExp(`^${dept.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") } } },
        ],
      },
    ];
  }

  const sortBy: Record<string, 1 | -1> =
    sort === "deadline" ? { lastDateToApply: 1 } : { createdAt: -1 };

  const jobs: any[] = await Job.find(filter).sort(sortBy).lean();

  const jobIds = jobs.map((j) => j._id);
  const applied: any[] = await Application.find({
    jobId: { $in: jobIds },
    studentId: req.user._id,
  })
    .select("jobId")
    .lean();
  const appliedSet = new Set(applied.map((a: any) => String(a.jobId)));

  const data = jobs.map((job) => {
    const { eligible, reasons } = computeJobEligibility(job, req.user);
    return shapeJob(job, {
      eligibilityDetails: { eligible, reasons },
      hasApplied: appliedSet.has(String(job._id)),
    });
  });

  res.json({
    status: "success",
    results: data.length,
    data,
  });
});

/**
 * Get a single job with eligibility + applied state for the student.
 */
export const getJobDetail = asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return next(new AppError("Invalid job id", 400));
  }

  const now = new Date();
  const job: any = await Job.findOne({
    _id: req.params.id,
    status: "active",
    lastDateToApply: { $gte: now },
  }).lean();

  if (!job) return next(new AppError("Job not found or no longer open", 404));

  const existing = await Application.findOne({
    jobId: job._id,
    studentId: req.user._id,
  })
    .select("_id status createdAt")
    .lean();

  const { eligible, reasons } = computeJobEligibility(job, req.user);

  res.json({
    status: "success",
    data: shapeJob(job, {
      eligibilityDetails: { eligible, reasons },
      hasApplied: Boolean(existing),
      application: existing || null,
    }),
  });
});

/**
 * Apply to a job. Eligibility is always validated server-side using the
 * authenticated student record — never from request data.
 */
export const applyToJob = asyncHandler(
  async (req: AuthRequest, res: Response, next: any) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return next(new AppError("Invalid job id", 400));
    }

    const job = await Job.findOne({
      _id: req.params.id,
      status: "active",
      lastDateToApply: { $gte: new Date() },
    });

    if (!job) return next(new AppError("Job not found or no longer open", 404));

    const { eligible, reasons } = computeJobEligibility(job, req.user);
    if (!eligible) {
      return next(
        new AppError(
          `You are not eligible for this job. ${reasons.join(" ")}`,
          400
        )
      );
    }

    const existing = await Application.exists({
      jobId: job._id,
      studentId: req.user._id,
    });
    if (existing) {
      return next(new AppError("You have already applied to this job", 400));
    }

    const student = req.user;
    const application = await Application.create({
      jobId: job._id,
      studentId: student._id,
      studentName: student.name || "",
      usn: student.usn || "",
      email: student.personalEmail || student.collegeEmail || student.email || "",
      department: student.department || "",
      cgpa: typeof student.cgpa === "number" ? student.cgpa : null,
      resumeUrl: student.resumeUrl || "",
      status: "applied",
    });

    res.status(201).json({
      status: "success",
      message: "Application submitted successfully",
      data: { application },
    });
  }
);
