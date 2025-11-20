import { Router } from "express";
import { requireAuth } from "../server/middleware/auth.js";
import { upsertGoal, getGoal, getGoalByQuery } from "../controllers/goals.controller.js";
const r = Router();
r.use(requireAuth);
r.get("/", getGoalByQuery); // GET /goals?year=2025&month=11
r.put("/:year/:month", upsertGoal);
r.get("/:year/:month", getGoal);
export default r;



