// ─────────────────────────────────────────────────────────────
// Admin API Service Layer
//
// Talks to the real admin endpoints on placement-prep-be
// (GET /api/v1/admin/...) using the stored JWT.
// ─────────────────────────────────────────────────────────────
import { BACKEND_URL } from "../config/config";
import type {
  AdminStudent,
  AdminResume,
  AdminInterview,
  AdminQuiz,
  QuizAttempt,
  AdminJob,
  JobApplicant,
  ProctoringLog,
  Announcement,
  AdminSettings,
  AdminStats,
  DashboardCharts,
} from "./types";

const API = `${BACKEND_URL}/api/v1/admin`;

export async function adminFetch<T = any>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const body = await res.json();
      message = body?.message || message;
    } catch { /* ignore */ }
    throw new Error(message);
  }
  return res.json();
}

function delay<T>(data: T, ms = 350): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

// ── Response shape helpers ────────────────────────────────

const avatarColor = (name: string) => {
  const palette = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length];
};

const mapStudent = (s: any): AdminStudent => ({
  id: s.id || s._id,
  name: s.name || "",
  email: s.email || "",
  role: s.role || "user",
  department: s.department || "",
  year: s.year || "",
  college: s.collegeEmail || "",
  phone: s.phone || "",
  location: s.address || "",
  avatarColor: avatarColor(s.name || "?"),
  createdAt: s.createdAt || new Date().toISOString(),
  lastActive: s.lastLoginAt || s.createdAt || new Date().toISOString(),
  status: s.isActive === false ? "inactive" : "active",
  atsScore: s.atsScore ?? 0,
  placementReadiness: s.profileCompletion ?? 0,
  interviewsTaken: s.interviewsTaken ?? 0,
  quizAttempts: s.quizAttempts ?? 0,
  averageInterviewScore: s.averageInterviewScore ?? 0,
  weakSubjects: s.weakSubjects ?? [],
  strongSubjects: s.strongSubjects ?? [],
});

const mapInterview = (i: any): AdminInterview => ({
  id: i._id,
  studentId: i.user?._id || i.user || "",
  studentName: i.user?.name || "Unknown",
  studentEmail: i.user?.email || "",
  jobRole: i.jobRole || "",
  interviewType: i.interviewType || "Technical",
  difficulty: i.difficulty || "Medium",
  status: i.status || "pending",
  technicalScore: i.technicalScore ?? 0,
  communicationScore: i.communicationScore ?? 0,
  confidenceScore: i.confidenceScore ?? 0,
  grammarScore: i.grammarScore ?? 0,
  fluencyScore: i.fluencyScore ?? 0,
  overallScore: i.overallScore ?? 0,
  cheatingCount: i.cheatingCount ?? 0,
  autoTerminated: i.autoTerminated ?? false,
  finalFeedback: i.finalFeedback || "",
  date: i.createdAt || new Date().toISOString(),
  durationMin: i.totalTimeTaken ? Math.round(i.totalTimeTaken / 60) : 0,
});

const mapAnnouncement = (a: any): Announcement => ({
  id: a._id,
  title: a.title || "",
  body: a.body || "",
  audience: a.audience || "all",
  priority: a.priority || "normal",
  status: a.status || "draft",
  scheduledAt: a.scheduledAt,
  publishedAt: a.publishedAt,
  createdAt: a.createdAt || new Date().toISOString(),
});

