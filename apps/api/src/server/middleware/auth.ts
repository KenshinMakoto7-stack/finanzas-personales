import { Request, Response, NextFunction } from "express";
import { auth } from "../../lib/firebase.js";

export interface AuthRequest extends Request {
  user?: { userId: string };
  file?: {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
  };
}

/**
 * Middleware para verificar token de Firebase Auth
 */
export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.slice("Bearer ".length);
    
    // Verificar token con Firebase Admin
    const decodedToken = await auth.verifyIdToken(token);
    
    // Agregar userId al request
    req.user = { userId: decodedToken.uid };
    
    next();
  } catch (error: any) {
    console.error("Auth error:", error);
    res.status(401).json({ error: "Invalid token" });
  }
}
