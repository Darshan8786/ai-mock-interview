import type { Match } from "./matcher";

const AI_SERVICE_URL = (process.env.AI_SERVICE_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
const AI_SERVICE_KEY = process.env.AI_SERVICE_KEY || "mindprep-ai-key-2026";

/** A request this slow means the service is struggling; the keyword model answers instead. */
const TIMEOUT_MS = 2500;

/** After a failure, skip the service for a while so every message doesn't pay the timeout. */
const COOLDOWN_MS = 15_000;
let unavailableUntil = 0;
let lastWarn = 0;

export interface NeuralRanking {
  ranked: Match[];
  threshold: number;
  confidentThreshold: number;
  /** Suggestions are offered down to (threshold - suggestMargin). */
  suggestMargin: number;
}

/**
 * Rank a message with the fine-tuned neural encoder in ai-services
 * (POST /chatbot/match). Returns null if the service is down, slow or has no
 * trained model — the caller must then fall back to the keyword model, so the
 * chatbot keeps working either way.
 */
export async function neuralRank(text: string): Promise<NeuralRanking | null> {
  if (Date.now() < unavailableUntil) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${AI_SERVICE_URL}/chatbot/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-AI-Service-Key": AI_SERVICE_KEY },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`AI service replied ${res.status}`);
    const body = (await res.json()) as {
      ranked: { target: string; score: number }[];
      threshold: number;
      confidentThreshold: number;
      suggestMargin: number;
    };
    if (!Array.isArray(body.ranked) || !body.ranked.length) throw new Error("empty ranking");
    return {
      ranked: body.ranked,
      threshold: body.threshold,
      confidentThreshold: body.confidentThreshold,
      suggestMargin: body.suggestMargin,
    };
  } catch (err) {
    unavailableUntil = Date.now() + COOLDOWN_MS;
    if (Date.now() - lastWarn > 60_000) {
      lastWarn = Date.now();
      console.warn(`[chatbot] neural matcher unavailable, using keyword model: ${(err as Error).message}`);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}
