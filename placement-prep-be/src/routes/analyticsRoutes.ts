import { Router } from "express";
import { protect } from "../middleware/auth";
import { getMyAnalytics } from "../controllers/analyticsController";

const router = Router();

router.use(protect);
router.get("/me", getMyAnalytics);

export default router;
