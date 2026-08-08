import { Router } from "express";
import authRoutes from "./authRoutes";
import questionRoutes from "./questionRoutes";
import mockInterviewRoutes from "./mockInterviewRoutes";
import resumeRoutes from "./resumeRoutes";
import aiRoutes from "./aiRoutes";
import reportRoutes from "./reportRoutes";
import pineconeRoutes from "./pineconeRoutes";
import jobRoutes from "./jobRoutes";
import aptitudeRoutes from "./aptitudeRoutes";
import adminRoutes from "./adminRoutes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/questions", questionRoutes);
router.use("/mock-interview", mockInterviewRoutes);
router.use("/resume", resumeRoutes);
router.use("/ai", aiRoutes);
router.use("/reports", reportRoutes);
router.use("/pinecone", pineconeRoutes);
router.use("/jobs", jobRoutes);
router.use("/aptitude", aptitudeRoutes);
router.use("/admin", adminRoutes);

export default router;
