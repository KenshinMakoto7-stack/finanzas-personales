import { Router } from "express";
import { requireAuth } from "../server/middleware/auth.js";
import { listTransactions, createTransaction, getTransaction, updateTransaction, deleteTransaction } from "../controllers/transactions.controller.js";
const r = Router();
r.use(requireAuth);
r.get("/", listTransactions);     // filtros: ?from&to&categoryId&accountId&page&pageSize
r.get("/:id", getTransaction);   // Obtener una transacción por ID
r.post("/", createTransaction);
r.put("/:id", updateTransaction);
r.delete("/:id", deleteTransaction);
export default r;



