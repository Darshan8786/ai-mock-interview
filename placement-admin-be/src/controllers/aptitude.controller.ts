import type { Request, Response } from "express";
import { AptitudeTest, AptitudeAttempt } from "../models/AptitudeTest.model";
import { catchAsync } from "../utils/catchAsync";
import { AppError } from "../utils/AppError";
import { executePaginated, buildMongooseFilter } from "../utils/apiFeatures";
import { sendSuccess, sendCreated, sendDeleted } from "../utils/response";
import type {
  CreateAptitudeTestBody,
  UpdateAptitudeTestBody,
} from "../validators/aptitude.validator";

export const getAptitudeTests = catchAsync(async (req: Request, res: Response) => {
  const filters = buildMongooseFilter(["status", "category", "difficulty"], req.query);
  const result = await executePaginated(AptitudeTest.find(), req.query, {
    searchFields: ["title", "description"],
    filters,
  });
  sendSuccess(res, result.data, "Aptitude tests fetched successfully", 200, result.meta);
});

export const getAptitudeTestById = catchAsync(async (req: Request, res: Response) => {
  const test = await AptitudeTest.findById(req.params.id).lean();
  if (!test) {
    throw new AppError("Aptitude test not found", 404);
  }

  const attempts = await AptitudeAttempt.countDocuments({ test: test._id });
  sendSuccess(res, { ...test, totalAttempts: attempts }, "Aptitude test fetched successfully", 200);
});

export const createAptitudeTest = catchAsync(async (req: Request, res: Response) => {
  const body = req.body as CreateAptitudeTestBody;
  const test = await AptitudeTest.create(body);
  sendCreated(res, test, "Aptitude test created successfully");
});

export const updateAptitudeTest = catchAsync(async (req: Request, res: Response) => {
  const body = req.body as UpdateAptitudeTestBody;

  const test = await AptitudeTest.findByIdAndUpdate(req.params.id, body, {
    new: true,
    runValidators: true,
  });

  if (!test) {
    throw new AppError("Aptitude test not found", 404);
  }
  sendSuccess(res, test, "Aptitude test updated successfully", 200);
});

export const deleteAptitudeTest = catchAsync(async (req: Request, res: Response) => {
  const test = await AptitudeTest.findByIdAndDelete(req.params.id);
  if (!test) {
    throw new AppError("Aptitude test not found", 404);
  }

  await AptitudeAttempt.deleteMany({ test: test._id });
  sendDeleted(res, "Aptitude test deleted successfully");
});

export const getAptitudeResults = catchAsync(async (req: Request, res: Response) => {
  const test = await AptitudeTest.findById(req.params.id);
  if (!test) {
    throw new AppError("Aptitude test not found", 404);
  }

  const result = await executePaginated(
    AptitudeAttempt.find({ test: test._id }),
    req.query,
    {
      populate: [{ path: "student", select: "name email avatar department batch" }],
    }
  );
  sendSuccess(res, result.data, "Aptitude results fetched successfully", 200, result.meta);
});

export const getAptitudeResultById = catchAsync(async (req: Request, res: Response) => {
  const attempt = await AptitudeAttempt.findById(req.params.attemptId)
    .populate("student", "name email avatar department batch")
    .populate("test", "title category difficulty passingScore")
    .lean();
  if (!attempt) {
    throw new AppError("Aptitude attempt not found", 404);
  }
  sendSuccess(res, attempt, "Aptitude attempt fetched successfully", 200);
});

export const deleteAptitudeResult = catchAsync(async (req: Request, res: Response) => {
  const attempt = await AptitudeAttempt.findByIdAndDelete(req.params.attemptId);
  if (!attempt) {
    throw new AppError("Aptitude attempt not found", 404);
  }
  sendDeleted(res, "Aptitude attempt deleted successfully");
});
