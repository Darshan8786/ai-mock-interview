/**
 * Explainable feedback for the mock-interview module.
 *
 * The analysis itself (scores, structure, communication, timeline, "why this score") is produced by
 * the existing LOCAL evaluator in ai-services (local_answer_evaluator.py) - nothing here calls or
 * depends on an external LLM. This file only
 *   - validates what comes back from it (zod) before anything is saved,
 *   - falls back gracefully (answer preserved, clearly flagged) when it is unavailable,
 *   - aggregates stored per-answer analyses into the report, weakness map, progress and the
 *     personalised plan for the next interview.
 *
 * Every aggregate is computed from stored answer evaluations; nothing is invented, and a metric that
 * a record does not have (older interviews, typed answers with no audio) is simply absent.
 */
import axios from "axios";
import { z } from "zod";

// ── Configuration ──────────────────────────────────────────────────────────
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:5001";
const AI_SERVICE_KEY = process.env.AI_SERVICE_KEY || "mindprep-ai-key-2026";
const aiServiceHeaders = { "X-AI-Service-Key": AI_SERVICE_KEY };

export const MAX_ANSWER_CHARS = 20000;
export const MAX_ATTEMPTS_PER_QUESTION = 10;
/** An answer scoring below this on a metric counts as weak on that metric. */
export const WEAK_THRESHOLD = 65;
/** An average at or above this counts as a strength. */
export const STRONG_THRESHOLD = 75;

// ── Metric catalogue ───────────────────────────────────────────────────────
export type MetricKey =
  | "technical"
  | "communication"
  | "confidence"
  | "grammar"
  | "fluency"
  | "relevance"
  | "structure"
  | "completeness"
  | "clarity"
  | "conciseness";

export const METRICS: ReadonlyArray<{ key: MetricKey; label: string; field: string }> = [
  { key: "technical", label: "Technical Accuracy", field: "technicalScore" },
  { key: "communication", label: "Communication", field: "communicationScore" },
  { key: "confidence", label: "Confidence", field: "confidenceScore" },
  { key: "grammar", label: "Grammar", field: "grammarScore" },
  { key: "fluency", label: "Fluency", field: "fluencyScore" },
  { key: "relevance", label: "Relevance", field: "relevanceScore" },
  { key: "structure", label: "Answer Structure", field: "structureScore" },
  { key: "completeness", label: "Completeness", field: "completenessScore" },
  { key: "clarity", label: "Clarity", field: "clarityScore" },
  { key: "conciseness", label: "Conciseness", field: "concisenessScore" },
];
const LEGACY_METRIC_KEYS: MetricKey[] = ["technical", "communication", "confidence", "grammar", "fluency", "relevance"];

const METRIC_ADVICE: Record<MetricKey, string> = {
  technical: "Revisit the concepts you missed and practise explaining each in one or two clear sentences.",
  communication: "Speak in short, complete sentences and keep every answer on the question.",
  confidence: "State what you know directly - replace hedges like \"I think\" with the statement itself.",
  grammar: "Re-read your answers for sentence endings and capitalisation; vary your vocabulary.",
  fluency: "Replace filler words with a short silent pause and keep a steady pace.",
  relevance: "Restate the key term of the question in your first sentence, then answer it.",
  structure: "Give every answer a clear shape (see the recommended structure on each question).",
  completeness: "Cover every expected point and add one concrete example.",
  clarity: "Use shorter sentences, cut hedging and avoid repeating yourself.",
  conciseness: "Lead with the answer, then add only the detail that supports it.",
};

// ── Validation (zod) ───────────────────────────────────────────────────────
const score = z
  .number()
  .finite()
  .transform((n) => Math.max(0, Math.min(100, Math.round(n))));
const text = (max: number) => z.string().transform((s) => s.slice(0, max));
const textList = (items: number, max: number) =>
  z.array(z.string()).transform((a) => a.slice(0, items).map((s) => s.slice(0, max)));
const fraction = z.number().min(0).max(1);
const count = z.number().int().min(0).max(100000);

const explanationEntry = z.object({
  score,
  good: textList(8, 400),
  missing: textList(8, 400),
  improve: textList(8, 400),
  // Caveat about how this score was produced (e.g. no answer key existed) - not a strength or a gap.
  note: text(300).optional(),
});

