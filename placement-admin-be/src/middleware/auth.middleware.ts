import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Admin } from "../models/Admin.model";
import { env } from "../config/env";
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

/**
 * Guards every admin data resource (students, companies, jobs, applications, interviews, aptitude tests, alumni).
 * Accepts either
 *   - an access token issued by THIS service (its own admin login), or
 *   - a token issued by placement-prep-be for a user whose role is "admin" - that is how the MindPrep admin panel
 *     signs in - verified with MAIN_JWT_SECRET (only when that secret is configured).
 * Anything else (no token, student tokens, forged or expired tokens) is rejected.
 */
export const requireAdmin = catchAsync(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      throw new AppError("Not authorized. Please log in.", 401);
    }
    const token = header.split(" ")[1];

    // 1) this service's own admin token
    let local: ReturnType<typeof verifyAccessToken> | null = null;
    try {
      local = verifyAccessToken(token);
    } catch {
      local = null;
    }
    if (local) {
      if (local.type !== "access" || local.role !== "admin") {
        throw new AppError("Invalid token. Access denied.", 403);
      }
      const admin = await Admin.findById(local.id);
      if (!admin || !admin.isActive) {
        throw new AppError("Admin account not found or deactivated.", 401);
      }
      req.admin = { id: admin._id.toString(), email: admin.email, role: "admin", source: "local" };
      next();
      return;
    }

    // 2) a MindPrep (placement-prep-be) admin token
    if (env.MAIN_JWT_SECRET) {
      let main: { id?: string; role?: string } | null = null;
      try {
        main = jwt.verify(token, env.MAIN_JWT_SECRET) as { id?: string; role?: string };
      } catch {
        main = null;
      }
      if (main) {
        if (main.role !== "admin" || !main.id) {
          throw new AppError("Admin access only.", 403);
        }
        req.admin = { id: String(main.id), email: "", role: "admin", source: "main" };
        next();
        return;
      }
    }
    throw new AppError("Invalid or expired token. Please log in again.", 401);
  }
);
