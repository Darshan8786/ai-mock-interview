import type { Request, Response } from "express";
import type { PopulateOptions } from "mongoose";
import { Application } from "../models/Application.model";
import { Student } from "../models/Student.model";
import { Job } from "../models/Job.model";
import { catchAsync } from "../utils/catchAsync";
import { AppError } from "../utils/AppError";
import { executePaginated, buildMongooseFilter } from "../utils/apiFeatures";
import { sendSuccess, sendCreated, sendDeleted } from "../utils/response";
import type {
  CreateApplicationBody,
  UpdateApplicationStatusBody,
} from "../validators/application.validator";

const APPLICATION_POPULATE: PopulateOptions[] = [
  { path: "student", select: "name email avatar department batch placementReadiness" },
  {
    path: "job",
    select: "title company status package",
    populate: { path: "company", select: "companyName logo" },
  },
];

export const getApplications = catchAsync(async (req: Request, res: Response) => {
  const filters = buildMongooseFilter(["status", "job", "student"], req.query);
  const result = await executePaginated(Application.find(), req.query, {
    searchFields: [],
    filters,
    populate: APPLICATION_POPULATE,
  });
  sendSuccess(res, result.data, "Applications fetched successfully", 200, result.meta);
});

export const getApplicationById = catchAsync(async (req: Request, res: Response) => {
  const application = await Application.findById(req.params.id)
    .populate(APPLICATION_POPULATE)
    .lean();
  if (!application) {
    throw new AppError("Application not found", 404);
  }
  sendSuccess(res, application, "Application fetched successfully", 200);
});

export const createApplication = catchAsync(async (req: Request, res: Response) => {
  const body = req.body as CreateApplicationBody;

  const [student, job] = await Promise.all([
    Student.findById(body.student),
    Job.findById(body.job),
  ]);
  if (!student) {
    throw new AppError("Student not found", 404);
  }
  if (!job) {
    throw new AppError("Job not found", 404);
  }

  const existing = await Application.findOne({
    student: body.student,
    job: body.job,
  });
  if (existing) {
    throw new AppError("This student has already applied for this job", 409);
  }

  const application = await Application.create(body);
  sendCreated(res, application, "Application created successfully");
});

export const updateApplicationStatus = catchAsync(
  async (req: Request, res: Response) => {
    const body = req.body as UpdateApplicationStatusBody;

    const application = await Application.findById(req.params.id);
    if (!application) {
      throw new AppError("Application not found", 404);
    }

    application.status = body.status;
    application.statusHistory.push({
      status: body.status,
      changedAt: new Date(),
    });
    if (body.atsScore !== undefined) {
      application.atsScore = body.atsScore;
    }
    await application.save();

    sendSuccess(
      res,
      application,
      `Application marked as ${body.status}`,
      200
    );
  }
);

export const deleteApplication = catchAsync(async (req: Request, res: Response) => {
  const application = await Application.findByIdAndDelete(req.params.id);
  if (!application) {
    throw new AppError("Application not found", 404);
  }
  sendDeleted(res, "Application deleted successfully");
});
