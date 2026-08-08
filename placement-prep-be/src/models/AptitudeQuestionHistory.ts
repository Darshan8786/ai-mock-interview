import { Schema, model, models } from "mongoose";

/**
 * Tracks every question a student has been SHOWN (not just answered), so the
 * same question is never served again until the matching pool is exhausted.
 */
const AptitudeQuestionHistorySchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    question: { type: Schema.Types.ObjectId, ref: "AptitudeQuestion", required: true },
    attempt: { type: Schema.Types.ObjectId, ref: "AptitudeAttempt", default: null },
    testType: { type: String, default: "" },
    // The options exactly as they were served (order randomized per student).
    servedOptions: { type: [String], default: [] },
    // Index of the correct option within servedOptions.
    servedCorrect: { type: Number, default: 0 },
    // True when the student had already seen this question (pool exhausted).
    repeated: { type: Boolean, default: false },
    answered: { type: Boolean, default: false },
    // Index the student selected within servedOptions.
    selected: { type: Number, default: null },
    correct: { type: Boolean, default: null },
  },
  { timestamps: { createdAt: "shownAt", updatedAt: false } }
);

AptitudeQuestionHistorySchema.index({ user: 1, question: 1 });
AptitudeQuestionHistorySchema.index({ user: 1, shownAt: 1 });
AptitudeQuestionHistorySchema.index({ question: 1 });

export const AptitudeQuestionHistory =
  models.AptitudeQuestionHistory ||
  model("AptitudeQuestionHistory", AptitudeQuestionHistorySchema);
