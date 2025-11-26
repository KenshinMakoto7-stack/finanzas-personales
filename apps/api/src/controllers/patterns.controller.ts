import { Response } from "express";
import { db } from "../lib/firebase.js";
import { AuthRequest } from "../server/middleware/auth.js";
import { objectToFirestore, docToObject, getDocumentsByIds } from "../lib/firestore-helpers.js";
import { Timestamp } from "firebase-admin/firestore";

export async function analyzePatterns(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const { months = "6" } = req.query;

    const monthsAgo = parseInt(months as string);
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsAgo);

    // Obtener transacciones del usuario y filtrar en memoria para evitar índices compuestos
    const transactionsSnapshot = await db.collection("transactions")
      .where("userId", "==", userId)
      .get();

    const startTime = startDate.getTime();
    const transactions = transactionsSnapshot.docs
      .map(doc => docToObject(doc))
      .filter((tx: any) => {
        const occurredAt = tx.occurredAt instanceof Date ? tx.occurredAt : new Date(tx.occurredAt);
        return occurredAt.getTime() >= startTime && (tx.type === "EXPENSE" || tx.type === "INCOME");
      })
      .sort((a: any, b: any) => {
        const dateA = a.occurredAt instanceof Date ? a.occurredAt : new Date(a.occurredAt);
        const dateB = b.occurredAt instanceof Date ? b.occurredAt : new Date(b.occurredAt);
        return dateB.getTime() - dateA.getTime(); // desc
      });

    // Cargar relaciones
    const categoryIds = [...new Set(transactions.map((t: any) => t.categoryId).filter(Boolean))];
    const accountIds = [...new Set(transactions.map((t: any) => t.accountId))];

    const [categories, accounts] = await Promise.all([
      getDocumentsByIds("categories", categoryIds),
      getDocumentsByIds("accounts", accountIds)
    ]);

    const categoriesMap = new Map(categories.map((c: any) => [c.id, c]));
    const accountsMap = new Map(accounts.map((a: any) => [a.id, a]));

    const transactionsWithRelations = transactions.map((tx: any) => ({
      ...tx,
      category: tx.categoryId ? categoriesMap.get(tx.categoryId) : null,
      account: accountsMap.get(tx.accountId) || null
    }));

    // Agrupar por patrones
    const patternMap = new Map<string, any>();

    transactionsWithRelations.forEach((tx: any) => {
      const occurredAt = tx.occurredAt instanceof Date ? tx.occurredAt : new Date(tx.occurredAt);
      const dayOfWeek = occurredAt.getDay();
      const dayOfMonth = occurredAt.getDate();

      // Crear clave de patrón
      const key = `${tx.categoryId || "null"}-${tx.accountId || "null"}-${dayOfWeek}-${dayOfMonth}`;

      if (!patternMap.has(key)) {
        patternMap.set(key, {
          categoryId: tx.categoryId,
          accountId: tx.accountId,
          dayOfWeek,
          dayOfMonth,
          amounts: [],
          descriptions: [],
          frequency: 0,
          lastMatched: occurredAt
        });
      }

      const pattern = patternMap.get(key)!;
      pattern.amounts.push(tx.amountCents);
      if (tx.description) {
        pattern.descriptions.push(tx.description);
      }
      pattern.frequency++;
      if (occurredAt > pattern.lastMatched) {
        pattern.lastMatched = occurredAt;
      }
    });

    // Guardar o actualizar patrones en la base de datos
    const patterns = [];
    for (const [key, patternData] of patternMap.entries()) {
      if (patternData.frequency >= 2) { // Solo patrones que aparecen al menos 2 veces
        const avgAmount = Math.round(
          patternData.amounts.reduce((a: number, b: number) => a + b, 0) / patternData.amounts.length
        );

        // Buscar patrón existente
        const existingSnapshot = await db.collection("transactionPatterns")
          .where("userId", "==", userId)
          .where("categoryId", "==", patternData.categoryId || null)
          .where("accountId", "==", patternData.accountId || null)
          .where("dayOfWeek", "==", patternData.dayOfWeek)
          .where("dayOfMonth", "==", patternData.dayOfMonth)
          .limit(1)
          .get();

        let pattern;
        if (!existingSnapshot.empty) {
          // Actualizar existente
          await db.collection("transactionPatterns").doc(existingSnapshot.docs[0].id).update({
            amountCents: avgAmount,
            frequency: patternData.frequency,
            lastMatched: Timestamp.fromDate(patternData.lastMatched),
            updatedAt: Timestamp.now()
          });
          pattern = docToObject(await db.collection("transactionPatterns").doc(existingSnapshot.docs[0].id).get());
        } else {
          // Crear nuevo
          const patternData_firestore = {
            userId,
            categoryId: patternData.categoryId || null,
            accountId: patternData.accountId || null,
            amountCents: avgAmount,
            dayOfWeek: patternData.dayOfWeek,
            dayOfMonth: patternData.dayOfMonth,
            frequency: patternData.frequency,
            lastMatched: Timestamp.fromDate(patternData.lastMatched),
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
          };
          const docRef = await db.collection("transactionPatterns").add(objectToFirestore(patternData_firestore));
          pattern = docToObject(await docRef.get());
        }

        // Cargar relaciones
        const [category, account] = await Promise.all([
          pattern.categoryId ? db.collection("categories").doc(pattern.categoryId).get() : Promise.resolve(null),
          pattern.accountId ? db.collection("accounts").doc(pattern.accountId).get() : Promise.resolve(null)
        ]);

        patterns.push({
          ...pattern,
          category: category?.exists ? docToObject(category) : null,
          account: account?.exists ? docToObject(account) : null
        });
      }
    }

    res.json({ patterns, analyzed: transactions.length });
  } catch (error: any) {
    console.error("Analyze patterns error:", error);
    res.status(500).json({ error: error.message || "Error al analizar patrones" });
  }
}

