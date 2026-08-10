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

  // Full profile details
  usn: string;
  registerNumber: string;
  personalEmail: string;
  semester: string;
  section: string;
  cgpa: number | null;
  backlogs: number;
  graduationYear: number | null;
  skills: string[];
  certifications: { name: string; issuer: string; year: string; link: string }[];
  projects: { title: string; description: string; techStack: string[]; link: string }[];
  resumeUrl: string;
  profilePhoto: string;
  linkedin: string;
  github: string;
  portfolio: string;
  dateOfBirth: string;
  placementStatus: string;
  verificationStatus: string;

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

export interface JobEligibility {
  minimumCGPA: number | null;
  maximumBacklogs: number | null;
  allowedDepartments: string[];
}

export interface EligibilityCounts {
  total: number;
  eligible: number;
  ineligible: number;
}

export type JobStatus = "active" | "inactive" | "closed" | "expired";

export interface AdminJob {
  id: string;
  companyName: string;
  jobTitle: string;
  jobDescription: string;
  location: string;
  jobType: string;
  package: string;
  requiredSkills: string[];
  eligibility: JobEligibility;
  lastDateToApply: string;
  numberOfOpenings: number;
  companyWebsite: string;
  applicationLink: string;
  experience: string;
  responsibilities: string;
  qualifications: string;
  selectionProcess: string;
  status: JobStatus;
  postedAt: string;
  updatedAt?: string;
  applicants: number;
  isExpired?: boolean;
  eligibilityCounts?: EligibilityCounts;
}

export interface EligibleStudent {
  id: string;
  usn: string;
  name: string;
  email: string;
  department: string;
  year: string;
  semester: string;
  cgpa: number | null;
  backlogs: number;
  eligible: boolean;
  reasons: string[];
  checkedAt: string;
}

export interface EligibilityListResponse {
  job: AdminJob;
  totalStudents: number;
  totalEligible: number;
  students: EligibleStudent[];
}

export interface NotifyResult {
  eligible: number;
  created: number;
  skipped: number;
}

export type ApplicationStatus =
  | "applied"
  | "shortlisted"
  | "rejected"
  | "selected"
  | "withdrawn";

export interface JobApplicant {
  id: string;
  jobId: string;
  studentName: string;
  usn: string;
  email: string;
  department: string;
  cgpa: number | null;
  resumeUrl: string;
  status: ApplicationStatus;
  appliedAt: string;
}

export interface JobApplicationStats {
  total: number;
  applied: number;
  shortlisted: number;
  rejected: number;
  selected: number;
  withdrawn: number;
}

export interface JobApplicationsResponse {
  job: AdminJob;
  stats: JobApplicationStats;
  applications: JobApplicant[];
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
  activeJobs: number;
  expiredJobs: number;
  totalApplications: number;
  shortlistedStudents: number;
  selectedStudents: number;
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
