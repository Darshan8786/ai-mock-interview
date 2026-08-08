import { z } from "zod";

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid ObjectId");

export const createInterviewSchema = z.object({
  body: z.object({
    student: objectIdSchema,
    job: objectIdSchema,
    interviewerName: z.string().optional(),
    scheduledAt: z.coerce.date({ invalid_type_error: "Scheduled date is required" }),
    durationMin: z.coerce.number().int().min(1).optional(),
    mode: z.enum(["online", "offline", "ai"]).default("ai"),
    link: z.string().url().optional(),
    notes: z.string().optional(),
  }),
});

export const updateInterviewSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z
    .object({
      interviewerName: z.string().optional(),
      scheduledAt: z.coerce.date().optional(),
      durationMin: z.coerce.number().int().min(1).optional(),
      mode: z.enum(["online", "offline", "ai"]).optional(),
      link: z.string().url().optional(),
      status: z
        .enum(["scheduled", "in-progress", "completed", "cancelled", "no-show"])
        .optional(),
      notes: z.string().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field must be provided",
    }),
});

export const updateInterviewScoresSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z
    .object({
      scores: z.object({
        technical: z.number().min(0).max(100).optional(),
        communication: z.number().min(0).max(100).optional(),
        confidence: z.number().min(0).max(100).optional(),
        grammar: z.number().min(0).max(100).optional(),
        fluency: z.number().min(0).max(100).optional(),
        overall: z.number().min(0).max(100).optional(),
      }),
      feedback: z.string().optional(),
      status: z.enum(["completed"]).optional(),
    })
    .refine((data) => Object.keys(data.scores).length > 0 || data.feedback, {
      message: "Provide at least one score or feedback",
    }),
});

export const interviewParamsSchema = z.object({
  params: z.object({ id: objectIdSchema }),
});

export const interviewQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    sort: z.string().optional(),
    search: z.string().trim().max(100).optional(),
    status: z
      .enum(["scheduled", "in-progress", "completed", "cancelled", "no-show"])
      .optional(),
    student: objectIdSchema.optional(),
    job: objectIdSchema.optional(),
    mode: z.enum(["online", "offline", "ai"]).optional(),
  }),
});

export type CreateInterviewBody = z.infer<typeof createInterviewSchema>["body"];
export type UpdateInterviewBody = z.infer<typeof updateInterviewSchema>["body"];
export type UpdateInterviewScoresBody = z.infer<
  typeof updateInterviewScoresSchema
>["body"];
