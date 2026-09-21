import { Schema, model, models } from "mongoose";

/**
 * Tracks every tech-practice question a user has been SHOWN, across every
 * attempt, so the same question is never served to them again until the
 * matching (technology) pool is genuinely exhausted - mirrors
 * AptitudeQuestionHistory's role for the aptitude system exactly. The
 * question's own content lives only in the local ai-services dataset
 * (looked up by `question`, the dataset's string id e.g. "python_042");
 * this collection only ever stores which ids a user has seen and when.
 */
const TechQuestionHistorySchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    technology: { type: String, required: true },
    question: { type: String, required: true }, // dataset question id, e.g. "python_042"
    attempt: { type: Schema.Types.ObjectId, ref: "TechQuizAttempt", default: null },
    // True when this id had to be reused because the unseen pool for this
    // user+technology was exhausted (mirrors AptitudeQuestionHistory.repeated).
    repeated: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: "shownAt", updatedAt: false } }
);

TechQuestionHistorySchema.index({ user: 1, technology: 1, question: 1 });
TechQuestionHistorySchema.index({ user: 1, technology: 1, shownAt: 1 });

export const TechQuestionHistory =
  models.TechQuestionHistory || model("TechQuestionHistory", TechQuestionHistorySchema);
