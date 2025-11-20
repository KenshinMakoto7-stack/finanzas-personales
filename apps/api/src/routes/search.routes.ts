import { Router } from "express";
import { requireAuth } from "../server/middleware/auth.js";
import * as searchController from "../controllers/search.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/", searchController.globalSearch);
router.get("/suggestions", searchController.searchSuggestions);

export default router;

