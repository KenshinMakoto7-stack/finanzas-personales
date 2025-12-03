import { db } from "../lib/firebase.js";
import { docToObject } from "../lib/firestore-helpers.js";

/**
 * Analiza tendencias temporales de gastos por categoría
 */
export async function analyzeTrends(userId: string, months: number = 6) {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  
  const transactionsSnapshot = await db.collection("transactions")
    .where("userId", "==", userId)
    .where("type", "==", "EXPENSE")
    .get();
  
  const transactions = transactionsSnapshot.docs
    .map(doc => docToObject(doc))
    .filter((tx: any) => {
      const occurredAt = tx.occurredAt instanceof Date ? tx.occurredAt : new Date(tx.occurredAt);
      return occurredAt >= startDate;
    });
  
  // Agrupar por categoría y mes
  const categoryMonthly: Record<string, Record<string, number>> = {};
  
  transactions.forEach((tx: any) => {
    const categoryId = tx.categoryId || "sin-categoria";
    const occurredAt = tx.occurredAt instanceof Date ? tx.occurredAt : new Date(tx.occurredAt);
    const monthKey = `${occurredAt.getFullYear()}-${String(occurredAt.getMonth() + 1).padStart(2, '0')}`;
    
    if (!categoryMonthly[categoryId]) {
      categoryMonthly[categoryId] = {};
    }
    if (!categoryMonthly[categoryId][monthKey]) {
      categoryMonthly[categoryId][monthKey] = 0;
    }
    categoryMonthly[categoryId][monthKey] += tx.amountCents;
  });
  
  // Calcular tendencias
  const trends = [];
  for (const [categoryId, monthlyData] of Object.entries(categoryMonthly)) {
    const months = Object.keys(monthlyData).sort();
    if (months.length < 2) continue;
    
    const amounts = months.map(m => monthlyData[m]);
    const firstHalf = amounts.slice(0, Math.floor(amounts.length / 2));
    const secondHalf = amounts.slice(Math.floor(amounts.length / 2));
    
    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    const change = avgSecond - avgFirst;
    const changePercent = avgFirst > 0 ? (change / avgFirst) * 100 : 0;
    
    trends.push({
      categoryId,
      trend: changePercent > 5 ? "increasing" : changePercent < -5 ? "decreasing" : "stable",
      changePercent: Math.round(changePercent * 10) / 10,
      averageAmount: Math.round(avgSecond)
    });
  }
  
  return trends;
}

/**
 * Detecta anomalías en gastos (gastos inusualmente altos)
 */
export async function detectAnomalies(userId: string, months: number = 3) {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  
  const transactionsSnapshot = await db.collection("transactions")
    .where("userId", "==", userId)
    .where("type", "==", "EXPENSE")
    .get();
  
  const transactions = transactionsSnapshot.docs
    .map(doc => docToObject(doc))
    .filter((tx: any) => {
      const occurredAt = tx.occurredAt instanceof Date ? tx.occurredAt : new Date(tx.occurredAt);
      return occurredAt >= startDate;
    });
  
  // Agrupar por categoría
  const categoryStats: Record<string, { amounts: number[]; mean: number; stdDev: number }> = {};
  
  transactions.forEach((tx: any) => {
    const categoryId = tx.categoryId || "sin-categoria";
    if (!categoryStats[categoryId]) {
      categoryStats[categoryId] = { amounts: [], mean: 0, stdDev: 0 };
    }
    categoryStats[categoryId].amounts.push(tx.amountCents);
  });
  
  // Calcular media y desviación estándar por categoría
  for (const [categoryId, stats] of Object.entries(categoryStats)) {
    if (stats.amounts.length < 3) continue; // Necesitamos al menos 3 transacciones
    
    const mean = stats.amounts.reduce((a, b) => a + b, 0) / stats.amounts.length;
    const variance = stats.amounts.reduce((sum, amount) => sum + Math.pow(amount - mean, 2), 0) / stats.amounts.length;
    const stdDev = Math.sqrt(variance);
    
    stats.mean = mean;
    stats.stdDev = stdDev;
  }
  
  // Detectar anomalías (Z-score > 2)
  const anomalies = [];
  transactions.forEach((tx: any) => {
    const categoryId = tx.categoryId || "sin-categoria";
    const stats = categoryStats[categoryId];
    if (!stats || stats.stdDev === 0) return;
    
    const zScore = (tx.amountCents - stats.mean) / stats.stdDev;
    if (zScore > 2) {
      anomalies.push({
        transactionId: tx.id,
        categoryId,
        amountCents: tx.amountCents,
        occurredAt: tx.occurredAt,
        description: tx.description,
        zScore: Math.round(zScore * 100) / 100,
        deviation: Math.round(((tx.amountCents - stats.mean) / stats.mean) * 100)
      });
    }
  });
  
  return anomalies.sort((a, b) => b.zScore - a.zScore).slice(0, 10); // Top 10 anomalías
}

