import { Router } from "express";
import { protect } from "../middleware/auth";
import { searchJobs } from "../controllers/jobController";

const router = Router();

router.get("/search", protect, searchJobs);

export default router;
