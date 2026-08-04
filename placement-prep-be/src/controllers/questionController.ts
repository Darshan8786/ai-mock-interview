import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { asyncHandler } from "../utils/asyncHandler";
import { generateQuestion, getEmbedding } from "../services/aiService";
import { upsertVector, queryVectors } from "../services/pineconeService";
import { AppError } from "../utils/AppError";

// 1. Generate & Store Question
export const createAIQuestion = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { topic, difficulty } = req.body;

    if (!topic) {
      return next(new AppError("Please provide a topic", 400));
    }

    // 1. Generate Question using Gemini
    const aiData = await generateQuestion(topic, difficulty || "medium");
    
    // 2. Generate Embedding from Question Text
    const questionText = aiData.question;
    const embedding = await getEmbedding(questionText);

    // 3. Store in Pinecone
    const vectorId = uuidv4();
    await upsertVector(vectorId, embedding, {
      topic: aiData.topic,
      difficulty: aiData.difficulty,
      question: aiData.question,
      answer: aiData.answer, // Storing answer in metadata for retrieval
    });

    res.status(201).json({
      status: "success",
      data: {
        id: vectorId,
        ...aiData,
      },
    });
  }
);

// 2. Search Similar Questions
export const searchQuestions = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { query } = req.body;

    if (!query) {
      return next(new AppError("Please provide a search query", 400));
    }

    // 1. Generate Embedding for Query
    const embedding = await getEmbedding(query);

    // 2. Query Pinecone
    const matches = await queryVectors(embedding, 5);

    // 3. Format Results
    const results = matches.map((match) => ({
      id: match.id,
      score: match.score,
      metadata: match.metadata,
    }));

    res.status(200).json({
      status: "success",
      results: results.length,
      data: results,
    });
  }
);
