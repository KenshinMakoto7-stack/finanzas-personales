import { Response } from "express";
import { db } from "../lib/firebase.js";
import { AuthRequest } from "../server/middleware/auth.js";
import { docToObject, textSearch, getDocumentsByIds, chunkArray } from "../lib/firestore-helpers.js";

// Límites para prevenir queries costosos
const MAX_SEARCH_RESULTS = 50;
const MAX_DOCS_TO_SCAN = 200;

export async function globalSearch(req: AuthRequest, res: Response) {
  try {
    const { q, limit = "10" } = req.query;
    const userId = req.user!.userId;
    const searchLimit = Math.min(Number(limit) || 10, MAX_SEARCH_RESULTS);

    if (!q || typeof q !== "string" || q.trim().length < 2) {
      return res.json({
        transactions: [],
        categories: [],
        accounts: [],
        tags: []
      });
    }

    const searchTerm = q.trim().toLowerCase();

    // Búsqueda optimizada: traer transacciones sin orderBy para evitar índice compuesto
    const transactionsSnapshot = await db.collection("transactions")
      .where("userId", "==", userId)
      .limit(MAX_DOCS_TO_SCAN)
      .get();

    let transactions = transactionsSnapshot.docs
      .map(doc => docToObject(doc))
      .filter((tx: any) => {
        const desc = (tx.description || "").toLowerCase();
        return desc.includes(searchTerm);
      })
      .slice(0, searchLimit);

    // Búsquedas en paralelo para categorías, cuentas y tags (son colecciones pequeñas)
    const [categoriesSnapshot, accountsSnapshot, tagsSnapshot] = await Promise.all([
      db.collection("categories").where("userId", "==", userId).limit(100).get(),
      db.collection("accounts").where("userId", "==", userId).limit(50).get(),
      db.collection("tags").where("userId", "==", userId).limit(100).get()
    ]);

    const categories = categoriesSnapshot.docs
      .map(doc => docToObject(doc))
      .filter((cat: any) => cat.name.toLowerCase().includes(searchTerm))
      .slice(0, searchLimit);

    const accounts = accountsSnapshot.docs
      .map(doc => docToObject(doc))
      .filter((acc: any) => acc.name.toLowerCase().includes(searchTerm))
      .slice(0, searchLimit);

    const tags = tagsSnapshot.docs
      .map(doc => docToObject(doc))
      .filter((tag: any) => tag.name.toLowerCase().includes(searchTerm))
      .slice(0, searchLimit);

    // Cargar relaciones para transacciones
    const categoryIds = [...new Set(transactions.map((t: any) => t.categoryId).filter(Boolean))];
    const accountIds = [...new Set(transactions.map((t: any) => t.accountId))];
    const transactionIds = transactions.map((t: any) => t.id);

    // Cargar transactionTags con chunking
    let tagsForTxDocs: any[] = [];
    if (transactionIds.length > 0) {
      const transactionIdChunks = chunkArray(transactionIds, 10);
      const tagSnapshots = await Promise.all(
        transactionIdChunks.map(chunk =>
          db.collection("transactionTags").where("transactionId", "in", chunk).get()
        )
      );
      tagsForTxDocs = tagSnapshots.flatMap(snapshot => snapshot.docs);
    }

    const [categoriesForTx, accountsForTx] = await Promise.all([
      getDocumentsByIds("categories", categoryIds),
      getDocumentsByIds("accounts", accountIds)
    ]);

    const categoriesMap = new Map(categoriesForTx.map((c: any) => [c.id, c]));
    const accountsMap = new Map(accountsForTx.map((a: any) => [a.id, a]));

    // Cargar tags
    const tagIds = [...new Set(tagsForTxDocs.map(doc => doc.data().tagId))];
    const tagsForTx = await getDocumentsByIds("tags", tagIds);
    const tagsMap = new Map(tagsForTx.map((t: any) => [t.id, t]));

    const transactionTagsMap = new Map<string, any[]>();
    tagsForTxDocs.forEach(doc => {
      const data = doc.data();
      const txId = data.transactionId;
      if (!transactionTagsMap.has(txId)) {
        transactionTagsMap.set(txId, []);
      }
      const tag = tagsMap.get(data.tagId);
      if (tag) {
        transactionTagsMap.get(txId)!.push(tag);
      }
    });

    // Enriquecer transacciones
    const formattedTransactions = transactions.map((tx: any) => ({
      ...tx,
      category: tx.categoryId ? categoriesMap.get(tx.categoryId) || null : null,
      account: accountsMap.get(tx.accountId) || null,
      tags: transactionTagsMap.get(tx.id) || []
    }));

    res.json({
      transactions: formattedTransactions,
      categories,
      accounts,
      tags,
      query: searchTerm
    });
  } catch (error: any) {
    console.error("Search error:", error);
    res.status(500).json({ error: "Error en la búsqueda" });
  }
}

