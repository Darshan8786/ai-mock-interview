import { Request, Response } from "express";
import mongoose from "mongoose";
import { AuthRequest } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { AppError } from "../../utils/AppError";
import { Job } from "../../models/Job";
import { Application } from "../../models/Application";
import { JobEligibility } from "../../models/JobEligibility";
import { StudentNotification } from "../../models/StudentNotification";
import { User } from "../../models/User";
import {
  recalculateJobEligibility,
  getEligibilityCounts,
} from "../../services/eligibilityService";

const JOB_STATUSES = ["active", "inactive", "closed", "expired"];
const APPLICATION_STATUSES = ["applied", "shortlisted", "rejected", "selected", "withdrawn"];

const FIELDS = [
  "companyName",
  "jobTitle",
  "jobDescription",
  "location",
  "jobType",
  "package",
  "requiredSkills",
  "eligibility",
  "lastDateToApply",
  "numberOfOpenings",
  "companyWebsite",
  "applicationLink",
  "experience",
  "responsibilities",
  "qualifications",
  "selectionProcess",
  "status",
];

const normalizeJobInput = (body: any) => {
  const out: Record<string, any> = {};

  FIELDS.forEach((f) => {
    if (body[f] !== undefined) out[f] = body[f];
  });

  const required = ["companyName", "jobTitle", "jobDescription", "location", "jobType"];
  for (const key of required) {
    if (!out[key] || !String(out[key]).trim()) {
      throw new AppError(`${key} is required`, 400);
    }
  }

  if (!out.lastDateToApply || isNaN(new Date(out.lastDateToApply).getTime())) {
    throw new AppError("A valid lastDateToApply is required", 400);
  }
  out.lastDateToApply = new Date(out.lastDateToApply);

  if (out.status !== undefined && !JOB_STATUSES.includes(out.status)) {
    throw new AppError("Invalid job status", 400);
  }

  if (out.eligibility !== undefined) {
    if (typeof out.eligibility !== "object" || out.eligibility === null) {
      throw new AppError("eligibility must be an object", 400);
    }
    const { minimumCGPA, maximumBacklogs, allowedDepartments } = out.eligibility;
    const clean: Record<string, any> = {};
    if (minimumCGPA !== undefined && minimumCGPA !== null) {
      const val = Number(minimumCGPA);
      if (isNaN(val) || val < 0 || val > 10) {
        throw new AppError("minimumCGPA must be between 0 and 10", 400);
      }
      clean.minimumCGPA = val;
    }
    if (maximumBacklogs !== undefined && maximumBacklogs !== null) {
      const val = Number(maximumBacklogs);
      if (isNaN(val) || val < 0 || val > 20) {
        throw new AppError("maximumBacklogs must be between 0 and 20", 400);
      }
      clean.maximumBacklogs = val;
    }
    if (allowedDepartments !== undefined) {
      if (!Array.isArray(allowedDepartments)) {
        throw new AppError("allowedDepartments must be an array", 400);
      }
      clean.allowedDepartments = allowedDepartments.map((d: any) => String(d).trim()).filter(Boolean);
    }
    out.eligibility = clean;
  }

  if (out.requiredSkills !== undefined) {
    if (!Array.isArray(out.requiredSkills)) {
      throw new AppError("requiredSkills must be an array", 400);
    }
    out.requiredSkills = out.requiredSkills.map((s: any) => String(s).trim()).filter(Boolean);
  }

  if (out.numberOfOpenings !== undefined && Number(out.numberOfOpenings) < 1) {
    throw new AppError("numberOfOpenings must be at least 1", 400);
  }

  return out;
};

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
  updatedAt: job.updatedAt,
  ...extra,
});

