import { Router } from "express";
import authRoutes from "./authRoutes";
import questionRoutes from "./questionRoutes";
import mockInterviewRoutes from "./mockInterviewRoutes";
import resumeRoutes from "./resumeRoutes";
import aiRoutes from "./aiRoutes";
import reportRoutes from "./reportRoutes";
import pineconeRoutes from "./pineconeRoutes";
import jobRoutes from "./jobRoutes";
import applicationRoutes from "./applicationRoutes";
import notificationRoutes from "./notificationRoutes";
import aptitudeRoutes from "./aptitudeRoutes";
import adminRoutes from "./adminRoutes";
import quizRoutes from "./quizRoutes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/questions", questionRoutes);
router.use("/mock-interview", mockInterviewRoutes);
router.use("/resume", resumeRoutes);
router.use("/ai", aiRoutes);
router.use("/reports", reportRoutes);
router.use("/pinecone", pineconeRoutes);
router.use("/jobs", jobRoutes);
router.use("/applications", applicationRoutes);
router.use("/notifications", notificationRoutes);
router.use("/aptitude", aptitudeRoutes);
router.use("/admin", adminRoutes);
router.use("/quiz", quizRoutes);

export default router;
