import { Router } from "express";
import { requireAuth } from "../server/middleware/auth.js";
import { exportCSV, exportJSON } from "../controllers/export.controller.js";
const r = Router();
r.use(requireAuth);
r.get("/csv", exportCSV);   // ?from=ISO&to=ISO
r.get("/json", exportJSON); // ?from&to
export default r;



