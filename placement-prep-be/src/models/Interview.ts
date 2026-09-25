import mongoose from "mongoose";

// Audio measurements taken on the client while a voice answer was recorded. Every field is
// optional: a typed answer has none, and `pauses` is only present when pause detection ran.
const speechMetricsSchema = new mongoose.Schema(
  {
    recordingSeconds: { type: Number },
    speechSeconds: { type: Number },
    pauseDetection: { type: Boolean },
    pauses: [
      new mongoose.Schema(
        { startSeconds: { type: Number }, durationSeconds: { type: Number } },
        { _id: false }
      ),
    ],
  },
  { _id: false }
);

// Scores + explainable analysis for ONE answer. Shared by the original attempt (question.evaluation)
// and every practice attempt. The first block is the original schema and keeps its defaults; the
// second block has NO defaults, so records saved before the feedback upgrade simply lack those
// fields and the UI shows only the metrics that actually exist.
const evaluationDefinition = {
  technicalScore: { type: Number, default: 0 },
  communicationScore: { type: Number, default: 0 },
  confidenceScore: { type: Number, default: 0 },
  grammarScore: { type: Number, default: 0 },
  fluencyScore: { type: Number, default: 0 },
  relevanceScore: { type: Number, default: 0 },
  feedback: { type: String, default: "" },
  structureScore: { type: Number },
  completenessScore: { type: Number },
  clarityScore: { type: Number },
  concisenessScore: { type: Number },
  // "local" = produced by the local evaluator; "fallback" = the AI service was unavailable, so the
  // scores are neutral placeholders and no explanation exists for them.
  source: { type: String, enum: ["local", "fallback"] },
  // Structured explanation (structure, communication, timeline, why-this-score, strengths,
  // weaknesses, improvements, practice topics). Validated against a zod schema in
  // services/mockInterviewFeedback.ts before it is ever written here.
  analysis: { type: mongoose.Schema.Types.Mixed },
};

// One practice attempt at a question. Attempt 1 is the question's own answer/evaluation; attempts
// 2..n live here so the original answer is never overwritten.
const attemptSchema = new mongoose.Schema({
  attemptNumber: { type: Number, required: true },
  answer: { type: String, default: "" },
  // What was actually spoken (voice answers only); equals `answer` for voice, empty for typed.
  transcript: { type: String, default: "" },
  answerType: { type: String, enum: ["voice", "text"], default: "text" },
  timeTaken: { type: Number, default: 0 },
  speech: { type: speechMetricsSchema },
  evaluation: evaluationDefinition,
  createdAt: { type: Date, default: Date.now },
});

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
  // College-created interviews only. The answer key is deliberately NOT copied
  // here (this document is returned to the student); it stays on the
  // CollegeInterviewQuestion and is looked up server-side when grading.
  collegeQuestion: { type: mongoose.Schema.Types.ObjectId, ref: "CollegeInterviewQuestion" },
  questionType: { type: String, default: "" },
  options: [{ type: String }],
  marks: { type: Number, default: 0 },
  answer: { type: String, default: "" },
  answerType: { type: String, enum: ["voice", "text"], default: "text" },
  // Spoken text for voice answers (same text as `answer`); empty for typed answers.
  transcript: { type: String, default: "" },
  speech: { type: speechMetricsSchema },
  evaluation: evaluationDefinition,
  timeTaken: { type: Number, default: 0 },
  // When attempt 1 was submitted. Absent on interviews saved before the feedback upgrade.
  answeredAt: { type: Date },
  skipped: { type: Boolean, default: false },
  // Which of the candidate's recurring weak areas this question was chosen to target (personalised
  // interviews only; empty otherwise).
  focusArea: { type: String, default: "" },
  // Practice attempts (attempt 2, 3, ...) made from the report page. Never affects interview scores.
  attempts: [attemptSchema],
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
    // "Coding" and "Mixed" exist only for college-created interviews.
    interviewType: { type: String, enum: ["HR", "Technical", "Behavioral", "Resume", "Coding", "Mixed"], required: true },
    // Where the questions came from: generated by the local AI model, built from a
    // resume, or authored by a college admin. Older documents have no value (= AI).
    source: { type: String, enum: ["AI", "RESUME", "COLLEGE"], default: "AI", index: true },
    collegeInterview: { type: mongoose.Schema.Types.ObjectId, ref: "CollegeInterview", index: true },
    college: { type: mongoose.Schema.Types.ObjectId, ref: "College", index: true },
    // Overall limit for college interviews (0 = none). Enforced server-side.
    timeLimitMinutes: { type: Number, default: 0 },
    // Only present for interviewType "Resume".
    resumeProfile: { type: resumeProfileSchema },
    difficulty: { type: String, enum: ["Easy", "Medium", "Hard", "Mixed"], required: true },
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
    // Counts ONLY fullscreen exits during an active interview. The 3rd exit
    // terminates the interview (terminationReason FULLSCREEN_EXIT_LIMIT_EXCEEDED).
    fullScreenExitCount: { type: Number, default: 0 },
    autoTerminated: { type: Boolean, default: false },
    // Set when auto-termination was caused by a specific, identifiable rule
    // (currently only the tab-switch limit) rather than a generic mix of
    // cheating violations.
    terminationReason: { type: String, default: "" },
    warnings: [warningSchema],
    // Recorded when this interview's questions were tailored to the candidate's earlier results.
    personalization: {
      type: new mongoose.Schema(
        {
          basedOnInterviews: { type: Number, default: 0 },
          focusAreas: [
            new mongoose.Schema(
              {
                label: { type: String, default: "" },
                skill: { type: String, default: "" },
                topic: { type: String, default: "" },
                reason: { type: String, default: "" },
              },
              { _id: false }
            ),
          ],
          message: { type: String, default: "" },
          // Number of questions actually drawn from the focus areas (0 if generation fell back).
          targetedQuestions: { type: Number, default: 0 },
        },
        { _id: false }
      ),
    },
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
