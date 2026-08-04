import { index } from "../config/pinecone";
import { AppError } from "../utils/AppError";

export const upsertVector = async (id: string, vector: number[], metadata: any) => {
  try {
    await index.upsert([
      {
        id,
        values: vector,
        metadata,
      },
    ]);
  } catch (error) {
    throw new AppError(`Pinecone Upsert failed: ${(error as Error).message}`, 500);
  }
};

export const queryVectors = async (vector: number[], topK: number = 5) => {
  try {
    const queryResponse = await index.query({
      vector,
      topK,
      includeMetadata: true,
    });
    return queryResponse.matches;
  } catch (error) {
    throw new AppError(`Pinecone Query failed: ${(error as Error).message}`, 500);
  }
};
