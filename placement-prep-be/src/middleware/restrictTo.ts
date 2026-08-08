import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth";
import { AppError } from "../utils/AppError";

/**
 * Requires req.user (set by `protect`) to have the given role(s).
 * Usage: router.use(protect, restrictTo("admin"));
 */
export const restrictTo = (...roles: string[]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError("You do not have permission to perform this action", 403));
    }
    next();
  };
};
