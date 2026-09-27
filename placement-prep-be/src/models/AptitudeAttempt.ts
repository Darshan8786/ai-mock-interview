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

// ── Adaptive (AI-generated, one-question-at-a-time) sessions ──
// Practice Again: attempt 1 is the in-session answer; later attempts are appended, never overwritten.
const practiceAttemptSchema = new mongoose.Schema(
  {
    attemptNumber: { type: Number, required: true },
    selectedText: { type: String, default: "" },
    isCorrect: { type: Boolean, default: false },
    score: { type: Number, default: 0 },
    timeTaken: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const adaptiveItemSchema = new mongoose.Schema(
  {
    question: { type: mongoose.Schema.Types.ObjectId, ref: "AptitudeQuestion", required: true },
    category: { type: String, default: "" },
    topic: { type: String, default: "" },
    difficulty: { type: String, default: "medium" }, // easy | medium | hard
    servedOptions: { type: [String], default: [] },
    servedCorrect: { type: Number, default: 0 }, // server-side only
    source: { type: String, default: "" }, // model | template | bank | bank-db
    verification: { type: String, default: "" },
    focusArea: { type: String, default: "" },
    topicReason: { type: String, default: "" },
    difficultyReason: { type: String, default: "" },
    estimatedTime: { type: Number, default: 60 },
    shownAt: { type: Date, default: Date.now },
    answered: { type: Boolean, default: false },
    selected: { type: Number, default: null },
    isCorrect: { type: Boolean, default: false },
    responseTime: { type: Number, default: null },
    answeredAt: { type: Date, default: null },
    attempts: { type: [practiceAttemptSchema], default: [] },
  },
  { _id: false }
);

const adaptiveSchema = new mongoose.Schema(
  {
    category: { type: String, default: "" },
    topic: { type: String, default: "" }, // "" = mixed topics of the category
    startDifficulty: { type: String, default: "easy" },
    currentDifficulty: { type: String, default: "easy" },
    timeLimitMinutes: { type: Number, default: 0 },
    nextStatus: { type: String, enum: ["idle", "generating", "ready", "failed", "done"], default: "idle" },
    nextError: { type: String, default: "" },
    lastDecision: { type: String, default: "" },
    personalization: { type: mongoose.Schema.Types.Mixed, default: null },
    items: { type: [adaptiveItemSchema], default: [] },
  },
  { _id: false }
);

const aptitudeAttemptSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    mode: { type: String, enum: ["classic", "adaptive"], default: "classic" },
    adaptive: { type: adaptiveSchema, default: null },
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
    // Set when the attempt was auto-submitted by a proctoring guard rather
    // than a normal user submission (currently only the tab-switch limit).
    terminationReason: { type: String, default: "" },
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
