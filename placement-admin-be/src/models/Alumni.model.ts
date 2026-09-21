import mongoose, { Schema, type Document, type Model } from "mongoose";

/** Optional job opening an alumnus/alumna is offering to students. */
export interface IAlumniOpening {
  jobTitle: string;
  location: string;
  requiredSkills: string[];
  jobDescription: string;
  applicationLink: string;
  lastDateToApply: Date;
}

export interface IAlumni extends Document {
  name: string;
  graduationYear: number;
  department: string;
  currentCompany: string;
  currentJobRole: string;
  email: string;
  linkedin?: string;
  hasOpening: boolean;
  /** Present only while hasOpening is true. */
  opening?: IAlumniOpening;
  createdAt: Date;
  updatedAt: Date;
}

const openingSchema = new Schema<IAlumniOpening>(
  {
    jobTitle: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    requiredSkills: { type: [String], default: [] },
    jobDescription: { type: String, required: true, trim: true },
    applicationLink: { type: String, required: true, trim: true },
    lastDateToApply: { type: Date, required: true },
  },
  { _id: false }
);

const alumniSchema = new Schema<IAlumni>(
  {
    name: { type: String, required: true, trim: true, index: true },
    graduationYear: { type: Number, required: true, index: true },
    department: { type: String, required: true, trim: true },
    currentCompany: { type: String, required: true, trim: true },
    currentJobRole: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
    },
    linkedin: { type: String, trim: true },
    hasOpening: { type: Boolean, default: false, index: true },
    opening: { type: openingSchema },
  },
  { timestamps: true }
);

export const Alumni: Model<IAlumni> = mongoose.model<IAlumni>("Alumni", alumniSchema);
