import { Schema, model, models } from "mongoose";

const AptitudeTopicSchema = new Schema(
  {
    category: {
      type: String,
      enum: ["Quantitative", "Logical Reasoning", "Verbal Ability", "Data Interpretation"],
      required: true,
      index: true,
    },
    name: { type: String, required: true, index: true },
    description: { type: String, default: "" },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

AptitudeTopicSchema.index({ category: 1, name: 1 }, { unique: true });

export const AptitudeTopic = models.AptitudeTopic || model("AptitudeTopic", AptitudeTopicSchema);
