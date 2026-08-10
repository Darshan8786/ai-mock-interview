import { Router } from "express";
import { protect } from "../middleware/auth";
import { searchJobs } from "../controllers/jobController";
import { listJobs, getJobDetail, applyToJob } from "../controllers/jobsController";

const router = Router();

// Adzuna external job search (kept for ResumeBuilder / job search UI)
router.get("/search", protect, searchJobs);

// Internal placement job module (student-facing)
router.get("/", protect, listJobs);
router.get("/:id", protect, getJobDetail);
router.post("/:id/apply", protect, applyToJob);

export default router;
