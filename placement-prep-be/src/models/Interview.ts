import mongoose from "mongoose";

const questionResponseSchema = new mongoose.Schema({
  question: { type: String, required: true },
  // Which local-training-dataset skill/topic this technical question was
  // generated for (empty for HR/Behavioral or static-fallback questions) -
  // carried through to /evaluate-answer so local grading can look up the
  // correct expected-concepts entry instead of guessing from the question text.
  skill: { type: String, default: "" },
  topic: { type: String, default: "" },
  // Expected concepts for this specific question. Only set for resume-based
  // interview questions, which are built from the candidate's own projects and
  // therefore have no entry in the static topic/HR concept files.
  concepts: [{ type: String }],
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

// The slice of the uploaded resume a resume-based interview is built from.
// Stored on the interview so regenerating questions doesn't need the PDF again.
const resumeProfileSchema = new mongoose.Schema(
  {
    skills: [{ type: String }],
    projects: [
      new mongoose.Schema(
        {
          name: { type: String, default: "" },
          description: { type: String, default: "" },
          technologies: [{ type: String }],
        },
        { _id: false }
      ),
    ],
  },
  { _id: false }
);

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
    interviewType: { type: String, enum: ["HR", "Technical", "Behavioral", "Resume"], required: true },
    // Only present for interviewType "Resume".
    resumeProfile: { type: resumeProfileSchema },
    difficulty: { type: String, enum: ["Easy", "Medium", "Hard"], required: true },
    totalQuestions: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "in-progress", "completed", "terminated"],
      default: "pending",
    },
    // Lifecycle of AI question generation — decoupled from `status` so the
    // interview session (and proctoring) is live before questions are ready.
    questionsStatus: {
      type: String,
      enum: ["pending", "generating", "ready", "failed"],
      default: "pending",
    },
    questions: [questionResponseSchema],
    currentQuestionIndex: { type: Number, default: 0 },
    cheatingCount: { type: Number, default: 0 },
    // Counts ONLY tab_switch violations, separately from the combined
    // cheatingCount above, so termination caused specifically by the
    // 3-strikes tab-switch rule can be attributed and persisted.
    tabSwitchCount: { type: Number, default: 0 },
    autoTerminated: { type: Boolean, default: false },
    // Set when auto-termination was caused by a specific, identifiable rule
    // (currently only the tab-switch limit) rather than a generic mix of
    // cheating violations.
    terminationReason: { type: String, default: "" },
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
