import mongoose from "mongoose";

/**
 * Local, MongoDB-backed vector store — the zero-external-dependency
 * replacement for Pinecone (see services/vectorStore.ts and
 * docs/LOCAL_AI_MIGRATION_AUDIT.md). Vectors are compared with brute-force
 * cosine similarity, which is appropriate at this app's scale (thousands,
 * not millions, of question/interview embeddings). `namespace` mirrors
 * Pinecone's per-user namespace concept ("" = the default/shared namespace).
 */
const vectorEmbeddingSchema = new mongoose.Schema(
  {
    namespace: { type: String, required: true, default: "", index: true },
    vectorId: { type: String, required: true },
    values: { type: [Number], required: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

vectorEmbeddingSchema.index({ namespace: 1, vectorId: 1 }, { unique: true });

export const VectorEmbedding =
  mongoose.models.VectorEmbedding || mongoose.model("VectorEmbedding", vectorEmbeddingSchema);
