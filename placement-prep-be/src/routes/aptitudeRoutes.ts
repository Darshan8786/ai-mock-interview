import { Router } from "express";
import {
  saveAptitudeResult,
  getMyAptitudeResults,
  getMyAptitudeStats,
} from "../controllers/aptitudeController";
import { protect } from "../middleware/auth";

const router = Router();

router.use(protect);

router.post("/save-result", saveAptitudeResult);
router.get("/my-results", getMyAptitudeResults);
router.get("/my-stats", getMyAptitudeStats);

export default router;
