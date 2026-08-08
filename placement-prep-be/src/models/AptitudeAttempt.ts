import mongoose from "mongoose";

const categoryScoreSchema = new mongoose.Schema(
  {
    category: { type: String, required: true },
    score: { type: Number, default: 0 },
    correct: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
  },
  { _id: false }
);

const aptitudeAttemptSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    totalQuestions: { type: Number, required: true },
    correctAnswers: { type: Number, required: true },
    wrongAnswers: { type: Number, default: 0 },
    unattempted: { type: Number, default: 0 },
    score: { type: Number, default: 0 },       // percentage 0-100
    marks: { type: Number, default: 0 },
    timeTaken: { type: Number, default: 0 },   // seconds
    tabWarnings: { type: Number, default: 0 },
    categoryScores: { type: [categoryScoreSchema], default: [] },
    // optional snapshot of the questions attempted (question text + selected + correct)
    answers: {
      type: [
        {
          question: String,
          selected: Number,
          correct: Number,
          isCorrect: Boolean,
          category: String,
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

aptitudeAttemptSchema.index({ user: 1, createdAt: -1 });

export const AptitudeAttempt =
  mongoose.models.AptitudeAttempt ||
  mongoose.model("AptitudeAttempt", aptitudeAttemptSchema);