const analysisSchema = z.object({
  version: z.number().int(),
  questionType: z.enum(["technical", "behavioral", "project", "hr"]),
  conceptSource: text(40),
  matchedConcepts: textList(8, 80),
  missingConcepts: textList(8, 80),
  structure: z.object({
    type: z.enum(["technical", "behavioral", "project", "hr"]),
    label: text(80),
    framework: text(160),
    score,
    elements: z
      .array(
        z.object({
          key: text(40),
          label: text(60),
          found: z.boolean(),
          evidence: text(320),
          position: fraction.nullable(),
        })
      )
      .max(8),
    missing: textList(8, 60),
    recommendation: text(700),
  }),
  communication: z.object({
    wordCount: count,
    durationSeconds: z.number().min(0).max(86400).nullable(),
    durationSource: z.enum(["recording", "time_on_question"]).nullable(),
    durationLabel: text(20).nullable(),
    fillerWords: z.object({
      count,
      items: z.array(z.object({ word: text(30), count })).max(10),
    }),
    repeatedPhrases: z.object({ count, items: textList(6, 80) }),
    hedgingPhrases: z.object({ count, items: textList(6, 80) }),
    longPauses: z
      .object({
        count,
        totalSeconds: z.number().min(0),
        thresholdSeconds: z.number().min(0),
        items: z
          .array(z.object({ startSeconds: z.number().min(0), durationSeconds: z.number().min(0) }))
          .max(50),
      })
      .nullable(),
    speakingRate: z
      .object({ wpm: z.number().int().min(0).max(1000), label: z.enum(["Slow", "Normal", "Fast"]) })
      .nullable(),
    length: z.enum(["extremely_short", "short", "appropriate", "long"]),
    idealLength: z.object({ min: count, max: count }),
    feedback: text(900),
    flagged: z.boolean(),
    notes: textList(4, 300),
  }),
  timeline: z
    .array(
      z.object({
        kind: z.enum(["good", "warn", "bad"]),
        label: text(140),
        position: fraction.nullable(),
        atSeconds: z.number().min(0).max(86400).nullable(),
      })
    )
    .max(40),
  explanations: z.object({
    technical: explanationEntry.optional(),
    communication: explanationEntry.optional(),
    confidence: explanationEntry.optional(),
    grammar: explanationEntry.optional(),
    fluency: explanationEntry.optional(),
    relevance: explanationEntry.optional(),
    structure: explanationEntry.optional(),
    completeness: explanationEntry.optional(),
    clarity: explanationEntry.optional(),
    conciseness: explanationEntry.optional(),
  }),
  strengths: textList(6, 300),
  weaknesses: textList(6, 300),
  improvements: textList(8, 500),
  practiceTopics: textList(6, 120),
});
export type EvaluationAnalysis = z.infer<typeof analysisSchema>;

export interface EvaluationData {
  technicalScore: number;
  communicationScore: number;
  confidenceScore: number;
  grammarScore: number;
  fluencyScore: number;
  relevanceScore: number;
  feedback: string;
  structureScore?: number;
  completenessScore?: number;
  clarityScore?: number;
  concisenessScore?: number;
  source: "local" | "fallback";
  analysis?: EvaluationAnalysis;
}

const evaluationSchema = z.object({
  technicalScore: score,
  communicationScore: score,
  confidenceScore: score,
  grammarScore: score,
  fluencyScore: score,
  relevanceScore: score,
  feedback: text(2000).default(""),
  structureScore: score.optional(),
  completenessScore: score.optional(),
  clarityScore: score.optional(),
  concisenessScore: score.optional(),
});

/** Validates an evaluation from the AI service. Returns null if the six core scores are unusable;
 *  a malformed `analysis` is dropped (scores kept) rather than failing the whole answer. */
export function sanitizeEvaluation(raw: unknown): EvaluationData | null {
  const base = evaluationSchema.safeParse(raw);
  if (!base.success) {
    console.warn(`Mock-interview evaluation rejected: ${base.error.issues[0]?.message}`);
    return null;
  }
  const out: EvaluationData = { ...base.data, source: "local" };
  const analysis = analysisSchema.safeParse((raw as any)?.analysis);
  if (analysis.success) {
    out.analysis = analysis.data;
  } else if ((raw as any)?.analysis !== undefined) {
    console.warn(`Mock-interview analysis dropped (invalid shape): ${analysis.error.issues[0]?.path.join(".")}`);
  }
  return out;
}

/** Neutral placeholder used ONLY when the local evaluator is unavailable. Deterministic (never random),
 *  flagged `source: "fallback"` so no explanation is ever shown for it, and retried when the report opens. */
