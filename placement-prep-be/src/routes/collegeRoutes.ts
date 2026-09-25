import { Router } from "express";
import { protect } from "../middleware/auth";
import { listColleges, getMyCollege, setMyCollege } from "../controllers/collegeInterviewStudentController";

const router = Router();

router.use(protect);
router.get("/", listColleges);
router.get("/me", getMyCollege);
router.put("/me", setMyCollege);

export default router;
