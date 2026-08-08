import type { Request, Response } from "express";
import { Student } from "../models/Student.model";
import { hashPassword } from "../services/password.service";
import { catchAsync } from "../utils/catchAsync";
import { AppError } from "../utils/AppError";
import { executePaginated, buildMongooseFilter } from "../utils/apiFeatures";
import { sendSuccess, sendCreated, sendDeleted } from "../utils/response";
import type { CreateStudentBody, UpdateStudentBody } from "../validators/student.validator";
import { Application } from "../models/Application.model";
import { Interview } from "../models/Interview.model";

export const getStudents = catchAsync(async (req: Request, res: Response) => {
  const filters = buildMongooseFilter(["department", "batch", "status"], req.query);
  const result = await executePaginated(Student.find(), req.query, {
    searchFields: ["name", "email"],
    filters,
  });
  sendSuccess(res, result.data, "Students fetched successfully", 200, result.meta);
});

export const getStudentById = catchAsync(async (req: Request, res: Response) => {
  const student = await Student.findById(req.params.id).lean();
  if (!student) {
    throw new AppError("Student not found", 404);
  }

  const [applications, interviews] = await Promise.all([
    Application.find({ student: student._id })
      .populate({
        path: "job",
        select: "title company status",
        populate: { path: "company", select: "companyName logo" },
      })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
    Interview.find({ student: student._id })
      .populate("job", "title")
      .sort({ scheduledAt: -1 })
      .limit(10)
      .lean(),
  ]);

  sendSuccess(
    res,
    { ...student, applications, interviews },
    "Student fetched successfully",
    200
  );
});

export const createStudent = catchAsync(async (req: Request, res: Response) => {
  const body = req.body as CreateStudentBody;

  const existing = await Student.findOne({ email: body.email });
  if (existing) {
    throw new AppError("A student with this email already exists", 409);
  }

  const passwordHash = await hashPassword(body.password);
  const student = await Student.create({ ...body, password: passwordHash });

  sendCreated(res, student, "Student created successfully");
});

export const updateStudent = catchAsync(async (req: Request, res: Response) => {
  const body = req.body as UpdateStudentBody;

  const existing = await Student.findById(req.params.id);
  if (!existing) {
    throw new AppError("Student not found", 404);
  }

  if (body.email && body.email !== existing.email) {
    const emailTaken = await Student.findOne({ email: body.email });
    if (emailTaken) {
      throw new AppError("A student with this email already exists", 409);
    }
  }

  const updateData: Record<string, unknown> = { ...body };
  if (body.password) {
    updateData.password = await hashPassword(body.password);
  }

  const student = await Student.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
    runValidators: true,
  });
  sendSuccess(res, student, "Student updated successfully", 200);
});

export const deleteStudent = catchAsync(async (req: Request, res: Response) => {
  const student = await Student.findByIdAndDelete(req.params.id);
  if (!student) {
    throw new AppError("Student not found", 404);
  }

  // Cascade-delete related records
  await Promise.all([
    Application.deleteMany({ student: student._id }),
    Interview.deleteMany({ student: student._id }),
  ]);

  sendDeleted(res, "Student deleted successfully");
});
