// ─────────────────────────────────────────────────────────────
// Admin Mock Data
// Used while the admin backend endpoints are not implemented.
// TODO(api): Replace each function with a real API call via
//            the admin service in `admin/api.ts`.
// ─────────────────────────────────────────────────────────────
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

const names = [
  "Aarav Sharma", "Priya Patel", "Rohan Mehta", "Sneha Iyer", "Karan Singh",
  "Ananya Rao", "Vikram Nair", "Divya Krishnan", "Arjun Reddy", "Ishita Gupta",
  "Rahul Verma", "Nisha Joshi", "Siddharth Menon", "Pooja Desai", "Aditya Kulkarni",
  "Meera Pillai", "Harsha Vardhan", "Kavya Shetty", "Nikhil Bose", "Tanvi Agarwal",
];

const colleges = [
  "RV College of Engineering", "BMS College of Engineering", "PES University",
  "MSRIT", "BITS Pilani", "NIT Trichy", "IIIT Bangalore", "Christ University",
];

const departments = ["CSE", "ISE", "ECE", "EEE", "Mech", "Civil"];

const avatarColors = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981",
  "#3b82f6", "#ef4444", "#14b8a6", "#f97316", "#8b5cf6",
];

const roles = ["Software Engineer", "Full Stack Developer", "Data Analyst", "Frontend Developer", "Backend Developer", "ML Engineer", "DevOps Engineer"];

