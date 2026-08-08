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
  payload: { answers: Record<string, number>; timeTaken: number; tabWarnings: number }
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
}): Promise<ScoredResult> => {
  const res = await api.post("/aptitude/practice/submit", payload);
  return res.data.data;
};
