import { z } from "zod";

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid ObjectId");

export const applicationParamsSchema = z.object({
  params: z.object({ id: objectIdSchema }),
});

export const createApplicationSchema = z.object({
  body: z.object({
    student: objectIdSchema,
    job: objectIdSchema,
    coverLetter: z.string().max(5000).optional(),
    resumeUrl: z.string().optional(),
  }),
});

export const applicationQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    sort: z.string().optional(),
    search: z.string().trim().max(100).optional(),
    status: z.enum(["applied", "shortlisted", "rejected", "hired", "withdrawn"]).optional(),
    job: objectIdSchema.optional(),
    student: objectIdSchema.optional(),
  }),
});

export const updateApplicationStatusSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    status: z.enum(["applied", "shortlisted", "rejected", "hired", "withdrawn"], {
      message: "Invalid application status",
    }),
    atsScore: z.number().min(0).max(100).optional(),
  }),
});

export type CreateApplicationBody = z.infer<typeof createApplicationSchema>["body"];
export type UpdateApplicationStatusBody = z.infer<
  typeof updateApplicationStatusSchema
>["body"];
