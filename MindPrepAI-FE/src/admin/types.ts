// ─────────────────────────────────────────────────────────────
// Admin Dashboard Types
// Mirrors the backend Mongoose models (User, Interview, Question,
// InterviewReport, CheatingEvent) so future API wiring maps 1:1.
// ─────────────────────────────────────────────────────────────

export interface AdminStudent {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  department: string;
  year: string;
  college: string;
  phone: string;
  location: string;
  avatarColor: string;
  createdAt: string;
  lastActive: string;
  status: "active" | "inactive" | "blocked";

  // Derived metrics
  atsScore: number;
  placementReadiness: number;
  interviewsTaken: number;
  quizAttempts: number;
  averageInterviewScore: number;
  weakSubjects: string[];
  strongSubjects: string[];
}

export interface AdminResume {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  fileName: string;
  fileSize: string;
  uploadedAt: string;
  atsScore: number;
  status: "parsing" | "analyzed" | "failed" | "pending";
  missingKeywords: string[];
  topRole: string;
  skills: string[];
}

export interface AdminInterview {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  jobRole: string;
  interviewType: "HR" | "Technical" | "Behavioral";
  difficulty: "Easy" | "Medium" | "Hard";
  status: "pending" | "in-progress" | "completed" | "terminated";
  technicalScore: number;
  communicationScore: number;
  confidenceScore: number;
  grammarScore: number;
  fluencyScore: number;
  overallScore: number;
  cheatingCount: number;
  autoTerminated: boolean;
  finalFeedback: string;
  date: string;
  durationMin: number;
}

export interface AdminQuiz {
  id: string;
  subject: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  topic: string;
  questionCount: number;
  attempts: number;
  avgScore: number;
  status: "published" | "draft" | "archived";
  createdAt: string;
  questions: AdminQuestion[];
}

export interface AdminQuestion {
  id: string;
  question: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  options: string[];
  correctAnswer: string;
}

export interface QuizAttempt {
  id: string;
  studentName: string;
  score: number;
  total: number;
  percentage: number;
  timeTaken: string;
  date: string;
}

export interface AdminJob {
  id: string;
  company: string;
  title: string;
  location: string;
  salary: string;
  eligibility: string;
  skillsRequired: string[];
  deadline: string;
  applicants: number;
  status: "open" | "closed" | "draft";
  postedAt: string;
  description: string;
}

export interface JobApplicant {
  id: string;
  name: string;
  email: string;
  appliedAt: string;
  atsScore: number;
  status: "applied" | "shortlisted" | "rejected" | "hired";
}

export interface ProctoringLog {
  id: string;
  studentName: string;
  interviewId: string;
  type:
    | "tab_switch"
    | "multiple_faces"
    | "phone_detected"
    | "eye_movement"
    | "face_not_visible"
    | "looking_away"
    | "copy"
    | "fullscreen_exit"
    | "camera_disabled"
    | "person_left";
  description: string;
  severity: "low" | "medium" | "high";
  timestamp: string;
  interviewStatus: "completed" | "terminated" | "in-progress";
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: "all" | "students" | "placed" | "freshers";
  status: "draft" | "published" | "scheduled";
  scheduledAt?: string;
  publishedAt?: string;
  createdAt: string;
  priority: "normal" | "important" | "urgent";
}

export interface AptitudeQuestion {
  _id: string;
  category: "Quantitative" | "Logical Reasoning" | "Verbal Ability" | "Data Interpretation";
  topic: string;
  subtopic: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  companyTags: { name: string; style: string }[];
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  estimatedTime: number;
  isActive: boolean;
  createdAt: string;
}

export interface AptitudeTopic {
  _id: string;
  category: string;
  name: string;
  description: string;
  order: number;
  questionCount: number;
  isActive: boolean;
}

export interface AptitudeTestConfig {
  _id: string;
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
  shuffle: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface AdminNotification {
  email: boolean;
  push: boolean;
  weeklyDigest: boolean;
  newInterview: boolean;
  lowAtsAlert: boolean;
  proctoringAlerts: boolean;
}

export interface AdminSettings {
  profile: {
    name: string;
    email: string;
    role: string;
    avatarColor: string;
  };
  theme: "dark" | "light" | "system";
  notifications: AdminNotification;
}

// ── Dashboard ──────────────────────────────────────────────

export interface AdminStats {
  totalStudents: number;
  totalInterviews: number;
  totalQuizAttempts: number;
  totalResumeAnalyses: number;
  totalJobs: number;
  avgAtsScore: number;
  placementReadiness: number;
  todayProctoringViolations: number;
}

export interface PerformancePoint {
  label: string;
  interviews: number;
  quizzes: number;
}

export interface AtsDistribution {
  range: string;
  count: number;
}

export interface ReadinessSlice {
  name: string;
  value: number;
  color: string;
}

export interface ActivityPoint {
  day: string;
  logins: number;
  interviews: number;
  quizzes: number;
}

export interface DashboardCharts {
  interviewPerformance: PerformancePoint[];
  quizPerformance: PerformancePoint[];
  atsDistribution: AtsDistribution[];
  placementReady: ReadinessSlice[];
  weeklyActivity: ActivityPoint[];
}
