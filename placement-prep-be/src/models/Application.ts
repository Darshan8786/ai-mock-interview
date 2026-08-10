import mongoose from "mongoose";

const applicationSchema = new mongoose.Schema(
  {
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    // Snapshot of the student profile at application time
    studentName: { type: String, default: "" },
    usn: { type: String, default: "" },
    email: { type: String, default: "" },
    department: { type: String, default: "" },
    cgpa: { type: Number, default: null },
    resumeUrl: { type: String, default: "" },

    status: {
      type: String,
      enum: ["applied", "shortlisted", "rejected", "selected", "withdrawn"],
      default: "applied",
      index: true,
    },
  },
  { timestamps: true }
);

// A student can apply to a given job only once.
applicationSchema.index({ jobId: 1, studentId: 1 }, { unique: true });

export const Application =
  mongoose.models.Application || mongoose.model("Application", applicationSchema);
