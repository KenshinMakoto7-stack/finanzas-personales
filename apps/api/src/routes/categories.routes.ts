import { Router } from "express";
import { requireAuth } from "../server/middleware/auth.js";
import { listCategories, createCategory, updateCategory, deleteCategory } from "../controllers/categories.controller.js";
const r = Router();
r.use(requireAuth);
r.get("/", listCategories);
r.post("/", createCategory);
r.put("/:id", updateCategory);
r.delete("/:id", deleteCategory);
export default r;



