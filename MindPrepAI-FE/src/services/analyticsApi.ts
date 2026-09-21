import axios from "axios";
import { BACKEND_URL } from "../config/config";

const api = axios.create({ baseURL: `${BACKEND_URL}/api/v1` });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Analytics ──────────────────────────────────────────

export interface AreaStat {
  name: string;
  source: "aptitude" | "tech" | "interview";
  group: string;
  correct: number;
  total: number;
  accuracy: number;
}

export interface TrendPoint {
  date: string;
  score: number;
  label: string;
}

export interface StudentAnalytics {
  hasData: boolean;
  overview: {
    readiness: number | null;
    aptitudeTests: number;
    techQuizzes: number;
    interviews: number;
    totalQuestions: number;
    correctAnswers: number;
    overallAccuracy: number;
  };
  aptitude: {
    attempts: number;
    avgScore: number;
    bestScore: number;
    lastScore: number | null;
    categories: AreaStat[];
    topics: AreaStat[];
    trend: TrendPoint[];
  };
  techQuiz: {
    attempts: number;
    avgScore: number;
    bestScore: number;
    technologies: { technology: string; attempts: number; avgScore: number; bestScore: number }[];
    topics: AreaStat[];
    trend: TrendPoint[];
  };
  interview: {
    attempts: number;
    terminated: number;
    avgOverall: number;
    lastOverall: number | null;
    skills: { key: string; label: string; score: number }[];
    roles: { role: string; attempts: number; avgScore: number }[];
    improvementAreas: { text: string; count: number }[];
    trend: TrendPoint[];
  };
  weakAreas: AreaStat[];
  strengths: AreaStat[];
}

/** Turn any failed request into a message the UI can show verbatim. */
export function errorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    if (err.response?.status === 401) return "Your session has expired. Please sign in again.";
    const serverMsg = (err.response?.data as { message?: string } | undefined)?.message;
    if (serverMsg) return serverMsg;
    if (!err.response) return "Can't reach the server. Check that the backend is running.";
  }
  return fallback;
}

export const getMyAnalytics = async (): Promise<StudentAnalytics> => {
  const res = await api.get("/analytics/me");
  return res.data.data;
};

// ── Chatbot ────────────────────────────────────────────

export interface ChatSuggestion {
  label: string;
  prompt: string;
}

export interface ChatSource {
  name: string;
  group: string;
  accuracy: number;
  correct: number;
  total: number;
}

export interface ChatResource {
  name: string;
  url: string;
  description: string;
}

export interface ChatReply {
  answer: string;
  kind: "knowledge" | "personal" | "smalltalk" | "suggest" | "fallback";
  topic?: string;
  confident: boolean;
  suggestions: ChatSuggestion[];
  sources: ChatSource[];
  resources: ChatResource[];
  action?: { label: string; path: string };
}

export const sendChatMessage = async (message: string): Promise<ChatReply> => {
  const res = await api.post("/chatbot/chat", { message });
  return res.data.data;
};

export const getChatbotInfo = async (): Promise<{ suggestions: ChatSuggestion[] }> => {
  const res = await api.get("/chatbot/info");
  return res.data.data;
};
