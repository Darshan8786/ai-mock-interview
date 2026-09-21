import { aptitudeKb } from "./kb/aptitude";
import { coreKb } from "./kb/core";
import { careerKb } from "./kb/career";
import { coreMoreKb } from "./kb/coreMore";
import { moreKb } from "./kb/careerMore";
import { intents, outOfScope } from "./intents";
import { rank } from "./matcher";
import type { EvalCase } from "./evalSet";
import { validationSet } from "./validationSet";
import { features, tokenize, vectorize } from "./nlp";
import { OOS_TARGET, type ChatbotModel, type KbEntry } from "./types";

export const MODEL_VERSION = 3;

export const knowledgeBase: KbEntry[] = [...aptitudeKb, ...coreKb, ...careerKb, ...coreMoreKb, ...moreKb];

interface TrainingExample {
  target: string;
  text: string;
  /** Multiplier applied to the vector; <1 for examples derived from answer text. */
  weight: number;
}

/** Hyper-parameters chosen by the trainer on the validation set. */
interface Params {
  oovWeight: number;
  bigramWeight: number;
  /** Weight of answer-sentence examples; 0 disables them. */
  chunkWeight: number;
}

/**
 * Break an answer into sentence-sized pieces so words that appear in the
 * explanation (e.g. "discriminant", "Coffman") can also route a question to it.
 */
function answerChunks(answer: string): string[] {
  return answer
    .split(/\n|(?<=[.;:])\s+/)
    .map((c) => c.replace(/^[•\d.\s)-]+/, "").trim())
    .filter((c) => tokenize(c).length >= 3);
}

function collectExamples(chunkWeight: number): TrainingExample[] {
  const out: TrainingExample[] = [];
  for (const e of knowledgeBase) {
    for (const q of e.questions) out.push({ target: e.id, text: q, weight: 1 });
    out.push({ target: e.id, text: e.title, weight: 1 });
    if (chunkWeight > 0) for (const c of answerChunks(e.answer)) out.push({ target: e.id, text: c, weight: chunkWeight });
  }
  for (const i of intents) for (const q of i.questions) out.push({ target: i.id, text: q, weight: 1 });
  // A trained "not my job" class: everyday chit-chat the bot must decline. Lets it
  // recognise off-topic messages directly rather than only by a low score.
  for (const q of outOfScope) out.push({ target: OOS_TARGET, text: q, weight: 1 });
  return out;
}

/** Smoothed inverse document frequency; each training phrasing counts as one document. */
function computeIdf(docs: string[][]): Record<string, number> {
  const df: Record<string, number> = {};
  for (const feats of docs) for (const f of new Set(feats)) df[f] = (df[f] ?? 0) + 1;
  const n = docs.length;
  const idf: Record<string, number> = {};
  for (const [f, c] of Object.entries(df)) idf[f] = Math.log((n + 1) / (c + 1)) + 1;
  return idf;
}

function buildModel(params: Params): ChatbotModel {
  const examples = collectExamples(params.chunkWeight);
  const docs = examples.map((e) => features(tokenize(e.text)));
  const idf = computeIdf(docs);
  return {
    version: MODEL_VERSION,
    trainedAt: new Date().toISOString(),
    idf,
    examples: examples.map((e, i) => {
      const vec = vectorize(docs[i], idf, { bigramWeight: params.bigramWeight });
      if (e.weight !== 1) for (const k of Object.keys(vec)) vec[k] *= e.weight;
      return { target: e.target, vec };
    }),
    oovWeight: params.oovWeight,
    bigramWeight: params.bigramWeight,
    threshold: 0.3,
    confidentThreshold: 0.5,
    stats: {
      entries: knowledgeBase.length,
      intents: intents.length,
      examples: examples.length,
      vocabulary: Object.keys(idf).length,
      validationAccuracy: 0,
      outOfScopeRejection: 0,
    },
  };
}

export interface TrainingReport {
  validationAccuracy: number;
  outOfScopeRejection: number;
  params: Params;
  threshold: number;
  confidentThreshold: number;
  /** Every configuration tried, best first — shows the tuner's decision is not arbitrary. */
  search: { params: Params; threshold: number; balanced: number }[];
}

const OOV_GRID = [0, 2, 4, 6, 9, 12];
const BIGRAM_GRID = [0.4, 0.7, 1];
const CHUNK_GRID = [0, 0.6, 0.85];

