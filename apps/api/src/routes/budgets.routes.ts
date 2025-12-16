import { Router } from "express";
import { requireAuth } from "../server/middleware/auth.js";
import * as budgetsController from "../controllers/budgets.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/", budgetsController.listCategoryBudgets);
router.get("/active-alerts", budgetsController.getActiveLimitAlerts);
router.post("/migrate", budgetsController.migrateBudgetsToLimitsEndpoint); // Endpoint temporal para migración
router.post("/", budgetsController.createCategoryBudget);
router.put("/:id", budgetsController.updateCategoryBudget);
router.delete("/:id", budgetsController.deleteCategoryBudget);

export default router;

