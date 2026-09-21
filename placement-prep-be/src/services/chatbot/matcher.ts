import { correctTokens, cosine, features, tokenize, vectorize } from "./nlp";
import { OOS_TARGET, type ChatbotModel, type ModelExample } from "./types";

export interface Match {
  target: string;
  score: number;
}

const vocabCache = new WeakMap<ChatbotModel, Set<string>>();

function vocabOf(model: ChatbotModel): Set<string> {
  let v = vocabCache.get(model);
  if (!v) {
    v = new Set(Object.keys(model.idf).filter((k) => !k.includes("_")));
    vocabCache.set(model, v);
  }
  return v;
}

/** Aggregate per-example similarities into one score per target (best example wins). */
export function bestPerTarget(
  queryVec: Record<string, number>,
  examples: ModelExample[],
  skipIndex = -1
): Match[] {
  const best = new Map<string, number>();
  for (let i = 0; i < examples.length; i++) {
    if (i === skipIndex) continue;
    const s = cosine(queryVec, examples[i].vec);
    if (s > (best.get(examples[i].target) ?? 0)) best.set(examples[i].target, s);
  }
  return [...best.entries()].map(([target, score]) => ({ target, score })).sort((a, b) => b.score - a.score);
}

/** Rank every known target for a free-text message; best first. Empty if nothing overlaps. */
export function rank(text: string, model: ChatbotModel): Match[] {
  const tokens = correctTokens(tokenize(text), vocabOf(model));
  const vec = vectorize(features(tokens), model.idf, {
    oovWeight: model.oovWeight,
    bigramWeight: model.bigramWeight,
  });
  if (Object.keys(vec).length === 0) return [];
  return bestPerTarget(vec, model.examples).filter((m) => m.score > 0);
}

/** Below this similarity a candidate is too weak to even suggest. */
export const SUGGEST_MIN = 0.15;

export type Decision =
  | { kind: "answer"; match: Match; confident: boolean }
  | { kind: "suggest"; matches: Match[] }
  | { kind: "decline" };

export interface DecisionConfig {
  /** Minimum similarity to answer. */
  threshold: number;
  /** Similarity from which an answer is presented as confident. */
  confidentThreshold: number;
  /** Below the threshold but at/above this, offer "did you mean" suggestions. */
  suggestMin: number;
}

/**
 * Turn a ranking into what the bot should do:
 *  - answer   — the best match clears the threshold;
 *  - suggest  — it is a plausible-but-uncertain topic: offer the top candidates
 *               as "did you mean" rather than guess or stonewall;
 *  - decline  — the trained out-of-scope class won, or nothing is close.
 * Works for any scorer (keyword or neural) — only the thresholds differ.
 */
export function decideRanked(ranked: Match[], cfg: DecisionConfig): Decision {
  const top = ranked[0];
  if (!top || top.target === OOS_TARGET) return { kind: "decline" };
  if (top.score >= cfg.threshold) {
    return { kind: "answer", match: top, confident: top.score >= cfg.confidentThreshold };
  }
  if (top.score >= cfg.suggestMin) {
    const matches = ranked.filter((m) => m.target !== OOS_TARGET && m.score >= cfg.suggestMin).slice(0, 3);
    return { kind: "suggest", matches };
  }
  return { kind: "decline" };
}

/** Keyword (TF-IDF) model decision. */
export function decide(ranked: Match[], model: ChatbotModel): Decision {
  return decideRanked(ranked, {
    threshold: model.threshold,
    confidentThreshold: model.confidentThreshold,
    suggestMin: SUGGEST_MIN,
  });
}
