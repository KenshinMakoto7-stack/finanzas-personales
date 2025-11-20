import { Router } from "express";
import { requireAuth } from "../server/middleware/auth.js";
import { monthlyByCategory } from "../controllers/reports.controller.js";
const r = Router();
r.use(requireAuth);
r.get("/monthly-by-category", monthlyByCategory); // ?year=2025&month=11&type=EXPENSE|INCOME
export default r;



