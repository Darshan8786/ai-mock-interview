import type { Request, Response } from "express";
import type { PopulateOptions } from "mongoose";
import { Interview } from "../models/Interview.model";
import { Student } from "../models/Student.model";
import { Job } from "../models/Job.model";
import { catchAsync } from "../utils/catchAsync";
import { AppError } from "../utils/AppError";
import { executePaginated, buildMongooseFilter } from "../utils/apiFeatures";
import { sendSuccess, sendCreated, sendDeleted } from "../utils/response";
import type {
  CreateInterviewBody,
  UpdateInterviewBody,
  UpdateInterviewScoresBody,
} from "../validators/interview.validator";

const INTERVIEW_POPULATE: PopulateOptions[] = [
  { path: "student", select: "name email avatar department batch" },
  { path: "job", select: "title company package", populate: { path: "company", select: "companyName logo" } },
];

export const getInterviews = catchAsync(async (req: Request, res: Response) => {
  const filters = buildMongooseFilter(["status", "student", "job", "mode"], req.query);
  const result = await executePaginated(Interview.find(), req.query, {
    searchFields: ["interviewerName"],
    filters,
    populate: INTERVIEW_POPULATE,
  });
  sendSuccess(res, result.data, "Interviews fetched successfully", 200, result.meta);
});

export const getInterviewById = catchAsync(async (req: Request, res: Response) => {
  const interview = await Interview.findById(req.params.id)
    .populate(INTERVIEW_POPULATE)
    .lean();
  if (!interview) {
    throw new AppError("Interview not found", 404);
  }
  sendSuccess(res, interview, "Interview fetched successfully", 200);
});

export const createInterview = catchAsync(async (req: Request, res: Response) => {
  const body = req.body as CreateInterviewBody;

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

  const interview = await Interview.create({
    ...body,
    conductedBy: req.admin?.id,
  });
  sendCreated(res, interview, "Interview scheduled successfully");
});

export const updateInterview = catchAsync(async (req: Request, res: Response) => {
  const body = req.body as UpdateInterviewBody;

  const interview = await Interview.findByIdAndUpdate(req.params.id, body, {
    new: true,
    runValidators: true,
  }).populate(INTERVIEW_POPULATE);

  if (!interview) {
    throw new AppError("Interview not found", 404);
  }
  sendSuccess(res, interview, "Interview updated successfully", 200);
});

export const updateInterviewScores = catchAsync(
  async (req: Request, res: Response) => {
    const body = req.body as UpdateInterviewScoresBody;

    const interview = await Interview.findById(req.params.id);
    if (!interview) {
      throw new AppError("Interview not found", 404);
    }

    if (body.scores) {
      const current = interview.scores ?? {};
      interview.scores = { ...current, ...body.scores };
    }
    if (body.feedback) {
      interview.feedback = body.feedback;
    }
    if (body.status === "completed") {
      interview.status = "completed";
    }
    await interview.save();

    sendSuccess(res, interview, "Interview scores updated successfully", 200);
  }
);

export const deleteInterview = catchAsync(async (req: Request, res: Response) => {
  const interview = await Interview.findByIdAndDelete(req.params.id);
  if (!interview) {
    throw new AppError("Interview not found", 404);
  }
  sendDeleted(res, "Interview deleted successfully");
});
