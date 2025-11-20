import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/db.js";
import { hashPassword, verifyPassword } from "../lib/crypto.js";
import { RegisterSchema, LoginSchema } from "@pf/shared";
import { AuthRequest } from "../server/middleware/auth.js";
import crypto from "crypto";
import { sendPasswordResetEmail } from "../services/email.service.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

export async function register(req: Request, res: Response) {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    const errors = parsed.error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join(", ");
    return res.status(400).json({ error: `Error de validación: ${errors}` });
  }

  const { email, password, name, currencyCode, locale, timeZone } = parsed.data;
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return res.status(409).json({ error: "Email ya registrado" });

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({ data: { email, passwordHash, name, currencyCode, locale, timeZone } });

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, user: { id: user.id, email, name, currencyCode, locale, timeZone } });
}

export async function login(req: Request, res: Response) {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    const errors = parsed.error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join(", ");
    return res.status(400).json({ error: `Error de validación: ${errors}` });
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: "Credenciales inválidas" });
  const ok = await verifyPassword(user.passwordHash, password);
  if (!ok) return res.status(401).json({ error: "Credenciales inválidas" });

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, currencyCode: user.currencyCode, locale: user.locale, timeZone: user.timeZone } });
}

export async function me(req: AuthRequest, res: Response) {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) return res.status(404).json({ error: "No encontrado" });
  res.json({ user: { id: user.id, email: user.email, name: user.name, currencyCode: user.currencyCode, locale: user.locale, timeZone: user.timeZone } });
}

export async function updatePrefs(req: AuthRequest, res: Response) {
  const { currencyCode, locale, timeZone, name } = req.body || {};
  const user = await prisma.user.update({
    where: { id: req.user!.userId },
    data: { currencyCode: currencyCode || undefined, locale: locale || undefined, timeZone: timeZone || undefined, name: name || undefined }
  });
  res.json({ user: { id: user.id, email: user.email, name: user.name, currencyCode: user.currencyCode, locale: user.locale, timeZone: user.timeZone } });
}

// Solicitar recuperación de contraseña
export async function requestPasswordReset(req: Request, res: Response) {
  const { email } = req.body;
  
  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Email es requerido" });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  
  // Por seguridad, siempre devolvemos éxito aunque el email no exista
  if (!user) {
    return res.json({ message: "Si el email existe, recibirás un enlace para recuperar tu contraseña" });
  }

  // Generar token seguro
  const resetToken = crypto.randomBytes(32).toString("hex");
  const resetTokenExpires = new Date();
  resetTokenExpires.setHours(resetTokenExpires.getHours() + 1); // Expira en 1 hora

  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken, resetTokenExpires }
  });

  // Enviar email con el token
  const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/reset-password?token=${resetToken}`;
  await sendPasswordResetEmail(user.email, resetUrl);

  res.json({ message: "Si el email existe, recibirás un enlace para recuperar tu contraseña" });
}

// Verificar token de recuperación
export async function verifyResetToken(req: Request, res: Response) {
  const { token } = req.query;

  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: "Token es requerido" });
  }

  const user = await prisma.user.findFirst({
    where: {
      resetToken: token,
      resetTokenExpires: { gt: new Date() }
    }
  });

  if (!user) {
    return res.status(400).json({ error: "Token inválido o expirado" });
  }

  res.json({ valid: true, email: user.email });
}

// Resetear contraseña
export async function resetPassword(req: Request, res: Response) {
  const { token, password } = req.body;

  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: "Token es requerido" });
  }

  if (!password || typeof password !== "string" || password.length < 8) {
    return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres" });
  }

  const user = await prisma.user.findFirst({
    where: {
      resetToken: token,
      resetTokenExpires: { gt: new Date() }
    }
  });

  if (!user) {
    return res.status(400).json({ error: "Token inválido o expirado" });
  }

  const passwordHash = await hashPassword(password);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      resetToken: null,
      resetTokenExpires: null
    }
  });

  res.json({ message: "Contraseña actualizada exitosamente" });
}



