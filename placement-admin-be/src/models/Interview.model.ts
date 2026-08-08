import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import type { IStudent } from "./Student.model";
import type { IJob } from "./Job.model";

export type InterviewStatus =
  | "scheduled"
  | "in-progress"
  | "completed"
  | "cancelled"
  | "no-show";

export interface IInterviewScore {
  technical?: number;
  communication?: number;
  confidence?: number;
  grammar?: number;
  fluency?: number;
  overall?: number;
}

export interface IInterview extends Document {
  student: Types.ObjectId | IStudent;
  job: Types.ObjectId | IJob;
  interviewerName?: string;
  scheduledAt: Date;
  durationMin?: number;
  mode: "online" | "offline" | "ai";
  link?: string;
  status: InterviewStatus;
  scores: IInterviewScore;
  feedback?: string;
  conductedBy?: Types.ObjectId;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const interviewSchema = new Schema<IInterview>(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    job: {
      type: Schema.Types.ObjectId,
      ref: "Job",
      required: true,
      index: true,
    },
    interviewerName: { type: String, trim: true },
    scheduledAt: { type: Date, required: true, index: true },
    durationMin: { type: Number, min: 1 },
    mode: {
      type: String,
      enum: ["online", "offline", "ai"],
      default: "ai",
    },
    link: { type: String, trim: true },
    status: {
      type: String,
      enum: ["scheduled", "in-progress", "completed", "cancelled", "no-show"],
      default: "scheduled",
      index: true,
    },
    scores: {
      technical: { type: Number, min: 0, max: 100 },
      communication: { type: Number, min: 0, max: 100 },
      confidence: { type: Number, min: 0, max: 100 },
      grammar: { type: Number, min: 0, max: 100 },
      fluency: { type: Number, min: 0, max: 100 },
      overall: { type: Number, min: 0, max: 100 },
    },
    feedback: { type: String, trim: true },
    conductedBy: { type: Schema.Types.ObjectId, ref: "Admin" },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

interviewSchema.index({ status: 1, scheduledAt: -1 });
interviewSchema.index({ student: 1, scheduledAt: -1 });

export const Interview: Model<IInterview> = mongoose.model<IInterview>(
  "Interview",
  interviewSchema
);
