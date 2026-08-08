import type { Request, Response } from "express";
import { Job } from "../models/Job.model";
import { Company } from "../models/Company.model";
import { Application } from "../models/Application.model";
import { Interview } from "../models/Interview.model";
import { catchAsync } from "../utils/catchAsync";
import { AppError } from "../utils/AppError";
import { executePaginated, buildMongooseFilter } from "../utils/apiFeatures";
import { sendSuccess, sendCreated, sendDeleted } from "../utils/response";
import type { CreateJobBody, UpdateJobBody } from "../validators/job.validator";

const JOB_POPULATE = { path: "company", select: "companyName logo location status" };

export const getJobs = catchAsync(async (req: Request, res: Response) => {
  const filters = buildMongooseFilter(["status", "company", "location"], req.query);
  const result = await executePaginated(Job.find(), req.query, {
    searchFields: ["title", "eligibility"],
    filters,
    populate: [JOB_POPULATE],
  });
  sendSuccess(res, result.data, "Jobs fetched successfully", 200, result.meta);
});

export const getJobById = catchAsync(async (req: Request, res: Response) => {
  const job = await Job.findById(req.params.id).populate(JOB_POPULATE).lean();
  if (!job) {
    throw new AppError("Job not found", 404);
  }

  const [applicationCount, interviewCount] = await Promise.all([
    Application.countDocuments({ job: job._id }),
    Interview.countDocuments({ job: job._id }),
  ]);

  sendSuccess(
    res,
    { ...job, applicationCount, interviewCount },
    "Job fetched successfully",
    200
  );
});

export const createJob = catchAsync(async (req: Request, res: Response) => {
  const body = req.body as CreateJobBody;

  const company = await Company.findById(body.company);
  if (!company) {
    throw new AppError("Company not found", 404);
  }

  const job = await Job.create(body);
  sendCreated(res, job, "Job created successfully");
});

export const updateJob = catchAsync(async (req: Request, res: Response) => {
  const body = req.body as UpdateJobBody;

  const job = await Job.findByIdAndUpdate(req.params.id, body, {
    new: true,
    runValidators: true,
  }).populate(JOB_POPULATE);

  if (!job) {
    throw new AppError("Job not found", 404);
  }
  sendSuccess(res, job, "Job updated successfully", 200);
});

export const deleteJob = catchAsync(async (req: Request, res: Response) => {
  const job = await Job.findByIdAndDelete(req.params.id);
  if (!job) {
    throw new AppError("Job not found", 404);
  }

  // Cascade-delete applications and interviews for this job
  await Promise.all([
    Application.deleteMany({ job: job._id }),
    Interview.deleteMany({ job: job._id }),
  ]);

  sendDeleted(res, "Job deleted successfully");
});