export const adminApi = {
  // ── Dashboard ────────────────────────────────────────────
  async getStats(): Promise<AdminStats> {
    const r = await adminFetch("/dashboard");
    const c = r.data?.counts || {};
    return {
      totalStudents: c.totalStudents ?? 0,
      totalInterviews: c.totalInterviews ?? 0,
      totalQuizAttempts: c.quizAttempts ?? 0,
      totalResumeAnalyses: 0,
      totalJobs: 0,
      avgAtsScore: 0,
      placementReadiness: Math.min(100, Math.round((c.averageCgpa ?? 0) * 10)),
      todayProctoringViolations: c.totalCheatingEvents ?? 0,
    };
  },
  async getCharts(): Promise<DashboardCharts> {
    const r = await adminFetch("/dashboard");
    const dist = r.data?.distribution || {};
    const deptEntries = Object.entries(dist.departmentWise || {});
    const colors = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4"];
    const placementReady: any[] = deptEntries.map(([name, value], idx) => ({
      name,
      value,
      color: colors[idx % colors.length],
    }));
    const interviewPerformance: DashboardCharts["interviewPerformance"] = Object.entries(
      dist.monthlyInterviews || {}
    ).map(([label, value]) => ({
      label,
      interviews: value as number,
      quizzes: 0,
    }));
    const quizPerformance: DashboardCharts["quizPerformance"] = Object.entries(
      dist.monthlyQuizzes || {}
    ).map(([label, value]) => ({
      label,
      quizzes: value as number,
      interviews: 0,
    }));
    return {
      interviewPerformance,
      quizPerformance,
      atsDistribution: [],
      placementReady,
      weeklyActivity: [],
    };
  },

  // ── Students ─────────────────────────────────────────────
  async getStudents(): Promise<AdminStudent[]> {
    const r = await adminFetch("/students?limit=100");
    return (r.data || []).map(mapStudent);
  },
  async getStudent(id: string): Promise<AdminStudent | undefined> {
    const r = await adminFetch(`/students/${id}`);
    return mapStudent(r.data?.student || {});
  },
  async updateStudent(id: string, patch: Partial<AdminStudent> & Record<string, any>): Promise<AdminStudent> {
    const body: Record<string, any> = {};
    const fieldMap: Record<string, string> = {
      name: "name",
      email: "email",
      phone: "phone",
      department: "department",
      year: "year",
      status: "isActive",
      placementStatus: "placementStatus",
    };
    Object.entries(fieldMap).forEach(([front, back]) => {
      if (patch[front as keyof AdminStudent] !== undefined) {
        body[back] =
          front === "status" ? patch.status === "active" : patch[front as keyof AdminStudent];
      }
    });
    const r = await adminFetch(`/students/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    return mapStudent(r.data?.student || {});
  },
  async deleteStudent(id: string): Promise<void> {
    await adminFetch(`/students/${id}`, { method: "DELETE" });
  },

  // ── Resumes ──────────────────────────────────────────────
  async getResumes(): Promise<AdminResume[]> {
    // Resume analyses are currently AI-on-the-fly; derive from students' resumeUrl
    const students = await this.getStudents();
    return students
      .filter((s) => (s as any).resumeUrl)
      .map((s) => ({
        id: s.id,
        studentId: s.id,
        studentName: s.name,
        studentEmail: s.email,
        fileName: (s as any).resumeFileName || "resume.pdf",
        fileSize: "—",
        uploadedAt: s.createdAt,
        atsScore: s.atsScore ?? 0,
        status: "analyzed" as const,
        missingKeywords: [],
        topRole: "",
        skills: s.strongSubjects ?? [],
      }));
  },
  async deleteResume(id: string): Promise<void> {
    await this.updateStudent(id, { resumeUrl: "" as any });
  },

  // ── Interviews ───────────────────────────────────────────
  async getInterviews(): Promise<AdminInterview[]> {
    const r = await adminFetch("/interviews?limit=100");
    return (r.data || []).map(mapInterview);
  },
  async getInterviewDetail(id: string): Promise<any> {
    const r = await adminFetch(`/interviews/${id}`);
    return r.data;
  },

  // ── Quizzes ──────────────────────────────────────────────
  async getQuizzes(): Promise<AdminQuiz[]> {
    const stats = await adminFetch("/quizzes/stats");
    const bySubject = stats.data?.bySubject || [];
    return bySubject.map((s: any) => ({
      id: s.subject,
      subject: s.subject,
      title: `${s.subject} Quiz`,
      difficulty: "medium" as const,
      topic: s.subject,
      questionCount: s.attempts,
      attempts: s.attempts,
      avgScore: s.accuracy,
      status: "published" as const,
      createdAt: new Date().toISOString(),
      questions: [],
    }));
  },
  async createQuiz(quiz: Omit<AdminQuiz, "id" | "attempts" | "avgScore" | "createdAt" | "questions">): Promise<AdminQuiz> {
    return delay({ ...quiz, id: `quiz_${Date.now()}`, attempts: 0, avgScore: 0, createdAt: new Date().toISOString(), questions: [] } as AdminQuiz);
  },
  async updateQuiz(id: string, patch: Partial<AdminQuiz>): Promise<AdminQuiz> {
    return delay({ ...(await this.getQuizzes()).find((q) => q.id === id)!, ...patch });
  },
  async deleteQuiz(_id: string): Promise<void> {
    return delay(undefined);
  },
  async getQuizAttempts(subject: string): Promise<QuizAttempt[]> {
    const r = await adminFetch(`/quizzes/attempts?limit=100${subject ? `&subject=${encodeURIComponent(subject)}` : ""}`);
    const byUser: Record<string, QuizAttempt> = {};
    (r.data || []).forEach((a: any) => {
      const key = a.userId?._id || a.userId || "unknown";
      const name = a.userId?.name || "Unknown";
      if (!byUser[key]) {
        byUser[key] = {
          id: key,
          studentName: name,
          score: 0,
          total: 0,
          percentage: 0,
          timeTaken: "—",
          date: a.createdAt || new Date().toISOString(),
        };
      }
      byUser[key].total++;
      if (a.correct) byUser[key].score++;
      byUser[key].percentage = Math.round((byUser[key].score / byUser[key].total) * 100);
    });
    return Object.values(byUser);
  },

  // ── Jobs ─────────────────────────────────────────────────
  async getJobs(): Promise<AdminJob[]> {
    return [];
  },
  async createJob(job: Omit<AdminJob, "id" | "applicants" | "postedAt">): Promise<AdminJob> {
    return delay({ ...job, id: `job_${Date.now()}`, applicants: 0, postedAt: new Date().toISOString() } as AdminJob);
  },
  async updateJob(id: string, patch: Partial<AdminJob>): Promise<AdminJob> {
    return delay({ ...(await this.getJobs()).find((j) => j.id === id)!, ...patch });
  },
  async deleteJob(_id: string): Promise<void> {
    return delay(undefined);
  },
  async getJobApplicants(_jobId: string): Promise<JobApplicant[]> {
    return [];
  },

  // ── Proctoring ───────────────────────────────────────────
  async getProctoringLogs(): Promise<ProctoringLog[]> {
    const r = await adminFetch("/proctoring?limit=100");
    return (r.data || []).map((e: any) => ({
      id: e._id,
      studentName: e.user?.name || "Unknown",
      interviewId: e.interview?._id || e.interview || "",
      type: e.type || "tab_switch",
      description: e.description || "",
      severity: "medium" as const,
      timestamp: e.timestamp || e.createdAt || new Date().toISOString(),
      interviewStatus: e.interview?.status || "in-progress",
    }));
  },

  // ── Announcements ────────────────────────────────────────
  async getAnnouncements(): Promise<Announcement[]> {
    const r = await adminFetch("/announcements");
    return (r.data || []).map(mapAnnouncement);
  },
  async createAnnouncement(ann: Omit<Announcement, "id" | "createdAt">): Promise<Announcement> {
    const r = await adminFetch("/announcements", { method: "POST", body: JSON.stringify(ann) });
    return mapAnnouncement(r.data);
  },
  async updateAnnouncement(id: string, patch: Partial<Announcement>): Promise<Announcement> {
    const r = await adminFetch(`/announcements/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    return mapAnnouncement(r.data);
  },
  async deleteAnnouncement(id: string): Promise<void> {
    await adminFetch(`/announcements/${id}`, { method: "DELETE" });
  },

  // ── Notifications ────────────────────────────────────────
  async getNotifications(): Promise<Announcement[]> {
    const r = await adminFetch("/notifications");
    return (r.data || []).map((n: any) => ({
      id: n._id,
      title: n.title || "",
      body: n.body || "",
      audience: "all" as const,
      priority: "normal" as const,
      status: "published" as const,
      createdAt: n.createdAt || new Date().toISOString(),
    }));
  },
  async createNotification(payload: {
    title: string;
    body: string;
    type?: string;
    departments?: string[];
    years?: string[];
    semesters?: string[];
    studentIds?: string[];
  }): Promise<void> {
    await adminFetch("/notifications", { method: "POST", body: JSON.stringify(payload) });
  },
  async deleteNotification(id: string): Promise<void> {
    await adminFetch(`/notifications/${id}`, { method: "DELETE" });
  },

  // ── Settings ─────────────────────────────────────────────
  async getSettings(): Promise<AdminSettings> {
    const name = localStorage.getItem("user_name") || "Administrator";
    const email = localStorage.getItem("user_email") || "admin@mindprep.ai";
    return {
      profile: { name, email, role: "admin", avatarColor: "#3b82f6" },
      theme: "dark",
      notifications: {
        email: true, push: true, weeklyDigest: true, newInterview: true,
        lowAtsAlert: true, proctoringAlerts: true,
      },
    };
  },
  async updateSettings(patch: Partial<AdminSettings>): Promise<AdminSettings> {
    if (patch.profile?.name) localStorage.setItem("user_name", patch.profile.name);
    if (patch.profile?.email) localStorage.setItem("user_email", patch.profile.email);
    return { ...(await this.getSettings()), ...patch };
  },
};
