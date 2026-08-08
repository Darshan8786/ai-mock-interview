import axios from "axios";
import { BACKEND_URL } from "../config/config";

const api = axios.create({ baseURL: `${BACKEND_URL}/api/v1` });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export interface Project {
  title: string;
  description: string;
  techStack: string[];
  link: string;
}

export interface Certification {
  name: string;
  issuer: string;
  year: string;
  link: string;
}

export interface StudentProfile {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  usn: string;
  registerNumber: string;
  collegeEmail: string;
  personalEmail: string;
  phone: string;
  department: string;
  year: string;
  semester: string;
  section: string;
  cgpa: number | null;
  skills: string[];
  certifications: Certification[];
  projects: Project[];
  resumeUrl: string;
  resumeFileName: string;
  profilePhoto: string;
  linkedin: string;
  github: string;
  portfolio: string;
  address: string;
  dateOfBirth: string;
  placementStatus: string;
  verificationStatus: string;
  isActive: boolean;
  lastLoginAt: string;
  createdAt: string;
  profileCompletion: number;
}

export const getMyProfile = async (): Promise<StudentProfile> => {
  const res = await api.get("/auth/me");
  return res.data.data.user;
};

export const updateMyProfile = async (
  patch: Partial<StudentProfile>
): Promise<StudentProfile> => {
  const res = await api.patch("/auth/profile", patch);
  return res.data.data.user;
};

export const changePassword = async (
  currentPassword: string,
  newPassword: string
): Promise<void> => {
  await api.patch("/auth/change-password", { currentPassword, newPassword });
};

// ── Aptitude persistence ──────────────────────────────

export const saveAptitudeResult = async (payload: {
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  unattempted: number;
  score: number;
  marks: number;
  timeTaken: number;
  tabWarnings: number;
  categoryScores: { category: string; score: number; correct: number; total: number }[];
  answers: { question: string; selected: number; correct: number; isCorrect: boolean; category: string }[];
}): Promise<void> => {
  await api.post("/aptitude/save-result", payload);
};

export const getMyAptitudeResults = async (): Promise<any[]> => {
  const res = await api.get("/aptitude/my-results");
  return res.data.data;
};

// ── Question bank / practice / tests ──────────────────────

export interface AptitudeQuestionDTO {
  id: string;
  category: string;
  topic: string;
  subtopic?: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  question: string;
  options: string[];
  estimatedTime: number;
  companyTags?: { name: string; style: string }[];
}

export interface AptitudeTestSummary {
  id: string;
  title: string;
  description: string;
  category: string;
  topics: string[];
  difficulty: string;
  questionCount: number;
  durationMinutes: number;
  marksPerQuestion: number;
  negativeMarksPerQuestion: number;
  passingScore: number;
}

export interface TopicInfo {
  id: string;
  name: string;
  description: string;
  questionCount: number;
}

export interface ScoredResult {
  attemptId: string;
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  unattempted: number;
  score: number;
  marks: number;
  marksPerQuestion: number;
  negativeMarksPerQuestion: number;
  passed?: boolean;
  passingScore?: number;
  timeTaken: number;
  tabWarnings: number;
  categoryScores: { category: string; score: number; correct: number; total: number }[];
  questions: {
    id: string;
    question: string;
    category: string;
    topic: string;
    difficulty: string;
    options: string[];
    selected: number | undefined;
    correct: number;
    isCorrect: boolean;
    explanation: string;
  }[];
}

export const getAptitudeTopics = async (): Promise<Record<string, TopicInfo[]>> => {
  const res = await api.get("/aptitude/topics");
  return res.data.data;
};

export const getAptitudeTests = async (): Promise<AptitudeTestSummary[]> => {
  const res = await api.get("/aptitude/tests");
  return res.data.data;
};

export const getTestQuestions = async (
  testId: string
): Promise<{ test: Partial<AptitudeTestSummary>; questions: AptitudeQuestionDTO[] }> => {
  const res = await api.get(`/aptitude/tests/${testId}/questions`);
  return res.data.data;
};

