import mongoose from "mongoose";

export const COLLEGE_INTERVIEW_TYPES = ["Technical", "HR", "Behavioral", "Coding", "Mixed"] as const;
export const PROGRAMMING_LANGUAGES = [
  "Python", "Java", "C", "C++", "JavaScript", "TypeScript", "Go", "Rust", "C#", "None",
] as const;
export const COLLEGE_DIFFICULTIES = ["Easy", "Medium", "Hard", "Mixed"] as const;
export const COLLEGE_INTERVIEW_STATUSES = ["draft", "published", "closed"] as const;

export type CollegeInterviewStatus = (typeof COLLEGE_INTERVIEW_STATUSES)[number];

/**
 * An interview template authored by a college admin (questions live in
 * CollegeInterviewQuestion). A student's attempt is NOT stored here: starting one
 * creates a regular `Interview` session (source "COLLEGE") that snapshots the
 * questions, so the existing timer, proctoring, scoring and report apply unchanged.
 */
const collegeInterviewSchema = new mongoose.Schema(
  {
    college: { type: mongoose.Schema.Types.ObjectId, ref: "College", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 150 },
    jobRole: { type: String, required: true, trim: true, maxlength: 120 },
    interviewType: { type: String, enum: COLLEGE_INTERVIEW_TYPES, required: true },
    programmingLanguage: { type: String, enum: PROGRAMMING_LANGUAGES, default: "None" },
    difficulty: { type: String, enum: COLLEGE_DIFFICULTIES, required: true },
    description: { type: String, trim: true, default: "", maxlength: 2000 },
    /** How many questions the student is asked. Must equal the authored count to publish. */
    questionCount: { type: Number, required: true, min: 1, max: 50 },
    /** Overall time limit in minutes. */
    timeLimit: { type: Number, required: true, min: 1, max: 300 },
    status: { type: String, enum: COLLEGE_INTERVIEW_STATUSES, default: "draft", index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    publishedAt: { type: Date },
  },
  { timestamps: true }
);

collegeInterviewSchema.index({ college: 1, createdAt: -1 });

export const CollegeInterview =
  mongoose.models.CollegeInterview || mongoose.model("CollegeInterview", collegeInterviewSchema);
