import { Schema, model, models } from "mongoose";

const QuizQuestionSchema = new Schema({
  subject: { type: String, required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  question: { type: String, required: true },
  options: [{ type: String, required: true }],
  correctAnswer: { type: String, required: true },
  attempted: { type: Boolean, default: false },
  selectedAnswer: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
});

export const QuizQuestion =
  models.QuizQuestion || model("QuizQuestion", QuizQuestionSchema);
