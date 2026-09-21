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
      usn: `1MV2${String(20 + (i % 4))}CS${String(i + 1).padStart(3, "0")}`,
      registerNumber: `4CB2${String(100 + i)}`,
      personalEmail: `${name.toLowerCase().replace(/ /g, ".")}@gmail.com`,
      semester: `${(i % 8) + 1}`,
      section: ["A", "B", "C"][i % 3],
      cgpa: 6 + (i % 40) / 10,
      backlogs: i % 7 === 0 ? 1 : i % 13 === 0 ? 2 : 0,
      graduationYear: 2026,
      skills: ["Python", "React", "SQL", "DSA"].sort(() => Math.random() - 0.5).slice(0, 4),
      certifications: [
        { name: "AWS Cloud Practitioner", issuer: "Amazon Web Services", year: "2024", link: "" },
      ],
      projects: [
        { title: "Placement Portal", description: "Full-stack web app for campus placement tracking.", techStack: ["React", "Node.js", "MongoDB"], link: "" },
      ],
      resumeUrl: "",
      profilePhoto: "",
      linkedin: "",
      github: "",
      portfolio: "",
      dateOfBirth: `2002-0${(i % 9) + 1}-15`,
      placementStatus: ["not_applied", "applied", "shortlisted", "selected", "placed"][i % 5],
      verificationStatus: i % 5 === 0 ? "pending" : i % 8 === 0 ? "rejected" : "verified",
      atsScore,
      placementReadiness: readiness,
      interviewsTaken: i % 3 === 0 ? 0 : 1 + (i % 8),
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

function makeJobs(): AdminJob[] {
  const companies = ["TCS", "Infosys", "Wipro", "Accenture", "Capgemini", "Cognizant", "Amazon", "Deloitte"];
  return companies.map((company, i) => ({
    id: `job_${seed()}`,
    companyName: company,
    jobTitle: roles[i % roles.length],
    jobDescription: `Opportunity for ${roles[i % roles.length]} at ${company} with a focus on building scalable products and strong engineering practices.`,
    location: ["Bengaluru", "Hyderabad", "Pune", "Chennai"][i % 4],
    jobType: i % 3 === 0 ? "Internship" : "Full-time",
    package: `${6 + i * 2}.5 - ${12 + i * 3} LPA`,
    requiredSkills: ["Java", "SQL", "DSA", "React"].slice(0, 2 + (i % 3)),
    eligibility: {
      minimumCGPA: 7 + (i % 2),
      maximumBacklogs: 0,
      allowedDepartments: [departments[i % departments.length]],
    },
    lastDateToApply: daysAgo(-(7 + i * 4)),
    numberOfOpenings: 5 + (i % 6),
    companyWebsite: `https://www.${company.toLowerCase()}.com`,
    applicationLink: "",
    experience: i % 2 === 0 ? "Fresher" : "0-1 years",
    responsibilities: "",
    qualifications: "",
    selectionProcess: "",
    status: (["active", "active", "closed", "inactive"] as const)[i % 4],
    postedAt: daysAgo(20 - i * 2),
    applicants: 15 + i * 22,
  }));
}

function makeApplicants(_job: AdminJob): JobApplicant[] {
  return names.slice(0, 6).map((n, i) => ({
    id: `app_${seed()}`,
    jobId: _job.id,
    studentName: n,
    usn: `1MV22CS${String(i + 1).padStart(3, "0")}`,
    email: n.toLowerCase().replace(/ /g, ".") + "@student.com",
    department: departments[i % departments.length],
    cgpa: 7 + (i % 3) + 0.2,
    resumeUrl: "",
    appliedAt: daysAgo(i * 2),
    status: (["applied", "shortlisted", "rejected", "selected"] as const)[i % 4],
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
  const logs = makeProctoringLogs();
  return {
    totalStudents: students.length,
    totalInterviews: interviews.length,
    totalResumeAnalyses: resumes.length,
    totalJobs: makeJobs().length,
    activeJobs: makeJobs().filter((j) => j.status === "active").length,
    expiredJobs: makeJobs().filter((j) => j.status === "expired").length,
    totalApplications: 120,
    shortlistedStudents: 24,
    selectedStudents: 8,
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
  }));
  return {
    interviewPerformance: performance,
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
    })),
  };
}

export const mockData = {
  students: makeStudents,
  resumes: makeResumes,
  interviews: makeInterviews,
  jobs: makeJobs,
  applicants: makeApplicants,
  proctoringLogs: makeProctoringLogs,
  announcements: makeAnnouncements,
  settings: makeSettings,
};
