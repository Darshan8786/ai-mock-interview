import { Schema, model, models } from "mongoose";

const AptitudeTestConfigSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: "" },
    // Optional filters applied when drawing questions
    category: {
      type: String,
      enum: ["", "Quantitative", "Logical Reasoning", "Verbal Ability", "Data Interpretation"],
      default: "",
    },
    topics: { type: [String], default: [] },
    difficulty: {
      type: String,
      enum: ["", "beginner", "intermediate", "advanced"],
      default: "",
    },
    // Draw config
    questionCount: { type: Number, default: 20, min: 1, max: 100 },
    // Timing
    durationMinutes: { type: Number, default: 20, min: 1 },
    // Scoring (configurable per test)
    marksPerQuestion: { type: Number, default: 1, min: 0 },
    negativeMarksPerQuestion: { type: Number, default: 0, min: 0 },
    passingScore: { type: Number, default: 50, min: 0, max: 100 }, // percentage
    shuffle: { type: Boolean, default: true },
    // Question pool override (admin-curated); empty => random draw by filters
    questionIds: { type: [Schema.Types.ObjectId], ref: "AptitudeQuestion", default: [] },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

AptitudeTestConfigSchema.index({ isActive: 1, category: 1 });

export const AptitudeTestConfig =
  models.AptitudeTestConfig || model("AptitudeTestConfig", AptitudeTestConfigSchema);
