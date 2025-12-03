import { Router } from "express";
import { requireAuth } from "../server/middleware/auth.js";
import * as aiAnalysisController from "../controllers/ai-analysis.controller.js";

const router = Router();
router.use(requireAuth);

router.get("/trends", aiAnalysisController.getTrends);
router.get("/anomalies", aiAnalysisController.getAnomalies);
router.get("/predictions", aiAnalysisController.getPredictions);
router.get("/insights", aiAnalysisController.getInsights);

export default router;

