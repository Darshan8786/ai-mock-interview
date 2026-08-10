import { Router } from "express";
import { protect } from "../middleware/auth";
import { getMyApplications } from "../controllers/applicationsController";

const router = Router();

router.use(protect);

// Student's own applications
router.get("/my", getMyApplications);

export default router;
