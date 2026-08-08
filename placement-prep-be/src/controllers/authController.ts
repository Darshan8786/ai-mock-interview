import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User";
import { AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { env } from "../config/env";
import bcrypt from "bcrypt";

const signToken = (id: string, role: string) => {
  return jwt.sign({ id, role }, env.JWT_SECRET, {
    expiresIn: "90d",
  });
};

// Whitelist of fields a student is allowed to update on their own profile.
const PROFILE_FIELDS = [
  "name",
  "usn",
  "registerNumber",
  "collegeEmail",
  "personalEmail",
  "phone",
  "department",
  "year",
  "semester",
  "section",
  "cgpa",
  "skills",
  "certifications",
  "projects",
  "resumeUrl",
  "resumeFileName",
  "profilePhoto",
  "linkedin",
  "github",
  "portfolio",
  "address",
  "dateOfBirth",
];

/**
 * Computes a 0-100 profile completion score based on which of the
 * student profile fields have been filled in.
 */
export const computeProfileCompletion = (user: any): number => {
  const checks: boolean[] = [
    !!user.name,
    !!user.usn,
    !!user.registerNumber,
    !!user.collegeEmail || !!user.personalEmail,
    !!user.phone,
    !!user.department,
    !!user.year,
    !!user.semester,
    !!user.section,
    typeof user.cgpa === "number" && user.cgpa > 0,
    Array.isArray(user.skills) && user.skills.length > 0,
    Array.isArray(user.certifications) && user.certifications.length > 0,
    Array.isArray(user.projects) && user.projects.length > 0,
    !!user.resumeUrl,
    !!user.profilePhoto,
    !!user.linkedin || !!user.github || !!user.portfolio,
    !!user.address,
    !!user.dateOfBirth,
  ];
  const filled = checks.filter(Boolean).length;
  return Math.round((filled / checks.length) * 100);
};

const sanitizeUser = (user: any) => {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    usn: user.usn,
    registerNumber: user.registerNumber,
    collegeEmail: user.collegeEmail,
    personalEmail: user.personalEmail,
    phone: user.phone,
    department: user.department,
    year: user.year,
    semester: user.semester,
    section: user.section,
    cgpa: user.cgpa,
    skills: user.skills,
    certifications: user.certifications,
    projects: user.projects,
    resumeUrl: user.resumeUrl,
    resumeFileName: user.resumeFileName,
    profilePhoto: user.profilePhoto,
    linkedin: user.linkedin,
    github: user.github,
    portfolio: user.portfolio,
    address: user.address,
    dateOfBirth: user.dateOfBirth,
    placementStatus: user.placementStatus,
    verificationStatus: user.verificationStatus,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    profileCompletion: computeProfileCompletion(user),
  };
};

export const register = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { name, email, password, role } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new AppError("Email already in use", 400));
    }

    // Security: never allow self-registration as admin
    const safeRole = role === "admin" ? "user" : "user";

    const newUser = await User.create({
      name,
      email,
      password,
      role: safeRole,
    });

    const token = signToken(newUser._id.toString(), newUser.role);

    res.status(201).json({
      status: "success",
      token,
      data: {
        user: sanitizeUser(newUser),
      },
    });
  }
);

export const login = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(new AppError("Please provide email and password", 400));
    }

    const user = await User.findOne({ email });

    // @ts-ignore - user methods defined in schema
    if (!user || !(await user.correctPassword(password))) {
      return next(new AppError("Incorrect email or password", 401));
    }

    if (!user.isActive) {
      return next(new AppError("Your account has been deactivated. Contact the Training & Placement Office.", 403));
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = signToken(user._id.toString(), user.role);

    res.status(200).json({
      status: "success",
      token,
      data: {
        user: sanitizeUser(user),
      },
    });
  }
);

export const getMe = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    return res.status(404).json({ status: "fail", message: "User not found" });
  }
  res.json({ status: "success", data: { user: sanitizeUser(user) } });
});

export const updateProfile = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const body: any = {};
    PROFILE_FIELDS.forEach((field) => {
      if (req.body[field] !== undefined) body[field] = req.body[field];
    });

    if (Object.keys(body).length === 0) {
      return next(new AppError("No valid profile fields provided", 400));
    }

    if (body.cgpa !== undefined && (body.cgpa < 0 || body.cgpa > 10)) {
      return next(new AppError("CGPA must be between 0 and 10", 400));
    }

    const updated = await User.findByIdAndUpdate(req.user._id, body, {
      new: true,
      runValidators: true,
    });

    res.json({ status: "success", data: { user: sanitizeUser(updated) } });
  }
);

export const changePassword = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return next(new AppError("Please provide current and new password", 400));
    }
    if (newPassword.length < 6) {
      return next(new AppError("New password must be at least 6 characters", 400));
    }

    const user = await User.findById(req.user._id);
    // @ts-ignore - user methods defined in schema
    if (!user || !(await user.correctPassword(currentPassword))) {
      return next(new AppError("Current password is incorrect", 401));
    }

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();

    res.status(200).json({
      status: "success",
      message: "Password changed successfully. Please log in again.",
    });
  }
);
