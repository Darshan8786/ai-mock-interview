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
