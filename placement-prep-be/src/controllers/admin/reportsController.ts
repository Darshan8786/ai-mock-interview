import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { User } from "../../models/User";
import { Interview } from "../../models/Interview";
import { AptitudeAttempt } from "../../models/AptitudeAttempt";
import { AptitudeQuestionHistory } from "../../models/AptitudeQuestionHistory";
import { TechQuizAttempt } from "../../models/TechQuizAttempt";
import { CheatingEvent } from "../../models/CheatingEvent";
import { Application } from "../../models/Application";

/**
 * GET /admin/reports?days=30
 *
 * Everything the admin Dashboard and Reports & Analytics pages chart, computed from stored records only:
 * interviews, aptitude + tech-practice sessions, saved resume ATS scores, cheating events and applications.
 * Time-based figures cover the last `days` days; per-student figures (readiness, ATS) use each student's history.
 * Nothing is estimated - a metric with no data is 0 / empty and says so via its `count`.
 */
const READY = 70;
const ALMOST = 50;
const MIN_TOPIC_ANSWERS = 5;

const mean = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);

function bucketer(days: number) {
  const unit: "day" | "week" | "month" = days <= 31 ? "day" : days <= 120 ? "week" : "month";
  const keyOf = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    if (unit === "week") x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // Monday
    if (unit === "month") x.setDate(1);
    return x.getTime();
  };
  const label = (t: number) => {
    const d = new Date(t);
    if (unit === "month") return d.toLocaleString("en-US", { month: "short", year: "numeric" });
    const s = d.toLocaleString("en-US", { month: "short", day: "numeric" });
    return unit === "week" ? `Wk ${s}` : s;
  };
  return { unit, keyOf, label };
}

