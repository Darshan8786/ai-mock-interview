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
    status: { type: String, enum: ["started", "completed"], default: "started", index: true },
    testType: { type: String, default: "" }, // practice | mock | daily | mixed | company | difficulty
    difficulty: { type: String, default: "" },
    title: { type: String, default: "" },
    marksPerQuestion: { type: Number, default: 1 },
    negativeMarksPerQuestion: { type: Number, default: 0 },
    passingScore: { type: Number, default: 50 },
    totalQuestions: { type: Number, required: true },
    correctAnswers: { type: Number, default: 0 },
    wrongAnswers: { type: Number, default: 0 },
    unattempted: { type: Number, default: 0 },
    score: { type: Number, default: 0 },       // percentage 0-100
    accuracy: { type: Number, default: 0 },    // correct / answered %
    marks: { type: Number, default: 0 },
    timeTaken: { type: Number, default: 0 },   // seconds
    tabWarnings: { type: Number, default: 0 },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
    categoryScores: { type: [categoryScoreSchema], default: [] },
    // Snapshot of the questions served (randomized option order) so submission
    // can be scored against exactly what the student saw.
    questions: {
      type: [
        {
          question: { type: mongoose.Schema.Types.ObjectId, ref: "AptitudeQuestion" },
          servedOptions: { type: [String], default: [] },
          servedCorrect: { type: Number, default: 0 },
          repeated: { type: Boolean, default: false },
        },
      ],
      default: [],
    },
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
