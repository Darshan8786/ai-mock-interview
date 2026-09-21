import mongoose from "mongoose";

// One tracked question within an attempt. The question's own text/options/
// etc. are never duplicated here - they live only in the local ai-services
// dataset and are served to the client at quiz-start time; this subdocument
// only tracks what the candidate did with it, so grading/scoring never has
// to trust anything the client claims about content.
const techQuizQuestionSchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true },
    topic: { type: String, default: "" },
    difficulty: { type: String, default: "" },
    questionType: { type: String, default: "" },
    submittedAnswer: { type: mongoose.Schema.Types.Mixed, default: null },
    answered: { type: Boolean, default: false },
    isCorrect: { type: Boolean, default: false },
    score: { type: Number, default: 0 },
  },
  { _id: false }
);

const topicScoreSchema = new mongoose.Schema(
  {
    topic: { type: String, required: true },
    correct: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    score: { type: Number, default: 0 }, // percentage
  },
  { _id: false }
);

const techQuizAttemptSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    technology: { type: String, required: true },
    difficulty: { type: String, required: true }, // Easy | Medium | Hard | Mixed
    totalQuestions: { type: Number, required: true },
    status: { type: String, enum: ["in-progress", "completed"], default: "in-progress" },
    questions: [techQuizQuestionSchema],
    correctAnswers: { type: Number, default: 0 },
    wrongAnswers: { type: Number, default: 0 },
    unanswered: { type: Number, default: 0 },
    score: { type: Number, default: 0 }, // overall percentage
    topicScores: [topicScoreSchema],
    strengths: [{ type: String }],
    weaknesses: [{ type: String }],
    timeTaken: { type: Number, default: 0 }, // seconds
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

techQuizAttemptSchema.index({ user: 1, createdAt: -1 });

export const TechQuizAttempt =
  mongoose.models.TechQuizAttempt || mongoose.model("TechQuizAttempt", techQuizAttemptSchema);