/**
 * Predice gastos futuros basado en patrones históricos
 */
export async function predictFutureExpenses(userId: string, targetMonth: number, targetYear: number) {
  const transactionsSnapshot = await db.collection("transactions")
    .where("userId", "==", userId)
    .where("type", "==", "EXPENSE")
    .get();
  
  const transactions = transactionsSnapshot.docs.map(doc => docToObject(doc));
  
  // Agrupar por categoría y día del mes
  const categoryDayPatterns: Record<string, Record<number, number[]>> = {};
  
  transactions.forEach((tx: any) => {
    const categoryId = tx.categoryId || "sin-categoria";
    const occurredAt = tx.occurredAt instanceof Date ? tx.occurredAt : new Date(tx.occurredAt);
    const dayOfMonth = occurredAt.getDate();
    
    if (!categoryDayPatterns[categoryId]) {
      categoryDayPatterns[categoryId] = {};
    }
    if (!categoryDayPatterns[categoryId][dayOfMonth]) {
      categoryDayPatterns[categoryId][dayOfMonth] = [];
    }
    categoryDayPatterns[categoryId][dayOfMonth].push(tx.amountCents);
  });
  
  // Predecir gastos para el mes objetivo
  const predictions = [];
  const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
  
  for (let day = 1; day <= daysInMonth; day++) {
    for (const [categoryId, dayPatterns] of Object.entries(categoryDayPatterns)) {
      const amounts = dayPatterns[day] || [];
      if (amounts.length === 0) continue;
      
      // Calcular promedio
      const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const frequency = amounts.length / transactions.length; // Frecuencia relativa
      
      if (frequency > 0.05) { // Solo si aparece en al menos 5% de las transacciones
        predictions.push({
          categoryId,
          day,
          predictedAmount: Math.round(avgAmount),
          confidence: Math.min(frequency * 100, 100),
          historicalOccurrences: amounts.length
        });
      }
    }
  }
  
  return predictions.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Genera insights accionables basados en el análisis
 */
export async function generateInsights(userId: string) {
  const [trends, anomalies, transactionsSnapshot] = await Promise.all([
    analyzeTrends(userId, 6),
    detectAnomalies(userId, 3),
    db.collection("transactions")
      .where("userId", "==", userId)
      .where("type", "==", "EXPENSE")
      .get()
  ]);
  
  const transactions = transactionsSnapshot.docs.map(doc => docToObject(doc));
  const totalExpenses = transactions.reduce((sum, tx: any) => sum + tx.amountCents, 0);
  const avgExpense = transactions.length > 0 ? totalExpenses / transactions.length : 0;
  
  const insights = [];
  
  // Insight 1: Tendencias
  const increasingTrends = trends.filter(t => t.trend === "increasing");
  if (increasingTrends.length > 0) {
    insights.push({
      type: "trend",
      priority: "high",
      title: "Gastos en aumento",
      message: `${increasingTrends.length} categoría(s) muestran tendencia al alza. Considera revisar estos gastos.`,
      categories: increasingTrends.map(t => t.categoryId)
    });
  }
  
  // Insight 2: Anomalías
  if (anomalies.length > 0) {
    insights.push({
      type: "anomaly",
      priority: "high",
      title: "Gastos inusuales detectados",
      message: `Se detectaron ${anomalies.length} gasto(s) significativamente por encima del promedio.`,
      count: anomalies.length
    });
  }
  
  // Insight 3: Oportunidades de ahorro
  const topCategories = trends
    .sort((a, b) => b.averageAmount - a.averageAmount)
    .slice(0, 3);
  
  if (topCategories.length > 0) {
    insights.push({
      type: "savings",
      priority: "medium",
      title: "Oportunidades de ahorro",
      message: `Tus categorías con mayor gasto representan una oportunidad de optimización.`,
      topCategories: topCategories.map(t => t.categoryId)
    });
  }
  
  return insights;
}

