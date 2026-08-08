import { Request, Response } from "express";
import mongoose from "mongoose";
import { User } from "../../models/User";
import { Interview } from "../../models/Interview";
import { AptitudeAttempt } from "../../models/AptitudeAttempt";
import { AttemptModel } from "../../db";
import { asyncHandler } from "../../utils/asyncHandler";
import { AppError } from "../../utils/AppError";
import { buildFilter, parsePagination, buildSearch } from "../../utils/queryHelpers";

const computeProfileCompletion = (user: any): number => {
  const checks: boolean[] = [
    !!user.name, !!user.usn, !!user.registerNumber,
    !!user.collegeEmail || !!user.personalEmail, !!user.phone,
    !!user.department, !!user.year, !!user.semester, !!user.section,
    typeof user.cgpa === "number" && user.cgpa > 0,
    Array.isArray(user.skills) && user.skills.length > 0,
    Array.isArray(user.certifications) && user.certifications.length > 0,
    Array.isArray(user.projects) && user.projects.length > 0,
    !!user.resumeUrl, !!user.profilePhoto,
    !!user.linkedin || !!user.github || !!user.portfolio,
    !!user.address, !!user.dateOfBirth,
  ];
  const filled = checks.filter(Boolean).length;
  return Math.round((filled / checks.length) * 100);
};

const shapeStudent = (s: any) => ({
  id: s._id,
  name: s.name,
  email: s.email,
  usn: s.usn,
  registerNumber: s.registerNumber,
  collegeEmail: s.collegeEmail,
  personalEmail: s.personalEmail,
  phone: s.phone,
  department: s.department,
  year: s.year,
  semester: s.semester,
  section: s.section,
  cgpa: s.cgpa,
  skills: s.skills || [],
  certifications: s.certifications || [],
  projects: s.projects || [],
  resumeUrl: s.resumeUrl,
  profilePhoto: s.profilePhoto,
  linkedin: s.linkedin,
  github: s.github,
  portfolio: s.portfolio,
  address: s.address,
  dateOfBirth: s.dateOfBirth,
  placementStatus: s.placementStatus,
  verificationStatus: s.verificationStatus,
  isActive: s.isActive,
  lastLoginAt: s.lastLoginAt,
  createdAt: s.createdAt,
  profileCompletion: computeProfileCompletion(s),
});

export const getStudents = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, sort, skip } = parsePagination(req.query);

  const filter: Record<string, any> = { role: "user" };
  Object.assign(filter, buildFilter(req.query, [
    "department", "year", "semester", "section",
    "placementStatus", "verificationStatus", "usn",
  ]));
  if (req.query.cgpaMin || req.query.cgpaMax) {
    filter.cgpa = {};
    if (req.query.cgpaMin) filter.cgpa.$gte = Number(req.query.cgpaMin);
    if (req.query.cgpaMax) filter.cgpa.$lte = Number(req.query.cgpaMax);
  }
  if (req.query.isActive !== undefined) {
    filter.isActive = req.query.isActive === "true" || req.query.isActive === "1";
  }
  const search = buildSearch(req.query, ["name", "email", "usn", "registerNumber"]);
  if (search) filter.$and = [search];

  const [total, docs] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter).sort(sort).skip(skip).limit(limit).lean(),
  ]);

  const data = await Promise.all(
    docs.map(async (s) => {
      const [interviews, aptitudes, quizAttempts] = await Promise.all([
        Interview.countDocuments({ user: s._id, status: { $in: ["completed", "terminated"] } }),
        AptitudeAttempt.countDocuments({ user: s._id }),
        AttemptModel.countDocuments({ userId: s._id }),
      ]);
      return { ...shapeStudent(s), interviewsTaken: interviews, aptitudeAttempts: aptitudes, quizAttempts };
    })
  );

  res.json({
    status: "success",
    results: data.length,
    total,
    page,
    limit,
    data,
  });
});

