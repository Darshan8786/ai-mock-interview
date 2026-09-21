import { z } from "zod";

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid ObjectId");

const currentYear = new Date().getFullYear();

/** URLs are rendered as links for students, so only http(s) is allowed (z.url() also accepts javascript:). */
const httpUrl = (label: string) =>
  z
    .string()
    .trim()
    .url(`${label} must be a valid URL`)
    .refine((u) => /^https?:\/\//i.test(u), { message: `${label} must start with http:// or https://` });

const openingSchema = z.object({
  jobTitle: z.string().trim().min(2, "Job title must be at least 2 characters"),
  location: z.string().trim().min(2, "Location is required"),
  requiredSkills: z.array(z.string().trim().min(1).max(50)).max(30).optional(),
  jobDescription: z.string().trim().min(10, "Job description must be at least 10 characters"),
  applicationLink: httpUrl("Application link"),
  lastDateToApply: z.coerce.date({ invalid_type_error: "Last date to apply must be a valid date" }),
});

const alumniFields = {
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  graduationYear: z.coerce
    .number()
    .int()
    .min(1950, "Graduation year is too early")
    .max(currentYear + 6, "Graduation year is too far in the future"),
  department: z.string().trim().min(2, "Department is required"),
  currentCompany: z.string().trim().min(1, "Current company is required"),
  currentJobRole: z.string().trim().min(1, "Current job role is required"),
  email: z.string().trim().email("Valid email is required"),
  linkedin: httpUrl("LinkedIn").optional().or(z.literal("")),
  hasOpening: z.boolean().optional(),
  opening: openingSchema.optional(),
};

export const createAlumniSchema = z.object({
  body: z
    .object(alumniFields)
    .refine((b) => !b.hasOpening || !!b.opening, {
      message: "Job opening details are required when hasOpening is true",
      path: ["opening"],
    }),
});

export const updateAlumniSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z
    .object({
      name: alumniFields.name.optional(),
      graduationYear: alumniFields.graduationYear.optional(),
      department: alumniFields.department.optional(),
      currentCompany: alumniFields.currentCompany.optional(),
      currentJobRole: alumniFields.currentJobRole.optional(),
      email: alumniFields.email.optional(),
      linkedin: alumniFields.linkedin,
      hasOpening: alumniFields.hasOpening,
      opening: alumniFields.opening,
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field must be provided",
    }),
});

export const alumniParamsSchema = z.object({
  params: z.object({ id: objectIdSchema }),
});

export const alumniQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    sort: z.string().optional(),
    search: z.string().trim().max(100).optional(),
    hasOpening: z.enum(["true", "false"]).optional(),
  }),
});

export type CreateAlumniBody = z.infer<typeof createAlumniSchema>["body"];
export type UpdateAlumniBody = z.infer<typeof updateAlumniSchema>["body"];
