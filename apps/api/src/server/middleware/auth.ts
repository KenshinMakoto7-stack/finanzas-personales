import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  user?: { userId: string };
}

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  const token = auth.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
    req.user = { userId: payload.userId };
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}