export const getStudent = asyncHandler(async (req: Request, res: Response) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new AppError("Invalid student id", 400);
  }
  const student = await User.findOne({ _id: req.params.id, role: "user" }).lean();
  if (!student) throw new AppError("Student not found", 404);

  const [interviews, aptitudes, attempts, reports] = await Promise.all([
    Interview.find({ user: student._id }).sort({ createdAt: -1 }).limit(50).lean(),
    AptitudeAttempt.find({ user: student._id }).sort({ createdAt: -1 }).limit(50).lean(),
    AttemptModel.find({ userId: student._id }).sort({ createdAt: -1 }).limit(200).lean(),
    null,
  ]);
  void reports;

  res.json({
    status: "success",
    data: {
      student: shapeStudent(student),
      interviews,
      aptitudes,
      quizAttempts: attempts,
    },
  });
});

export const updateStudent = asyncHandler(async (req: Request, res: Response) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new AppError("Invalid student id", 400);
  }

  const allowed = [
    "name", "usn", "registerNumber", "collegeEmail", "personalEmail",
    "phone", "department", "year", "semester", "section", "cgpa",
    "skills", "certifications", "projects", "resumeUrl", "profilePhoto",
    "linkedin", "github", "portfolio", "address", "dateOfBirth",
    "placementStatus", "verificationStatus", "isActive",
  ];
  const update: Record<string, any> = {};
  allowed.forEach((f) => {
    if (req.body[f] !== undefined) update[f] = req.body[f];
  });

  if (Object.keys(update).length === 0) {
    throw new AppError("No valid fields provided", 400);
  }

  const student = await User.findOneAndUpdate(
    { _id: req.params.id, role: "user" },
    update,
    { new: true, runValidators: true }
  );
  if (!student) throw new AppError("Student not found", 404);

  res.json({ status: "success", data: { student: shapeStudent(student) } });
});

export const deleteStudent = asyncHandler(async (req: Request, res: Response) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new AppError("Invalid student id", 400);
  }
  const student = await User.findOneAndDelete({ _id: req.params.id, role: "user" });
  if (!student) throw new AppError("Student not found", 404);

  await Promise.all([
    Interview.deleteMany({ user: student._id }),
    AptitudeAttempt.deleteMany({ user: student._id }),
    AttemptModel.deleteMany({ userId: student._id }),
  ]);

  res.json({ status: "success", message: "Student deleted successfully" });
});

// ── Verification / approval actions ─────────────────────────

export const verifyStudent = asyncHandler(async (req: Request, res: Response) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new AppError("Invalid student id", 400);
  }
  const student = await User.findOneAndUpdate(
    { _id: req.params.id, role: "user" },
    { verificationStatus: "verified" },
    { new: true, runValidators: true }
  );
  if (!student) throw new AppError("Student not found", 404);
  res.json({ status: "success", data: { student: shapeStudent(student) } });
});

export const rejectStudent = asyncHandler(async (req: Request, res: Response) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new AppError("Invalid student id", 400);
  }
  const student = await User.findOneAndUpdate(
    { _id: req.params.id, role: "user" },
    { verificationStatus: "rejected" },
    { new: true, runValidators: true }
  );
  if (!student) throw new AppError("Student not found", 404);
  res.json({ status: "success", data: { student: shapeStudent(student) } });
});

export const setPlacementStatus = asyncHandler(async (req: Request, res: Response) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new AppError("Invalid student id", 400);
  }
  const { placementStatus } = req.body;
  if (!["not_applied", "applied", "shortlisted", "selected", "not_selected", "placed"].includes(placementStatus)) {
    throw new AppError("Invalid placement status", 400);
  }
  const student = await User.findOneAndUpdate(
    { _id: req.params.id, role: "user" },
    { placementStatus },
    { new: true, runValidators: true }
  );
  if (!student) throw new AppError("Student not found", 404);
  res.json({ status: "success", data: { student: shapeStudent(student) } });
});
