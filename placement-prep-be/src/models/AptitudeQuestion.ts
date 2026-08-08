import { Schema, model, models } from "mongoose";

const companyTagSchema = new Schema(
  {
    name: { type: String, required: true },
    style: { type: String, enum: ["tcs-style", "infosys-style", "wipro-style", "accenture-style", "general"], default: "general" },
  },
  { _id: false }
);

const AptitudeQuestionSchema = new Schema(
  {
    category: {
      type: String,
      enum: ["Quantitative", "Logical Reasoning", "Verbal Ability", "Data Interpretation"],
      required: true,
      index: true,
    },
    topic: { type: String, required: true, index: true },
    subtopic: { type: String, default: "" },
    difficulty: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      default: "intermediate",
      index: true,
    },
    companyTags: { type: [companyTagSchema], default: [] },
    question: { type: String, required: true },
    options: { type: [String], required: true, validate: [(v: string[]) => v.length >= 2 && v.length <= 6, "options length must be between 2 and 6"] },
    correctAnswer: { type: Number, required: true }, // index of correct option
    explanation: { type: String, default: "" },
    estimatedTime: { type: Number, default: 60 }, // seconds
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

AptitudeQuestionSchema.index({ category: 1, topic: 1 });
AptitudeQuestionSchema.index({ difficulty: 1, category: 1 });
AptitudeQuestionSchema.index({ "companyTags.name": 1 });

export const AptitudeQuestion =
  models.AptitudeQuestion || model("AptitudeQuestion", AptitudeQuestionSchema);
