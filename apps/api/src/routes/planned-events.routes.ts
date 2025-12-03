import { Router } from "express";
import { requireAuth } from "../server/middleware/auth.js";
import * as plannedEventsController from "../controllers/planned-events.controller.js";

const router = Router();
router.use(requireAuth);

router.get("/", plannedEventsController.listPlannedEvents);
router.post("/", plannedEventsController.createPlannedEvent);
router.put("/:id", plannedEventsController.updatePlannedEvent);
router.post("/:id/confirm", plannedEventsController.confirmPlannedEvent);
router.delete("/:id", plannedEventsController.deletePlannedEvent);

export default router;

