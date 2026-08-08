import type { Request, Response } from "express";
import { Admin } from "../models/Admin.model";
import { comparePassword, hashPassword } from "../services/password.service";
import {
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  verifyRefreshToken,
} from "../services/token.service";
import { catchAsync } from "../utils/catchAsync";
import { AppError } from "../utils/AppError";
import { sendSuccess } from "../utils/response";
import { seedAdmin } from "../seed/seedAdmin";

export const login = catchAsync(async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };

  const admin = await Admin.findOne({ email })
    .select("+password +refreshToken")
    .lean();

  if (!admin || !(await comparePassword(password, admin.password))) {
    throw new AppError("Invalid email or password", 401);
  }

  if (!admin.isActive) {
    throw new AppError("This admin account has been deactivated", 403);
  }

  const tokenPair = generateTokenPair({
    id: admin._id.toString(),
    email: admin.email,
    role: "admin",
  });

  // Persist the refresh token (hashed) so it can be revoked on logout
  await Admin.findByIdAndUpdate(admin._id, {
    refreshToken: await hashPassword(tokenPair.refreshToken),
    lastLoginAt: new Date(),
  });

  const { password: _pw, refreshToken: _rt, ...adminDetails } = admin;

  sendSuccess(
    res,
    {
      admin: adminDetails,
      tokenPair,
    },
    "Login successful",
    200
  );
});

export const refresh = catchAsync(async (req: Request, res: Response) => {
  const { refreshToken } = req.body as { refreshToken: string };

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError("Invalid or expired refresh token", 401);
  }

  if (payload.type !== "refresh" || payload.role !== "admin") {
    throw new AppError("Invalid refresh token", 401);
  }

  const admin = await Admin.findById(payload.id).select("+refreshToken");
  if (!admin || !admin.isActive || !admin.refreshToken) {
    throw new AppError("Refresh token no longer valid", 401);
  }

  const matches = await comparePassword(refreshToken, admin.refreshToken);
  if (!matches) {
    throw new AppError("Refresh token mismatch", 401);
  }

  const newAccess = generateAccessToken({
    id: admin._id.toString(),
    email: admin.email,
    role: "admin",
  });
  const newRefresh = generateRefreshToken({
    id: admin._id.toString(),
    email: admin.email,
    role: "admin",
  });

  admin.refreshToken = await hashPassword(newRefresh);
  await admin.save();

  sendSuccess(
    res,
    { accessToken: newAccess, refreshToken: newRefresh },
    "Token refreshed",
    200
  );
});

export const logout = catchAsync(async (req: Request, res: Response) => {
  if (!req.admin) {
    throw new AppError("Not authenticated", 401);
  }
  await Admin.findByIdAndUpdate(req.admin.id, { $unset: { refreshToken: 1 } });
  sendSuccess(res, null, "Logged out successfully", 200);
});

export const getProfile = catchAsync(async (req: Request, res: Response) => {
  const admin = await Admin.findById(req.admin?.id).lean();
  if (!admin) {
    throw new AppError("Admin not found", 404);
  }
  sendSuccess(res, admin, "Profile fetched successfully", 200);
});

export const updateProfile = catchAsync(async (req: Request, res: Response) => {
  const { name, phone, avatar } = req.body as {
    name?: string;
    phone?: string;
    avatar?: string;
  };

  const admin = await Admin.findByIdAndUpdate(
    req.admin?.id,
    { $set: { name, phone, avatar } },
    { new: true, runValidators: true }
  ).lean();

  if (!admin) {
    throw new AppError("Admin not found", 404);
  }
  sendSuccess(res, admin, "Profile updated successfully", 200);
});

export const changePassword = catchAsync(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body as {
    currentPassword: string;
    newPassword: string;
  };

  const admin = await Admin.findById(req.admin?.id).select("+password");
  if (!admin) {
    throw new AppError("Admin not found", 404);
  }

  if (!(await comparePassword(currentPassword, admin.password))) {
    throw new AppError("Current password is incorrect", 400);
  }

  admin.password = await hashPassword(newPassword);
  admin.refreshToken = undefined; // invalidate old refresh tokens
  await admin.save();

  sendSuccess(res, null, "Password changed successfully. Please log in again.", 200);
});

export const bootstrapAdmin = catchAsync(async (_req: Request, res: Response) => {
  await seedAdmin();
  sendSuccess(res, null, "Admin bootstrap completed", 200);
});
