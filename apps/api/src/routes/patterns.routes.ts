import { Router } from "express";
import { requireAuth } from "../server/middleware/auth.js";
import * as patternsController from "../controllers/patterns.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/", patternsController.listPatterns);
router.post("/analyze", patternsController.analyzePatterns);
router.get("/suggestions", patternsController.getSuggestions);
router.delete("/:id", patternsController.deletePattern);

export default router;

