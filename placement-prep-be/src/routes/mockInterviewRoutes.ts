import { Router } from "express";
import { protect } from "../middleware/auth";
import {
  createInterview,
  getInterview,
  submitAnswer,
  skipQuestion,
  reportCheating,
  terminateInterview,
  getReport,
  getDashboard,
} from "../controllers/mockInterviewController";

const router = Router();

router.use(protect);

router.post("/create", createInterview);
router.get("/dashboard", getDashboard);
router.get("/:id", getInterview);
router.post("/:id/answer", submitAnswer);
router.post("/:id/skip", skipQuestion);
router.post("/:id/cheating", reportCheating);
router.post("/:id/terminate", terminateInterview);
router.get("/:id/report", getReport);

export default router;
