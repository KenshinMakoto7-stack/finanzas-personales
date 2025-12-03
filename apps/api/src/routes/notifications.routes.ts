import { Router } from "express";
import { requireAuth } from "../server/middleware/auth.js";
import * as notificationsController from "../controllers/notifications.controller.js";

const router = Router();

router.use(requireAuth);

router.post("/subscribe", notificationsController.registerSubscription);
router.get("/pending", notificationsController.getPendingNotifications);
router.post("/read", notificationsController.markAsRead);
router.delete("/:id", notificationsController.deleteNotification);
router.delete("/", notificationsController.deleteAllNotifications);

export default router;

