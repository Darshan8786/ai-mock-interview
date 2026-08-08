import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import type { IStudent } from "./Student.model";

export type AptitudeDifficulty = "easy" | "medium" | "hard";
export type AptitudeTestStatus = "published" | "draft" | "archived";

export interface IAptitudeQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  difficulty: AptitudeDifficulty;
  topic?: string;
}

export interface IAptitudeTest extends Document {
  title: string;
  description?: string;
  category?: string;
  difficulty: AptitudeDifficulty;
  timeLimitMin: number;
  passingScore: number;
  totalMarks: number;
  questions: IAptitudeQuestion[];
  status: AptitudeTestStatus;
  attempts: number;
  avgScore: number;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAptitudeAttempt extends Document {
  student: Types.ObjectId | IStudent;
  test: Types.ObjectId | IAptitudeTest;
  answers: { questionId: string; selected: string; correct: boolean }[];
  score: number;
  total: number;
  percentage: number;
  timeTakenMin: number;
  passed: boolean;
  submittedAt: Date;
  createdAt: Date;
}

const aptitudeQuestionSchema = new Schema<IAptitudeQuestion>({
  question: { type: String, required: true, trim: true },
  options: { type: [String], required: true, validate: { validator: (v: string[]) => v.length >= 2 } },
  correctAnswer: { type: String, required: true },
  difficulty: {
    type: String,
    enum: ["easy", "medium", "hard"],
    default: "medium",
  },
  topic: { type: String, trim: true },
});

const aptitudeTestSchema = new Schema<IAptitudeTest>(
  {
    title: { type: String, required: true, trim: true, index: true },
    description: { type: String, trim: true },
    category: { type: String, trim: true },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
    },
    timeLimitMin: { type: Number, min: 1, default: 30 },
    passingScore: { type: Number, min: 0, default: 50 },
    totalMarks: { type: Number, min: 0, default: 100 },
    questions: { type: [aptitudeQuestionSchema], default: [] },
    status: {
      type: String,
      enum: ["published", "draft", "archived"],
      default: "draft",
      index: true,
    },
    attempts: { type: Number, default: 0 },
    avgScore: { type: Number, min: 0, max: 100, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "Admin" },
  },
  { timestamps: true }
);

aptitudeTestSchema.index({ title: "text", category: "text" });

const aptitudeAttemptSchema = new Schema<IAptitudeAttempt>(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    test: {
      type: Schema.Types.ObjectId,
      ref: "AptitudeTest",
      required: true,
      index: true,
    },
    answers: [
      {
        questionId: { type: String, required: true },
        selected: { type: String },
        correct: { type: Boolean, required: true },
        _id: false,
      },
    ],
    score: { type: Number, min: 0, default: 0 },
    total: { type: Number, min: 0, default: 0 },
    percentage: { type: Number, min: 0, max: 100, default: 0 },
    timeTakenMin: { type: Number, min: 0, default: 0 },
    passed: { type: Boolean, default: false },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

aptitudeAttemptSchema.index({ student: 1, test: 1, submittedAt: -1 });

export const AptitudeTest: Model<IAptitudeTest> = mongoose.model<IAptitudeTest>(
  "AptitudeTest",
  aptitudeTestSchema
);

export const AptitudeAttempt: Model<IAptitudeAttempt> =
  mongoose.model<IAptitudeAttempt>("AptitudeAttempt", aptitudeAttemptSchema);
