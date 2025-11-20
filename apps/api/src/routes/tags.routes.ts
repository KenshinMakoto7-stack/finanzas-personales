import { Router } from "express";
import { requireAuth } from "../server/middleware/auth.js";
import * as tagsController from "../controllers/tags.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/", tagsController.listTags);
router.post("/", tagsController.createTag);
router.put("/:id", tagsController.updateTag);
router.delete("/:id", tagsController.deleteTag);
router.post("/transactions", tagsController.addTagToTransaction);
router.delete("/transactions/:transactionId/:tagId", tagsController.removeTagFromTransaction);

export default router;

