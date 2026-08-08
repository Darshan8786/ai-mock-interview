import { z } from "zod";

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid ObjectId");

export const createJobSchema = z.object({
  body: z.object({
    title: z.string().min(2, "Title must be at least 2 characters"),
    company: objectIdSchema,
    package: z.string().optional(),
    location: z.string().optional(),
    skills: z.array(z.string().trim().min(1)).max(50).optional(),
    eligibility: z.string().optional(),
    deadline: z.coerce.date({ invalid_type_error: "Deadline must be a valid date" }).optional(),
    openings: z.coerce.number().int().min(1).default(1),
    description: z.string().optional(),
    status: z.enum(["open", "closed", "draft"]).optional(),
  }),
});

export const updateJobSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z
    .object({
      title: z.string().min(2).optional(),
      company: objectIdSchema.optional(),
      package: z.string().optional(),
      location: z.string().optional(),
      skills: z.array(z.string().trim().min(1)).max(50).optional(),
      eligibility: z.string().optional(),
      deadline: z.coerce.date().optional(),
      openings: z.coerce.number().int().min(1).optional(),
      description: z.string().optional(),
      status: z.enum(["open", "closed", "draft"]).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field must be provided",
    }),
});

export const jobParamsSchema = z.object({
  params: z.object({ id: objectIdSchema }),
});

export const jobQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    sort: z.string().optional(),
    search: z.string().trim().max(100).optional(),
    status: z.enum(["open", "closed", "draft"]).optional(),
    company: objectIdSchema.optional(),
    location: z.string().optional(),
  }),
});

export type CreateJobBody = z.infer<typeof createJobSchema>["body"];
export type UpdateJobBody = z.infer<typeof updateJobSchema>["body"];