export const getAdminJobs = asyncHandler(async (req: Request, res: Response) => {
  const { search, status, company, sort } = req.query;

  const filter: Record<string, any> = {};
  if (status) filter.status = String(status);
  if (company) filter.companyName = { $regex: String(company), $options: "i" };
  if (search) {
    const q = String(search).trim();
    filter.$or = [
      { companyName: { $regex: q, $options: "i" } },
      { jobTitle: { $regex: q, $options: "i" } },
      { location: { $regex: q, $options: "i" } },
    ];
  }

  const sortBy: Record<string, any> = sort === "deadline" ? { lastDateToApply: 1 } : { createdAt: -1 };

  const jobs: any[] = await Job.find(filter).sort(sortBy).lean();

  const counts: any[] = await Application.aggregate([
    { $match: { jobId: { $in: jobs.map((j) => j._id) } } },
    { $group: { _id: "$jobId", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));

  const eligAgg: any[] = await JobEligibility.aggregate([
    { $match: { jobId: { $in: jobs.map((j) => j._id) } } },
    { $group: { _id: "$jobId", eligible: { $sum: { $cond: ["$eligible", 1, 0] } }, total: { $sum: 1 } } },
  ]);
  const eligMap = new Map(eligAgg.map((e) => [String(e._id), e]));

  const now = Date.now();
  const data = jobs.map((job) => {
    const e = eligMap.get(String(job._id));
    return shapeJob(job, {
      applicants: countMap.get(String(job._id)) || 0,
      eligibilityCounts: {
        total: e?.total || 0,
        eligible: e?.eligible || 0,
        ineligible: (e?.total || 0) - (e?.eligible || 0),
      },
      isExpired:
        job.status === "active" &&
        job.lastDateToApply &&
        new Date(job.lastDateToApply).getTime() < now,
    });
  });

  res.json({ status: "success", results: data.length, data });
});

export const getAdminJob = asyncHandler(async (req: Request, res: Response, next: any) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return next(new AppError("Invalid job id", 400));
  }
  const job: any = await Job.findById(req.params.id).lean();
  if (!job) return next(new AppError("Job not found", 404));

  const [applicants, elig] = await Promise.all([
    Application.countDocuments({ jobId: job._id }),
    getEligibilityCounts(job._id),
  ]);

  res.json({
    status: "success",
    data: shapeJob(job, { applicants, eligibilityCounts: elig }),
  });
});

export const createJob = asyncHandler(async (req: AuthRequest, res: Response) => {
  const input = normalizeJobInput(req.body);
  input.createdBy = req.user._id;
  input.status = input.status || "active";

  const job = await Job.create(input);

  // Automatically check every student against the new job's criteria.
  let eligibilityCounts = { total: 0, eligible: 0, ineligible: 0 };
  try {
    const result = await recalculateJobEligibility(job._id.toString());
    eligibilityCounts = result;
  } catch (err) {
    console.error("[JobEligibility] recalc failed on create:", err);
  }

  res.status(201).json({
    status: "success",
    message: "Job created successfully",
    data: shapeJob(job, { applicants: 0, eligibilityCounts }),
  });
});

export const updateJob = asyncHandler(async (req: Request, res: Response, next: any) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return next(new AppError("Invalid job id", 400));
  }
  const input = normalizeJobInput(req.body);

  const job = await Job.findByIdAndUpdate(req.params.id, input, {
    new: true,
    runValidators: true,
  });
  if (!job) return next(new AppError("Job not found", 404));

  // Eligibility criteria may have changed → recalculate the eligible list.
  let eligibilityCounts = { total: 0, eligible: 0, ineligible: 0 };
  try {
    const result = await recalculateJobEligibility(job._id.toString());
    eligibilityCounts = result;
  } catch (err) {
    console.error("[JobEligibility] recalc failed on update:", err);
  }

  const applicants = await Application.countDocuments({ jobId: job._id });

  res.json({
    status: "success",
    message: "Job updated successfully",
    data: shapeJob(job, { applicants, eligibilityCounts }),
  });
});

