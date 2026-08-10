import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { Application } from "../models/Application";

const shapeApplication = (app: any) => {
  const job: any = app.jobId || {};
  return {
    id: app._id,
    jobId: job._id || app.jobId,
    companyName: job.companyName || "",
    jobTitle: job.jobTitle || "",
    location: job.location || "",
    jobType: job.jobType || "",
    package: job.package || "",
    jobStatus: job.status || "",
    lastDateToApply: job.lastDateToApply || null,
    studentName: app.studentName,
    usn: app.usn,
    email: app.email,
    department: app.department,
    cgpa: app.cgpa,
    resumeUrl: app.resumeUrl,
    status: app.status,
    appliedAt: app.createdAt,
  };
};

/**
 * List the authenticated student's own applications.
 */
export const getMyApplications = asyncHandler(async (req: AuthRequest, res: Response) => {
  const apps = await Application.find({ studentId: req.user._id })
    .sort({ createdAt: -1 })
    .populate("jobId", "companyName jobTitle location jobType package status lastDateToApply")
    .lean();

  res.json({
    status: "success",
    results: apps.length,
    data: apps.map(shapeApplication),
  });
});
