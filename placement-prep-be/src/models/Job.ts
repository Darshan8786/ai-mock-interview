import mongoose from "mongoose";

const eligibilitySchema = new mongoose.Schema(
  {
    minimumCGPA: { type: Number, min: 0, max: 10, default: null },
    maximumBacklogs: { type: Number, min: 0, default: 0 },
    allowedDepartments: { type: [String], default: [] },
  },
  { _id: false }
);

const jobSchema = new mongoose.Schema(
  {
    companyName: { type: String, required: true, trim: true },
    jobTitle: { type: String, required: true, trim: true },
    jobDescription: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    jobType: { type: String, required: true, trim: true },
    package: { type: String, default: "", trim: true },
    requiredSkills: { type: [String], default: [] },

    eligibility: { type: eligibilitySchema, default: () => ({}) },

    lastDateToApply: { type: Date, required: true },
    numberOfOpenings: { type: Number, min: 1, default: 1 },

    companyWebsite: { type: String, default: "", trim: true },
    applicationLink: { type: String, default: "", trim: true },

    experience: { type: String, default: "", trim: true },
    responsibilities: { type: String, default: "", trim: true },
    qualifications: { type: String, default: "", trim: true },
    selectionProcess: { type: String, default: "", trim: true },

    status: {
      type: String,
      enum: ["active", "inactive", "closed", "expired"],
      default: "active",
      index: true,
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

jobSchema.index({ createdAt: -1 });
jobSchema.index({ status: 1, lastDateToApply: 1 });

export const Job = mongoose.models.Job || mongoose.model("Job", jobSchema);
