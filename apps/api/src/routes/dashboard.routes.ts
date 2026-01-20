import { Router } from "express";
import { requireAuth } from "../server/middleware/auth.js";
import { dashboardSummary } from "../controllers/dashboard.controller.js";

const r = Router();

r.use(requireAuth);
r.get("/summary", dashboardSummary);

export default r;