export async function getSuggestions(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const { date } = req.query;

    const targetDate = date ? new Date(date as string) : new Date();
    const dayOfWeek = targetDate.getDay();
    const dayOfMonth = targetDate.getDate();

    // Buscar patrones que coincidan con el día - sin orderBy para evitar índices compuestos
    const [patternsByWeekSnapshot, patternsByMonthSnapshot] = await Promise.all([
      db.collection("transactionPatterns")
        .where("userId", "==", userId)
        .where("dayOfWeek", "==", dayOfWeek)
        .get(),
      db.collection("transactionPatterns")
        .where("userId", "==", userId)
        .where("dayOfMonth", "==", dayOfMonth)
        .get()
    ]);

    const patternsMap = new Map<string, any>();
    [...patternsByWeekSnapshot.docs, ...patternsByMonthSnapshot.docs].forEach(doc => {
      if (!patternsMap.has(doc.id)) {
        patternsMap.set(doc.id, docToObject(doc));
      }
    });

    const patterns = Array.from(patternsMap.values())
      .sort((a, b) => {
        if (b.frequency !== a.frequency) return b.frequency - a.frequency;
        const aDate = a.lastMatched instanceof Date ? a.lastMatched : new Date(a.lastMatched);
        const bDate = b.lastMatched instanceof Date ? b.lastMatched : new Date(b.lastMatched);
        return bDate.getTime() - aDate.getTime();
      })
      .slice(0, 10);

    // Cargar relaciones
    const categoryIds = [...new Set(patterns.map((p: any) => p.categoryId).filter(Boolean))];
    const accountIds = [...new Set(patterns.map((p: any) => p.accountId).filter(Boolean))];

    const [categories, accounts] = await Promise.all([
      getDocumentsByIds("categories", categoryIds),
      getDocumentsByIds("accounts", accountIds)
    ]);

    const categoriesMap = new Map(categories.map((c: any) => [c.id, c]));
    const accountsMap = new Map(accounts.map((a: any) => [a.id, a]));

    const suggestions = patterns.map((pattern: any) => ({
      categoryId: pattern.categoryId,
      category: pattern.categoryId ? categoriesMap.get(pattern.categoryId) : null,
      accountId: pattern.accountId,
      account: pattern.accountId ? accountsMap.get(pattern.accountId) : null,
      suggestedAmount: pattern.amountCents,
      confidence: Math.min(100, pattern.frequency * 20), // 0-100%
      lastMatched: pattern.lastMatched,
      matchReason: pattern.dayOfMonth === dayOfMonth
        ? "Ocurre este día del mes"
        : "Ocurre este día de la semana"
    }));

    res.json({ suggestions });
  } catch (error: any) {
    console.error("Get suggestions error:", error);
    res.status(500).json({ error: error.message || "Error al obtener sugerencias" });
  }
}

export async function listPatterns(req: AuthRequest, res: Response) {
  try {
    // Sin orderBy para evitar índices compuestos
    const snapshot = await db.collection("transactionPatterns")
      .where("userId", "==", req.user!.userId)
      .get();

    // Ordenar en memoria
    const patterns = snapshot.docs
      .map(doc => docToObject(doc))
      .sort((a: any, b: any) => {
        if (b.frequency !== a.frequency) return b.frequency - a.frequency;
        const dateA = a.lastMatched instanceof Date ? a.lastMatched : new Date(a.lastMatched || 0);
        const dateB = b.lastMatched instanceof Date ? b.lastMatched : new Date(b.lastMatched || 0);
        return dateB.getTime() - dateA.getTime();
      });

    // Cargar relaciones
    const categoryIds = [...new Set(patterns.map((p: any) => p.categoryId).filter(Boolean))];
    const accountIds = [...new Set(patterns.map((p: any) => p.accountId).filter(Boolean))];

    const [categories, accounts] = await Promise.all([
      getDocumentsByIds("categories", categoryIds),
      getDocumentsByIds("accounts", accountIds)
    ]);

    const categoriesMap = new Map(categories.map((c: any) => [c.id, c]));
    const accountsMap = new Map(accounts.map((a: any) => [a.id, a]));

    const patternsWithRelations = patterns.map((pattern: any) => ({
      ...pattern,
      category: pattern.categoryId ? categoriesMap.get(pattern.categoryId) : null,
      account: pattern.accountId ? accountsMap.get(pattern.accountId) : null
    }));

    res.json({ patterns: patternsWithRelations });
  } catch (error: any) {
    console.error("List patterns error:", error);
    res.status(500).json({ error: error.message || "Error al listar patrones" });
  }
}

export async function deletePattern(req: AuthRequest, res: Response) {
  try {
    const patternId = req.params.id;

    // Verificar que el patrón existe y pertenece al usuario
    const patternDoc = await db.collection("transactionPatterns").doc(patternId).get();
    if (!patternDoc.exists) {
      return res.status(404).json({ error: "Patrón no encontrado" });
    }

    const patternData = patternDoc.data()!;
    if (patternData.userId !== req.user!.userId) {
      return res.status(403).json({ error: "No autorizado" });
    }

    await db.collection("transactionPatterns").doc(patternId).delete();
    res.status(204).send();
  } catch (error: any) {
    console.error("Delete pattern error:", error);
    res.status(500).json({ error: error.message || "Error al eliminar patrón" });
  }
}