function seed(): number {
  return Math.floor(Math.random() * 100000) + 1;
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString();
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function timeAgo(n: number): string {
  const d = new Date(Date.now() - n * 3600000);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function makeStudents(): AdminStudent[] {
  return names.map((name, i) => {
    const atsScore = 40 + Math.floor(Math.random() * 60);
    const readiness = Math.max(20, Math.min(98, Math.round(atsScore * 0.7 + Math.random() * 25)));
    const weak = ["DSA", "System Design", "DBMS", "Networking", "OOPS"].sort(() => Math.random() - 0.5).slice(0, 2);
    const strong = ["React", "SQL", "Java", "Python", "Git"].sort(() => Math.random() - 0.5).slice(0, 2);
    return {
      id: `stu_${seed()}`,
      name,
      email: name.toLowerCase().replace(/ /g, ".") + "@student.com",
      role: "user",
      department: departments[i % departments.length],
      year: `${2021 + (i % 4)}-${2022 + (i % 4)}`,
      college: colleges[i % colleges.length],
      phone: `+91 9${seed()}`,
      location: "Bengaluru, India",
      avatarColor: avatarColors[i % avatarColors.length],
      createdAt: daysAgo(120 - i * 3),
      lastActive: timeAgo(i * 5),
      status: i % 7 === 0 ? "inactive" : i % 11 === 0 ? "blocked" : "active",
      atsScore,
      placementReadiness: readiness,
      interviewsTaken: i % 3 === 0 ? 0 : 1 + (i % 8),
      quizAttempts: 3 + (i * 7) % 40,
      averageInterviewScore: 50 + Math.floor(Math.random() * 45),
      weakSubjects: weak,
      strongSubjects: strong,
    };
  });
}

function makeResumes(): AdminResume[] {
  const students = makeStudents();
  return students.slice(0, 14).map((s, i) => ({
    id: `res_${seed()}`,
    studentId: s.id,
    studentName: s.name,
    studentEmail: s.email,
    fileName: `${s.name.replace(/ /g, "_")}_Resume.pdf`,
    fileSize: `${(120 + Math.random() * 400).toFixed(0)} KB`,
    uploadedAt: daysAgo(30 - i * 2),
    atsScore: s.atsScore,
    status: i % 8 === 0 ? "parsing" : i % 13 === 0 ? "failed" : "analyzed",
    missingKeywords: s.weakSubjects,
    topRole: roles[i % roles.length],
    skills: s.strongSubjects,
  }));
}

function makeInterviews(): AdminInterview[] {
  const students = makeStudents();
  const types: AdminInterview["interviewType"][] = ["Technical", "HR", "Behavioral"];
  const statuses: AdminInterview["status"][] = ["completed", "completed", "terminated", "in-progress", "pending"];
  return students.slice(0, 18).map((s, i) => {
    const tech = 45 + Math.floor(Math.random() * 50);
    const comm = 55 + Math.floor(Math.random() * 40);
    const conf = 50 + Math.floor(Math.random() * 45);
    const gram = 60 + Math.floor(Math.random() * 35);
    const flu = 55 + Math.floor(Math.random() * 40);
    const status = statuses[i % statuses.length];
    const cheatingCount = i % 4 === 0 ? 1 + (i % 3) : 0;
    return {
      id: `int_${seed()}`,
      studentId: s.id,
      studentName: s.name,
      studentEmail: s.email,
      jobRole: roles[i % roles.length],
      interviewType: types[i % types.length],
      difficulty: ["Easy", "Medium", "Hard"][i % 3] as AdminInterview["difficulty"],
      status,
      technicalScore: status === "pending" ? 0 : tech,
      communicationScore: status === "pending" ? 0 : comm,
      confidenceScore: status === "pending" ? 0 : conf,
      grammarScore: status === "pending" ? 0 : gram,
      fluencyScore: status === "pending" ? 0 : flu,
      overallScore: status === "pending" ? 0 : Math.round((tech + comm + conf + gram + flu) / 5),
      cheatingCount,
      autoTerminated: status === "terminated",
      finalFeedback:
        status === "pending"
          ? ""
          : cheatingCount > 0
            ? "Strong technical knowledge but proctoring flags need attention. Stay focused and avoid tab switching."
            : "Good understanding of fundamentals. Improve structured problem-solving and articulate responses with more examples.",
      date: daysAgo(12 - (i % 12)),
      durationMin: 15 + (i * 7) % 40,
    };
  });
}

function makeQuizzes(): AdminQuiz[] {
  const subjects = ["DSA", "DBMS", "OOPS", "OS", "Networking", "SQL"];
  const topics = ["Arrays & Hashing", "Normalization", "Polymorphism", "Process Scheduling", "TCP/IP", "Joins & Indexing"];
  return subjects.map((subject, i) => ({
    id: `quiz_${seed()}`,
    subject,
    title: `${subject} Practice Set ${i + 1}`,
    difficulty: (["easy", "medium", "hard"] as const)[i % 3],
    topic: topics[i % topics.length],
    questionCount: 10 + (i * 5) % 15,
    attempts: 20 + i * 14,
    avgScore: 45 + (i * 11) % 40,
    status: i % 5 === 0 ? "draft" : i % 6 === 0 ? "archived" : "published",
    createdAt: daysAgo(40 - i * 4),
    questions: Array.from({ length: 2 }, (_, q) => ({
      id: `q_${seed()}`,
      question: `Sample ${subject} question ${q + 1}: describe the core concept of ${topics[i % topics.length]}?`,
      topic: topics[i % topics.length],
      difficulty: (["easy", "medium", "hard"] as const)[q % 3],
      options: ["Option A", "Option B", "Option C", "Option D"],
      correctAnswer: "Option A",
    })),
  }));
}

function makeAttempts(quiz: AdminQuiz): QuizAttempt[] {
  const namesPool = names.slice(0, 8);
  return namesPool.map((n) => {
    const total = quiz.questionCount;
    const score = Math.floor(Math.random() * (total + 1));
    return {
      id: `att_${seed()}`,
      studentName: n,
      score,
      total,
      percentage: Math.round((score / total) * 100),
      timeTaken: `${1 + Math.floor(Math.random() * 4)}m ${pad(Math.floor(Math.random() * 60))}s`,
      date: daysAgo(Math.floor(Math.random() * 20)),
    };
  });
}

function makeJobs(): AdminJob[] {
  const companies = ["TCS", "Infosys", "Wipro", "Accenture", "Capgemini", "Cognizant", "Amazon", "Deloitte"];
  return companies.map((company, i) => ({
    id: `job_${seed()}`,
    company,
    title: roles[i % roles.length],
    location: ["Bengaluru", "Hyderabad", "Pune", "Chennai"][i % 4],
    salary: `${6 + i * 2}.5 - ${12 + i * 3} LPA`,
    eligibility: `${departments[i % departments.length]}, ${2021 + (i % 3)} batch, 60% aggregate`,
    skillsRequired: ["Java", "SQL", "DSA", "React"].slice(0, 2 + (i % 3)),
    deadline: daysAgo(-(7 + i * 4)),
    applicants: 15 + i * 22,
    status: i % 4 === 0 ? "closed" : i % 9 === 0 ? "draft" : "open",
    postedAt: daysAgo(20 - i * 2),
    description: `Opportunity for ${roles[i % roles.length]} at ${company} with a focus on building scalable products and strong engineering practices.`,
  }));
}

function makeApplicants(_job: AdminJob): JobApplicant[] {
  return names.slice(0, 6).map((n, i) => ({
    id: `app_${seed()}`,
    name: n,
    email: n.toLowerCase().replace(/ /g, ".") + "@student.com",
    appliedAt: daysAgo(i * 2),
    atsScore: 45 + Math.floor(Math.random() * 50),
    status: (["applied", "shortlisted", "rejected", "hired"] as const)[i % 4],
  }));
}

function makeProctoringLogs(): ProctoringLog[] {
  const students = makeStudents().slice(0, 10);
  const types: ProctoringLog["type"][] = [
    "tab_switch", "multiple_faces", "phone_detected", "eye_movement",
    "face_not_visible", "looking_away", "copy", "fullscreen_exit",
    "camera_disabled", "person_left",
  ];
  return Array.from({ length: 24 }, (_, i) => {
    const type = types[i % types.length];
    const severity: ProctoringLog["severity"] =
      type === "multiple_faces" || type === "phone_detected" ? "high"
        : type === "tab_switch" || type === "person_left" ? "medium"
          : "low";
    return {
      id: `log_${seed()}`,
      studentName: students[i % students.length].name,
      interviewId: `int_${seed()}`,
      type,
      description: {
        tab_switch: "Student switched to another browser tab",
        multiple_faces: "Multiple faces detected in camera frame",
        phone_detected: "Mobile phone detected in frame",
        eye_movement: "Suspicious eye movement / gaze off-screen",
        face_not_visible: "Face moved out of the camera frame",
        looking_away: "Student looked away from the screen",
        copy: "Copy action attempted during interview",
        fullscreen_exit: "Exited fullscreen mode",
        camera_disabled: "Camera disabled by student",
        person_left: "No person detected — student left the frame",
      }[type],
      severity,
      timestamp: new Date(Date.now() - i * 36e5).toISOString(),
      interviewStatus: severity === "high" ? "terminated" : i % 5 === 0 ? "in-progress" : "completed",
    };
  });
}

function makeAnnouncements(): Announcement[] {
  return [
    {
      id: `ann_${seed()}`,
      title: "TCS Off-Campus Drive 2026",
      body: "TCS is hiring fresh graduates for the 2026 batch. Register on the placements portal before the deadline.",
      audience: "all",
      status: "published",
      publishedAt: daysAgo(2),
      createdAt: daysAgo(3),
      priority: "important",
    },
    {
      id: `ann_${seed()}`,
      title: "Mock Interview Marathon",
      body: "Join the 5-day mock interview marathon starting next Monday. Daily AI-powered technical interviews.",
      audience: "students",
      status: "scheduled",
      scheduledAt: daysAgo(-1),
      createdAt: daysAgo(1),
      priority: "normal",
    },
    {
      id: `ann_${seed()}`,
      title: "Resume Workshop",
      body: "AI resume analyzer is available 24/7. Get your ATS score and fix issues before the campus drive.",
      audience: "freshers",
      status: "draft",
      createdAt: daysAgo(0.5),
      priority: "normal",
    },
  ];
}

function makeSettings(): AdminSettings {
  return {
    profile: {
      name: "Admin",
      email: "admin@mindprep.ai",
      role: "Super Admin",
      avatarColor: "#6366f1",
    },
    theme: "dark",
    notifications: {
      email: true,
      push: true,
      weeklyDigest: false,
      newInterview: true,
      lowAtsAlert: true,
      proctoringAlerts: false,
    },
  };
}

export function getAdminStats(): AdminStats {
  const students = makeStudents();
  const interviews = makeInterviews();
  const resumes = makeResumes();
  const quizzes = makeQuizzes();
  const logs = makeProctoringLogs();
  return {
    totalStudents: students.length,
    totalInterviews: interviews.length,
    totalQuizAttempts: quizzes.reduce((a, q) => a + q.attempts, 0),
    totalResumeAnalyses: resumes.length,
    totalJobs: makeJobs().length,
    avgAtsScore: Math.round(resumes.reduce((a, r) => a + r.atsScore, 0) / resumes.length),
    placementReadiness: Math.round(students.reduce((a, s) => a + s.placementReadiness, 0) / students.length),
    todayProctoringViolations: logs.filter((l) => new Date(l.timestamp).toDateString() === new Date().toDateString()).length || logs.length,
  };
}

export function getDashboardCharts(): DashboardCharts {
  const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  const performance = labels.map((label, i) => ({
    label,
    interviews: 30 + (i * 13) % 60,
    quizzes: 45 + (i * 17) % 70,
  }));
  return {
    interviewPerformance: performance,
    quizPerformance: performance.map((p) => ({ ...p, quizzes: p.interviews })),
    atsDistribution: [
      { range: "0-40", count: 4 },
      { range: "41-60", count: 7 },
      { range: "61-75", count: 9 },
      { range: "76-90", count: 12 },
      { range: "91-100", count: 5 },
    ],
    placementReady: [
      { name: "Ready", value: 58, color: "#10b981" },
      { name: "Almost Ready", value: 27, color: "#f59e0b" },
      { name: "Needs Work", value: 15, color: "#ef4444" },
    ],
    weeklyActivity: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, i) => ({
      day,
      logins: 120 + i * 25,
      interviews: 18 + i * 7,
      quizzes: 60 + i * 15,
    })),
  };
}

export const mockData = {
  students: makeStudents,
  resumes: makeResumes,
  interviews: makeInterviews,
  quizzes: makeQuizzes,
  attempts: makeAttempts,
  jobs: makeJobs,
  applicants: makeApplicants,
  proctoringLogs: makeProctoringLogs,
  announcements: makeAnnouncements,
  settings: makeSettings,
};
