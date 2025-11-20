import { Router } from "express";
import { requireAuth } from "../server/middleware/auth.js";
import { listAccounts, createAccount, updateAccount, deleteAccount } from "../controllers/accounts.controller.js";
const r = Router();
r.use(requireAuth);
r.get("/", listAccounts);
r.post("/", createAccount);
r.put("/:id", updateAccount);
r.delete("/:id", deleteAccount);
export default r;



