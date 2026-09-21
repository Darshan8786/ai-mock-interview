/**
 * Dependency-free text processing for the local study chatbot.
 *
 * Everything here is deterministic and runs in-process: no API keys, no
 * network, no external model server. The chatbot "learns" by turning training
 * utterances into TF-IDF vectors (see trainer.ts) and answers by nearest
 * neighbour search over those vectors.
 */

export type SparseVector = Record<string, number>;

const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "am", "do", "does", "did",
  "of", "to", "in", "on", "at", "for", "with", "and", "or", "it", "its", "this", "that",
  "these", "those", "i", "me", "you", "your", "we", "our", "can", "could", "would",
  "should", "will", "shall", "please", "tell", "explain", "about", "give", "show", "what",
  "whats", "how", "why", "when", "where", "which", "who", "some", "any", "so", "if", "then",
  "than", "as", "by", "from", "into", "up", "out", "there", "here", "get", "want", "know",
  "need", "just", "like", "also", "much", "very",
]);

/** Symbols that carry meaning in tech text and would be destroyed by tokenising on \W. */
const PROTECTED: [RegExp, string][] = [
  [/c\+\+/g, "cpp"],
  [/c#/g, "csharp"],
  [/\.net\b/g, "dotnet"],
  [/node\.?js/g, "nodejs"],
  [/react\.?js/g, "react"],
  [/\bvs\.?\b/g, " versus "],
  [/\bdiff(?:erence)?s?\b/g, " difference "],
  [/\bq&a\b/g, "qa"],
  [/&/g, " and "],
];

/** Common abbreviations / spellings mapped to one canonical token. */
const SYNONYMS: Record<string, string> = {
  interviews: "interview",
  interviewer: "interview",
  hr: "hr",
  cv: "resume",
  ats: "ats",
  gd: "groupdiscussion",
  si: "simpleinterest",
  ci: "compoundinterest",
  tsd: "speeddistancetime",
  lcm: "lcm",
  hcf: "hcf",
  gcd: "hcf",
  oops: "oop",
  oop: "oop",
  ooad: "oop",
  dbms: "dbms",
  rdbms: "dbms",
  os: "os",
  cn: "network",
  networking: "network",
  networks: "network",
  ds: "dsa",
  dsa: "dsa",
  algo: "algorithm",
  algos: "algorithm",
  ml: "ml",
  js: "javascript",
  ts: "typescript",
  py: "python",
  db: "database",
  sql: "sql",
  nosql: "nosql",
  ppt: "presentation",
  qs: "question",
  ques: "question",
  qn: "question",
  quiz: "test",
  exam: "test",
  quizzes: "test",
  mock: "mock",
  weakness: "weak",
  weaknesses: "weak",
  weakest: "weak",
  weaker: "weak",
  struggling: "weak",
  improve: "improve",
  improving: "improve",
  improvement: "improve",
  better: "improve",
  score: "score",
  scores: "score",
  marks: "score",
  result: "score",
  results: "score",
  percent: "percentage",
  percentages: "percentage",
  pct: "percentage",
  // paraphrase folding: everyday words students use -> the word the KB uses
  chance: "probability",
  odds: "probability",
  likelihood: "probability",
  likely: "probability",
  app: "platform",
  site: "platform",
  website: "platform",
  portal: "platform",
  position: "role",
  lagging: "weak",
  lag: "weak",
  lacking: "weak",
  struggle: "weak",
  struggles: "weak",
  poor: "weak",
  worst: "weak",
  good: "strong",
  best: "strong",
  strongest: "strong",
  stronger: "strong",
  confident: "strong",
  excel: "strong",
  selected: "hire",
  select: "hire",
  hired: "hire",
  recruit: "hire",
  recruited: "hire",
  stage: "stage",
  stages: "stage",
  steps: "stage",
  step: "stage",
  phases: "stage",
  phase: "stage",
  previous: "history",
  past: "history",
  earlier: "history",
  leave: "skip",
  ignore: "skip",
  current: "stream",
  swim: "boat",
  swimming: "boat",
  rowing: "boat",
  tap: "pipe",
  taps: "pipe",
  faucet: "pipe",
  sit: "seat",
  sitting: "seat",
  seated: "seat",
  seats: "seat",
  sequence: "series",
  sequences: "series",
  pattern: "series",
  talk: "speak",
  talking: "speak",
  speaking: "speak",
  fluent: "speak",
  fluently: "speak",
  robot: "bot",
  chatbot: "bot",
  human: "person",
  hi: "hello",
  hey: "hello",
  hii: "hello",
  hiya: "hello",
  yo: "hello",
  thanks: "thank",
  thx: "thank",
  ty: "thank",
  bye: "goodbye",
  cya: "goodbye",
};

/** Cheap suffix stripper. Not linguistically perfect, but consistent, which is all TF-IDF needs. */
export function stem(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith("ies") && word.length > 4) return word.slice(0, -3) + "y";
  if (word.endsWith("sses")) return word.slice(0, -2);
  if (word.endsWith("ing") && word.length > 5) {
    const base = word.slice(0, -3);
    // running -> run, stopping -> stop
    return /(.)\1$/.test(base) ? base.slice(0, -1) : base;
  }
  if (word.endsWith("ed") && word.length > 4) {
    const base = word.slice(0, -2);
    return /(.)\1$/.test(base) ? base.slice(0, -1) : base;
  }
  if (word.endsWith("es") && word.length > 4 && /(s|x|z|ch|sh)es$/.test(word)) return word.slice(0, -2);
  if (word.endsWith("s") && !word.endsWith("ss") && !word.endsWith("us") && !word.endsWith("is")) {
    return word.slice(0, -1);
  }
  return word;
}

