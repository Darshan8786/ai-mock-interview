import type { Response } from "express";
import type { PaginationMeta } from "../types";

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message = "Success",
  statusCode = 200,
  meta?: PaginationMeta
): Response => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    ...(meta ? { pagination: meta } : {}),
  });
};

export const sendCreated = <T>(res: Response, data: T, message = "Created successfully"): Response => {
  return sendSuccess(res, data, message, 201);
};

export const sendDeleted = (res: Response, message = "Deleted successfully"): Response => {
  return sendSuccess(res, null, message, 200);
};
