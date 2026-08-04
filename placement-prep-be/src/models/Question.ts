
import { Schema, model, models } from "mongoose";

const QuestionSchema = new Schema({
  question: { type: String, required: true },
  difficulty: { type: String, enum: ["easy", "medium", "hard"], required: true },
  topic: {type: String, required: true},
  options: [{ type: String, required: true }],
  correctAnswer: { type: String, required: true },
});

// Function to dynamically return model for any subject/collection
export function getQuestionModel(subject: string) {
  const collectionName = subject.toLowerCase(); 
  return models[collectionName] || model("Question", QuestionSchema, collectionName);
}
