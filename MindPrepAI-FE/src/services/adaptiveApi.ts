import axios from "axios";
import { BACKEND_URL } from "../config/config";

// Adaptive, AI-generated Aptitude and Tech Practice sessions. Questions are generated one at a time by the local
// model in ai-services (with verified offline fallbacks); the answer key never reaches the browser before an answer
// has been submitted - the backend grades everything.
const api = axios.create({ baseURL: `${BACKEND_URL}/api/v1` });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export type Level = "easy" | "medium" | "hard";

export interface Plan {
  hasHistory: boolean;
  answersConsidered: number;
  weakTopics: { topic: string; accuracy: number; attempts: number; mistakes: number }[];
  strongTopics: { topic: string; accuracy: number; attempts: number }[];
  targetedShare: number;
  message: string;
}

export interface Adaptation {
  level: Level;
  changed: boolean;
  direction: "up" | "down" | "same";
  reason: string;
  message: string;
}

export interface TopicStat {
  topic: string;
  attempts: number;
  correct: number;
  accuracy: number;
  avgResponseTime: number | null;
  mistakes: number;
  weak: boolean;
  strong: boolean;
}

export interface Summary {
  total: number;
  answered: number;
  correct: number;
  score: number;
  accuracy: number;
  avgResponseTime: number | null;
  averageDifficulty: Level | null;
  topicWise: TopicStat[];
  difficultyWise: { difficulty: Level; answered: number; correct: number; accuracy: number }[];
  typeWise: { questionType: string; answered: number; correct: number; accuracy: number }[];
  strongest: string[];
  weakest: string[];
  recommended: string[];
}

export interface Comparison {
  previousScore: number;
  previousAccuracy: number;
  scoreDelta: number;
  accuracyDelta: number;
}

export interface AttemptComparison {
  beforeAttempt: number;
  afterAttempt: number;
  before: number;
  after: number;
  improvement: number;
}

// ── Aptitude ─────────────────────────────────────────────────────────────────
export interface AptitudeQuestionView {
  itemIndex: number;
  question: string;
  options: string[];
  category: string;
  topic: string;
  difficulty: Level;
  focusArea: string;
  topicReason: string;
  difficultyReason: string;
  source: string;
  verification: string;
  estimatedTime: number;
}

export interface AptitudeState {
  attemptId: string;
  status: "started" | "completed";
  nextStatus: "idle" | "generating" | "ready" | "failed" | "done";
  nextError: string;
  category: string;
  topic: string;
  totalQuestions: number;
  answered: number;
  correct: number;
  currentDifficulty: Level;
  timeLimitMinutes: number;
  startedAt: string;
  personalization: Plan | null;
  currentQuestion: AptitudeQuestionView | null;
}

export interface AptitudeAnswerResult {
  itemIndex: number;
  isCorrect: boolean;
  skipped: boolean;
  correctIndex: number;
  correctOption: string;
  explanation: string;
  topic: string;
  weakConcept: string | null;
  recommendation: string;
  adaptation: Adaptation;
  answered: number;
  correct: number;
  total: number;
  isLast: boolean;
}

export interface AptitudePracticeAttempt {
  attemptNumber: number;
  selectedText: string;
  isCorrect: boolean;
  score: number;
  timeTaken: number;
  createdAt: string;
}

export interface AptitudeReportItem {
  itemIndex: number;
  question: string;
  options: string[];
  selected: number | null;
  correct: number;
  isCorrect: boolean;
  answered: boolean;
  explanation: string;
  topic: string;
  difficulty: Level;
  focusArea: string;
  source: string;
  verification: string;
  responseTime: number | null;
  attempts: AptitudePracticeAttempt[];
  comparison: AttemptComparison | null;
  canPractice: boolean;
}

export interface AptitudeReport {
  attemptId: string;
  title: string;
  category: string;
  topic: string;
  startDifficulty: Level;
  finalDifficulty: Level;
  timeTaken: number;
  summary: Summary;
  comparison: Comparison | null;
  personalizationApplied: Plan | null;
  nextSession: Plan;
  sources: Record<string, number>;
  items: AptitudeReportItem[];
}

export const getAptitudePlan = async (category: string, topic: string): Promise<Plan> =>
  (await api.get("/aptitude/adaptive/personalization", { params: { category, topic } })).data.data;

export const startAdaptiveAptitude = async (body: {
  category: string; topic: string; difficulty: string; count: number; timeLimitMinutes: number;
}): Promise<{ attemptId: string }> => (await api.post("/aptitude/adaptive/start", body)).data.data;

export const getAdaptiveAptitudeState = async (id: string): Promise<AptitudeState> =>
  (await api.get(`/aptitude/adaptive/${id}/state`)).data.data;

export const retryAdaptiveAptitude = async (id: string) => api.post(`/aptitude/adaptive/${id}/retry`);

export const answerAdaptiveAptitude = async (id: string, body: { itemIndex: number; selected: number | null; responseTime: number }): Promise<AptitudeAnswerResult> =>
  (await api.post(`/aptitude/adaptive/${id}/answer`, body)).data.data;

export const finishAdaptiveAptitude = async (id: string, body: { timeTaken: number; terminationReason?: string }): Promise<AptitudeReport> =>
  (await api.post(`/aptitude/adaptive/${id}/finish`, body)).data.data;

