import { Router } from "express";
import { requireAuth } from "../server/middleware/auth.js";
import { listTransactions, createTransaction, getTransaction, updateTransaction, deleteTransaction } from "../controllers/transactions.controller.js";
import attachmentsRoutes from "./transactions-attachments.routes.js";

const r = Router();
r.use(requireAuth);
r.get("/", listTransactions);     // filtros: ?from&to&categoryId&accountId&page&pageSize
r.get("/:id", getTransaction);   // Obtener una transacción por ID
r.post("/", createTransaction);
r.put("/:id", updateTransaction);
r.delete("/:id", deleteTransaction);
r.use("/", attachmentsRoutes); // Rutas de attachments: POST /:id/attachments, DELETE /:id/attachments/:attachmentId
export default r;



