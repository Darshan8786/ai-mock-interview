import { env } from "../config/env";

const OLLAMA_URL = env.OLLAMA_URL.replace(/\/+$/, "");
const OLLAMA_EMBED_MODEL = env.OLLAMA_EMBED_MODEL;

/**
 * Generate an embedding vector using a local Ollama embedding model
 * (e.g. nomic-embed-text, 768 dimensions). Requires Ollama to be running
 * locally (default http://localhost:11434).
 */
export async function embedText(text: string): Promise<number[]> {
  const response = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: OLLAMA_EMBED_MODEL, input: text }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Ollama embedding failed (${response.status}): ${detail}`);
  }

  const data = (await response.json()) as { embeddings: number[][] };
  const embedding = data.embeddings?.[0];
  if (!embedding) {
    throw new Error("Ollama returned no embedding for the given input");
  }
  return embedding;
}
