import mongoose from "mongoose";

const interviewReportSchema = new mongoose.Schema(
  {
    interview: { type: mongoose.Schema.Types.ObjectId, ref: "Interview", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    overallScore: { type: Number, required: true },
    technicalScore: { type: Number, required: true },
    communicationScore: { type: Number, required: true },
    confidenceScore: { type: Number, required: true },
    grammarScore: { type: Number, required: true },
    fluencyScore: { type: Number, required: true },
    cheatingCount: { type: Number, default: 0 },
    warnings: [{
      type: { type: String },
      message: { type: String },
      timestamp: { type: Date },
    }],
    strengths: [{ type: String }],
    weaknesses: [{ type: String }],
    areasToImprove: [{ type: String }],
    finalFeedback: { type: String },
    jobRole: { type: String },
    interviewType: { type: String },
    difficulty: { type: String },
    totalQuestions: { type: Number },
    questionsAttempted: { type: Number },
    totalTimeTaken: { type: Number },
  },
  { timestamps: true }
);

interviewReportSchema.index({ user: 1, createdAt: -1 });

export const InterviewReport = mongoose.model("InterviewReport", interviewReportSchema);