export const getAdaptiveAptitudeReport = async (id: string): Promise<AptitudeReport> =>
  (await api.get(`/aptitude/adaptive/${id}/report`)).data.data;

export const reattemptAptitude = async (id: string, itemIndex: number, body: { selectedText: string; timeTaken: number }) =>
  (await api.post(`/aptitude/adaptive/${id}/items/${itemIndex}/reattempt`, body)).data.data as {
    attempt: AptitudePracticeAttempt; attempts: AptitudePracticeAttempt[]; comparison: AttemptComparison | null;
    correctOption: string; explanation: string; weakConcept: string | null; recommendation: string;
  };

// ── Tech ─────────────────────────────────────────────────────────────────────
export interface TechQuestionView {
  index: number;
  id: string;
  technology: string;
  topic: string;
  difficulty: string;
  question_type: string;
  question: string;
  options?: string[];
  code_snippet?: string;
  buggy_code?: string;
  starter_code?: string;
  schema_context?: string;
  test_cases?: { input: string }[];
  source: string;
  focusArea: string;
  topicReason: string;
  difficultyReason: string;
}

export interface TechState {
  attemptId: string;
  status: "in-progress" | "completed";
  technology: string;
  topic: string;
  questionType: string;
  nextStatus: "idle" | "generating" | "ready" | "failed" | "done";
  nextError: string;
  totalQuestions: number;
  answered: number;
  correct: number;
  currentDifficulty: Level;
  timeLimitMinutes: number;
  startedAt: string;
  personalization: Plan | null;
  currentQuestion: TechQuestionView | null;
}

export interface TechAnswerResult {
  index: number;
  isCorrect: boolean | null;
  pending: boolean;
  skipped: boolean;
  score: number;
  correctAnswer: string;
  explanation: string;
  expectedConcepts: string[];
  missingConcepts: string[];
  referenceFixedCode?: string;
  recommendation: string;
  evaluationSource: string;
  weakConcept: string | null;
  adaptation: Adaptation;
  answered: number;
  correct: number;
  total: number;
  isLast: boolean;
}

export interface TechPracticeAttempt {
  attemptNumber: number;
  answer: string | number | null;
  isCorrect: boolean | null;
  score: number | null;
  timeTaken: number;
  createdAt: string;
  evaluationSource?: string;
  missingConcepts?: string[];
}

export interface TechReportItem {
  index: number;
  question: string;
  questionType: string;
  topic: string;
  difficulty: string;
  options?: string[];
  code: string;
  submittedAnswer: string | number | null;
  isCorrect: boolean | null;
  score: number;
  evaluation: (TechAnswerResult & { pending?: boolean }) | null;
  source: string;
  verification: string;
  focusArea: string;
  responseTime: number | null;
  attempts: TechPracticeAttempt[];
  comparison: AttemptComparison | null;
  canPractice: boolean;
}

export interface TechReport {
  attemptId: string;
  technology: string;
  topic: string;
  questionType: string;
  startDifficulty: Level;
  finalDifficulty: Level;
  timeTaken: number;
  summary: Summary;
  comparison: Comparison | null;
  pendingEvaluations: number;
  personalizationApplied: Plan | null;
  nextSession: Plan;
  sources: Record<string, number>;
  items: TechReportItem[];
}

export const getTechPlan = async (technology: string, topic: string): Promise<Plan> =>
  (await api.get("/tech-quiz/personalization", { params: { technology, topic } })).data.data;

export const startAdaptiveTech = async (body: {
  technology: string; topic: string; questionType: string; difficulty: string; count: number; timeLimitMinutes: number; availableTopics: string[];
}): Promise<{ attemptId: string }> => (await api.post("/tech-quiz/adaptive/start", body)).data.data;

export const getAdaptiveTechState = async (id: string): Promise<TechState> => (await api.get(`/tech-quiz/adaptive/${id}/state`)).data.data;

export const retryAdaptiveTech = async (id: string) => api.post(`/tech-quiz/adaptive/${id}/retry`);

export const answerAdaptiveTech = async (id: string, body: { index: number; answer: string | number | null; responseTime: number }): Promise<TechAnswerResult> =>
  (await api.post(`/tech-quiz/adaptive/${id}/answer`, body)).data.data;

export const finishAdaptiveTech = async (id: string, body: { timeTaken: number }): Promise<TechReport> =>
  (await api.post(`/tech-quiz/adaptive/${id}/finish`, body)).data.data;

export const getAdaptiveTechReport = async (id: string): Promise<TechReport> => (await api.get(`/tech-quiz/adaptive/${id}/report`)).data.data;

export const reattemptTech = async (id: string, index: number, body: { answer: string | number; timeTaken: number }) =>
  (await api.post(`/tech-quiz/adaptive/${id}/questions/${index}/reattempt`, body)).data.data as {
    attempt: TechPracticeAttempt; attempts: TechPracticeAttempt[]; comparison: AttemptComparison | null; pending: boolean;
    correctAnswer: string; explanation: string; expectedConcepts: string[]; missingConcepts: string[]; recommendation: string;
  };

export const getTechProgress = async (technology: string) => (await api.get("/tech-quiz/progress", { params: { technology } })).data.data as {
  technology: string; sessions: number; currentDifficulty: string | null; summary: Summary; plan: Plan;
  trend: { attemptId: string; date: string; score: number; mode: string }[];
};
