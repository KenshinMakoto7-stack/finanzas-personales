import { Router } from "express";
import { register, login, me, updatePrefs, requestPasswordReset, verifyResetToken, resetPassword } from "../controllers/auth.controller.js";
import { requireAuth } from "../server/middleware/auth.js";
const r = Router();
r.post("/register", register);
r.post("/login", login);
r.get("/me", requireAuth, me);
r.put("/prefs", requireAuth, updatePrefs);

// Recuperación de contraseña
r.post("/forgot-password", requestPasswordReset);
r.get("/verify-reset-token", verifyResetToken);
r.post("/reset-password", resetPassword);

export default r;



