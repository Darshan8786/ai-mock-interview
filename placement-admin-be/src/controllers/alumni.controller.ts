import type { Request, Response } from "express";
import { Alumni } from "../models/Alumni.model";
import { catchAsync } from "../utils/catchAsync";
import { AppError } from "../utils/AppError";
import { executePaginated } from "../utils/apiFeatures";
import { sendSuccess, sendCreated, sendDeleted } from "../utils/response";
import type { CreateAlumniBody, UpdateAlumniBody } from "../validators/alumni.validator";

const DUPLICATE_EMAIL = "An alumni with this email already exists";

/**
 * The validate middleware only checks the request; it does not replace req.body
 * with the parsed value, so trimming has to be applied here before saving.
 */
const cleanOpening = <T extends { requiredSkills?: string[] }>(opening: T): T => ({
  ...opening,
  requiredSkills: (opening.requiredSkills ?? []).map((s) => s.trim()).filter(Boolean),
});

export const getAlumni = catchAsync(async (req: Request, res: Response) => {
  const filters: Record<string, unknown> = {};
  if (req.query.hasOpening === "true") filters.hasOpening = true;
  if (req.query.hasOpening === "false") filters.hasOpening = false;

  const result = await executePaginated(Alumni.find(), req.query, {
    searchFields: ["name", "email", "department", "currentCompany", "currentJobRole", "opening.jobTitle"],
    filters,
  });
  sendSuccess(res, result.data, "Alumni fetched successfully", 200, result.meta);
});

export const getAlumniById = catchAsync(async (req: Request, res: Response) => {
  const alumni = await Alumni.findById(req.params.id).lean();
  if (!alumni) {
    throw new AppError("Alumni not found", 404);
  }
  sendSuccess(res, alumni, "Alumni fetched successfully", 200);
});

export const createAlumni = catchAsync(async (req: Request, res: Response) => {
  const body = req.body as CreateAlumniBody;

  const existing = await Alumni.findOne({ email: body.email.toLowerCase() });
  if (existing) {
    throw new AppError(DUPLICATE_EMAIL, 409);
  }

  const { hasOpening, opening, ...rest } = body;
  const alumni = await Alumni.create({
    ...rest,
    hasOpening: !!hasOpening,
    // The opening only exists while hasOpening is true.
    ...(hasOpening && opening ? { opening: cleanOpening(opening) } : {}),
  });
  sendCreated(res, alumni, "Alumni created successfully");
});

export const updateAlumni = catchAsync(async (req: Request, res: Response) => {
  const body = req.body as UpdateAlumniBody;

  const existing = await Alumni.findById(req.params.id);
  if (!existing) {
    throw new AppError("Alumni not found", 404);
  }

  if (body.email && body.email.toLowerCase() !== existing.email) {
    const emailTaken = await Alumni.findOne({ email: body.email.toLowerCase() });
    if (emailTaken) {
      throw new AppError(DUPLICATE_EMAIL, 409);
    }
  }

  const { hasOpening, opening, ...fields } = body;
  const willHaveOpening = hasOpening ?? existing.hasOpening;

  // Keep hasOpening and the opening details consistent: turning it on needs details
  // (from this request or already stored); turning it off removes them.
  const update: Record<string, unknown> = { ...fields, hasOpening: willHaveOpening };
  const unset: Record<string, 1> = {};
  if (!willHaveOpening) {
    unset.opening = 1;
  } else if (opening) {
    update.opening = cleanOpening(opening);
  } else if (!existing.opening) {
    throw new AppError("Job opening details are required when hasOpening is true", 400);
  }

  const alumni = await Alumni.findByIdAndUpdate(
    req.params.id,
    { $set: update, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
    { new: true, runValidators: true }
  );
  sendSuccess(res, alumni, "Alumni updated successfully", 200);
});

export const deleteAlumni = catchAsync(async (req: Request, res: Response) => {
  const alumni = await Alumni.findByIdAndDelete(req.params.id);
  if (!alumni) {
    throw new AppError("Alumni not found", 404);
  }
  sendDeleted(res, "Alumni deleted successfully");
});

/**
 * Public, read-only list of alumni job openings that are still open, for the
 * student-facing Jobs page. Deliberately exposes only what students need to see
 * and apply — no alumni email or LinkedIn.
 */
export const getOpenAlumniOpenings = catchAsync(async (_req: Request, res: Response) => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const rows = await Alumni.find({
    hasOpening: true,
    "opening.lastDateToApply": { $gte: startOfToday },
  })
    .sort({ "opening.lastDateToApply": 1 })
    .limit(100)
    .lean();

  const openings = rows.map((a) => ({
    id: a._id,
    alumniName: a.name,
    graduationYear: a.graduationYear,
    currentCompany: a.currentCompany,
    currentJobRole: a.currentJobRole,
    jobTitle: a.opening?.jobTitle,
    location: a.opening?.location,
    requiredSkills: a.opening?.requiredSkills ?? [],
    jobDescription: a.opening?.jobDescription,
    applicationLink: a.opening?.applicationLink,
    lastDateToApply: a.opening?.lastDateToApply,
  }));
  sendSuccess(res, openings, "Alumni job openings fetched successfully", 200);
});
