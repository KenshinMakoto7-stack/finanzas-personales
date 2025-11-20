import { Router } from "express";
import { requireAuth } from "../server/middleware/auth.js";
import { getExchangeRate, refreshExchangeRate } from "../controllers/exchange.controller.js";

const r = Router();

// El tipo de cambio es público (no requiere auth)
r.get("/rate", getExchangeRate);
r.post("/refresh", requireAuth, refreshExchangeRate);

export default r;

