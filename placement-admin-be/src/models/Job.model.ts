import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import type { ICompany } from "./Company.model";

export type JobStatus = "open" | "closed" | "draft";

export interface IJob extends Document {
  title: string;
  company: Types.ObjectId | ICompany;
  package?: string;
  location?: string;
  skills: string[];
  eligibility?: string;
  deadline?: Date;
  openings: number;
  description?: string;
  status: JobStatus;
  createdAt: Date;
  updatedAt: Date;
}

const jobSchema = new Schema<IJob>(
  {
    title: { type: String, required: true, trim: true, index: true },
    company: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    package: { type: String, trim: true },
    location: { type: String, trim: true },
    skills: { type: [String], default: [] },
    eligibility: { type: String, trim: true },
    deadline: { type: Date },
    openings: { type: Number, min: 1, default: 1 },
    description: { type: String, trim: true },
    status: {
      type: String,
      enum: ["open", "closed", "draft"],
      default: "draft",
      index: true,
    },
  },
  { timestamps: true }
);

jobSchema.index({ title: "text", location: "text", skills: "text" });
jobSchema.index({ status: 1, createdAt: -1 });

export const Job: Model<IJob> = mongoose.model<IJob>("Job", jobSchema);
