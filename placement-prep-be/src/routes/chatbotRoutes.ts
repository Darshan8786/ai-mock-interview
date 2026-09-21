import { Router } from "express";
import { protect } from "../middleware/auth";
import { chatMessage, chatbotInfo } from "../controllers/chatbotController";

const router = Router();

router.use(protect);
router.get("/info", chatbotInfo);
router.post("/chat", chatMessage);

export default router;
