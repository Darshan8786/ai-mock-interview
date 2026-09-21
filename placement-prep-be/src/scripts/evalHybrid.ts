/**
 * Compares the three ways the chatbot can understand a message, on the same
 * held-out test sets — both as written and with typos injected:
 *
 *   keyword — TF-IDF model (works offline, strong typo correction)
 *   neural  — fine-tuned sentence encoder in ai-services (needs that service)
 *   hybrid  — neural, except when it is unsure and the keyword model is confident
 *
 *   npm run eval:hybrid        (start ai-services first, or set AI_SERVICE_URL)
 */
import { evalSet, type EvalCase } from "../services/chatbot/evalSet";
import { evalSetFresh } from "../services/chatbot/evalSetFresh";
import { evalSetCold3 } from "../services/chatbot/evalSetCold3";
import { decideRanked, rank, SUGGEST_MIN, type Decision, type Match } from "../services/chatbot/matcher";
import { fuseDecisions } from "../services/chatbot/fusion";
import { loadModel } from "../services/chatbot/modelStore";
import { neuralRank } from "../services/chatbot/neuralClient";

const kw = loadModel();

/** Deterministic PRNG so the typo sets are identical on every run. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function withTypos(text: string, rnd: () => number): string {
  return text
    .split(" ")
    .map((w) => {
      if (w.length < 5 || rnd() > 0.4) return w;
      const i = 1 + Math.floor(rnd() * (w.length - 2));
      const op = Math.floor(rnd() * 3);
      if (op === 0) return w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2); // swap
      if (op === 1) return w.slice(0, i) + w.slice(i + 1); // drop
      return w.slice(0, i) + w[i] + w.slice(i); // duplicate
    })
    .join(" ");
}

type Strategy = "keyword" | "neural" | "hybrid";

async function decideAll(q: string): Promise<Record<Strategy, Decision>> {
  const kRanked: Match[] = rank(q, kw);
  const kDec = decideRanked(kRanked, { threshold: kw.threshold, confidentThreshold: kw.confidentThreshold, suggestMin: SUGGEST_MIN });
  const n = await neuralRank(q);
  if (!n) throw new Error("neural service unavailable — start ai-services (or set AI_SERVICE_URL)");
  const nDec = decideRanked(n.ranked, {
    threshold: n.threshold,
    confidentThreshold: n.confidentThreshold,
    suggestMin: n.threshold - n.suggestMargin,
  });
  const hybrid = fuseDecisions(nDec, kDec);
  return { keyword: kDec, neural: nDec, hybrid };
}

function score(cases: EvalCase[], decisions: Decision[]) {
  let nIn = 0, exact = 0, helpful = 0, nOff = 0, declined = 0;
  cases.forEach((c, i) => {
    const d = decisions[i];
    if (c.expect === null) {
      nOff++;
      if (d.kind !== "answer") declined++;
      return;
    }
    nIn++;
    const ok = d.kind === "answer" && d.match.target === c.expect;
    if (ok) exact++;
    if (ok || (d.kind === "suggest" && d.matches.some((m) => m.target === c.expect))) helpful++;
  });
  return { exact: exact / nIn, helpful: helpful / nIn, declined: nOff ? declined / nOff : 1 };
}

const pct = (x: number) => `${(x * 100).toFixed(1).padStart(5)}%`;

(async () => {
  const sets: Record<string, EvalCase[]> = { "test 1": evalSet, "test 2": evalSetFresh, "test 3": evalSetCold3 };
  const rnd = mulberry32(2026);
  const totals: Record<string, Record<Strategy, { exact: number; helpful: number; declined: number; n: number }>> = {};

  for (const variant of ["as written", "with typos"] as const) {
    console.log(`\n══════ ${variant} ══════`);
    console.log("set      strategy   exact   answer-or-suggestion   off-topic declined");
    for (const [name, base] of Object.entries(sets)) {
      const cases = variant === "as written" ? base : base.map((c) => ({ ...c, q: withTypos(c.q, rnd) }));
      const all = [];
      for (const c of cases) all.push(await decideAll(c.q));
      for (const s of ["keyword", "neural", "hybrid"] as Strategy[]) {
        const r = score(cases, all.map((d) => d[s]));
        console.log(`${name}   ${s.padEnd(8)}  ${pct(r.exact)}   ${pct(r.helpful)}               ${pct(r.declined)}`);
        const key = variant;
        totals[key] ??= {} as any;
        const t = (totals[key][s] ??= { exact: 0, helpful: 0, declined: 0, n: 0 });
        t.exact += r.exact; t.helpful += r.helpful; t.declined += r.declined; t.n++;
      }
    }
  }

  console.log("\n══════ average over the three sets ══════");
  for (const [variant, byS] of Object.entries(totals)) {
    for (const [s, t] of Object.entries(byS)) {
      console.log(`${variant.padEnd(10)} ${s.padEnd(8)}  exact ${pct(t.exact / t.n)}  answer-or-suggestion ${pct(t.helpful / t.n)}  declined ${pct(t.declined / t.n)}`);
    }
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
