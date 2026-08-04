import mongoose, { Schema } from "mongoose";

const AttemptSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    questionId: { type: Schema.Types.ObjectId, required: true, ref: "Question" },
    selectedOption: { type: String, required: true },
    correct: { type: Boolean, required: true },
    subject: { type: String, required: true },
    topic: { type: String, required: true },
}, { timestamps: true });

export const AttemptModel =
    mongoose.models["Attempt"] || mongoose.model("Attempt", AttemptSchema);

const InterviewScoreSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    role: { type: String, required: false },
    company: { type: String, required: false },
    subject: { type: String, required: false },
    scores: { type: [Number], required: true },
    total: { type: Number, required: true },
    sessionId: { type: String },
}, { timestamps: true });

export const InterviewScoreModel =
    mongoose.models["InterviewScore"] || mongoose.model("InterviewScore", InterviewScoreSchema);