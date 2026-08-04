import { geminiModel, embeddingModel } from "../config/gemini";
import { AppError } from "../utils/AppError";

export const generateQuestion = async (topic: string, difficulty: string) => {
  try {
    const prompt = `Generate a unique interview question about ${topic} with ${difficulty} difficulty. 
    Return a JSON object with keys: "question", "answer", "difficulty", "topic".`;

    const result = await geminiModel.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const response = result.response;
    const text = response.text();
    
    return JSON.parse(text);
  } catch (error) {
    throw new AppError(`AI Generation failed: ${(error as Error).message}`, 500);
  }
};

export const getEmbedding = async (text: string) => {
  try {
    const result = await embeddingModel.embedContent(text);
    return result.embedding.values;
  } catch (error) {
    throw new AppError(`Embedding generation failed: ${(error as Error).message}`, 500);
  }
};