export const getReports = asyncHandler(async (req: Request, res: Response) => {
  const days = Math.min(730, Math.max(1, Number(req.query.days) || 30));
  const since = new Date(Date.now() - days * 86400000);
  const { unit, keyOf, label } = bucketer(days);

  const [students, interviews, aptitude, tech, cheating, applications, allInterviews, allAptitude, allTech] = await Promise.all([
    User.find({ role: "user" }).select("name email department atsScore atsAnalyzedAt createdAt lastLoginAt").lean(),
    Interview.find({ createdAt: { $gte: since } })
      .select("user status overallScore technicalScore communicationScore confidenceScore cheatingCount source jobRole interviewType difficulty createdAt completedAt totalTimeTaken grammarScore fluencyScore autoTerminated")
      .populate("user", "name email").lean(),
    AptitudeAttempt.find({ status: "completed", createdAt: { $gte: since } }).select("user score accuracy mode testType createdAt").lean(),
    TechQuizAttempt.find({ status: "completed", createdAt: { $gte: since } }).select("user score technology mode questions.topic questions.answered questions.isCorrect createdAt").lean(),
    CheatingEvent.countDocuments({ createdAt: { $gte: since } }),
    Application.countDocuments({ createdAt: { $gte: since } }),
    // per-student history (readiness) - all time
    Interview.find({ status: { $in: ["completed", "terminated"] }, source: { $ne: "COLLEGE" } }).select("user overallScore").lean(),
    AptitudeAttempt.find({ status: "completed" }).select("user score").lean(),
    TechQuizAttempt.find({ status: "completed" }).select("user score").lean(),
  ]);

  // ── KPIs
  const finished = interviews.filter((i: any) => i.status === "completed" || i.status === "terminated");
  const completed = interviews.filter((i: any) => i.status === "completed");
  const terminated = interviews.filter((i: any) => i.status === "terminated");
  const ats = students.filter((s: any) => typeof s.atsScore === "number");
  const activeIds = new Set<string>([
    ...interviews.map((i: any) => String(i.user?._id || i.user)),
    ...aptitude.map((a: any) => String(a.user)),
    ...tech.map((t: any) => String(t.user)),
  ]);

  // ── readiness per student (average of what the student has actually done)
  const per = new Map<string, { interview: number[]; aptitude: number[]; tech: number[] }>();
  const slot = (id: string) => per.get(id) || (per.set(id, { interview: [], aptitude: [], tech: [] }), per.get(id)!);
  allInterviews.forEach((i: any) => slot(String(i.user)).interview.push(i.overallScore || 0));
  allAptitude.forEach((a: any) => slot(String(a.user)).aptitude.push(a.score || 0));
  allTech.forEach((t: any) => slot(String(t.user)).tech.push(t.score || 0));
  const buckets = { ready: 0, almost: 0, needsWork: 0, noActivity: 0 };
  const readinessScores: number[] = [];
  for (const s of students as any[]) {
    const p = per.get(String(s._id));
    const parts: number[] = [];
    if (p?.interview.length) parts.push(mean(p.interview));
    if (p?.aptitude.length) parts.push(mean(p.aptitude));
    if (p?.tech.length) parts.push(mean(p.tech));
    if (typeof s.atsScore === "number") parts.push(s.atsScore);
    if (!parts.length) {
      buckets.noActivity++;
      continue;
    }
    const r = mean(parts);
    readinessScores.push(r);
    if (r >= READY) buckets.ready++;
    else if (r >= ALMOST) buckets.almost++;
    else buckets.needsWork++;
  }

  // ── time series
  const series = new Map<number, { interviews: number; scores: number[]; aptitude: number; tech: number }>();
  const at = (d: any) => {
    const k = keyOf(new Date(d));
    return series.get(k) || (series.set(k, { interviews: 0, scores: [], aptitude: 0, tech: 0 }), series.get(k)!);
  };
  // pre-fill every bucket in the range so the charts show quiet periods as zero, not as gaps
  for (let t = keyOf(since); t <= Date.now(); ) {
    at(t);
    const d = new Date(t);
    if (unit === "day") d.setDate(d.getDate() + 1);
    else if (unit === "week") d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    t = keyOf(d);
  }
  interviews.forEach((i: any) => {
    const b = at(i.createdAt);
    b.interviews++;
    if (i.status === "completed" || i.status === "terminated") b.scores.push(i.overallScore || 0);
  });
  aptitude.forEach((a: any) => at(a.createdAt).aptitude++);
  tech.forEach((t: any) => at(t.createdAt).tech++);
  const ordered = [...series.entries()].sort((a, b) => a[0] - b[0]);

  // ── weakest topics across students
  const aptTopics = await AptitudeQuestionHistory.aggregate([
    { $match: { answered: true, shownAt: { $gte: since } } },
    { $lookup: { from: "aptitudequestions", localField: "question", foreignField: "_id", as: "q" } },
    { $unwind: "$q" },
    { $group: { _id: "$q.topic", answered: { $sum: 1 }, correct: { $sum: { $cond: ["$correct", 1, 0] } } } },
    { $match: { answered: { $gte: MIN_TOPIC_ANSWERS } } },
  ]);
  const techTopicMap = new Map<string, { answered: number; correct: number }>();
  tech.forEach((t: any) => (t.questions || []).forEach((q: any) => {
    if (!q.answered || !q.topic) return;
    const key = `${t.technology} · ${q.topic}`;
    const b = techTopicMap.get(key) || { answered: 0, correct: 0 };
    b.answered++;
    if (q.isCorrect) b.correct++;
    techTopicMap.set(key, b);
  }));
  const weakest = (rows: Array<{ topic: string; answered: number; correct: number }>) => rows
    .filter((r) => r.answered >= MIN_TOPIC_ANSWERS)
    .map((r) => ({ ...r, accuracy: Math.round((r.correct / r.answered) * 100) }))
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 6);

  res.json({
    status: "success",
    data: {
      range: { days, since, bucket: unit },
      kpis: {
        totalStudents: students.length,
        activeStudents: activeIds.size,
        interviewsTaken: interviews.length,
        interviewsCompleted: completed.length,
        interviewsTerminated: terminated.length,
        avgInterviewScore: mean(finished.map((i: any) => i.overallScore || 0)),
        aptitudeSessions: aptitude.length,
        avgAptitudeScore: mean(aptitude.map((a: any) => a.score || 0)),
        techSessions: tech.length,
        avgTechScore: mean(tech.map((t: any) => t.score || 0)),
        resumesAnalyzed: ats.length,
        avgAtsScore: mean(ats.map((s: any) => s.atsScore)),
        placementReady: buckets.ready,
        avgReadiness: mean(readinessScores),
        cheatingEvents: cheating,
        applications,
      },
      interviewPerformance: ordered.map(([k, b]) => ({ label: label(k), interviews: b.interviews, avgScore: mean(b.scores) })),
      activity: ordered.map(([k, b]) => ({ label: label(k), interviews: b.interviews, aptitude: b.aptitude, tech: b.tech })),
      atsDistribution: [
        { range: "0-39", count: ats.filter((s: any) => s.atsScore < 40).length },
        { range: "40-59", count: ats.filter((s: any) => s.atsScore >= 40 && s.atsScore < 60).length },
        { range: "60-79", count: ats.filter((s: any) => s.atsScore >= 60 && s.atsScore < 80).length },
        { range: "80-100", count: ats.filter((s: any) => s.atsScore >= 80).length },
      ],
      placementReadiness: [
        { name: `Ready (${READY}+)`, value: buckets.ready, color: "#10b981" },
        { name: `Almost (${ALMOST}-${READY - 1})`, value: buckets.almost, color: "#f59e0b" },
        { name: `Needs work (<${ALMOST})`, value: buckets.needsWork, color: "#ef4444" },
        { name: "No activity yet", value: buckets.noActivity, color: "#64748b" },
      ],
      readinessMethod: "Average of each student's own interview, aptitude and tech-practice scores and resume ATS score (whichever exist).",
      weakestAptitudeTopics: weakest(aptTopics.map((t: any) => ({ topic: t._id || "Unknown", answered: t.answered, correct: t.correct }))),
      weakestTechTopics: weakest([...techTopicMap.entries()].map(([topic, v]) => ({ topic, ...v }))),
      interviews: interviews
        .sort((a: any, b: any) => +new Date(b.createdAt) - +new Date(a.createdAt))
        .slice(0, 500)
        .map((i: any) => ({
          id: i._id, studentName: i.user?.name || "Unknown", studentEmail: i.user?.email || "", jobRole: i.jobRole || "",
          interviewType: i.interviewType || "", difficulty: i.difficulty || "", status: i.status, overallScore: i.overallScore || 0,
          technicalScore: i.technicalScore || 0, communicationScore: i.communicationScore || 0, confidenceScore: i.confidenceScore || 0,
          grammarScore: i.grammarScore || 0, fluencyScore: i.fluencyScore || 0, cheatingCount: i.cheatingCount || 0, date: i.createdAt,
        })),
    },
  });
});
