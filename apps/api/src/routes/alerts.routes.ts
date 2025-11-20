import { Router } from "express";
import { requireAuth } from "../server/middleware/auth.js";
import { alertsPreview } from "../controllers/alerts.controller.js";
const r = Router();
r.use(requireAuth);
r.get("/preview", alertsPreview); // ?date=YYYY-MM-DD
export default r;



