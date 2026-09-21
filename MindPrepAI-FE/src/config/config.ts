export const BACKEND_URL =
  (import.meta.env.VITE_BACKEND_URL as string | undefined) || "http://localhost:3001";

// placement-admin-be (Alumni management + public alumni openings) — port 5001.
// It has its own admin accounts/tokens, separate from the main backend above.
export const ADMIN_API_URL =
  ((import.meta.env.VITE_ADMIN_API_URL as string | undefined) || "http://localhost:5001").replace(/\/+$/, "");

// Legacy Flask AI service (LLM question gen / evaluation / STT / TTS) — port 8000.
export const AI_SERVICE_URL =
  (import.meta.env.VITE_AI_SERVICE_URL as string | undefined) || "http://127.0.0.1:8000";

// FastAPI proctoring service WebSocket — port 8001.
// Use 127.0.0.1, NOT "localhost": on Windows "localhost" resolves to ::1
// (IPv6) first, the service binds IPv4 only, and the browser/client waits out
// a ~2s TCP fallback on every single connection attempt before retrying on
// 127.0.0.1 — which is exactly the "proctoring takes forever to connect" bug.
export const PROCTOR_WS_URL =
  (import.meta.env.VITE_PROCTOR_WS_URL as string | undefined) || "ws://127.0.0.1:8001";

// Shared secret for the AI service (X-AI-Service-Key). This is an internal
// service-to-service secret, NOT a paid AI-provider API key — no Groq/Gemini/NIM
// key is ever exposed to the browser. Still overridable via env so it is not
// hard-copied across files.
export const AI_SERVICE_KEY =
  (import.meta.env.VITE_AI_SERVICE_KEY as string | undefined) || "mindprep-ai-key-2026";
