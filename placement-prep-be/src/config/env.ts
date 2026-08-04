interface EnvConfig {
  PORT: number;
  MONGO_URI: string;
  PINECONE_API_KEY: string;
  GEMINI_API_KEY: string;
  OPENAI_API_KEY: string;
  GROQ_API_KEY: string;
  NIM_API_URL: string;
  NIM_API_KEY: string;
  NIM_MODEL: string;
  NODE_ENV: string;
  JWT_SECRET: string;
  AI_SERVICE_URL: string;
  ADZUNA_APP_ID: string;
  ADZUNA_APP_KEY: string;
}

const getEnv = (): EnvConfig => {
  const missing: string[] = [];
  const required: (keyof EnvConfig)[] = [
    "MONGO_URI",
    "PINECONE_API_KEY",
    "GEMINI_API_KEY",
  ];

  required.forEach((key) => {
    if (!process.env[key]) missing.push(key);
  });

  if (missing.length > 0) {
    console.error(`❌ CRITICAL: Missing Environment Variables: ${missing.join(", ")}`);
    process.exit(1);
  }

  return {
    PORT: Number(process.env.PORT) || 5000,
    MONGO_URI: process.env.MONGO_URI as string,
    PINECONE_API_KEY: process.env.PINECONE_API_KEY as string,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY as string,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY as string,
    GROQ_API_KEY: process.env.GROQ_API_KEY as string,
    NIM_API_URL: process.env.NIM_API_URL as string,
    NIM_API_KEY: process.env.NIM_API_KEY as string,
    NIM_MODEL: process.env.NIM_MODEL || "meta/llama-3.1-405b-instruct",
    NODE_ENV: process.env.NODE_ENV || "development",
    JWT_SECRET: process.env.JWT_SECRET || "fallback-secret-change-me",
    AI_SERVICE_URL: process.env.AI_SERVICE_URL || "http://localhost:5001",
    ADZUNA_APP_ID: process.env.ADZUNA_APP_ID || "",
    ADZUNA_APP_KEY: process.env.ADZUNA_APP_KEY || "",
  };
};

export const env = Object.freeze(getEnv());
