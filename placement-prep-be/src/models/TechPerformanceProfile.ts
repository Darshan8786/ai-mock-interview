import mongoose from "mongoose";

// Per (user, technology) rolling performance used by the adaptive question
// system: weak topics (low accuracy) bias future question selection toward
// more practice on that topic, and currentDifficulty steps up/down by
// exactly one level after each completed quiz - never jumps unpredictably.
const techTopicStatSchema = new mongoose.Schema(
  {
    topic: { type: String, required: true },
    correct: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
  },
  { _id: false }
);

const techPerformanceProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    technology: { type: String, required: true },
    currentDifficulty: { type: String, enum: ["Easy", "Medium", "Hard"], default: "Easy" },
    topicStats: [techTopicStatSchema],
    totalAttempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

techPerformanceProfileSchema.index({ user: 1, technology: 1 }, { unique: true });

export const TechPerformanceProfile =
  mongoose.models.TechPerformanceProfile ||
  mongoose.model("TechPerformanceProfile", techPerformanceProfileSchema);
