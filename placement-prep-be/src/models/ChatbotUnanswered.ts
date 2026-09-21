import mongoose from "mongoose";

/**
 * Messages the study chatbot could not answer confidently. This is the bot's
 * training backlog: review it (`npm run chatbot:unanswered`), add the missing
 * topics or phrasings to src/services/chatbot/kb, then `npm run train:chatbot`.
 */
const chatbotUnansweredSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    query: { type: String, required: true, maxlength: 500 },
    // "suggest" = plausible topic but low confidence; "decline" = nothing close.
    outcome: { type: String, enum: ["suggest", "decline"], required: true },
    topTarget: { type: String, default: "" },
    topScore: { type: Number, default: 0 },
  },
  { timestamps: true }
);

chatbotUnansweredSchema.index({ createdAt: -1 });

export const ChatbotUnanswered =
  mongoose.models.ChatbotUnanswered || mongoose.model("ChatbotUnanswered", chatbotUnansweredSchema);