export const deleteJob = asyncHandler(async (req: Request, res: Response, next: any) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return next(new AppError("Invalid job id", 400));
  }
  const job = await Job.findByIdAndDelete(req.params.id);
  if (!job) return next(new AppError("Job not found", 404));

  await Promise.all([
    Application.deleteMany({ jobId: job._id }),
    JobEligibility.deleteMany({ jobId: job._id }),
    StudentNotification.deleteMany({ jobId: job._id }),
  ]);

  res.json({ status: "success", message: "Job deleted successfully" });
});

export const setJobStatus = asyncHandler(async (req: Request, res: Response, next: any) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return next(new AppError("Invalid job id", 400));
  }
  const { status } = req.body;
  if (!JOB_STATUSES.includes(status)) {
    return next(new AppError("Invalid job status", 400));
  }

  const job = await Job.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true, runValidators: true }
  );
  if (!job) return next(new AppError("Job not found", 404));

  const applicants = await Application.countDocuments({ jobId: job._id });

  res.json({
    status: "success",
    message: `Job status updated to ${status}`,
    data: shapeJob(job, { applicants }),
  });
});

export const getJobApplications = asyncHandler(
  async (req: Request, res: Response, next: any) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return next(new AppError("Invalid job id", 400));
    }
    const job: any = await Job.findById(req.params.id).lean();
    if (!job) return next(new AppError("Job not found", 404));

    const apps: any[] = await Application.find({ jobId: job._id })
      .sort({ createdAt: -1 })
      .lean();

    const stats: Record<string, number> = {
      total: apps.length,
      applied: 0,
      shortlisted: 0,
      rejected: 0,
      selected: 0,
      withdrawn: 0,
    };
    const data = apps.map((a) => {
      stats[a.status] = (stats[a.status] || 0) + 1;
      return {
        id: a._id,
        jobId: a.jobId,
        studentName: a.studentName,
        usn: a.usn,
        email: a.email,
        department: a.department,
        cgpa: a.cgpa,
        resumeUrl: a.resumeUrl,
        status: a.status,
        appliedAt: a.createdAt,
      };
    });

    res.json({
      status: "success",
      results: data.length,
      data: { job: shapeJob(job), stats, applications: data },
    });
  }
);

export const updateApplicationStatus = asyncHandler(
  async (req: Request, res: Response, next: any) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return next(new AppError("Invalid application id", 400));
    }
    const { status } = req.body;
    if (!APPLICATION_STATUSES.includes(status)) {
      return next(new AppError("Invalid application status", 400));
    }

    const app = await Application.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );
    if (!app) return next(new AppError("Application not found", 404));

    res.json({
      status: "success",
      message: `Application marked as ${status}`,
      data: { application: app },
    });
  }
);

// ── Eligibility engine (admin) ─────────────────────────────

const shapeEligibleStudent = (s: any, snap: any) => ({
  id: s?._id,
  usn: s?.usn || "",
  name: s?.name || "",
  email: s?.email || "",
  department: s?.department || "",
  year: s?.year || "",
  semester: s?.semester || "",
  cgpa: typeof s?.cgpa === "number" ? s.cgpa : null,
  backlogs: s?.backlogs ?? 0,
  eligible: snap.eligible,
  reasons: snap.reasons || [],
  checkedAt: snap.checkedAt,
});

const loadJobOrThrow = async (id: string) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid job id", 400);
  }
  const job = await Job.findById(id);
  if (!job) throw new AppError("Job not found", 404);
  return job;
};

export const getEligibleStudents = asyncHandler(
  async (req: Request, res: Response) => {
    const job = await loadJobOrThrow(req.params.id);

    const [snapshots, totalStudents] = await Promise.all([
      JobEligibility.find({ jobId: job._id, eligible: true }).lean(),
      User.countDocuments({ role: "user" }),
    ]);
    const students: any[] = await User.find({
      _id: { $in: snapshots.map((s) => s.studentId) },
    }).lean();
    const studentMap = new Map(students.map((s) => [String(s._id), s]));

    const data = snapshots.map((snap) =>
      shapeEligibleStudent(studentMap.get(String(snap.studentId)), snap)
    );

    res.json({
      status: "success",
      results: data.length,
      data: { job: shapeJob(job), totalStudents, totalEligible: data.length, students: data },
    });
  }
);

