import { Response } from "express";
import { AuthRequest } from "../server/middleware/auth.js";
import { analyzeTrends, detectAnomalies, predictFutureExpenses, generateInsights } from "../services/ai-analysis.service.js";

/**
 * GET /ai-analysis/trends
 * Obtiene análisis de tendencias de gastos
 */
export async function getTrends(req: AuthRequest, res: Response) {
  try {
    const { months = "6" } = req.query;
    const trends = await analyzeTrends(req.user!.userId, parseInt(months as string));
    res.json({ trends });
  } catch (error: any) {
    console.error("Error analyzing trends:", error);
    res.status(500).json({ error: "Error al analizar tendencias" });
  }
}

/**
 * GET /ai-analysis/anomalies
 * Detecta gastos anómalos
 */
export async function getAnomalies(req: AuthRequest, res: Response) {
  try {
    const { months = "3" } = req.query;
    const anomalies = await detectAnomalies(req.user!.userId, parseInt(months as string));
    res.json({ anomalies });
  } catch (error: any) {
    console.error("Error detecting anomalies:", error);
    res.status(500).json({ error: "Error al detectar anomalías" });
  }
}

/**
 * GET /ai-analysis/predictions
 * Predice gastos futuros
 */
export async function getPredictions(req: AuthRequest, res: Response) {
  try {
    const { month, year } = req.query;
    const targetMonth = month ? parseInt(month as string) : new Date().getMonth() + 1;
    const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
    
    const predictions = await predictFutureExpenses(req.user!.userId, targetMonth, targetYear);
    res.json({ predictions });
  } catch (error: any) {
    console.error("Error predicting expenses:", error);
    res.status(500).json({ error: "Error al predecir gastos" });
  }
}

/**
 * GET /ai-analysis/insights
 * Genera insights accionables
 */
export async function getInsights(req: AuthRequest, res: Response) {
  try {
    const insights = await generateInsights(req.user!.userId);
    res.json({ insights });
  } catch (error: any) {
    console.error("Error generating insights:", error);
    res.status(500).json({ error: "Error al generar insights" });
  }
}

