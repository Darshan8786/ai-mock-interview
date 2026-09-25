import { index as pineconeIndex } from "../config/pinecone";
import { VectorEmbedding } from "../models/VectorEmbedding";

export interface VectorMatch {
  id: string;
  score: number;
  metadata: Record<string, any>;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Vector upsert/query, used by pineconeService.ts (default namespace "") and
 * interviewRagService.ts (namespace = userId). Uses managed Pinecone when
 * PINECONE_API_KEY is configured (unchanged legacy path); otherwise falls
 * back to a local, MongoDB-backed brute-force cosine-similarity store — no
 * external service, no native dependency, and it runs on infrastructure this
 * app already requires. See docs/LOCAL_AI_MIGRATION_AUDIT.md for the audit
 * that motivated this.
 */
export async function upsertVector(
  namespace: string,
  id: string,
  vector: number[],
  metadata: Record<string, any>
): Promise<void> {
  if (pineconeIndex) {
    const target = namespace ? pineconeIndex.namespace(namespace) : pineconeIndex;
    await target.upsert([{ id, values: vector, metadata }]);
    return;
  }
  await VectorEmbedding.findOneAndUpdate(
    { namespace, vectorId: id },
    { namespace, vectorId: id, values: vector, metadata },
    { upsert: true, new: true }
  );
}

export async function queryVectors(
  namespace: string,
  vector: number[],
  topK: number = 5
): Promise<VectorMatch[]> {
  if (pineconeIndex) {
    const target = namespace ? pineconeIndex.namespace(namespace) : pineconeIndex;
    const response = await target.query({ vector, topK, includeMetadata: true });
    return (response.matches || []).map((m: any) => ({
      id: m.id,
      score: m.score,
      metadata: (m.metadata || {}) as Record<string, any>,
    }));
  }
  const docs = await VectorEmbedding.find({ namespace }).lean();
  const scored: VectorMatch[] = docs.map((d: any) => ({
    id: d.vectorId as string,
    score: cosineSimilarity(vector, d.values as number[]),
    metadata: (d.metadata || {}) as Record<string, any>,
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}