export async function searchSuggestions(req: AuthRequest, res: Response) {
  try {
    const { q } = req.query;
    const userId = req.user!.userId;

    if (!q || typeof q !== "string" || q.trim().length < 1) {
      return res.json({ suggestions: [] });
    }

    const searchTerm = q.trim().toLowerCase();

    const suggestions: any[] = [];

    // Sugerencias de categorías
    const categoriesSnapshot = await db.collection("categories")
      .where("userId", "==", userId)
      .limit(20)
      .get();

    const categories = categoriesSnapshot.docs
      .map(doc => docToObject(doc))
      .filter((cat: any) => cat.name.toLowerCase().includes(searchTerm))
      .slice(0, 5);

    categories.forEach((cat: any) => {
      suggestions.push({
        type: "category",
        id: cat.id,
        title: cat.name,
        subtitle: cat.type === "INCOME" ? "Ingreso" : "Gasto",
        icon: cat.icon || "📁"
      });
    });

    // Sugerencias de cuentas
    const accountsSnapshot = await db.collection("accounts")
      .where("userId", "==", userId)
      .limit(20)
      .get();

    const accounts = accountsSnapshot.docs
      .map(doc => docToObject(doc))
      .filter((acc: any) => acc.name.toLowerCase().includes(searchTerm))
      .slice(0, 5);

    accounts.forEach((acc: any) => {
      suggestions.push({
        type: "account",
        id: acc.id,
        title: acc.name,
        subtitle: acc.type,
        icon: "💳"
      });
    });

    // Sugerencias de tags
    const tagsSnapshot = await db.collection("tags")
      .where("userId", "==", userId)
      .limit(20)
      .get();

    const tags = tagsSnapshot.docs
      .map(doc => docToObject(doc))
      .filter((tag: any) => tag.name.toLowerCase().includes(searchTerm))
      .slice(0, 5);

    tags.forEach((tag: any) => {
      suggestions.push({
        type: "tag",
        id: tag.id,
        title: tag.name,
        subtitle: "Etiqueta",
        icon: "🏷️"
      });
    });

    // Sugerencias de descripciones comunes de transacciones
    const transactionsSnapshot = await db.collection("transactions")
      .where("userId", "==", userId)
      .limit(100)
      .get();

    const descriptions = new Set<string>();
    transactionsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.description && data.description.toLowerCase().includes(searchTerm)) {
        descriptions.add(data.description);
      }
    });

    Array.from(descriptions).slice(0, 5).forEach(desc => {
      suggestions.push({
        type: "description",
        id: desc,
        title: desc,
        subtitle: "Descripción común",
        icon: "📝"
      });
    });

    res.json({ suggestions: suggestions.slice(0, 10) });
  } catch (error: any) {
    console.error("Suggestions error:", error);
    res.status(500).json({ error: "Error en las sugerencias" });
  }
}
