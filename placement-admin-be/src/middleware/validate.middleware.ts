import type { Request, Response, NextFunction } from "express";
import type { AnyZodObject, ZodError } from "zod";
import { AppError } from "../utils/AppError";

/**
 * Validates request.body / params / query against a Zod schema.
 * Each schema should be shaped as { body?, params?, query? }.
 */
export const validate =
  (schema: AnyZodObject) =>
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (err) {
      if (err instanceof AppError) {
        next(err);
        return;
      }
      const zodError = err as ZodError;
      const message = zodError.errors
        .map((e) => {
          const path = e.path.join(".");
          return path ? `${path}: ${e.message}` : e.message;
        })
        .join("; ");
      next(new AppError(message, 400));
    }
  };
