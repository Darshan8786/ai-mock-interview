// ─────────────────────────────────────────────────────────────
// College interviews — admin API client
//
// Talks to placement-prep-be (/api/v1/admin/college-interviews) with the same admin
// token as the rest of the admin panel. The server scopes everything to the admin's
// own college; no college id is ever sent from here.
// ─────────────────────────────────────────────────────────────
import { BACKEND_URL } from "../config/config";

const API = `${BACKEND_URL}/api/v1/admin/college-interviews`;

export const INTERVIEW_TYPES = ["Technical", "HR", "Behavioral", "Coding", "Mixed"] as const;
export const PROGRAMMING_LANGUAGES = ["Python", "Java", "C", "C++", "JavaScript", "TypeScript", "Go", "Rust", "C#", "None"] as const;
export const DIFFICULTIES = ["Easy", "Medium", "Hard", "Mixed"] as const;
export const QUESTION_TYPES = ["MCQ", "Technical", "Coding", "Behavioral", "HR", "Subjective"] as const;
export const QUESTION_DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;

export type InterviewStatus = "draft" | "published" | "closed";
export type QuestionType = (typeof QUESTION_TYPES)[number];

export interface CollegeInterviewConfig {
  name: string;
  jobRole: string;
  interviewType: (typeof INTERVIEW_TYPES)[number];
  programmingLanguage: (typeof PROGRAMMING_LANGUAGES)[number];
  difficulty: (typeof DIFFICULTIES)[number];
  description: string;
  questionCount: number;
  timeLimit: number;
}

export interface CollegeInterview extends CollegeInterviewConfig {
  _id: string;
  status: InterviewStatus;
  questionsAuthored: number;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CollegeQuestion {
  _id: string;
  order: number;
  questionType: QuestionType;
  question: string;
  topic: string;
  difficulty: (typeof QUESTION_DIFFICULTIES)[number];
  marks: number;
  options: string[];
  correctAnswer: "A" | "B" | "C" | "D" | "";
  expectedAnswer: string;
  evaluationCriteria: string;
  codingConfig: { language: string; starterCode: string; expectedSolution: string };
}

export type QuestionInput = Omit<CollegeQuestion, "_id" | "order">;

export interface InterviewDetail {
  interview: CollegeInterview;
  questions: CollegeQuestion[];
  attempts: { total: number; completed: number; terminated: number; "in-progress": number };
}

/** Error carrying the server's full list of reasons an interview can't be published yet. */
export class CollegeApiError extends Error {
  problems: string[];
  constructor(message: string, problems: string[] = []) {
    super(message);
    this.problems = problems;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("adminToken");
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers || {}),
      },
    });
  } catch {
    throw new CollegeApiError("Can't reach the server. Check that the backend is running.");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new CollegeApiError(body?.message || `Request failed: ${res.status}`, Array.isArray(body?.problems) ? body.problems : []);
  }
  return body as T;
}

const json = (data: unknown) => JSON.stringify(data);

export const collegeInterviewApi = {
  async list(params: { status?: InterviewStatus; search?: string } = {}): Promise<CollegeInterview[]> {
    const q = new URLSearchParams();
    if (params.status) q.set("status", params.status);
    if (params.search?.trim()) q.set("search", params.search.trim());
    const qs = q.toString();
    return (await request<{ data: CollegeInterview[] }>(qs ? `?${qs}` : "")).data;
  },
  async get(id: string): Promise<InterviewDetail> {
    return (await request<{ data: InterviewDetail }>(`/${id}`)).data;
  },
  async create(config: CollegeInterviewConfig): Promise<CollegeInterview> {
    return (await request<{ data: CollegeInterview }>("", { method: "POST", body: json(config) })).data;
  },
  async update(id: string, config: Partial<CollegeInterviewConfig>): Promise<CollegeInterview> {
    return (await request<{ data: CollegeInterview }>(`/${id}`, { method: "PUT", body: json(config) })).data;
  },
  async setStatus(id: string, status: InterviewStatus): Promise<CollegeInterview> {
    return (await request<{ data: CollegeInterview }>(`/${id}/status`, { method: "PATCH", body: json({ status }) })).data;
  },
  async remove(id: string): Promise<void> {
    await request(`/${id}`, { method: "DELETE" });
  },

  async addQuestion(id: string, q: QuestionInput): Promise<CollegeQuestion> {
    return (await request<{ data: CollegeQuestion }>(`/${id}/questions`, { method: "POST", body: json(q) })).data;
  },
  async updateQuestion(id: string, qid: string, q: QuestionInput): Promise<CollegeQuestion> {
    return (await request<{ data: CollegeQuestion }>(`/${id}/questions/${qid}`, { method: "PUT", body: json(q) })).data;
  },
  async deleteQuestion(id: string, qid: string): Promise<void> {
    await request(`/${id}/questions/${qid}`, { method: "DELETE" });
  },
  async duplicateQuestion(id: string, qid: string): Promise<CollegeQuestion> {
    return (await request<{ data: CollegeQuestion }>(`/${id}/questions/${qid}/duplicate`, { method: "POST" })).data;
  },
  async reorderQuestions(id: string, order: string[]): Promise<CollegeQuestion[]> {
    return (await request<{ data: CollegeQuestion[] }>(`/${id}/questions/reorder`, { method: "PUT", body: json({ order }) })).data;
  },
};

export const statusTone = (s: InterviewStatus) => (s === "published" ? "green" : s === "closed" ? "gray" : "yellow");
