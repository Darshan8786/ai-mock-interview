import type { Request, Response, NextFunction } from "express";
import { Admin } from "../models/Admin.model";
import { verifyAccessToken } from "../services/token.service";
import { AppError } from "../utils/AppError";
import { catchAsync } from "../utils/catchAsync";
import type { AuthenticatedAdmin } from "../types";

/**
 * Protects admin routes. Requires a valid Bearer access token and
 * an existing, active admin account.
 */
export const protect = catchAsync(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      throw new AppError("Not authorized. Please log in.", 401);
    }

    const token = header.split(" ")[1];

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new AppError("Invalid or expired token. Please log in again.", 401);
    }

    if (payload.type !== "access" || payload.role !== "admin") {
      throw new AppError("Invalid token. Access denied.", 403);
    }

    const admin = await Admin.findById(payload.id).select("+password +refreshToken");
    if (!admin || !admin.isActive) {
      throw new AppError("Admin account not found or deactivated.", 401);
    }

    const adminInfo: AuthenticatedAdmin = {
      id: admin._id.toString(),
      email: admin.email,
      role: "admin",
    };
    req.admin = adminInfo;
    next();
  }
);

/**
 * Ensures a refresh token is presented for refresh endpoints.
 */
export const requireRefreshToken = catchAsync(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      throw new AppError("Refresh token is required", 400);
    }
    next();
  }
);