/**
 * Fit the model:
 *   1. featurise every training phrasing (stemmed unigrams + bigrams) and,
 *      optionally, sentence chunks of each answer,
 *   2. learn IDF weights over them,
 *   3. grid-search the hyper-parameters — how strongly unknown words count
 *      against a match, how much bigrams matter, whether/how much answer-text
 *      chunks help, and the minimum similarity to answer at all — on a
 *      validation set of realistic messages plus out-of-scope negatives. A
 *      configuration is scored by the mean of (in-scope answered correctly) and
 *      (off-topic declined) so neither dominates.
 *
 * The final quality number comes from evalSet.ts, which is never seen here.
 */
export function train(): { model: ChatbotModel; report: TrainingReport } {
  // Only validation cases are used for tuning. The out-of-scope TRAINING phrasings
  // are excluded here: the model has seen them, so rejecting them proves nothing.
  const cases: EvalCase[] = validationSet;
  const inScope = cases.filter((c) => c.expect !== null);
  const offTopic = cases.filter((c) => c.expect === null);

  const search: TrainingReport["search"] = [];
  let best: { params: Params; t: number; score: number; acc: number; rej: number } | null = null;

  for (const chunkWeight of CHUNK_GRID) {
    for (const bigramWeight of BIGRAM_GRID) {
      for (const oovWeight of OOV_GRID) {
        const params: Params = { oovWeight, bigramWeight, chunkWeight };
        const m = buildModel(params);
        const inTop = inScope.map((c) => {
          const top = rank(c.q, m)[0];
          return { score: top?.score ?? 0, correct: top?.target === c.expect };
        });
        const offTop = offTopic.map((c) => {
          const top = rank(c.q, m)[0];
          return { score: top?.score ?? 0, oos: !top || top.target === OOS_TARGET };
        });

        const ties: number[] = [];
        let localBest = -1;
        let acc = 0;
        let rej = 0;
        for (let t = 0.05; t <= 0.9; t += 0.01) {
          const a = inTop.filter((x) => x.correct && x.score >= t).length / inTop.length;
          const r = offTop.filter((x) => x.oos || x.score < t).length / offTop.length;
          const bal = (a + r) / 2;
          if (bal > localBest + 1e-9) {
            localBest = bal;
            ties.length = 0;
            ties.push(t);
            acc = a;
            rej = r;
          } else if (Math.abs(bal - localBest) <= 1e-9) {
            ties.push(t);
          }
        }
        const t = ties[Math.floor(ties.length / 2)];
        search.push({ params, threshold: Number(t.toFixed(2)), balanced: localBest });
        // On a tie prefer the simpler model: fewer chunk examples, then smaller OOV weight.
        if (!best || localBest > best.score + 1e-9) best = { params, t, score: localBest, acc, rej };
      }
    }
  }
  search.sort((a, b) => b.balanced - a.balanced);
  const chosen = best!;

  // "Confident": the lowest similarity at which >=95% of accepted answers were right.
  const tuned = buildModel(chosen.params);
  const scored = cases.map((c) => {
    const top = rank(c.q, tuned)[0];
    return { score: top?.score ?? 0, right: c.expect !== null && top?.target === c.expect };
  });
  let confident = Math.min(0.95, chosen.t + 0.1);
  for (let t = chosen.t; t <= 0.95; t += 0.01) {
    const accepted = scored.filter((x) => x.score >= t);
    if (accepted.length >= 5 && accepted.filter((x) => x.right).length / accepted.length >= 0.95) {
      confident = t;
      break;
    }
  }

  const model: ChatbotModel = {
    ...tuned,
    threshold: Number(chosen.t.toFixed(2)),
    confidentThreshold: Number(Math.max(confident, chosen.t).toFixed(2)),
    stats: {
      ...tuned.stats,
      validationAccuracy: Number(chosen.acc.toFixed(4)),
      outOfScopeRejection: Number(chosen.rej.toFixed(4)),
    },
  };

  return {
    model,
    report: {
      validationAccuracy: chosen.acc,
      outOfScopeRejection: chosen.rej,
      params: chosen.params,
      threshold: model.threshold,
      confidentThreshold: model.confidentThreshold,
      search: search.slice(0, 5),
    },
  };
}
