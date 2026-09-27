/**
 * A deliberately misbehaving stand-in for ai-services, used only by e2eAdaptive.ts (E2E_ONLY=ai-faults) to prove the
 * backend survives a broken AI layer. Never used by the app.
 *
 *   FAKE_AI_MODE=malformed|empty|unauthorized|slow FAKE_AI_PORT=8099 npx tsx src/scripts/fakeAiService.ts
 *
 *   malformed     200 with wrong-shaped JSON (missing options/type, strings where arrays belong, ...)
 *   empty         200 with an empty body
 *   unauthorized  401 on every call (missing / wrong X-AI-Service-Key)
 *   slow          answers correctly-shaped JSON only after FAKE_AI_DELAY_MS (longer than the backend's timeout)
 */
import http from "http";

const MODE = process.env.FAKE_AI_MODE || "malformed";
const PORT = Number(process.env.FAKE_AI_PORT || 8099);
const DELAY = Number(process.env.FAKE_AI_DELAY_MS || 8000);

const malformed: Record<string, unknown> = {
  "/aptitude/generate-question": { question: "What is 20% of 150?", options: "20, 25, 30, 35", answer_index: 9 },
  "/tech-practice/generate-question": { question: "Explain Java collections.", source: "model" },
  "/tech-practice/evaluate": { verdict: "maybe" },
  "/generate-questions": { questions: "not-a-list" },
  "/evaluate-answer": { evaluation: { technicalScore: "high", feedback: 42 } },
  "/generate-feedback": { feedback: null },
};

http
  .createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const path = (req.url || "").split("?")[0];
      console.log(`[fake-ai:${MODE}] ${req.method} ${path}`);
      if (MODE === "unauthorized") {
        res.writeHead(401, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Unauthorized" }));
      }
      if (MODE === "empty") {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end("");
      }
      if (MODE === "slow") {
        return setTimeout(() => {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(malformed[path] || {}));
        }, DELAY);
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(malformed[path] ?? { unexpected: true }));
    });
  })
  .listen(PORT, "127.0.0.1", () => console.log(`fake ai-service (${MODE}) on ${PORT}`));
