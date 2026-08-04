import mongoose from "mongoose";

const questionResponseSchema = new mongoose.Schema({
  question: { type: String, required: true },
  answer: { type: String, default: "" },
  answerType: { type: String, enum: ["voice", "text"], default: "text" },
  evaluation: {
    technicalScore: { type: Number, default: 0 },
    communicationScore: { type: Number, default: 0 },
    confidenceScore: { type: Number, default: 0 },
    grammarScore: { type: Number, default: 0 },
    fluencyScore: { type: Number, default: 0 },
    relevanceScore: { type: Number, default: 0 },
    feedback: { type: String, default: "" },
  },
  timeTaken: { type: Number, default: 0 },
  skipped: { type: Boolean, default: false },
});

const warningSchema = new mongoose.Schema({
  type: { type: String, required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  severity: { type: String, enum: ["low", "medium", "high"], default: "low" },
});

const interviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    jobRole: { type: String, required: true },
    experienceLevel: { type: String, enum: ["fresher", "junior", "mid", "senior", "lead"], required: true },
    interviewType: { type: String, enum: ["HR", "Technical", "Behavioral"], required: true },
    difficulty: { type: String, enum: ["Easy", "Medium", "Hard"], required: true },
    totalQuestions: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "in-progress", "completed", "terminated"],
      default: "pending",
    },
    questions: [questionResponseSchema],
    currentQuestionIndex: { type: Number, default: 0 },
    cheatingCount: { type: Number, default: 0 },
    autoTerminated: { type: Boolean, default: false },
    warnings: [warningSchema],
    overallScore: { type: Number, default: 0 },
    technicalScore: { type: Number, default: 0 },
    communicationScore: { type: Number, default: 0 },
    confidenceScore: { type: Number, default: 0 },
    grammarScore: { type: Number, default: 0 },
    fluencyScore: { type: Number, default: 0 },
    strengths: [{ type: String }],
    weaknesses: [{ type: String }],
    areasToImprove: [{ type: String }],
    finalFeedback: { type: String, default: "" },
    startedAt: { type: Date },
    completedAt: { type: Date },
    totalTimeTaken: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Interview = mongoose.model("Interview", interviewSchema);
