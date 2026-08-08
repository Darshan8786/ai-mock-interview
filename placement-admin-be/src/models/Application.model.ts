import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import type { IStudent } from "./Student.model";
import type { IJob } from "./Job.model";

export type ApplicationStatus =
  | "applied"
  | "shortlisted"
  | "rejected"
  | "hired"
  | "withdrawn";

export interface IApplication extends Document {
  student: Types.ObjectId | IStudent;
  job: Types.ObjectId | IJob;
  coverLetter?: string;
  resumeUrl?: string;
  atsScore?: number;
  status: ApplicationStatus;
  reviewedBy?: Types.ObjectId;
  statusHistory: { status: ApplicationStatus; changedAt: Date }[];
  appliedAt: Date;
  updatedAt: Date;
  createdAt: Date;
}

const applicationSchema = new Schema<IApplication>(
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
    coverLetter: { type: String, trim: true },
    resumeUrl: { type: String },
    atsScore: { type: Number, min: 0, max: 100 },
    status: {
      type: String,
      enum: ["applied", "shortlisted", "rejected", "hired", "withdrawn"],
      default: "applied",
      index: true,
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "Admin" },
    statusHistory: [
      {
        status: {
          type: String,
          enum: ["applied", "shortlisted", "rejected", "hired", "withdrawn"],
        },
        changedAt: { type: Date, default: Date.now },
        _id: false,
      },
    ],
  },
  { timestamps: true }
);

// A student can apply to a job only once
applicationSchema.index({ student: 1, job: 1 }, { unique: true });
applicationSchema.index({ status: 1, createdAt: -1 });

export const Application: Model<IApplication> = mongoose.model<IApplication>(
  "Application",
  applicationSchema
);
