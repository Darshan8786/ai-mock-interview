// Shapes of the explainable-feedback data returned by the mock-interview API
// (see placement-prep-be/src/services/mockInterviewFeedback.ts). Every field that a record might not
// have (older interviews, typed answers with no audio) is optional or nullable: the UI shows only what exists.

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

export interface MetricDef {
  key: MetricKey;
  label: string;
  field: keyof Evaluation;
}

export const METRIC_DEFS: MetricDef[] = [
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

export interface Explanation {
  score: number;
  good: string[];
  missing: string[];
  improve: string[];
  /** Caveat about how the score was produced (not a strength or a gap). */
  note?: string;
}

export interface StructureElement {
  key: string;
  label: string;
  found: boolean;
  evidence: string;
  position: number | null;
}

export interface AnswerStructure {
  type: "technical" | "behavioral" | "project" | "hr";
  label: string;
  framework: string;
  score: number;
  elements: StructureElement[];
  missing: string[];
  recommendation: string;
}

export interface CommunicationAnalysis {
  wordCount: number;
  durationSeconds: number | null;
  durationSource: "recording" | "time_on_question" | null;
  durationLabel: string | null;
  fillerWords: { count: number; items: Array<{ word: string; count: number }> };
  repeatedPhrases: { count: number; items: string[] };
  hedgingPhrases: { count: number; items: string[] };
  longPauses: {
    count: number;
    totalSeconds: number;
    thresholdSeconds: number;
    items: Array<{ startSeconds: number; durationSeconds: number }>;
  } | null;
  speakingRate: { wpm: number; label: "Slow" | "Normal" | "Fast" } | null;
  length: "extremely_short" | "short" | "appropriate" | "long";
  idealLength: { min: number; max: number };
  feedback: string;
  flagged: boolean;
  notes: string[];
}

export interface TimelineEvent {
  kind: "good" | "warn" | "bad";
  label: string;
  /** Fraction (0-1) of the transcript's words; null when the event is not tied to a place in the answer. */
  position: number | null;
  /** Seconds into the recording - only for audio-measured pauses. */
  atSeconds: number | null;
}

export interface EvaluationAnalysis {
  version: number;
  questionType: "technical" | "behavioral" | "project" | "hr";
  conceptSource: string;
  matchedConcepts: string[];
  missingConcepts: string[];
  structure: AnswerStructure;
  communication: CommunicationAnalysis;
  timeline: TimelineEvent[];
  explanations: Partial<Record<MetricKey, Explanation>>;
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
  practiceTopics: string[];
}

export interface Evaluation {
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
  source?: "local" | "fallback";
  analysis?: EvaluationAnalysis;
}

export interface SpeechMetrics {
  recordingSeconds: number;
  speechSeconds?: number;
  pauseDetection?: boolean;
  pauses?: Array<{ startSeconds: number; durationSeconds: number }>;
}

export interface AttemptView {
  attemptNumber: number;
  answer: string;
  transcript: string;
  answerType: "voice" | "text";
  timeTaken: number;
  speech?: SpeechMetrics;
  evaluation: Evaluation | null;
  createdAt: string | null;
  timestampApproximate?: boolean;
}

export interface ComparisonRow {
  key: string;
  label: string;
  values: Array<number | null>;
  delta: number | null;
  lowerIsBetter?: boolean;
  unit?: "%" | "s" | "count";
  neutral?: boolean;
}

export interface Comparison {
  attempts: number[];
  rows: ComparisonRow[];
}

export type VerdictLevel = "strong" | "improve" | "weak" | "skipped" | "pending";

export interface QuestionSummary {
  index: number;
  questionId: string;
  verdict: { level: VerdictLevel; label: string; score: number };
  attemptCount: number;
  canPractice: boolean;
  comparison: Comparison | null;
  focusArea: string;
}

export interface PerformanceSummary {
  answered: number;
  evaluated: number;
  metrics: Array<{ key: MetricKey; label: string; score: number }>;
  strongest: { key: MetricKey; label: string; score: number } | null;
  weakest: { key: MetricKey; label: string; score: number } | null;
  recommendation: string | null;
}

export interface WeaknessEntry {
  kind: "topic" | "dimension";
  key: string;
  label: string;
  occurrences: number;
  total: number;
  avgScore: number;
  weight: number;
  detail?: string[];
  examples: Array<{ questionIndex: number; question: string; score: number }>;
}

export interface WeaknessMap {
  weaknesses: WeaknessEntry[];
  strengths: Array<{ kind: "topic" | "dimension"; key: string; label: string; avgScore: number }>;
  answersConsidered: number;
}

export interface ProctoringSummary {
  items: Array<{ label: string; status: "ok" | "warn" | "bad"; detail?: string }>;
  note: string;
}

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
  message: string;
  coaching: Array<{ label: string; advice: string }>;
  suggestions: string[];
}

export interface ProgressPoint {
  interviewId: string;
  date: string;
  jobRole: string;
  interviewType: string;
  overall: number;
  metrics: Partial<Record<MetricKey, number>>;
}

export interface ProgressData {
  points: ProgressPoint[];
  improvement: Array<{ key: MetricKey; label: string; first: number; latest: number; delta: number }>;
  weaknessMap?: WeaknessMap;
}

export interface ReportFeedback {
  performance: PerformanceSummary;
  weaknessMap: WeaknessMap;
  questions: QuestionSummary[];
  proctoring: ProctoringSummary;
  nextInterview: Personalization | null;
  progress: ProgressData | null;
  personalizationApplied: { message: string; targetedQuestions: number; focusAreas: FocusArea[] } | null;
}

/** Score for one metric from an evaluation, or undefined if that record does not have it. */
export function metricScore(ev: Evaluation | null | undefined, def: MetricDef): number | undefined {
  const v = ev?.[def.field];
  return typeof v === "number" ? v : undefined;
}
