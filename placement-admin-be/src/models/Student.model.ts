import mongoose, { Schema, type Document, type Model } from "mongoose";

export type StudentStatus = "active" | "inactive" | "blocked";

export interface IStudent extends Document {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role: "user";
  department?: string;
  year?: string;
  batch?: string;
  college?: string;
  location?: string;
  avatar?: string;
  skills: string[];
  resumeUrl?: string;
  atsScore?: number;
  placementReadiness?: number;
  status: StudentStatus;
  createdAt: Date;
  updatedAt: Date;
}

const studentSchema = new Schema<IStudent>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: { type: String, trim: true },
    password: { type: String, required: true, select: false, minlength: 6 },
    role: { type: String, enum: ["user"], default: "user" },
    department: { type: String, trim: true },
    year: { type: String, trim: true },
    batch: { type: String, trim: true },
    college: { type: String, trim: true },
    location: { type: String, trim: true },
    avatar: { type: String },
    skills: { type: [String], default: [] },
    resumeUrl: { type: String },
    atsScore: { type: Number, min: 0, max: 100, default: 0 },
    placementReadiness: { type: Number, min: 0, max: 100, default: 0 },
    status: {
      type: String,
      enum: ["active", "inactive", "blocked"],
      default: "active",
      index: true,
    },
  },
  { timestamps: true }
);

studentSchema.index({ name: "text", email: "text", skills: "text" });

studentSchema.set("toJSON", {
  transform: (_doc: unknown, ret: { password?: string; __v?: number }) => {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

export const Student: Model<IStudent> = mongoose.model<IStudent>(
  "Student",
  studentSchema
);
