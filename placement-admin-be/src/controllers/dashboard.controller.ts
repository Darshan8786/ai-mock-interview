import type { Request, Response } from "express";
import { Student, Company, Job, Application, Interview, AptitudeTest, AptitudeAttempt } from "../models";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/response";

export const getDashboardStats = catchAsync(async (_req: Request, res: Response) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    totalStudents,
    totalCompanies,
    totalJobs,
    activeJobs,
    totalApplications,
    interviewsConducted,
    aptitudeTestsCompleted,
    recentRegistrations,
    recentApplications,
    recentCompanies,
  ] = await Promise.all([
    Student.countDocuments(),
    Company.countDocuments(),
    Job.countDocuments(),
    Job.countDocuments({ status: "open" }),
    Application.countDocuments(),
    Interview.countDocuments({ status: { $in: ["completed", "in-progress"] } }),
    AptitudeAttempt.countDocuments(),
    Student.find().sort({ createdAt: -1 }).limit(5).lean(),
    Application.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("student", "name email avatar")
      .populate({
        path: "job",
        select: "title company status",
        populate: { path: "company", select: "companyName logo" },
      })
      .lean(),
    Company.find().sort({ createdAt: -1 }).limit(5).lean(),
  ]);

  // Aggregate application status distribution
  const statusBreakdown = await Application.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  // Aptitude average score
  const aptitudeAvg = await AptitudeAttempt.aggregate([
    { $group: { _id: null, avg: { $avg: "$percentage" } } },
  ]);

  sendSuccess(
    res,
    {
      counts: {
        totalStudents,
        totalCompanies,
        totalJobs,
        activeJobs,
        totalApplications,
        interviewsConducted,
        aptitudeTestsCompleted,
      },
      averageAptitudeScore: Math.round(aptitudeAvg[0]?.avg ?? 0),
      applicationStatusBreakdown: statusBreakdown.map((s) => ({
        status: s._id,
        count: s.count,
      })),
      recentRegistrations,
      recentApplications,
      recentCompanies,
    },
    "Dashboard stats fetched successfully",
    200
  );
});
