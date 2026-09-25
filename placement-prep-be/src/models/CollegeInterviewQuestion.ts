import mongoose from "mongoose";

export const QUESTION_TYPES = ["MCQ", "Technical", "Coding", "Behavioral", "HR", "Subjective"] as const;
export const QUESTION_DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

/**
 * One question of a college interview. Holds the answer key (MCQ correct option,
 * expected answer, evaluation criteria). These fields must NEVER be sent to a
 * student: the session snapshot copies only the question text, type, options and
 * marks, and answers are graded server-side by looking this document up.
 */
const collegeInterviewQuestionSchema = new mongoose.Schema(
  {
    interview: { type: mongoose.Schema.Types.ObjectId, ref: "CollegeInterview", required: true, index: true },
    // Denormalised from the parent so every query can be scoped to a college directly.
    college: { type: mongoose.Schema.Types.ObjectId, ref: "College", required: true, index: true },
    order: { type: Number, required: true },
    questionType: { type: String, enum: QUESTION_TYPES, required: true },
    question: { type: String, required: true, trim: true, maxlength: 4000 },
    topic: { type: String, trim: true, default: "", maxlength: 120 },
    difficulty: { type: String, enum: QUESTION_DIFFICULTIES, default: "Medium" },
    marks: { type: Number, default: 1, min: 0, max: 100 },

    // MCQ
    options: { type: [String], default: [] },
    correctAnswer: { type: String, enum: ["A", "B", "C", "D", ""], default: "" },

    // Non-MCQ
    expectedAnswer: { type: String, trim: true, default: "", maxlength: 4000 },
    /** Comma- or newline-separated concepts/keywords the answer should cover. */
    evaluationCriteria: { type: String, trim: true, default: "", maxlength: 2000 },

    // Coding (text-based evaluation only — there is no code runner in this app)
    codingConfig: {
      language: { type: String, default: "" },
      starterCode: { type: String, default: "", maxlength: 4000 },
      expectedSolution: { type: String, default: "", maxlength: 6000 },
    },
  },
  { timestamps: true }
);

collegeInterviewQuestionSchema.index({ interview: 1, order: 1 });

export const CollegeInterviewQuestion =
  mongoose.models.CollegeInterviewQuestion ||
  mongoose.model("CollegeInterviewQuestion", collegeInterviewQuestionSchema);
