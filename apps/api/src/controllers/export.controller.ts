import { Request, Response } from "express";
import { db } from "../lib/firebase.js";
import { AuthRequest } from "../server/middleware/auth.js";
import { docToObject, getDocumentsByIds } from "../lib/firestore-helpers.js";
import { Timestamp } from "firebase-admin/firestore";

export async function exportCSV(req: AuthRequest, res: Response) {
  try {
    const { from, to } = req.query as any;
    
    let query: FirebaseFirestore.Query = db.collection("transactions")
      .where("userId", "==", req.user!.userId);

    if (from) {
      query = query.where("occurredAt", ">=", Timestamp.fromDate(new Date(from)));
    }
    if (to) {
      query = query.where("occurredAt", "<=", Timestamp.fromDate(new Date(to)));
    }

    query = query.orderBy("occurredAt", "asc");

    const snapshot = await query.get();
    const txs = snapshot.docs.map(doc => docToObject(doc));

    // Cargar relaciones
    const accountIds = [...new Set(txs.map((t: any) => t.accountId))];
    const categoryIds = [...new Set(txs.map((t: any) => t.categoryId).filter(Boolean))];

    const [accounts, categories] = await Promise.all([
      getDocumentsByIds("accounts", accountIds),
      getDocumentsByIds("categories", categoryIds)
    ]);

    const accountsMap = new Map(accounts.map((a: any) => [a.id, a]));
    const categoriesMap = new Map(categories.map((c: any) => [c.id, c]));

    const header = "date,type,amountCents,account,category,description\n";
    const rows = txs.map((t: any) => {
      const account = accountsMap.get(t.accountId);
      const category = categoriesMap.get(t.categoryId);
      const occurredAt = t.occurredAt instanceof Date ? t.occurredAt : new Date(t.occurredAt);
      return [
        occurredAt.toISOString(),
        t.type,
        t.amountCents,
        account?.name || "",
        category?.name || "",
        (t.description || "").replace(/[\n,]/g, " ")
      ].join(",");
    }).join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=transactions.csv");
    res.send(header + rows + "\n");
  } catch (error: any) {
    console.error("Export CSV error:", error);
    res.status(500).json({ error: error.message || "Error al exportar CSV" });
  }
}

export async function exportJSON(req: AuthRequest, res: Response) {
  try {
    const { from, to } = req.query as any;
    
    let query: FirebaseFirestore.Query = db.collection("transactions")
      .where("userId", "==", req.user!.userId);

    if (from) {
      query = query.where("occurredAt", ">=", Timestamp.fromDate(new Date(from)));
    }
    if (to) {
      query = query.where("occurredAt", "<=", Timestamp.fromDate(new Date(to)));
    }

    query = query.orderBy("occurredAt", "asc");

    const snapshot = await query.get();
    const txs = snapshot.docs.map(doc => docToObject(doc));

    res.json({ transactions: txs });
  } catch (error: any) {
    console.error("Export JSON error:", error);
    res.status(500).json({ error: error.message || "Error al exportar JSON" });
  }
}
