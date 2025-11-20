import { Router } from "express";
import { requireAuth } from "../server/middleware/auth.js";
import * as notificationsController from "../controllers/notifications.controller.js";

const router = Router();

router.use(requireAuth);

router.post("/subscribe", notificationsController.registerSubscription);
router.get("/pending", notificationsController.getPendingNotifications);
router.post("/read", notificationsController.markAsRead);

export default router;

