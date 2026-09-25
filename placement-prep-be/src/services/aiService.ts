import axios from "axios";
import { AppError } from "../utils/AppError";
import { embedText } from "./embeddingService";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:5001";
const AI_SERVICE_KEY = process.env.AI_SERVICE_KEY || "mindprep-ai-key-2026";

// Generates one AI quiz question (topic + difficulty). Previously called
// Gemini directly; now routes to ai-services' local fine-tuned interviewer
// model / offline question bank (POST /generate-quiz-question) - the same
// local generation chain the mock-interview flow already uses. No external
// AI API key is required. See docs/LOCAL_AI_MIGRATION_AUDIT.md.
export const generateQuestion = async (topic: string, difficulty: string) => {
  try {
    const response = await axios.post(
      `${AI_SERVICE_URL}/generate-quiz-question`,
      { topic, difficulty },
      { timeout: 15000, headers: { "X-AI-Service-Key": AI_SERVICE_KEY } }
    );
    const { question, answer, source } = response.data;
    return { question, answer: answer || "", difficulty, topic, source };
  } catch (error) {
    throw new AppError(`AI Generation failed: ${(error as Error).message}`, 500);
  }
};

export const getEmbedding = async (text: string) => {
  try {
    return await embedText(text);
  } catch (error) {
    throw new AppError(`Embedding generation failed: ${(error as Error).message}`, 500);
  }
};
