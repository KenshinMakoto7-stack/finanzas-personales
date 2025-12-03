import { Router } from "express";
import { requireAuth } from "../server/middleware/auth.js";
import multer from "multer";
import * as attachmentsController from "../controllers/transactions-attachments.controller.js";

const router = Router();
router.use(requireAuth);

// Configurar multer para manejar archivos en memoria
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
  fileFilter: (_req, file, cb) => {
    // Aceptar solo imágenes
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de imagen'));
    }
  }
});

router.post("/:id/attachments", upload.single('image'), attachmentsController.uploadAttachment);
router.delete("/:id/attachments/:attachmentId", attachmentsController.deleteAttachment);

export default router;

