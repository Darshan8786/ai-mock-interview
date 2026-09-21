import axios from "axios";
import { BACKEND_URL } from "../config/config";

// Every question, correct answer, and explanation here comes from the local
// trained dataset served by ai-services (tech_question_engine.py /
// tech_answer_evaluator.py) via this backend - no external AI API call is
// made anywhere in this flow.
const api = axios.create({ baseURL: `${BACKEND_URL}/api/v1/tech-quiz` });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export interface TechQuestionDTO {
  id: string;
  technology: string;
  topic: string;
  difficulty: "Easy" | "Medium" | "Hard";
  question: string;
  question_type: string;
  keywords: string[];
  options?: string[];
  starter_code?: string;
  test_cases?: { input: string }[];
  code_snippet?: string;
  buggy_code?: string;
  schema_context?: string;
}

export interface TechnologyMeta {
  file_key: string;
  total: number;
  topics: string[];
  by_difficulty: Record<string, number>;
  by_question_type: Record<string, number>;
}

export interface StartTechQuizResult {
  attemptId: string;
  technology: string;
  difficulty: string;
  totalQuestions: number;
  insufficient: boolean;
  repeatedCount: number;
  recommendedDifficulty: string;
  questions: TechQuestionDTO[];
}

export interface AnswerResult {
  isCorrect: boolean;
  score: number;
  correctAnswer: string;
  explanation: string;
  testCases?: { input: string; expected_output: string }[];
  matchedKeywords?: string[];
  missedKeywords?: string[];
  answeredCount: number;
  totalQuestions: number;
}

export interface TopicScore {
  topic: string;
  correct: number;
  total: number;
  score: number;
}

export interface TechQuizResultDTO {
  attemptId: string;
  technology: string;
  difficulty: string;
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  unanswered: number;
  score: number;
  topicScores: TopicScore[];
  strengths: string[];
  weaknesses: string[];
  timeTaken: number;
  recommendedNextDifficulty?: string;
}

export const getTechnologies = async (): Promise<Record<string, TechnologyMeta>> => {
  const res = await api.get("/technologies");
  return res.data.data;
};

export const startTechQuiz = async (payload: {
  technology: string;
  difficulty: string;
  totalQuestions: number;
  questionTypes?: string[];
}): Promise<StartTechQuizResult> => {
  const res = await api.post("/start", payload);
  return res.data.data;
};

export const submitTechQuizAnswer = async (
  attemptId: string,
  payload: { questionId: string; answer: unknown }
): Promise<AnswerResult> => {
  const res = await api.post(`/${attemptId}/answer`, payload);
  return res.data.data;
};

export const finishTechQuiz = async (
  attemptId: string,
  payload: { timeTaken: number }
): Promise<TechQuizResultDTO> => {
  const res = await api.post(`/${attemptId}/finish`, payload);
  return res.data.data;
};

export interface TechQuizHistoryEntry {
  _id: string;
  technology: string;
  difficulty: string;
  totalQuestions: number;
  correctAnswers: number;
  score: number;
  createdAt: string;
}

export const getTechQuizHistory = async (): Promise<TechQuizHistoryEntry[]> => {
  const res = await api.get("/history");
  return res.data.data;
};
