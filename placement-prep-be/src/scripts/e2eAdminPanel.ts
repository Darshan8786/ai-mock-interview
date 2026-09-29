/**
 * API sweep of every placement-prep-be /api/v1/admin endpoint used by the MindPrep admin panel, against a RUNNING
 * backend + SCRATCH database. Also checks that the Reports numbers are internally consistent and that a real resume
 * analysis saves the student's ATS score.
 *
 *   E2E_API=http://127.0.0.1:3002/api/v1 E2E_MONGO=mongodb://127.0.0.1:27018/mindprep_e2e npx tsx src/scripts/e2eAdminPanel.ts
 */
import mongoose from "mongoose";
import path from "path";

const API = process.env.E2E_API || "http://127.0.0.1:3002/api/v1";
const MONGO = process.env.E2E_MONGO || "mongodb://127.0.0.1:27018/mindprep_e2e";
if (!/127\.0\.0\.1|localhost/.test(MONGO)) throw new Error("E2E_MONGO must be a local scratch database");
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "admin@mindprep.ai";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "admin123";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  ok ? passed++ : failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
type Res = { status: number; body: any };
async function req(method: string, p: string, body?: unknown, token?: string, raw?: BodyInit, extraHeaders: Record<string, string> = {}): Promise<Res> {
  const r = await fetch(API + p, {
    method,
    headers: { ...(raw ? {} : { "Content-Type": "application/json" }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extraHeaders },
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}
const brief = (r: Res) => `${r.status} ${JSON.stringify(r.body)?.slice(0, 180)}`;
const stamp = Date.now();
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

async function student(tag: string) {
  const email = `panel_${tag}_${stamp}@example.test`;
  const r = await req("POST", "/auth/register", { name: `Panel ${tag}`, email, password: "Passw0rd!e2e" });
  return { token: r.body?.token as string, id: r.body?.data?.user?._id || r.body?.data?.user?.id, email };
}

function resumePdf(): Buffer {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { jsPDF } = require(path.resolve(__dirname, "../../../MindPrepAI-FE/node_modules/jspdf/dist/jspdf.node.min.js"));
  const doc = new jsPDF();
  const lines = [
    "Aarav Sharma", "aarav.sharma@example.test | +91 9876543210 | Bengaluru | linkedin.com/in/aarav-sharma-e2e | github.com/aarav-e2e",
    "SUMMARY", "Final-year computer science student building backend services and data pipelines with Python, Java and SQL.",
    "EDUCATION", "B.E. Computer Science, RV College of Engineering, 2022 - 2026, CGPA 8.4",
    "SKILLS", "Python, Java, SQL, JavaScript, React, Node.js, Express, MongoDB, PostgreSQL, Docker, Git, REST APIs, Data Structures, Algorithms",
    "EXPERIENCE", "Software Engineering Intern, Acme Analytics (May 2025 - Aug 2025)",
    "- Built a REST API in Node.js and Express serving 20k requests/day; reduced p95 latency by 35% with Redis caching.",
    "- Wrote SQL reports on PostgreSQL that cut the finance team's monthly reconciliation from 3 days to 4 hours.",
    "PROJECTS", "Placement Portal - React, Node.js, MongoDB: job listings, applications and admin dashboards used by 600 students.",
    "Stock Trend Predictor - Python, pandas, scikit-learn: forecasts with 12% lower error than the moving-average baseline.",
    "CERTIFICATIONS", "AWS Certified Cloud Practitioner (2025)", "ACHIEVEMENTS", "Winner, Smart India Hackathon 2024 (software edition)",
  ];
  let y = 15;
  for (const l of lines) {
    for (const part of doc.splitTextToSize(l, 180)) {
      doc.text(part, 12, y);
      y += 7;
    }
  }
  return Buffer.from(doc.output("arraybuffer"));
}

(async () => {
  await mongoose.connect(MONGO);
  const db = mongoose.connection.db!;

  // ── auth
  const login = await req("POST", "/auth/login", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  check("admin login", login.status === 200 && login.body?.data?.user?.role === "admin", brief(login));
  const A = login.body?.token as string;
  const s1 = await student("s1");
  const s2 = await student("s2");
  check("admin routes: no token -> 401", (await req("GET", "/admin/dashboard")).status === 401);
  check("admin routes: student token -> 403", (await req("GET", "/admin/reports", undefined, s1.token)).status === 403);

  // ── ATS persistence through the real resume analyzer
  const fd = new FormData();
  fd.append("resume", new Blob([resumePdf()], { type: "application/pdf" }), "aarav-resume.pdf");
  const an = await req("POST", "/resume/analyze", undefined, s1.token, fd);
  const ats = an.body?.data?.analysis?.ats_score;
  check("resume analyze works", an.status === 200 && typeof ats === "number", brief(an));
  const saved: any = await db.collection("users").findOne({ email: s1.email });
  check("ATS score saved on the student", saved?.atsScore === ats && !!saved?.atsAnalyzedAt && saved?.atsFileName === "aarav-resume.pdf", `${saved?.atsScore} vs ${ats}`);

  // ── dashboard + reports
  const dash = await req("GET", "/admin/dashboard", undefined, A);
  check("dashboard", dash.status === 200 && typeof dash.body?.data?.counts?.totalStudents === "number", brief(dash));
  for (const days of [7, 30, 90, 365]) {
    const r = await req("GET", `/admin/reports?days=${days}`, undefined, A);
    const d = r.body?.data;
    check(`reports ${days}d: 200 + shape`, r.status === 200 && !!d?.kpis && Array.isArray(d?.interviewPerformance), brief(r));
    if (!d) continue;
    const k = d.kpis;
    const expectPoints = days <= 31 ? days + 1 : days <= 120 ? Math.ceil(days / 7) + 1 : 13;
    check(`reports ${days}d: bucket=${d.range.bucket}, ${d.interviewPerformance.length} points`, Math.abs(d.interviewPerformance.length - expectPoints) <= 1, `expected ~${expectPoints}`);
    check(`reports ${days}d: interview series sums to KPI`, sum(d.interviewPerformance.map((p: any) => p.interviews)) === k.interviewsTaken, `${sum(d.interviewPerformance.map((p: any) => p.interviews))} vs ${k.interviewsTaken}`);
    check(`reports ${days}d: activity sums match sessions`, sum(d.activity.map((p: any) => p.aptitude)) === k.aptitudeSessions && sum(d.activity.map((p: any) => p.tech)) === k.techSessions);
    check(`reports ${days}d: readiness pie covers every student`, sum(d.placementReadiness.map((x: any) => x.value)) === k.totalStudents, `${sum(d.placementReadiness.map((x: any) => x.value))} vs ${k.totalStudents}`);
    check(`reports ${days}d: ATS buckets == resumes analysed`, sum(d.atsDistribution.map((x: any) => x.count)) === k.resumesAnalyzed && k.resumesAnalyzed >= 1);
    check(`reports ${days}d: scores in 0-100`, [k.avgInterviewScore, k.avgAptitudeScore, k.avgTechScore, k.avgAtsScore, k.avgReadiness].every((v: number) => v >= 0 && v <= 100));
  }
  const r30 = (await req("GET", "/admin/reports?days=30", undefined, A)).body?.data;
  const liveInterviews = await db.collection("interviews").countDocuments({ createdAt: { $gte: new Date(Date.now() - 30 * 86400000) } });
  check("reports: interview KPI matches the database", r30.kpis.interviewsTaken === liveInterviews, `${r30.kpis.interviewsTaken} vs ${liveInterviews}`);
  check("reports: weakest aptitude topics computed", Array.isArray(r30.weakestAptitudeTopics) && r30.weakestAptitudeTopics.length > 0, JSON.stringify(r30.weakestAptitudeTopics?.slice(0, 2)));
  check("reports: weakest tech topics computed", Array.isArray(r30.weakestTechTopics), JSON.stringify(r30.weakestTechTopics?.slice(0, 2)));
  check("reports: bad days param clamped", (await req("GET", "/admin/reports?days=abc", undefined, A)).body?.data?.range?.days === 30);

  // ── students
  const sl = await req("GET", "/admin/students?limit=100", undefined, A);
  const me = (sl.body?.data || []).find((s: any) => s.email === s1.email);
  check("students: list includes ATS fields", sl.status === 200 && me?.atsScore === ats && me?.atsFileName === "aarav-resume.pdf", brief(sl));
  const sid = me?.id || me?._id;
  check("students: get", (await req("GET", `/admin/students/${sid}`, undefined, A)).status === 200);
  const sp = await req("PATCH", `/admin/students/${sid}`, { cgpa: 8.4, department: "CSE", backlogs: 0 }, A);
  check("students: update", sp.status === 200, brief(sp));
  check("students: verify", (await req("PATCH", `/admin/students/${sid}/verify`, {}, A)).status === 200);
  check("students: reject", (await req("PATCH", `/admin/students/${sid}/reject`, { reason: "test" }, A)).status === 200);
  check("students: verify again", (await req("PATCH", `/admin/students/${sid}/verify`, {}, A)).status === 200);
  const ps = await req("PATCH", `/admin/students/${sid}/placement-status`, { placementStatus: "shortlisted" }, A);
  check("students: placement status", ps.status === 200, brief(ps));

  // ── interviews / aptitude results
  const il = await req("GET", "/admin/interviews?limit=100", undefined, A);
  check("interviews: list", il.status === 200 && Array.isArray(il.body?.data), brief(il));
  check("interviews: stats", (await req("GET", "/admin/interviews/stats", undefined, A)).status === 200);
  if (il.body?.data?.[0]) check("interviews: detail", (await req("GET", `/admin/interviews/${il.body.data[0]._id}`, undefined, A)).status === 200);
  const al = await req("GET", "/admin/aptitude?limit=100", undefined, A);
  check("aptitude attempts: list", al.status === 200 && Array.isArray(al.body?.data), brief(al));
  check("aptitude attempts: stats", (await req("GET", "/admin/aptitude/stats", undefined, A)).status === 200);
  if (al.body?.data?.[0]) check("aptitude attempts: detail", (await req("GET", `/admin/aptitude/${al.body.data[0]._id}`, undefined, A)).status === 200);

  // ── aptitude bank: questions / topics / tests
  const tp = await req("POST", "/admin/aptitude-topics", { category: "Quantitative", name: `E2E Topic ${stamp}`, description: "test" }, A);
  check("aptitude topics: create", tp.status === 201 || tp.status === 200, brief(tp));
  const tid = tp.body?.data?._id || tp.body?.data?.id;
  check("aptitude topics: list", (await req("GET", "/admin/aptitude-topics", undefined, A)).status === 200);
  const q = await req("POST", "/admin/aptitude-questions", { category: "Quantitative", topic: `E2E Topic ${stamp}`, difficulty: "beginner", question: "What is 10% of 250?", options: ["20", "25", "30", "35"], correctAnswer: 1, explanation: "250 x 10/100 = 25" }, A);
  check("aptitude questions: create", q.status === 201 || q.status === 200, brief(q));
  const qid = q.body?.data?._id || q.body?.data?.id;
  check("aptitude questions: list", (await req("GET", "/admin/aptitude-questions?limit=100", undefined, A)).status === 200);
  check("aptitude questions: get", (await req("GET", `/admin/aptitude-questions/${qid}`, undefined, A)).status === 200);
  check("aptitude questions: update", (await req("PATCH", `/admin/aptitude-questions/${qid}`, { explanation: "250 x 0.1 = 25" }, A)).status === 200);
  const tt = await req("POST", "/admin/aptitude-tests", { title: `E2E Test ${stamp}`, category: "Quantitative", questionCount: 5, durationMinutes: 5 }, A);
  check("aptitude tests: create", tt.status === 201 || tt.status === 200, brief(tt));
  const ttid = tt.body?.data?._id || tt.body?.data?.id;
  check("aptitude tests: list", (await req("GET", "/admin/aptitude-tests?limit=100", undefined, A)).status === 200);
  check("aptitude tests: update", (await req("PATCH", `/admin/aptitude-tests/${ttid}`, { durationMinutes: 6 }, A)).status === 200);
  check("aptitude tests: delete", (await req("DELETE", `/admin/aptitude-tests/${ttid}`, undefined, A)).status === 200);
  check("aptitude questions: delete", (await req("DELETE", `/admin/aptitude-questions/${qid}`, undefined, A)).status === 200);
  check("aptitude topics: delete", (await req("DELETE", `/admin/aptitude-topics/${tid}`, undefined, A)).status === 200);

  // ── announcements / notifications
  const an1 = await req("POST", "/admin/announcements", { title: "Drive on Friday", body: "Acme drive this Friday 10am.", audience: "all", priority: "important", status: "published" }, A);
  check("announcements: create", an1.status === 201 || an1.status === 200, brief(an1));
  const aid = an1.body?.data?._id;
  check("announcements: list", (await req("GET", "/admin/announcements", undefined, A)).body?.data?.some?.((x: any) => x._id === aid));
  check("announcements: update", (await req("PATCH", `/admin/announcements/${aid}`, { priority: "urgent" }, A)).status === 200);
  check("announcements: delete", (await req("DELETE", `/admin/announcements/${aid}`, undefined, A)).status === 200);
  const nt = await req("POST", "/admin/notifications", { title: "Aptitude test", body: "Mock test tomorrow", type: "quiz_schedule" }, A);
  check("notifications: create", nt.status === 201 || nt.status === 200, brief(nt));
  const nid = nt.body?.data?._id;
  check("notifications: list", (await req("GET", "/admin/notifications", undefined, A)).status === 200);
  const sn = await req("GET", "/notifications/my", undefined, s2.token);
  check("notifications: student receives it", sn.status === 200 && JSON.stringify(sn.body).includes("Mock test tomorrow"), brief(sn));
  check("notifications: delete", (await req("DELETE", `/admin/notifications/${nid}`, undefined, A)).status === 200);

  // ── jobs pipeline
  const deadline = new Date(Date.now() + 20 * 86400000).toISOString();
  const jb = await req("POST", "/admin/jobs", { companyName: "Acme", jobTitle: "Backend Engineer", jobDescription: "Build APIs in Node.js.", location: "Bengaluru", jobType: "Full-time", package: "12 LPA", requiredSkills: ["Node.js"], lastDateToApply: deadline, numberOfOpenings: 2, eligibility: { minimumCGPA: 7, maximumBacklogs: 0, allowedDepartments: [] } }, A);
  check("jobs: create", jb.status === 201, brief(jb));
  const jid = jb.body?.data?._id || jb.body?.data?.id;
  check("jobs: list", (await req("GET", "/admin/jobs?limit=100", undefined, A)).status === 200);
  check("jobs: get", (await req("GET", `/admin/jobs/${jid}`, undefined, A)).status === 200);
  const jobFull = { companyName: "Acme", jobTitle: "Backend Engineer", jobDescription: "Build APIs in Node.js.", location: "Bengaluru", jobType: "Full-time", package: "14 LPA", requiredSkills: ["Node.js"], lastDateToApply: deadline, numberOfOpenings: 2, eligibility: { minimumCGPA: 7, maximumBacklogs: 0, allowedDepartments: [] } };
  const ju = await req("PUT", `/admin/jobs/${jid}`, jobFull, A); // PUT = full replace (the admin job form always sends every field)
  check("jobs: update", ju.status === 200 && ju.body?.data?.package === "14 LPA", brief(ju));
  check("jobs: recalc eligibility", (await req("POST", `/admin/jobs/${jid}/eligibility/recalculate`, {}, A)).status === 200);
  const el = await req("GET", `/admin/jobs/${jid}/eligible-students`, undefined, A);
  check("jobs: eligible students include the CGPA-8.4 student", el.status === 200 && JSON.stringify(el.body).includes(s1.email), brief(el));
  check("jobs: ineligible students", (await req("GET", `/admin/jobs/${jid}/ineligible-students`, undefined, A)).status === 200);
  const nf = await req("POST", `/admin/jobs/${jid}/notify-eligible`, {}, A);
  check("jobs: notify eligible", nf.status === 200, brief(nf));
  const ap = await req("POST", `/jobs/${jid}/apply`, {}, s1.token);
  check("student applies", ap.status === 201 || ap.status === 200, brief(ap));
  const apps = await req("GET", `/admin/jobs/${jid}/applications`, undefined, A);
  const appId = (apps.body?.data?.applications || apps.body?.data || []).find?.((x: any) => JSON.stringify(x).includes(s1.email))?.id;
  check("jobs: applications list shows the applicant", apps.status === 200 && !!appId, brief(apps));
  if (appId) check("applications: status -> shortlisted", (await req("PATCH", `/admin/applications/${appId}/status`, { status: "shortlisted" }, A)).status === 200);
  check("jobs: status -> closed", (await req("PATCH", `/admin/jobs/${jid}/status`, { status: "closed" }, A)).status === 200);
  check("jobs: delete", (await req("DELETE", `/admin/jobs/${jid}`, undefined, A)).status === 200);

  // ── college interviews (admin linked to a scratch college)
  let college: any = await db.collection("colleges").findOne({ name: "E2E College" });
  if (!college) college = { _id: (await db.collection("colleges").insertOne({ name: "E2E College", createdAt: new Date(), updatedAt: new Date() })).insertedId };
  await db.collection("users").updateOne({ email: ADMIN_EMAIL }, { $set: { college: college._id } });
  const ci = await req("POST", "/admin/college-interviews", { name: "Campus Drive Round 1", jobRole: "Software Engineer", interviewType: "Technical", difficulty: "Medium", questionCount: 2, timeLimit: 20, programmingLanguage: "Java" }, A);
  check("college interviews: create", ci.status === 201, brief(ci));
  const cid = ci.body?.data?._id;
  check("college interviews: list", (await req("GET", "/admin/college-interviews", undefined, A)).status === 200);
  const q1 = await req("POST", `/admin/college-interviews/${cid}/questions`, { questionType: "MCQ", question: "Which keyword creates a subclass in Java?", options: ["extends", "implements", "super", "this"], correctAnswer: "A", difficulty: "Easy", marks: 1 }, A);
  check("college interviews: add MCQ question", q1.status === 201 || q1.status === 200, brief(q1));
  const q2 = await req("POST", `/admin/college-interviews/${cid}/questions`, { questionType: "Technical", question: "Explain the difference between an interface and an abstract class.", difficulty: "Medium", marks: 5, expectedAnswer: "Interfaces declare behaviour; abstract classes can hold state and partial implementation." }, A);
  check("college interviews: add technical question", q2.status === 201 || q2.status === 200, brief(q2));
  const detail = await req("GET", `/admin/college-interviews/${cid}`, undefined, A);
  const qs = detail.body?.data?.questions || [];
  check("college interviews: detail with questions", detail.status === 200 && qs.length === 2, brief(detail));
  if (qs.length === 2) {
    check("college interviews: reorder", (await req("PUT", `/admin/college-interviews/${cid}/questions/reorder`, { order: [qs[1]._id, qs[0]._id] }, A)).status === 200);
    check("college interviews: update question", (await req("PUT", `/admin/college-interviews/${cid}/questions/${qs[0]._id}`, { marks: 2 }, A)).status === 200);
    const dup = await req("POST", `/admin/college-interviews/${cid}/questions/${qs[0]._id}/duplicate`, {}, A);
    check("college interviews: duplicate question", dup.status === 201 || dup.status === 200, brief(dup));
    const dupId = dup.body?.data?._id;
    if (dupId) check("college interviews: delete question", (await req("DELETE", `/admin/college-interviews/${cid}/questions/${dupId}`, undefined, A)).status === 200);
  }
  const pub = await req("PATCH", `/admin/college-interviews/${cid}/status`, { status: "published" }, A);
  check("college interviews: publish", pub.status === 200, brief(pub));
  check("college interviews: update", (await req("PUT", `/admin/college-interviews/${cid}`, { timeLimit: 25 }, A)).status === 200);
  const cl = await req("PATCH", `/admin/college-interviews/${cid}/status`, { status: "closed" }, A);
  check("college interviews: close", cl.status === 200, brief(cl));
  check("college interviews: delete", (await req("DELETE", `/admin/college-interviews/${cid}`, undefined, A)).status === 200);

  // ── delete a student (the second test student)
  const s2doc: any = await db.collection("users").findOne({ email: s2.email });
  check("students: delete", (await req("DELETE", `/admin/students/${s2doc._id}`, undefined, A)).status === 200);

  console.log(`\n${passed} passed, ${failed} failed`);
  await mongoose.disconnect();
  process.exit(failed ? 1 : 0);
})().catch(async (e) => {
  console.log(`FAIL  harness error: ${e?.stack || e}`);
  process.exit(1);
});
