import { Router } from "express";
import { protect } from "../middleware/auth";
import {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from "../controllers/notificationsController";

const router = Router();

router.use(protect);

// Student's own notification feed
router.get("/my", getMyNotifications);
router.patch("/read-all", markAllNotificationsRead);
router.patch("/:id/read", markNotificationRead);
router.delete("/:id", deleteNotification);

export default router;
