import { upsertVector as storeUpsert, queryVectors as storeQuery } from "./vectorStore";
import { AppError } from "../utils/AppError";

// Default (unnamespaced) vector store, used by the quiz-question RAG feature.
// Backed by Pinecone when configured, otherwise a local MongoDB-based store —
// see vectorStore.ts.
export const upsertVector = async (id: string, vector: number[], metadata: any) => {
  try {
    await storeUpsert("", id, vector, metadata);
  } catch (error) {
    throw new AppError(`Vector upsert failed: ${(error as Error).message}`, 500);
  }
};

export const queryVectors = async (vector: number[], topK: number = 5) => {
  try {
    return await storeQuery("", vector, topK);
  } catch (error) {
    throw new AppError(`Vector query failed: ${(error as Error).message}`, 500);
  }
};
