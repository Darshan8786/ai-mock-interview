import type { Request, Response } from "express";
import { Company } from "../models/Company.model";
import { Job } from "../models/Job.model";
import { catchAsync } from "../utils/catchAsync";
import { AppError } from "../utils/AppError";
import { executePaginated, buildMongooseFilter } from "../utils/apiFeatures";
import { sendSuccess, sendCreated, sendDeleted } from "../utils/response";
import type { CreateCompanyBody, UpdateCompanyBody } from "../validators/company.validator";

export const getCompanies = catchAsync(async (req: Request, res: Response) => {
  const filters = buildMongooseFilter(["status"], req.query);
  const result = await executePaginated(Company.find(), req.query, {
    searchFields: ["companyName", "hrName", "email"],
    filters,
  });
  sendSuccess(res, result.data, "Companies fetched successfully", 200, result.meta);
});

export const getCompanyById = catchAsync(async (req: Request, res: Response) => {
  const company = await Company.findById(req.params.id).lean();
  if (!company) {
    throw new AppError("Company not found", 404);
  }

  const jobs = await Job.find({ company: company._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  sendSuccess(res, { ...company, jobs }, "Company fetched successfully", 200);
});

export const createCompany = catchAsync(async (req: Request, res: Response) => {
  const body = req.body as CreateCompanyBody;

  const existing = await Company.findOne({ companyName: body.companyName });
  if (existing) {
    throw new AppError("A company with this name already exists", 409);
  }

  const company = await Company.create(body);
  sendCreated(res, company, "Company created successfully");
});

export const updateCompany = catchAsync(async (req: Request, res: Response) => {
  const body = req.body as UpdateCompanyBody;

  const existing = await Company.findById(req.params.id);
  if (!existing) {
    throw new AppError("Company not found", 404);
  }

  if (body.companyName && body.companyName !== existing.companyName) {
    const nameTaken = await Company.findOne({ companyName: body.companyName });
    if (nameTaken) {
      throw new AppError("A company with this name already exists", 409);
    }
  }

  const company = await Company.findByIdAndUpdate(req.params.id, body, {
    new: true,
    runValidators: true,
  });
  sendSuccess(res, company, "Company updated successfully", 200);
});

export const deleteCompany = catchAsync(async (req: Request, res: Response) => {
  const company = await Company.findByIdAndDelete(req.params.id);
  if (!company) {
    throw new AppError("Company not found", 404);
  }

  await Job.deleteMany({ company: company._id });
  sendDeleted(res, "Company deleted successfully");
});
