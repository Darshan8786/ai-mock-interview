import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env";
import { AppError } from "../utils/AppError";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";

const isCastError = (err: unknown): err is mongoose.Error.CastError =>
  err instanceof mongoose.Error.CastError;

const isDuplicateKeyError = (
  err: unknown
): err is Error & { code: number; keyValue?: Record<string, unknown> } =>
  typeof err === "object" &&
  err !== null &&
  "code" in err &&
  (err as { code: number }).code === 11000;

const isJsonWebTokenError = (err: unknown): err is jwt.JsonWebTokenError =>
  err instanceof jwt.JsonWebTokenError;

const isTokenExpiredError = (err: unknown): err is jwt.TokenExpiredError =>
  err instanceof jwt.TokenExpiredError;

/**
 * Central error handler. Converts every known error into a consistent
 * `{ success: false, message, data }` JSON response.
 */
export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): Response => {
  let statusCode = 500;
  let message = "Internal server error";

  // Operational AppErrors (explicit throws)
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (isCastError(err)) {
    statusCode = 400;
    message = `Invalid value for ${err.path}: ${err.value}`;
  } else if (isDuplicateKeyError(err)) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || "field";
    message = `Duplicate value for ${field}. This record already exists.`;
  } else if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join("; ");
  } else if (isTokenExpiredError(err)) {
    statusCode = 401;
    message = "Token has expired. Please log in again.";
  } else if (isJsonWebTokenError(err)) {
    statusCode = 401;
    message = "Invalid token. Please log in again.";
  } else if (err instanceof Error) {
    message = err.message;
  }

  // Swallow internal stack traces in production
  // eslint-disable-next-line no-console
  if (env.NODE_ENV !== "production" && err instanceof Error) console.error(err.stack);

  return res.status(statusCode).json({
    success: false,
    message,
    data: null,
  });
};