export function fallbackEvaluation(): EvaluationData {
  return {
    technicalScore: 60,
    communicationScore: 60,
    confidenceScore: 60,
    grammarScore: 60,
    fluencyScore: 60,
    relevanceScore: 60,
    feedback: "Automatic evaluation was unavailable for this answer. Your answer was saved.",
    source: "fallback",
  };
}

// Incoming answer payloads ---------------------------------------------------
const speechSchema = z.object({
  recordingSeconds: z.number().finite().min(0.5).max(3600),
  speechSeconds: z.number().finite().min(0).max(3700).optional(),
  pauseDetection: z.boolean().optional(),
  pauses: z
    .array(z.object({ startSeconds: z.number().finite().min(0).max(3700), durationSeconds: z.number().finite().min(0.1).max(3700) }))
    .max(50)
    .optional(),
});
export type SpeechMetrics = z.infer<typeof speechSchema>;

/** Lenient: unusable audio metadata is dropped (the answer still counts) - never an error. */
export function parseSpeech(raw: unknown, answerType: "voice" | "text"): SpeechMetrics | undefined {
  if (answerType !== "voice" || raw == null) return undefined;
  const parsed = speechSchema.safeParse(raw);
  if (!parsed.success) return undefined;
  const s = parsed.data;
  if (!s.pauseDetection) return { recordingSeconds: s.recordingSeconds, speechSeconds: s.speechSeconds };
  return { ...s, pauses: s.pauses ?? [] };
}

const answerBodySchema = z.object({
  answer: z.string().max(MAX_ANSWER_CHARS, "Answer is too long"),
  answerType: z.enum(["voice", "text"]).default("text"),
  timeTaken: z.number().finite().min(0).max(86400).default(0),
  speech: z.unknown().optional(),
});

export interface ParsedAnswerBody {
  answer: string;
  answerType: "voice" | "text";
  timeTaken: number;
  speech?: SpeechMetrics;
}

/** Returns the validated body or a human-readable error message. */
export function parseAnswerBody(body: any): { ok: true; value: ParsedAnswerBody } | { ok: false; message: string } {
  const parsed = answerBodySchema.safeParse({
    answer: typeof body?.answer === "string" ? body.answer : body?.answer == null ? "" : String(body.answer),
    answerType: body?.answerType ?? undefined,
    timeTaken: body?.timeTaken == null ? undefined : Number(body.timeTaken),
    speech: body?.speech,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message || "Invalid answer" };
  }
  const { answer, answerType, timeTaken, speech } = parsed.data;
  return { ok: true, value: { answer, answerType, timeTaken, speech: parseSpeech(speech, answerType) } };
}

// ── AI-service call ────────────────────────────────────────────────────────
export interface EvalRequest {
  question: string;
  answer: string;
  interviewType: string;
  difficulty: string;
  jobRole: string;
  skill?: string;
  topic?: string;
  concepts?: string[];
  answerType?: "voice" | "text";
  speech?: SpeechMetrics;
  timeTaken?: number;
}

/** Calls the local evaluator. Never throws: on any failure returns the flagged fallback. */
export async function evaluateAnswerWithAi(payload: EvalRequest, timeoutMs = 20000): Promise<EvaluationData> {
  try {
    const res = await axios.post(`${AI_SERVICE_URL}/evaluate-answer`, payload, {
      timeout: timeoutMs,
      headers: aiServiceHeaders,
    });
    return sanitizeEvaluation(res.data?.evaluation) ?? fallbackEvaluation();
  } catch (err: any) {
    console.error(`Answer evaluation unavailable: ${err?.message}`);
    return fallbackEvaluation();
  }
}

export function evalPayloadForQuestion(interview: any, q: any, answer: string, extra: Partial<EvalRequest> = {}): EvalRequest {
  return {
    question: q.question,
    answer,
    interviewType: interview.interviewType,
    difficulty: interview.difficulty,
    jobRole: interview.jobRole,
    skill: q.skill || "",
    topic: q.topic || "",
    concepts: Array.from((q.concepts as string[]) || []),
    ...extra,
  };
}

/**
 * Opening a report (re)evaluates answers that have no usable analysis: older interviews saved before
 * the feedback upgrade, and answers whose evaluation fell back because the service was down. Bounded
 * by an overall budget so a slow service can never hang the report; unchanged answers stay as they are.
 * College interviews are skipped (their grading uses an answer key this path must not see).
 * Returns true if anything changed.
 */
