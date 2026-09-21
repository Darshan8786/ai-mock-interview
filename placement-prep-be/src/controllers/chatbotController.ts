import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { chat, MAX_MESSAGE_LENGTH } from "../services/chatbot/engine";
import { loadModel } from "../services/chatbot/modelStore";
import { STARTER_SUGGESTIONS } from "../services/chatbot/responder";
import { ChatbotUnanswered } from "../models/ChatbotUnanswered";

/** POST /chatbot/chat  { message } → the bot's reply. No external AI service is called. */
export const chatMessage = asyncHandler(async (req: AuthRequest, res: Response) => {
  const message = req.body?.message;
  if (typeof message !== "string" || !message.trim()) {
    throw new AppError("A non-empty 'message' string is required.", 400);
  }
  if (message.length > MAX_MESSAGE_LENGTH * 4) {
    throw new AppError(`Message is too long (max ${MAX_MESSAGE_LENGTH} characters).`, 400);
  }

  const outcome = await chat(message, String(req.user._id));

  if (outcome.unanswered) {
    // Fire-and-forget: a logging failure must never fail the student's request.
    ChatbotUnanswered.create({
      user: req.user._id,
      query: message.trim().slice(0, MAX_MESSAGE_LENGTH),
      outcome: outcome.reply.kind === "suggest" ? "suggest" : "decline",
      topTarget: outcome.topCandidate?.target ?? "",
      topScore: outcome.topCandidate?.score ?? 0,
    }).catch((err: Error) => console.warn("[chatbot] could not log unanswered query:", err.message));
  }

  res.json({ status: "success", data: outcome.reply });
});

/** GET /chatbot/info → starter prompts and a little about the trained model. */
export const chatbotInfo = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const model = loadModel();
  res.json({
    status: "success",
    data: {
      suggestions: STARTER_SUGGESTIONS,
      model: {
        trainedAt: model.trainedAt,
        topics: model.stats.entries,
        externalApi: false,
      },
    },
  });
});
