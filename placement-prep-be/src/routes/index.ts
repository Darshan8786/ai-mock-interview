import { Router } from "express";
import authRoutes from "./authRoutes";
import questionRoutes from "./questionRoutes";
import mockInterviewRoutes from "./mockInterviewRoutes";
import resumeRoutes from "./resumeRoutes";
import analyticsRoutes from "./analyticsRoutes";
import chatbotRoutes from "./chatbotRoutes";
import jobRoutes from "./jobRoutes";
import applicationRoutes from "./applicationRoutes";
import notificationRoutes from "./notificationRoutes";
import aptitudeRoutes from "./aptitudeRoutes";
import adminRoutes from "./adminRoutes";
import techQuizRoutes from "./techQuizRoutes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/questions", questionRoutes);
router.use("/mock-interview", mockInterviewRoutes);
router.use("/resume", resumeRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/chatbot", chatbotRoutes);
router.use("/jobs", jobRoutes);
router.use("/applications", applicationRoutes);
router.use("/notifications", notificationRoutes);
router.use("/aptitude", aptitudeRoutes);
router.use("/admin", adminRoutes);
router.use("/tech-quiz", techQuizRoutes);

export default router;