export async function ensureEvaluated(interview: any, budgetMs = 10000): Promise<boolean> {
  if (interview.source === "COLLEGE") return false;
  const targets: Array<{ target: any; answer: string; extra: Partial<EvalRequest>; question: any }> = [];
  for (const q of interview.questions) {
    if (q.skipped) continue;
    const consider = (target: any, answer: string, extra: Partial<EvalRequest>) => {
      const ev = target.evaluation;
      if (!answer.trim() || answer.trim() === "(voice recorded)") return;
      if (ev?.analysis && ev.source !== "fallback") return;
      targets.push({ target, answer, extra, question: q });
    };
    consider(q, q.answer || "", { answerType: q.answerType, speech: q.speech ? plain(q.speech) : undefined, timeTaken: q.timeTaken });
    for (const at of q.attempts || []) {
      consider(at, at.answer || "", { answerType: at.answerType, speech: at.speech ? plain(at.speech) : undefined, timeTaken: at.timeTaken });
    }
  }
  if (targets.length === 0) return false;

  let changed = false;
  const work = Promise.all(
    targets.slice(0, 40).map(async ({ target, answer, extra, question }) => {
      const result = await evaluateAnswerWithAi(evalPayloadForQuestion(interview, question, answer, extra), budgetMs);
      if (result.source === "fallback") return; // still unavailable - keep what is stored
      target.evaluation = result;
      changed = true;
    })
  );
  await Promise.race([work, new Promise((resolve) => setTimeout(resolve, budgetMs))]);
  return changed;
}

function plain(doc: any) {
  return typeof doc?.toObject === "function" ? doc.toObject() : doc;
}

// ── Reading stored evaluations ─────────────────────────────────────────────
const isAnswered = (q: any) => !q.skipped && typeof q.answer === "string" && q.answer.trim().length > 0;

