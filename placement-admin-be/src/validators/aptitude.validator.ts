import { z } from "zod";

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid ObjectId");

const aptitudeQuestionSchema = z.object({
  question: z.string().min(3, "Question must be at least 3 characters"),
  options: z.array(z.string().trim().min(1)).min(2).max(6),
  correctAnswer: z.string().trim().min(1),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  topic: z.string().optional(),
});

export const createAptitudeTestSchema = z.object({
  body: z.object({
    title: z.string().min(2, "Title must be at least 2 characters"),
    description: z.string().optional(),
    category: z.string().optional(),
    difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
    timeLimitMin: z.coerce.number().int().min(1).default(30),
    passingScore: z.coerce.number().min(0).max(100).default(50),
    totalMarks: z.coerce.number().min(0).default(100),
    questions: z.array(aptitudeQuestionSchema).min(1, "At least one question is required").max(200),
    status: z.enum(["published", "draft", "archived"]).default("draft"),
  }),
});

export const updateAptitudeTestSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z
    .object({
      title: z.string().min(2).optional(),
      description: z.string().optional(),
      category: z.string().optional(),
      difficulty: z.enum(["easy", "medium", "hard"]).optional(),
      timeLimitMin: z.coerce.number().int().min(1).optional(),
      passingScore: z.coerce.number().min(0).max(100).optional(),
      totalMarks: z.coerce.number().min(0).optional(),
      questions: z
        .array(aptitudeQuestionSchema)
        .min(1)
        .max(200)
        .optional(),
      status: z.enum(["published", "draft", "archived"]).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field must be provided",
    }),
});

export const aptitudeParamsSchema = z.object({
  params: z.object({ id: objectIdSchema }),
});

export const aptitudeAttemptParamsSchema = z.object({
  params: z.object({ attemptId: objectIdSchema }),
});

export const aptitudeTestQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    sort: z.string().optional(),
    search: z.string().trim().max(100).optional(),
    status: z.enum(["published", "draft", "archived"]).optional(),
    category: z.string().optional(),
    difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  }),
});

export const aptitudeResultsQuerySchema = z.object({
  params: z.object({ id: objectIdSchema }),
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    sort: z.string().optional(),
  }),
});

export type CreateAptitudeTestBody = z.infer<typeof createAptitudeTestSchema>["body"];
export type UpdateAptitudeTestBody = z.infer<typeof updateAptitudeTestSchema>["body"];
