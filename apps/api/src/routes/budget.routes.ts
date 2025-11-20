import { Router } from "express";
import { requireAuth } from "../server/middleware/auth.js";
import { budgetSummary } from "../controllers/budget.controller.js";
const r = Router();
r.use(requireAuth);
r.get("/summary", budgetSummary); // ?date=YYYY-MM-DD
export default r;