/** Metric value from a stored evaluation, or undefined if that record does not have it. */
export function metricValue(ev: any, key: MetricKey): number | undefined {
  const field = METRICS.find((m) => m.key === key)!.field;
  const v = ev?.[field];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/** Evaluations that carry real (non-placeholder) scores. */
const isRealEvaluation = (ev: any) => !!ev && ev.source !== "fallback";

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const round = (n: number) => Math.round(n);

/** Mean of the six original scores - the same "question score" the report has always shown. */
export function questionAverage(ev: any): number {
  const vals = LEGACY_METRIC_KEYS.map((k) => metricValue(ev, k) ?? 0);
  return round(mean(vals));
}

const structureLabel = (analysis: any) => analysis?.structure?.framework as string | undefined;

export function topicLabel(q: any): string | undefined {
  const skill = String(q.skill || "").trim();
  if (!skill) return undefined;
  if (skill === "Project") return "Project explanation";
  if (skill === "HR") return "HR questions";
  if (skill === "Behavioral") return "Behavioral questions";
  return skill;
}

// ── Per-question verdicts ──────────────────────────────────────────────────
export type VerdictLevel = "strong" | "improve" | "weak" | "skipped" | "pending";

export function questionVerdict(q: any): { level: VerdictLevel; label: string; score: number } {
  if (q.skipped) return { level: "skipped", label: "Skipped", score: 0 };
  if (!isAnswered(q)) return { level: "skipped", label: "Not answered", score: 0 };
  const ev = q.evaluation;
  if (!isRealEvaluation(ev)) return { level: "pending", label: "Not evaluated", score: 0 };
  const avg = questionAverage(ev);
  const isProject = ev?.analysis?.questionType === "project" || q.skill === "Project";
  if (avg >= STRONG_THRESHOLD) return { level: "strong", label: isProject ? "Excellent project explanation" : "Strong answer", score: avg };
  if (avg >= 55) return { level: "improve", label: "Needs improvement", score: avg };
  const technical = metricValue(ev, "technical") ?? 0;
  return { level: "weak", label: technical < 55 ? "Weak technical explanation" : "Weak answer", score: avg };
}

// ── Attempts & before/after comparison ─────────────────────────────────────
export interface AttemptView {
  attemptNumber: number;
  answer: string;
  transcript: string;
  answerType: "voice" | "text";
  timeTaken: number;
  speech?: unknown;
  evaluation: any;
  createdAt: Date | string | null;
  /** True when the timestamp is inferred (attempt 1 of an interview saved before answers were timestamped). */
  timestampApproximate?: boolean;
}

export function attemptViews(interview: any, q: any): AttemptView[] {
  const first: AttemptView = {
    attemptNumber: 1,
    answer: q.answer || "",
    transcript: q.transcript || (q.answerType === "voice" ? q.answer || "" : ""),
    answerType: q.answerType || "text",
    timeTaken: q.timeTaken || 0,
    speech: q.speech ? plain(q.speech) : undefined,
    evaluation: q.evaluation ? plain(q.evaluation) : null,
    createdAt: q.answeredAt || interview.completedAt || interview.createdAt || null,
    timestampApproximate: !q.answeredAt,
  };
  const rest: AttemptView[] = (q.attempts || []).map((a: any) => ({
    attemptNumber: a.attemptNumber,
    answer: a.answer || "",
    transcript: a.transcript || "",
    answerType: a.answerType || "text",
    timeTaken: a.timeTaken || 0,
    speech: a.speech ? plain(a.speech) : undefined,
    evaluation: a.evaluation ? plain(a.evaluation) : null,
    createdAt: a.createdAt || null,
  }));
  return [first, ...rest].sort((a, b) => a.attemptNumber - b.attemptNumber);
}

export interface ComparisonRow {
  key: string;
  label: string;
  /** One value per attempt, null where that attempt has no such metric. */
  values: Array<number | null>;
  /** latest - first, over the attempts that have the metric. */
  delta: number | null;
  /** For rows where a lower number is the improvement (filler words, duration). */
  lowerIsBetter?: boolean;
  unit?: "%" | "s" | "count";
  neutral?: boolean;
}

/** Before/after rows. Only metrics present on at least two attempts are returned. */
export function buildComparison(attempts: AttemptView[]): { attempts: number[]; rows: ComparisonRow[] } {
  const usable = attempts.filter((a) => isRealEvaluation(a.evaluation));
  const rows: ComparisonRow[] = [];
  const finish = (row: Omit<ComparisonRow, "delta">) => {
    const present = row.values.filter((v): v is number => v !== null);
    if (present.length < 2) return;
    rows.push({ ...row, delta: round(present[present.length - 1] - present[0]) });
  };

  for (const m of METRICS) {
    finish({
      key: m.key,
      label: m.label,
      unit: "%",
      values: usable.map((a) => metricValue(a.evaluation, m.key) ?? null),
    });
  }
  finish({
    key: "fillerWords",
    label: "Filler words",
    unit: "count",
    lowerIsBetter: true,
    values: usable.map((a) => a.evaluation?.analysis?.communication?.fillerWords?.count ?? null),
  });
  finish({
    key: "wordCount",
    label: "Answer length (words)",
    unit: "count",
    neutral: true,
    values: usable.map((a) => a.evaluation?.analysis?.communication?.wordCount ?? null),
  });
  // Duration is only comparable when every attempt measured the same thing.
  const sources = new Set(usable.map((a) => a.evaluation?.analysis?.communication?.durationSource ?? null));
  if (sources.size === 1 && !sources.has(null)) {
    finish({
      key: "duration",
      label: sources.has("recording") ? "Speaking duration" : "Time on question",
      unit: "s",
      neutral: true,
      values: usable.map((a) => a.evaluation?.analysis?.communication?.durationSeconds ?? null),
    });
  }
  return { attempts: usable.map((a) => a.attemptNumber), rows };
}

// ── Report: performance summary ────────────────────────────────────────────
export interface PerformanceSummary {
  answered: number;
  evaluated: number;
  metrics: Array<{ key: MetricKey; label: string; score: number }>;
  strongest: { key: MetricKey; label: string; score: number } | null;
  weakest: { key: MetricKey; label: string; score: number } | null;
  recommendation: string | null;
}

export function buildPerformanceSummary(interview: any): PerformanceSummary {
  const answered = interview.questions.filter(isAnswered);
  const evaluated = answered.filter((q: any) => isRealEvaluation(q.evaluation));

  const metrics: PerformanceSummary["metrics"] = [];
  for (const m of METRICS) {
    const vals = evaluated.map((q: any) => metricValue(q.evaluation, m.key)).filter((v: any): v is number => v !== undefined);
    if (vals.length === 0) continue;
    // A newer metric only counts if every evaluated answer has it, so it never misrepresents a mix of old and new data.
    if (!LEGACY_METRIC_KEYS.includes(m.key) && vals.length < evaluated.length) continue;
    metrics.push({ key: m.key, label: m.label, score: round(mean(vals)) });
  }

  let strongest: PerformanceSummary["strongest"] = null;
  let weakest: PerformanceSummary["weakest"] = null;
  for (const m of metrics) {
    if (!strongest || m.score > strongest.score) strongest = m;
    if (!weakest || m.score < weakest.score) weakest = m;
  }
  if (strongest && weakest && strongest.key === weakest.key) weakest = null;

  let recommendation: string | null = null;
  if (weakest) {
    recommendation = METRIC_ADVICE[weakest.key];
    if (weakest.key === "structure") {
      const frameworks = evaluated
        .filter((q: any) => (metricValue(q.evaluation, "structure") ?? 100) < STRONG_THRESHOLD)
        .map((q: any) => structureLabel(q.evaluation?.analysis))
        .filter(Boolean) as string[];
      const top = mode(frameworks);
      if (top) recommendation = `Focus on structuring your answers using ${top}.`;
    } else if (weakest.key === "technical") {
      const topics = evaluated.flatMap((q: any) => q.evaluation?.analysis?.practiceTopics || []);
      const top = topN(topics, 3);
      if (top.length) recommendation = `Focus your revision on ${top.join(", ")}. ${METRIC_ADVICE.technical}`;
    }
  }

  return { answered: answered.length, evaluated: evaluated.length, metrics, strongest, weakest, recommendation };
}

function mode(xs: string[]): string | undefined {
  return topN(xs, 1)[0];
}
function topN(xs: string[], n: number): string[] {
  const counts = new Map<string, number>();
  for (const x of xs) counts.set(x, (counts.get(x) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
}

// ── Weakness map ───────────────────────────────────────────────────────────
export interface WeaknessEntry {
  kind: "topic" | "dimension";
  key: string;
  label: string;
  /** Answers that were weak here. */
  occurrences: number;
  /** Answers considered for this area. */
  total: number;
  /** Mean score over the weak answers. */
  avgScore: number;
  /** 0-100, how far below the weak threshold-plus-margin the weak answers were, weighted by frequency. */
  weight: number;
  detail?: string[];
  examples: Array<{ questionIndex: number; question: string; score: number }>;
}

export interface WeaknessMap {
  weaknesses: WeaknessEntry[];
  strengths: Array<{ kind: "topic" | "dimension"; key: string; label: string; avgScore: number }>;
  answersConsidered: number;
}

export interface AnswerSample {
  question: any;
  index: number;
}

/** Recurring weaknesses/strengths, computed only from evaluated answers. An area counts as a weakness when it
 *  was weak in at least two answers, or in at least half the answers that touched it. */
export function buildWeaknessMap(samples: AnswerSample[]): WeaknessMap {
  const usable = samples.filter((s) => isAnswered(s.question) && isRealEvaluation(s.question.evaluation));
  type Bucket = { label: string; kind: "topic" | "dimension"; scores: number[]; weak: Array<{ s: AnswerSample; score: number }>; details: string[] };
  const buckets = new Map<string, Bucket>();

  const touch = (key: string, label: string, kind: Bucket["kind"], s: AnswerSample, value: number, detail?: string) => {
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = { label, kind, scores: [], weak: [], details: [] }));
    b.scores.push(value);
    if (value < WEAK_THRESHOLD) {
      b.weak.push({ s, score: value });
      if (detail) b.details.push(detail);
    }
  };

  for (const s of usable) {
    const ev = s.question.evaluation;
    const topic = topicLabel(s.question);
    const technical = metricValue(ev, "technical");
    if (topic && technical !== undefined) {
      touch(`topic:${topic}`, topic, "topic", s, technical, s.question.topic || undefined);
    }
    for (const m of METRICS) {
      if (m.key === "technical" && topic) continue; // covered by the topic buckets
      const v = metricValue(ev, m.key);
      if (v !== undefined) touch(`dimension:${m.key}`, m.label, "dimension", s, v);
    }
  }

  const weaknesses: WeaknessEntry[] = [];
  const strengths: WeaknessMap["strengths"] = [];
  for (const [key, b] of buckets) {
    const total = b.scores.length;
    const occurrences = b.weak.length;
    const avg = round(mean(b.scores));
    if (occurrences >= 2 || (occurrences > 0 && occurrences / total >= 0.5)) {
      const weakAvg = mean(b.weak.map((w) => w.score));
      weaknesses.push({
        kind: b.kind,
        key,
        label: b.label,
        occurrences,
        total,
        avgScore: round(weakAvg),
        weight: occurrences * (100 - weakAvg), // normalised below
        detail: topN(b.details, 3),
        examples: b.weak
          .sort((x, y) => x.score - y.score)
          .slice(0, 3)
          .map((w) => ({ questionIndex: w.s.index, question: String(w.s.question.question).slice(0, 160), score: w.score })),
      });
    } else if (avg >= STRONG_THRESHOLD && occurrences === 0) {
      strengths.push({ kind: b.kind, key, label: b.label, avgScore: avg });
    }
  }

  const maxWeight = Math.max(1, ...weaknesses.map((w) => w.weight));
  for (const w of weaknesses) w.weight = round((w.weight / maxWeight) * 100);
  weaknesses.sort((a, b) => b.weight - a.weight);
  strengths.sort((a, b) => b.avgScore - a.avgScore);

  return { weaknesses: weaknesses.slice(0, 8), strengths: strengths.slice(0, 6), answersConsidered: usable.length };
}

function samplesOf(interview: any): AnswerSample[] {
  return interview.questions.map((question: any, index: number) => ({ question, index }));
}

// ── Report assembly ────────────────────────────────────────────────────────
export function buildQuestionSummaries(interview: any) {
  const collegeSession = interview.source === "COLLEGE";
  return interview.questions.map((q: any, index: number) => {
    const verdict = questionVerdict(q);
    const attempts = attemptViews(interview, q);
    const comparison = attempts.length > 1 ? buildComparison(attempts) : null;
    return {
      index,
      questionId: String(q._id),
      verdict,
      attemptCount: attempts.length,
      // Practice is for answered AI/resume questions; college interviews are assessments whose feedback
      // names the answer key, so they are never re-attemptable.
      canPractice: !collegeSession && isAnswered(q) && !q.questionType && attempts.length < MAX_ATTEMPTS_PER_QUESTION,
      comparison,
      focusArea: q.focusArea || "",
    };
  });
}

export function buildProctoringSummary(interview: any, events: any[]) {
  const items: Array<{ label: string; status: "ok" | "warn" | "bad"; detail?: string }> = [];
  const tabSwitches = interview.tabSwitchCount || 0;
  const fsExits = interview.fullScreenExitCount || 0;
  items.push(
    tabSwitches === 0
      ? { label: "No tab switches", status: "ok" }
      : { label: `${tabSwitches} tab switch${tabSwitches === 1 ? "" : "es"}`, status: tabSwitches >= 3 ? "bad" : "warn" }
  );
  items.push(
    fsExits === 0
      ? { label: "No full-screen exits", status: "ok" }
      : { label: `${fsExits} full-screen exit${fsExits === 1 ? "" : "s"}`, status: fsExits >= 3 ? "bad" : "warn" }
  );
  const other = new Map<string, number>();
  for (const e of events) {
    if (e.type === "tab_switch" || e.type === "fullscreen_exit") continue;
    other.set(e.type, (other.get(e.type) || 0) + 1);
  }
  for (const [type, n] of other) items.push({ label: `${n} × ${String(type).replace(/_/g, " ")}`, status: "warn" });
  if (interview.autoTerminated || interview.terminationReason) {
    items.push({
      label: "Interview was ended automatically",
      status: "bad",
      detail: interview.terminationReason ? String(interview.terminationReason).replace(/_/g, " ").toLowerCase() : undefined,
    });
  }
  return {
    items,
    note: "Camera-based checks (face, gaze, objects) run live during the interview and are not stored, so they are not part of this summary.",
  };
}

// ── Progress across interviews ─────────────────────────────────────────────
export interface ProgressPoint {
  interviewId: string;
  date: string;
  jobRole: string;
  interviewType: string;
  overall: number;
  metrics: Partial<Record<MetricKey, number>>;
}

export function buildProgress(interviews: any[]) {
  const points: ProgressPoint[] = [];
  for (const iv of interviews) {
    const evaluated = iv.questions.filter((q: any) => isAnswered(q) && isRealEvaluation(q.evaluation));
    if (evaluated.length === 0) continue;
    const metrics: ProgressPoint["metrics"] = {};
    for (const m of METRICS) {
      const vals = evaluated.map((q: any) => metricValue(q.evaluation, m.key)).filter((v: any): v is number => v !== undefined);
      if (vals.length === 0) continue;
      if (!LEGACY_METRIC_KEYS.includes(m.key) && vals.length < evaluated.length) continue;
      metrics[m.key] = round(mean(vals));
    }
    points.push({
      interviewId: String(iv._id),
      date: new Date(iv.completedAt || iv.createdAt).toISOString(),
      jobRole: iv.jobRole,
      interviewType: iv.interviewType,
      overall: iv.overallScore || 0,
      metrics,
    });
  }
  points.sort((a, b) => +new Date(a.date) - +new Date(b.date));

  const improvement: Array<{ key: MetricKey; label: string; first: number; latest: number; delta: number }> = [];
  if (points.length >= 2) {
    for (const m of METRICS) {
      const withMetric = points.filter((p) => p.metrics[m.key] !== undefined);
      if (withMetric.length < 2) continue;
      const first = withMetric[0].metrics[m.key]!;
      const latest = withMetric[withMetric.length - 1].metrics[m.key]!;
      improvement.push({ key: m.key, label: m.label, first, latest, delta: latest - first });
    }
  }
  return { points, improvement };
}

// ── Personalised next interview ────────────────────────────────────────────
export interface FocusArea {
  label: string;
  skill: string;
  topic: string;
  reason: string;
}

export interface Personalization {
  hasHistory: boolean;
  basedOnInterviews: number;
  focusAreas: FocusArea[];
  /** What the next interview will actually change (empty when nothing can be tailored). */
  message: string;
  /** Coaching that cannot change the questions (e.g. answer structure) - shown, never claimed as applied. */
  coaching: Array<{ label: string; advice: string }>;
  suggestions: string[];
}

const NON_TOPIC_SKILLS = new Set(["HR", "Behavioral", "Resume", "Project"]);

/** Builds the plan for the next interview from the candidate's real history (`priorInterviews`, newest
 *  first, any status filtering already done by the caller). */
export function buildPersonalization(priorInterviews: any[], interviewType: string): Personalization {
  const history = priorInterviews.filter((iv) => iv.source !== "COLLEGE");
  const samples = history.flatMap(samplesOf);
  const map = buildWeaknessMap(samples);
  const base: Personalization = {
    hasHistory: map.answersConsidered > 0,
    basedOnInterviews: history.length,
    focusAreas: [],
    message: "",
    coaching: [],
    suggestions: [],
  };
  if (!base.hasHistory) return base;

  // Tailoring the next interview needs REPEATED struggle: a topic must have been weak in at least two answers
  // (the report's weakness map is more lenient because it only describes one interview).
  const topicWeaknesses = map.weaknesses.filter((w) => w.kind === "topic" && w.occurrences >= 2);
  const projectWeak = topicWeaknesses.find((w) => w.label === "Project explanation");
  const canTargetTopics = interviewType === "Technical" || interviewType === "Resume";

  if (canTargetTopics) {
    for (const w of topicWeaknesses) {
      const skill = w.label;
      if (NON_TOPIC_SKILLS.has(skill) || w.label === "Project explanation") continue;
      if (base.focusAreas.length >= 3) break;
      const topic = w.detail?.[0] || "";
      base.focusAreas.push({
        label: topic ? `${skill}: ${topic}` : skill,
        skill,
        topic,
        reason: `Weak in ${w.occurrences} of ${w.total} answers (average ${w.avgScore}% on those)`,
      });
    }
  }
  if (interviewType === "Resume" && projectWeak) {
    base.focusAreas.push({
      label: "Project explanation",
      skill: "Project",
      topic: "",
      reason: `Weak in ${projectWeak.occurrences} of ${projectWeak.total} project answers (average ${projectWeak.avgScore}% on those)`,
    });
  } else if (projectWeak) {
    base.suggestions.push(
      `Your project explanations were weak in ${projectWeak.occurrences} of ${projectWeak.total} answers. A Resume-based interview will include more project-depth questions.`
    );
  }

  if (base.focusAreas.length > 0) {
    const names = base.focusAreas.map((f) => f.label);
    const joined = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
    const wantsProjects = base.focusAreas.some((f) => f.skill === "Project");
    base.message =
      `Your previous interviews showed difficulty with ${joined}. ` +
      (wantsProjects
        ? "Your next interview will include more project-depth questions" + (names.length > 1 ? " and more questions on the other areas above." : ".")
        : `Your next interview will include more ${joined} questions.`);
  }

  for (const w of map.weaknesses.filter((x) => x.kind === "dimension" && x.key !== "dimension:technical").slice(0, 3)) {
    const metric = METRICS.find((m) => `dimension:${m.key}` === w.key);
    if (!metric) continue;
    base.coaching.push({
      label: w.label,
      advice: `${w.label} was weak in ${w.occurrences} of ${w.total} answers. ${METRIC_ADVICE[metric.key]}`,
    });
  }
  return base;
}

/** Recurring weaknesses/strengths of a single interview (used by its report). */
export function weaknessMapForInterview(interview: any): WeaknessMap {
  return buildWeaknessMap(samplesOf(interview));
}
