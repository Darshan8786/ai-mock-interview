import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { User } from "../../models/User";
import { Interview } from "../../models/Interview";
import { InterviewReport } from "../../models/InterviewReport";
import { CheatingEvent } from "../../models/CheatingEvent";
import { AptitudeAttempt } from "../../models/AptitudeAttempt";
import { AttemptModel } from "../../db";
import { Notification } from "../../models/Notification";
import { Announcement } from "../../models/Announcement";

/**
 * Aggregate dashboard stats for the Training & Placement Officer.
 */
export const getDashboardStats = asyncHandler(async (_req: Request, res: Response) => {
  const [students, verifiedStudents, companies, interviews, reports, aptitudes, attempts, cheating] =
    await Promise.all([
      User.find({ role: "user" }).lean(),
      User.countDocuments({ role: "user", verificationStatus: "verified" }),
      User.distinct("department", { role: "user" }),
      Interview.find().lean(),
      InterviewReport.find().lean(),
      AptitudeAttempt.find().lean(),
      AttemptModel.find().lean(),
      CheatingEvent.countDocuments(),
    ]);

  const totalStudents = students.length;

  // Profile completeness
  const computeCompletion = (u: any) => {
    const checks: boolean[] = [
      !!u.usn, !!u.phone, !!u.department, !!u.year, !!u.semester,
      typeof u.cgpa === "number" && u.cgpa > 0,
      Array.isArray(u.skills) && u.skills.length > 0,
      Array.isArray(u.projects) && u.projects.length > 0,
      !!u.resumeUrl,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  };
  const incompleteProfiles = students.filter((s) => computeCompletion(s) < 50).length;

  // Year / semester / department distribution
  const yearWise: Record<string, number> = {};
  const semesterWise: Record<string, number> = {};
  const departmentWise: Record<string, number> = {};
  const cgpas: number[] = [];
  let eligibleForPlacement = 0;
  students.forEach((s) => {
    if (s.year) yearWise[s.year] = (yearWise[s.year] || 0) + 1;
    if (s.semester) semesterWise[s.semester] = (semesterWise[s.semester] || 0) + 1;
    if (s.department) departmentWise[s.department] = (departmentWise[s.department] || 0) + 1;
    if (typeof s.cgpa === "number" && s.cgpa > 0) {
      cgpas.push(s.cgpa);
      if (s.cgpa >= 6.5) eligibleForPlacement++;
    }
  });
  const avgCgpa = cgpas.length
    ? Math.round((cgpas.reduce((a, b) => a + b, 0) / cgpas.length) * 100) / 100
    : 0;

  // Interview stats
  const interviewScores = reports.map((r: any) => r.overallScore || 0);
  const avgInterviewScore = interviewScores.length
    ? Math.round(interviewScores.reduce((a, b) => a + b, 0) / interviewScores.length)
    : 0;
  const highestInterviewScore = interviewScores.length ? Math.max(...interviewScores) : 0;
  const lowestInterviewScore = interviewScores.length ? Math.min(...interviewScores) : 0;

  // Aptitude stats
  const aptitudeScores = aptitudes.map((a: any) => a.score || 0);
  const avgAptitudeScore = aptitudeScores.length
    ? Math.round(aptitudeScores.reduce((a, b) => a + b, 0) / aptitudeScores.length)
    : 0;
  const highestAptitudeScore = aptitudeScores.length ? Math.max(...aptitudeScores) : 0;

  // Quiz stats (AttemptModel has one row per question answered)
  const quizAttempts = attempts.length;
  const quizCorrect = attempts.filter((a: any) => a.correct).length;
  const avgQuizScore = quizAttempts ? Math.round((quizCorrect / quizAttempts) * 100) : 0;

  // Placement pipeline
  const byPlacement: Record<string, number> = {};
  students.forEach((s) => {
    const key = s.placementStatus || "not_applied";
    byPlacement[key] = (byPlacement[key] || 0) + 1;
  });

  const recentStudents = await User.find({ role: "user" })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();
  const recentInterviews = await Interview.find()
    .sort({ createdAt: -1 })
    .limit(5)
    .populate("user", "name email usn department")
    .lean();
  const recentAptitudes = await AptitudeAttempt.find()
    .sort({ createdAt: -1 })
    .limit(5)
    .populate("user", "name email usn department")
    .lean();
  const recentQuiz = await AttemptModel.find()
    .sort({ createdAt: -1 })
    .limit(5)
    .populate("userId", "name email")
    .lean();
  const recentNotifications = await Notification.find()
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  res.json({
    status: "success",
    data: {
      counts: {
        totalStudents,
        verifiedStudents,
        incompleteProfiles,
        departments: companies.length,
        averageCgpa: avgCgpa,
        studentsEligibleForPlacement: eligibleForPlacement,
        totalInterviews: interviews.length,
        averageInterviewScore: avgInterviewScore,
        highestInterviewScore,
        lowestInterviewScore,
        aptitudeTestsCompleted: aptitudes.length,
        averageAptitudeScore: avgAptitudeScore,
        highestAptitudeScore,
        quizAttempts,
        averageQuizScore: avgQuizScore,
        totalCheatingEvents: cheating,
        announcements: await Announcement.countDocuments(),
      },
      distribution: {
        departmentWise,
        yearWise,
        semesterWise,
        placementStatus: byPlacement,
      },
      recent: {
        students: recentStudents,
        interviews: recentInterviews,
        aptitude: recentAptitudes,
        quiz: recentQuiz,
        notifications: recentNotifications,
      },
    },
  });
});