export const getIneligibleStudents = asyncHandler(
  async (req: Request, res: Response) => {
    const job = await loadJobOrThrow(req.params.id);

    const [snapshots, totalStudents, totalEligible] = await Promise.all([
      JobEligibility.find({ jobId: job._id, eligible: false }).lean(),
      User.countDocuments({ role: "user" }),
      JobEligibility.countDocuments({ jobId: job._id, eligible: true }),
    ]);
    const students: any[] = await User.find({
      _id: { $in: snapshots.map((s) => s.studentId) },
    }).lean();
    const studentMap = new Map(students.map((s) => [String(s._id), s]));

    const data = snapshots.map((snap) =>
      shapeEligibleStudent(studentMap.get(String(snap.studentId)), snap)
    );

    res.json({
      status: "success",
      results: data.length,
      data: { job: shapeJob(job), totalStudents, totalEligible, students: data },
    });
  }
);

export const recalculateEligibility = asyncHandler(
  async (req: Request, res: Response) => {
    const job = await loadJobOrThrow(req.params.id);

    const result = await recalculateJobEligibility(job._id.toString());

    res.json({
      status: "success",
      message: `Eligibility recalculated: ${result.eligible} of ${result.total} students eligible`,
      data: result,
    });
  }
);

export const notifyEligibleStudents = asyncHandler(
  async (req: Request, res: Response, next: any) => {
    const job = await loadJobOrThrow(req.params.id);

    const now = new Date();
    const isExpired = job.lastDateToApply
      ? new Date(job.lastDateToApply).getTime() < now.getTime()
      : false;
    if (job.status !== "active" || isExpired) {
      return next(
        new AppError(
          "Eligibility notifications can only be sent for active jobs that have not passed their application deadline.",
          400
        )
      );
    }

    const snapshots: any[] = await JobEligibility.find({
      jobId: job._id,
      eligible: true,
    })
      .select("studentId")
      .lean();

    // Only notify students whose accounts are active.
    const activeUsers = await User.find({
      _id: { $in: snapshots.map((s) => s.studentId) },
      isActive: true,
    })
      .select("_id")
      .lean();
    const activeIds = new Set(activeUsers.map((u) => String(u._id)));
    const activeSnapshots = snapshots.filter((s) =>
      activeIds.has(String(s.studentId))
    );

    if (activeSnapshots.length === 0) {
      return next(
        new AppError("No active eligible students found. Recalculate eligibility first.", 400)
      );
    }

    const title = `New Placement Opportunity — ${job.companyName}`;
    const body = `${job.companyName} is hiring ${job.jobTitle}. You are eligible for this placement opportunity. Package: ${
      job.package || "—"
    } · Location: ${job.location || "—"} · Last Date: ${new Date(
      job.lastDateToApply
    ).toLocaleDateString()}`;

    const ops = activeSnapshots.map((s) => ({
      updateOne: {
        filter: { studentId: s.studentId, jobId: job._id, type: "job_eligible" },
        update: {
          $setOnInsert: {
            studentId: s.studentId,
            jobId: job._id,
            type: "job_eligible",
            title,
            body,
            job: {
              jobId: job._id,
              companyName: job.companyName,
              jobTitle: job.jobTitle,
              package: job.package || "",
              location: job.location || "",
              lastDateToApply: job.lastDateToApply,
            },
            read: false,
          },
        },
        upsert: true,
      },
    }));

    let created = 0;
    let skipped = 0;
    if (ops.length > 0) {
      const result = await StudentNotification.bulkWrite(ops, { ordered: false });
      created = result.upsertedCount;
      skipped = result.matchedCount;
    }

    res.json({
      status: "success",
      message: `Eligibility notification sent to ${created} student(s)`,
      data: { eligible: activeSnapshots.length, created, skipped },
    });
  }
);
