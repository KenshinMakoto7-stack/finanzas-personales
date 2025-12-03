import { Router } from "express";
import { requireAuth } from "../server/middleware/auth.js";
import { listDebts, createDebt, updateDebt, deleteDebt, getDebtStatistics, markDebtAsPaid } from "../controllers/debts.controller.js";

const r = Router();
r.use(requireAuth);

r.get("/", listDebts);
r.post("/", createDebt);
r.put("/:id", updateDebt);
r.delete("/:id", deleteDebt);
r.post("/:id/mark-paid", markDebtAsPaid);
r.get("/statistics", getDebtStatistics);

export default r;

