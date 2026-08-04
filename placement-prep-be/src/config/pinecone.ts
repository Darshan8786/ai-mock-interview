import { Pinecone } from "@pinecone-database/pinecone";
import { env } from "./env.js";

export const pinecone = new Pinecone({
  apiKey: env.PINECONE_API_KEY,
});

export const getIndex = (name: string) => pinecone.index(name);

// Default index export used by pineconeService
export const index = pinecone.index(process.env.PINECONE_INDEX_NAME || "mindprep");
