interface EnvConfig {
  PORT: number;
  MONGO_URI: string;
  PINECONE_API_KEY: string;
  OLLAMA_URL: string;
  OLLAMA_EMBED_MODEL: string;
  NODE_ENV: string;
  JWT_SECRET: string;
  AI_SERVICE_URL: string;
  ADZUNA_APP_ID: string;
  ADZUNA_APP_KEY: string;
  LOCAL_ONLY: boolean;
}

const getEnv = (): EnvConfig => {
  const missing: string[] = [];
  // Only genuinely required for the app to run at all. Pinecone backs the
  // vector-search RAG enhancement and degrades gracefully without a key (see
  // config/pinecone.ts, services/vectorStore.ts), so it is optional here.
  // Gemini, OpenAI, Groq, and NVIDIA NIM are not read anywhere in this
  // backend at all anymore (mock-interview questions, resume analysis, and
  // quiz-question generation all run through ai-services' local models) —
  // removed from this config entirely rather than kept as unused fields.
  // See docs/LOCAL_AI_MIGRATION_AUDIT.md.
  const required: (keyof EnvConfig)[] = [
    "MONGO_URI",
  ];

  required.forEach((key) => {
    if (!process.env[key]) missing.push(key);
  });

  if (missing.length > 0) {
    console.error(`❌ CRITICAL: Missing Environment Variables: ${missing.join(", ")}`);
    process.exit(1);
  }

  const localOnly = (process.env.LOCAL_ONLY || "").toLowerCase() === "true";

  if (!process.env.PINECONE_API_KEY) {
    console.warn("⚠️  PINECONE_API_KEY not set — vector search uses the local MongoDB-backed store instead (see services/vectorStore.ts); the app runs normally.");
  } else if (localOnly) {
    console.warn("⚠️  LOCAL_ONLY=true — PINECONE_API_KEY is set but will be ignored; vector search uses the local MongoDB-backed store instead.");
  }

  return {
    PORT: Number(process.env.PORT) || 5000,
    MONGO_URI: process.env.MONGO_URI as string,
    PINECONE_API_KEY: process.env.PINECONE_API_KEY || "",
    OLLAMA_URL: process.env.OLLAMA_URL || "http://localhost:11434",
    OLLAMA_EMBED_MODEL: process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text",
    NODE_ENV: process.env.NODE_ENV || "development",
    JWT_SECRET: process.env.JWT_SECRET || "fallback-secret-change-me",
    AI_SERVICE_URL: process.env.AI_SERVICE_URL || "http://localhost:5001",
    ADZUNA_APP_ID: process.env.ADZUNA_APP_ID || "",
    ADZUNA_APP_KEY: process.env.ADZUNA_APP_KEY || "",
    LOCAL_ONLY: localOnly,
  };
};

export const env = Object.freeze(getEnv());
