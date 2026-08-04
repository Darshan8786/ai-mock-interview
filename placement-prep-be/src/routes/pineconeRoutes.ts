import express from "express";
import { userMiddleware } from "../middleware/userMiddleware";
import {
    syncAttemptsToVectorDB,
    getVectorDBStats,
    ragQuery,
} from "../controllers/pineconeController";

const router = express.Router();

// Sync user attempts to vector database
router.post("/sync-attempts", userMiddleware, syncAttemptsToVectorDB);

// Get vector database stats for user
router.get("/stats", userMiddleware, getVectorDBStats);

// RAG query endpoint
router.post("/chat", userMiddleware, ragQuery);

export default router;
