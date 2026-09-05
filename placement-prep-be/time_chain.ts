import axios from "axios";

const t = (label: string, ms: number) =>
  console.log(`${label.padEnd(38)} ${(ms / 1000).toFixed(2)}s`);

async function main() {
  // 1. Ollama embed via backend service
  let t0 = Date.now();
  try {
    const { embedText } = await import("./src/services/embeddingService");
    const v = await embedText(
      "Full Stack Developer Technical Entry Level mock interview"
    );
    t("embedText (Ollama)", Date.now() - t0);
    console.log("  vector dims:", v.length);
  } catch (e: any) {
    t("embedText ERROR", Date.now() - t0);
    console.log(" ", e.message);
  }

  // 2. Pinecone query
  t0 = Date.now();
  try {
    const { getInterviewContext } = await import(
      "./src/services/interviewRagService"
    );
    const ctx = await getInterviewContext(
      "testuser",
      "Full Stack Developer Technical Entry Level"
    );
    t("getInterviewContext (Pinecone)", Date.now() - t0);
    console.log("  ctx len:", ctx.length);
  } catch (e: any) {
    t("Pinecone ERROR", Date.now() - t0);
    console.log(" ", e.message);
  }

  // 3. Flask generate-questions over localhost (IPv6 trap) vs 127.0.0.1
  const body = {
    jobRole: "Full Stack Developer",
    experienceLevel: "Entry Level",
    interviewType: "Technical",
    difficulty: "Medium",
    totalQuestions: 3,
  };
  const headers = {
    "Content-Type": "application/json",
    "X-AI-Service-Key": process.env.AI_SERVICE_KEY || "mindprep-ai-key-2026",
  };
  for (const host of ["http://localhost:8000", "http://127.0.0.1:8000"]) {
    t0 = Date.now();
    try {
      await axios.post(`${host}/generate-questions`, body, {
        headers,
        timeout: 30000,
      });
      t(`generate-questions via ${host}`, Date.now() - t0);
    } catch (e: any) {
      t(`generate-questions via ${host} ERROR`, Date.now() - t0);
      console.log(" ", e.message);
    }
  }
}

main().catch((e) => console.error(e));
