import { z } from "zod";

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid ObjectId");

export const paginationQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    sort: z.string().optional(),
    search: z.string().trim().max(100).optional(),
  }),
});

export const createStudentSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Valid email is required"),
    phone: z.string().optional(),
    password: z.string().min(6, "Password must be at least 6 characters"),
    department: z.string().optional(),
    year: z.string().optional(),
    batch: z.string().optional(),
    college: z.string().optional(),
    location: z.string().optional(),
    avatar: z.string().optional(),
    skills: z.array(z.string().trim().min(1)).max(50).optional(),
    resumeUrl: z.string().optional(),
  }),
});

export const updateStudentSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z
    .object({
      name: z.string().min(2).optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      password: z.string().min(6).optional(),
      department: z.string().optional(),
      year: z.string().optional(),
      batch: z.string().optional(),
      college: z.string().optional(),
      location: z.string().optional(),
      avatar: z.string().optional(),
      skills: z.array(z.string().trim().min(1)).max(50).optional(),
      resumeUrl: z.string().optional(),
      atsScore: z.number().min(0).max(100).optional(),
      placementReadiness: z.number().min(0).max(100).optional(),
      status: z.enum(["active", "inactive", "blocked"]).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field must be provided",
    }),
});

export const studentIdParamsSchema = z.object({
  params: z.object({ id: objectIdSchema }),
});

export const studentQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    sort: z.string().optional(),
    search: z.string().trim().max(100).optional(),
    department: z.string().optional(),
    batch: z.string().optional(),
    status: z.enum(["active", "inactive", "blocked"]).optional(),
  }),
});

export type CreateStudentBody = z.infer<typeof createStudentSchema>["body"];
export type UpdateStudentBody = z.infer<typeof updateStudentSchema>["body"];
