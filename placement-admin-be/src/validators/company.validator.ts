import { z } from "zod";

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid ObjectId");

export const createCompanySchema = z.object({
  body: z.object({
    companyName: z.string().min(2, "Company name must be at least 2 characters"),
    hrName: z.string().min(2, "HR name must be at least 2 characters"),
    email: z.string().email("Valid email is required"),
    phone: z.string().optional(),
    location: z.string().optional(),
    description: z.string().optional(),
    logo: z.string().optional(),
    website: z.string().url("Website must be a valid URL").optional(),
    status: z.enum(["active", "inactive", "blacklisted"]).optional(),
  }),
});

export const updateCompanySchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z
    .object({
      companyName: z.string().min(2).optional(),
      hrName: z.string().min(2).optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      location: z.string().optional(),
      description: z.string().optional(),
      logo: z.string().optional(),
      website: z.string().url().optional(),
      status: z.enum(["active", "inactive", "blacklisted"]).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field must be provided",
    }),
});

export const companyParamsSchema = z.object({
  params: z.object({ id: objectIdSchema }),
});

export const companyQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    sort: z.string().optional(),
    search: z.string().trim().max(100).optional(),
    status: z.enum(["active", "inactive", "blacklisted"]).optional(),
  }),
});

export type CreateCompanyBody = z.infer<typeof createCompanySchema>["body"];
export type UpdateCompanyBody = z.infer<typeof updateCompanySchema>["body"];
