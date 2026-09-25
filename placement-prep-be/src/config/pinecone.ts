import { Pinecone } from "@pinecone-database/pinecone";
import { env } from "./env.js";

// Optional: Pinecone is not required for the app to start, or for vector
// search to work at all. When PINECONE_API_KEY is unset — or LOCAL_ONLY=true,
// which ignores a configured key outright and never touches the network —
// `index` is null and services/vectorStore.ts transparently falls back to a
// local, MongoDB-backed vector store instead. Quiz-question search and
// mock-interview RAG context keep working with zero external dependency
// either way. See pineconeService.ts, interviewRagService.ts, and
// docs/LOCAL_AI_MIGRATION_AUDIT.md.
export const pinecone =
  env.PINECONE_API_KEY && !env.LOCAL_ONLY ? new Pinecone({ apiKey: env.PINECONE_API_KEY }) : null;

export const getIndex = (name: string) => pinecone?.index(name) ?? null;

// Default index export used by pineconeService
export const index = pinecone ? pinecone.index(process.env.PINECONE_INDEX_NAME || "mindprep") : null;