export const submitAptitudeTest = async (
  testId: string,
  payload: { answers: Record<string, number>; timeTaken: number; tabWarnings: number; drawnQuestionIds?: string[] }
): Promise<ScoredResult> => {
  const res = await api.post(`/aptitude/tests/${testId}/submit`, payload);
  return res.data.data;
};

export const getPracticeQuestions = async (params: {
  category?: string;
  topic?: string;
  difficulty?: string;
  count?: number;
  tag?: string;
}): Promise<{ config: any; questions: AptitudeQuestionDTO[] }> => {
  const res = await api.get("/aptitude/practice", { params });
  return res.data.data;
};

export const submitPractice = async (payload: {
  answers: Record<string, number>;
  timeTaken: number;
  tabWarnings: number;
  marksPerQuestion?: number;
  negativeMarksPerQuestion?: number;
  drawnQuestionIds?: string[];
}): Promise<ScoredResult> => {
  const res = await api.post("/aptitude/practice/submit", payload);
  return res.data.data;
};

// ── Unified session flow (start / active / submit) ──────────

export interface StartedAttempt {
  attemptId: string;
  test: {
    title: string;
    testType: string;
    difficulty: string;
    durationMinutes: number;
    marksPerQuestion: number;
    negativeMarksPerQuestion: number;
    passingScore: number;
    count: number;
  };
  poolSize: number;
  repeatedIds: string[];
  questions: AptitudeQuestionDTO[];
}

export const startAptitudeTest = async (payload: {
  mode?: string;
  testId?: string;
  category?: string;
  topic?: string;
  difficulty?: string;
  tag?: string;
  count?: number;
  distribution?: Record<string, number>;
}): Promise<StartedAttempt> => {
  const res = await api.post("/aptitude/test/start", payload);
  return res.data.data;
};

export const getActiveAttempt = async (attemptId: string): Promise<StartedAttempt> => {
  const res = await api.get(`/aptitude/test/${attemptId}`);
  return res.data.data;
};

export const submitAttempt = async (
  attemptId: string,
  payload: { answers: Record<string, number>; timeTaken: number; tabWarnings: number }
): Promise<ScoredResult> => {
  const res = await api.post(`/aptitude/test/${attemptId}/submit`, payload);
  return res.data.data;
};

// ── Progress & history ──────────────────────────────────────

export interface AptitudeProgress {
  totalSeen: number;
  totalAnswered: number;
  totalCorrect: number;
  totalIncorrect: number;
  accuracy: number;
  completedTests: number;
  questionsRemaining: number;
  questionsCompleted: number;
  weakTopics: string[];
  strongTopics: string[];
  topicWise: { topic: string; answered: number; correct: number; accuracy: number; weak: boolean }[];
  difficultyWise: { difficulty: string; answered: number; correct: number; accuracy: number }[];
}

export const getAptitudeProgress = async (): Promise<AptitudeProgress> => {
  const res = await api.get("/aptitude/progress");
  return res.data.data;
};

export interface AttemptSummary {
  attemptId: string;
  title: string;
  testType: string;
  difficulty: string;
  status: string;
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  unattempted: number;
  score: number;
  accuracy: number;
  marks: number;
  timeTaken: number;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
}

export const getAptitudeHistory = async (): Promise<AttemptSummary[]> => {
  const res = await api.get("/aptitude/history");
  return res.data.data;
};

export interface AttemptDetail extends AttemptSummary {
  questions: {
    id: string;
    question: string;
    category: string;
    topic: string;
    difficulty: string;
    options: string[];
    repeated: boolean;
    selected: number | undefined;
    correct: number;
    answered: boolean;
    isCorrect: boolean;
    explanation: string;
  }[];
}

export const getAptitudeHistoryDetail = async (attemptId: string): Promise<AttemptDetail> => {
  const res = await api.get(`/aptitude/history/${attemptId}`);
  return res.data.data;
};