export function normalize(text: string): string {
  let t = text.toLowerCase();
  for (const [re, rep] of PROTECTED) t = t.replace(re, rep);
  return t;
}

/** Unigram tokens after normalising, stop-word removal, synonym folding and stemming. */
export function tokenize(text: string): string[] {
  const raw = normalize(text).match(/[a-z0-9]+/g) ?? [];
  const out: string[] = [];
  for (const w of raw) {
    if (STOPWORDS.has(w)) continue;
    const canon = SYNONYMS[w] ?? w;
    const tok = SYNONYMS[w] ? canon : stem(canon);
    // Stemming can turn a content word into a stop word ("explained" -> "explain").
    if (STOPWORDS.has(tok)) continue;
    out.push(tok);
  }
  return out;
}

/** Unigrams plus adjacent bigrams; bigrams let "time work" outrank "time speed". */
export function features(tokens: string[]): string[] {
  const feats = [...tokens];
  for (let i = 0; i < tokens.length - 1; i++) feats.push(`${tokens[i]}_${tokens[i + 1]}`);
  return feats;
}

export function levenshtein(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0];
    prev[0] = i;
    let rowMin = prev[0];
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1));
      last = tmp;
      if (prev[j] < rowMin) rowMin = prev[j];
    }
    if (rowMin > max) return max + 1;
  }
  return prev[b.length];
}

/**
 * Snap out-of-vocabulary tokens to the closest known one so a typo like
 * "percentge" or "deadlok" still matches. Deliberately conservative, because a
 * wrong "correction" (robot -> root) is worse than leaving the word unknown:
 * words under 6 letters are never touched, and the first letter must agree
 * (typos rarely change it).
 */
export function correctTokens(tokens: string[], vocab: Set<string>): string[] {
  return tokens.map((tok) => {
    if (vocab.has(tok) || tok.length < 6) return tok;
    const maxDist = tok.length >= 9 ? 2 : 1;
    let best = tok;
    let bestDist = maxDist + 1;
    for (const v of vocab) {
      if (v[0] !== tok[0] || v.includes("_")) continue;
      const d = levenshtein(tok, v, maxDist);
      if (d < bestDist) {
        bestDist = d;
        best = v;
        if (d === 1) break;
      }
    }
    return bestDist <= maxDist ? best : tok;
  });
}

export interface VectorOptions {
  /** Weight for words the model has never seen (they count towards length only). */
  oovWeight?: number;
  /** Multiplier for bigram features relative to unigrams (order-sensitivity vs. overlap). */
  bigramWeight?: number;
}

/**
 * L2-normalised sub-linear TF-IDF vector.
 *
 * Words the model has never seen cannot match anything, but they still count
 * towards the vector's length (weight `oovWeight`). Without this, "how is the
 * stock market doing" collapses to the single known word "doing" and scores a
 * perfect 1.0 against "how am I doing". The more of a message the model does
 * not understand, the lower its similarity — which is what lets it say "I don't
 * know" instead of guessing.
 *
 * Bigrams are down-weighted (`bigramWeight`) so a reordered paraphrase such as
 * "feedback from my last interview" still lines up with "my interview feedback".
 */
export function vectorize(feats: string[], idf: Record<string, number>, opts: VectorOptions = {}): SparseVector {
  const oovWeight = opts.oovWeight ?? 0;
  const bigramWeight = opts.bigramWeight ?? 1;
  const tf: Record<string, number> = {};
  let unknown = 0;
  for (const f of feats) {
    if (idf[f] !== undefined) tf[f] = (tf[f] ?? 0) + 1;
    else if (oovWeight > 0 && !f.includes("_")) unknown += 1;
  }
  const vec: SparseVector = {};
  let norm = unknown * oovWeight * oovWeight;
  for (const [f, count] of Object.entries(tf)) {
    const w = (1 + Math.log(count)) * idf[f] * (f.includes("_") ? bigramWeight : 1);
    vec[f] = w;
    norm += w * w;
  }
  norm = Math.sqrt(norm);
  if (norm === 0) return {};
  for (const f of Object.keys(vec)) vec[f] /= norm;
  return vec;
}

export function cosine(a: SparseVector, b: SparseVector): number {
  const [small, large] = Object.keys(a).length <= Object.keys(b).length ? [a, b] : [b, a];
  let dot = 0;
  for (const k in small) {
    const other = large[k];
    if (other !== undefined) dot += small[k] * other;
  }
  return dot;
}
