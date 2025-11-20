import { Request, Response } from "express";
import { getCurrentExchangeRate, clearExchangeRateCache } from "../services/exchange.service.js";
import { AuthRequest } from "../server/middleware/auth.js";

/**
 * GET /exchange/rate
 * Obtiene el tipo de cambio actual USD/UYU
 */
export async function getExchangeRate(req: Request, res: Response) {
  try {
    const rateInfo = await getCurrentExchangeRate();
    res.json(rateInfo);
  } catch (error: any) {
    res.status(500).json({ error: "Error obteniendo tipo de cambio", message: error.message });
  }
}

/**
 * POST /exchange/refresh
 * Fuerza la actualización del tipo de cambio
 */
export async function refreshExchangeRate(req: AuthRequest, res: Response) {
  try {
    clearExchangeRateCache();
    const rateInfo = await getCurrentExchangeRate();
    res.json({ message: "Tipo de cambio actualizado", ...rateInfo });
  } catch (error: any) {
    res.status(500).json({ error: "Error actualizando tipo de cambio", message: error.message });
  }
}

