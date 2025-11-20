import { Router } from "express";
import { requireAuth } from "../server/middleware/auth.js";
import { expensesByCategory, savingsStatistics, incomeStatistics, fixedCosts, aiInsights } from "../controllers/statistics.controller.js";
const r = Router();
r.use(requireAuth);
r.get("/expenses-by-category", expensesByCategory); // ?year&month&period=month|quarter|semester|year
r.get("/savings", savingsStatistics); // ?year
r.get("/income", incomeStatistics); // ?year
r.get("/fixed-costs", fixedCosts);
r.get("/ai-insights", aiInsights);
export default r;


