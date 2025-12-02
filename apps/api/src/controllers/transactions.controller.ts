import { Request, Response } from "express";
import { db } from "../lib/firebase.js";
import { TransactionSchema } from "@pf/shared";
import { AuthRequest } from "../server/middleware/auth.js";
import { objectToFirestore, docToObject, textSearch, getDocumentsByIds, chunkArray } from "../lib/firestore-helpers.js";
import { Timestamp } from "firebase-admin/firestore";

// Constantes de seguridad
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;

export async function listTransactions(req: AuthRequest, res: Response) {
  try {
    const {
      from,
      to,
      categoryId,
      accountId,
      type,
      tagId,
      minAmount,
      maxAmount,
      search,
      isRecurring,
      page = "1",
      pageSize = "50",
      sortBy = "occurredAt",
      sortOrder = "desc"
    } = req.query as any;

    // Obtener todas las transacciones del usuario y filtrar en memoria
    // Esto evita la necesidad de índices compuestos en Firebase
    const snapshot = await db.collection("transactions")
      .where("userId", "==", req.user!.userId)
      .get();

    let allTransactions = snapshot.docs.map(doc => docToObject(doc));

    // Filtros de fecha
    if (from) {
      const fromDate = new Date(from as string).getTime();
      allTransactions = allTransactions.filter((tx: any) => {
        const txDate = tx.occurredAt instanceof Date ? tx.occurredAt : new Date(tx.occurredAt);
        return txDate.getTime() >= fromDate;
      });
    }
    if (to) {
      const toDate = new Date(to as string).getTime();
      allTransactions = allTransactions.filter((tx: any) => {
        const txDate = tx.occurredAt instanceof Date ? tx.occurredAt : new Date(tx.occurredAt);
        return txDate.getTime() <= toDate;
      });
    }

    // Filtros básicos
    if (categoryId) {
      allTransactions = allTransactions.filter((tx: any) => tx.categoryId === String(categoryId));
    }
    if (accountId) {
      allTransactions = allTransactions.filter((tx: any) => tx.accountId === String(accountId));
    }
    if (type) {
      allTransactions = allTransactions.filter((tx: any) => tx.type === type);
    }
    if (isRecurring !== undefined) {
      const isRecurringBool = isRecurring === "true";
      allTransactions = allTransactions.filter((tx: any) => tx.isRecurring === isRecurringBool);
    }

    // Filtros de monto
    if (minAmount) {
      allTransactions = allTransactions.filter((tx: any) => tx.amountCents >= Number(minAmount));
    }
    if (maxAmount) {
      allTransactions = allTransactions.filter((tx: any) => tx.amountCents <= Number(maxAmount));
    }

    // Total después de filtros
    const total = allTransactions.length;

    // Ordenamiento en memoria
    const orderDirection = sortOrder === "asc" ? 1 : -1;
    const sortField = sortBy || "occurredAt";
    allTransactions.sort((a: any, b: any) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      
      // Manejar fechas
      if (sortField === "occurredAt" || sortField === "createdAt") {
        aVal = aVal instanceof Date ? aVal.getTime() : new Date(aVal).getTime();
        bVal = bVal instanceof Date ? bVal.getTime() : new Date(bVal).getTime();
      }
      
      if (aVal < bVal) return -1 * orderDirection;
      if (aVal > bVal) return 1 * orderDirection;
      return 0;
    });

    // Paginación con límite de seguridad
    const requestedPageSize = Math.min(Number(pageSize) || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const skip = (Math.max(1, Number(page)) - 1) * requestedPageSize;
    const take = requestedPageSize;

    // Aplicar paginación
    let transactions = allTransactions.slice(skip, skip + take);

    // Filtro por tag (post-procesamiento si no se puede hacer en query)
    if (tagId) {
      const transactionIds = new Set<string>();
      const tagRefs = await db.collection("transactionTags")
        .where("tagId", "==", String(tagId))
        .get();
      tagRefs.docs.forEach(doc => {
        transactionIds.add(doc.data().transactionId);
      });
      transactions = transactions.filter(tx => transactionIds.has(tx.id));
    }

    // Búsqueda de texto (post-procesamiento)
    if (search) {
      const searchLower = (search as string).toLowerCase();
      transactions = transactions.filter((tx: any) => {
        const desc = (tx.description || "").toLowerCase();
        return desc.includes(searchLower);
      });
    }

    // Cargar relaciones (category, account, tags)
    const categoryIds = [...new Set(transactions.map((t: any) => t.categoryId).filter(Boolean))];
    const accountIds = [...new Set(transactions.map((t: any) => t.accountId).filter(Boolean))];
    const transactionIds = transactions.map((t: any) => t.id);

    // Cargar transactionTags (usar chunking para respetar límite de 10)
    let tagsSnapshotDocs: any[] = [];
    if (transactionIds.length > 0) {
      const transactionIdChunks = chunkArray(transactionIds, 10);
      const tagSnapshots = await Promise.all(
        transactionIdChunks.map(chunk =>
          db.collection("transactionTags").where("transactionId", "in", chunk).get()
        )
      );
      tagsSnapshotDocs = tagSnapshots.flatMap(snapshot => snapshot.docs);
    }

    // Cargar categories, accounts y tags usando helper function (corrige __name__)
    const [categories, accounts] = await Promise.all([
      getDocumentsByIds("categories", categoryIds),
      getDocumentsByIds("accounts", accountIds)
    ]);

    const categoriesMap = new Map(categories.map(cat => [cat.id, cat]));
    const accountsMap = new Map(accounts.map(acc => [acc.id, acc]));
    
    // Cargar tags
    const tagIds = [...new Set(tagsSnapshotDocs.map(doc => doc.data().tagId))];
    const tags = await getDocumentsByIds("tags", tagIds);
    const tagsMap = new Map(tags.map(tag => [tag.id, tag]));
    
    const transactionTagsMap = new Map<string, any[]>();
    tagsSnapshotDocs.forEach(doc => {
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

    // Enriquecer transacciones con relaciones
    transactions = transactions.map((tx: any) => ({
      ...tx,
      category: tx.categoryId ? categoriesMap.get(tx.categoryId) || null : null,
      account: accountsMap.get(tx.accountId) || null,
      tags: transactionTagsMap.get(tx.id) || []
    }));

    res.json({ transactions, page: Number(page), pageSize: take, total });
  } catch (error: any) {
    console.error("List transactions error:", error);
    res.status(500).json({ error: error.message || "Error al listar transacciones" });
  }
}

export async function createTransaction(req: AuthRequest, res: Response) {
  try {
    const parsed = TransactionSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join(", ");
      return res.status(400).json({ error: `Error de validación: ${errors}` });
    }

    const { accountId, categoryId, type, amountCents, currencyCode, occurredAt, description, isRecurring, recurringRule, nextOccurrence } = parsed.data;
    const notificationSchedule = (req.body as any).notificationSchedule ? JSON.stringify((req.body as any).notificationSchedule) : null;
    const isPaid = (req.body as any).isPaid || false;
    const totalOccurrences = (req.body as any).totalOccurrences !== undefined ? (req.body as any).totalOccurrences : null;
    const remainingOccurrences = (req.body as any).remainingOccurrences !== undefined ? (req.body as any).remainingOccurrences : null;

    // Validar que amountCents sea positivo y entero
    if (amountCents <= 0) {
      return res.status(400).json({ error: "El importe debe ser mayor a 0" });
    }

    // Verificar que la categoría existe y pertenece al usuario (OBLIGATORIO)
    if (!categoryId) {
      return res.status(400).json({ error: "La categoría es obligatoria" });
    }
    const categoryDoc = await db.collection("categories").doc(categoryId).get();
    if (!categoryDoc.exists) {
      return res.status(400).json({ error: "Categoría no válida" });
    }
    const categoryData = categoryDoc.data()!;
    if (categoryData.userId !== req.user!.userId) {
      return res.status(400).json({ error: "Categoría no válida" });
    }

    // Verificar que la cuenta existe y pertenece al usuario
    const accountDoc = await db.collection("accounts").doc(accountId).get();
    if (!accountDoc.exists) {
      return res.status(400).json({ error: "Cuenta no válida" });
    }
    const accountData = accountDoc.data()!;
    if (accountData.userId !== req.user!.userId) {
      return res.status(400).json({ error: "Cuenta no válida" });
    }

    const transactionData = {
      userId: req.user!.userId,
      accountId,
      categoryId,
      type,
      amountCents: Math.round(Number(amountCents)),
      currencyCode: currencyCode || accountData.currencyCode,
      occurredAt: Timestamp.fromDate(new Date(occurredAt)),
      description: description || null,
      isRecurring: isRecurring || false,
      recurringRule: recurringRule || null,
      nextOccurrence: nextOccurrence ? Timestamp.fromDate(new Date(nextOccurrence)) : null,
      notificationSchedule: notificationSchedule || null,
      isPaid: isRecurring ? isPaid : false,
      totalOccurrences: isRecurring ? totalOccurrences : null,
      remainingOccurrences: isRecurring ? remainingOccurrences : null,
      createdAt: Timestamp.now()
    };

    // Si la transacción usa una subcategoría de "Deudas", preparar actualización atómica
    let debtRef: FirebaseFirestore.DocumentReference | null = null;
    let newPaidInstallments: number | null = null;
    
    if (categoryData.parentId && type === "EXPENSE") {
      try {
        const parentCategoryDoc = await db.collection("categories").doc(categoryData.parentId).get();
        if (parentCategoryDoc.exists) {
          const parentCategoryData = parentCategoryDoc.data()!;
          if (parentCategoryData.name === "Deudas") {
            // Buscar la deuda que corresponde a esta subcategoría (por nombre)
            const debtsSnapshot = await db.collection("debts")
              .where("userId", "==", req.user!.userId)
              .where("description", "==", categoryData.name)
              .limit(1)
              .get();

            if (!debtsSnapshot.empty) {
              const debtDoc = debtsSnapshot.docs[0];
              const debtData = debtDoc.data();
              if (debtData.paidInstallments < debtData.totalInstallments) {
                debtRef = db.collection("debts").doc(debtDoc.id);
                newPaidInstallments = Math.min(debtData.paidInstallments + 1, debtData.totalInstallments);
              }
            }
          }
        }
      } catch (error: any) {
        console.error("Error al buscar deuda para actualización:", error);
      }
    }

    // Usar batch write para atomicidad: crear transacción y actualizar deuda en una sola operación
    const batch = db.batch();
    const transactionRef = db.collection("transactions").doc();
    
    batch.set(transactionRef, objectToFirestore(transactionData));
    
    if (debtRef && newPaidInstallments !== null) {
      batch.update(debtRef, {
        paidInstallments: newPaidInstallments,
        updatedAt: Timestamp.now()
      });
    }
    
    await batch.commit();
    
    const tx = docToObject(await transactionRef.get());
    
    if (debtRef && newPaidInstallments !== null) {
      console.log(`Deuda actualizada atómicamente: ${newPaidInstallments}/${(await debtRef.get()).data()!.totalInstallments} cuotas pagadas`);
    }

    // Cargar relaciones para la respuesta
    const [category, account] = await Promise.all([
      db.collection("categories").doc(categoryId).get(),
      db.collection("accounts").doc(accountId).get()
    ]);

    const responseTx = {
      ...tx,
      category: category.exists ? docToObject(category) : null,
      account: account.exists ? docToObject(account) : null
    };

    res.status(201).json({ transaction: responseTx });
  } catch (error: any) {
    console.error("Create transaction error:", error);
    res.status(500).json({ error: error.message || "Error al crear transacción" });
  }
}

export async function updateTransaction(req: AuthRequest, res: Response) {
  try {
    const transactionId = req.params.id;
    const transactionDoc = await db.collection("transactions").doc(transactionId).get();

    if (!transactionDoc.exists) {
      return res.status(404).json({ error: "Transacción no encontrada" });
    }

    const transactionData = transactionDoc.data()!;
    if (transactionData.userId !== req.user!.userId) {
      return res.status(403).json({ error: "No autorizado" });
    }

    const parsed = TransactionSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join(", ");
      return res.status(400).json({ error: `Error de validación: ${errors}` });
    }

    const updateData: any = {};
    if (parsed.data.accountId !== undefined) updateData.accountId = parsed.data.accountId;
    if (parsed.data.categoryId !== undefined) updateData.categoryId = parsed.data.categoryId;
    if (parsed.data.type !== undefined) updateData.type = parsed.data.type;
    if (parsed.data.amountCents !== undefined) updateData.amountCents = Math.round(Number(parsed.data.amountCents));
    if (parsed.data.currencyCode !== undefined) updateData.currencyCode = parsed.data.currencyCode;
    if (parsed.data.occurredAt !== undefined) updateData.occurredAt = Timestamp.fromDate(new Date(parsed.data.occurredAt));
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description || null;
    if (parsed.data.isRecurring !== undefined) updateData.isRecurring = parsed.data.isRecurring;
    if (parsed.data.recurringRule !== undefined) updateData.recurringRule = parsed.data.recurringRule || null;
    if (parsed.data.nextOccurrence !== undefined) updateData.nextOccurrence = parsed.data.nextOccurrence ? Timestamp.fromDate(new Date(parsed.data.nextOccurrence)) : null;
    if ((req.body as any).notificationSchedule !== undefined) {
      updateData.notificationSchedule = (req.body as any).notificationSchedule ? JSON.stringify((req.body as any).notificationSchedule) : null;
    }
    if ((req.body as any).isPaid !== undefined) updateData.isPaid = (req.body as any).isPaid;
    if ((req.body as any).totalOccurrences !== undefined) updateData.totalOccurrences = (req.body as any).totalOccurrences;
    if ((req.body as any).remainingOccurrences !== undefined) updateData.remainingOccurrences = (req.body as any).remainingOccurrences;

    await db.collection("transactions").doc(transactionId).update(objectToFirestore(updateData));

    const updatedDoc = await db.collection("transactions").doc(transactionId).get();
    res.json({ transaction: docToObject(updatedDoc) });
  } catch (error: any) {
    console.error("Update transaction error:", error);
    res.status(500).json({ error: error.message || "Error al actualizar transacción" });
  }
}

export async function getTransaction(req: AuthRequest, res: Response) {
  try {
    const transactionId = req.params.id;
    const transactionDoc = await db.collection("transactions").doc(transactionId).get();

    if (!transactionDoc.exists) {
      return res.status(404).json({ error: "Transacción no encontrada" });
    }

    const transactionData = transactionDoc.data()!;
    if (transactionData.userId !== req.user!.userId) {
      return res.status(403).json({ error: "No autorizado" });
    }

    const transaction = docToObject(transactionDoc);
    
    // Enriquecer con datos relacionados
    if (transaction.accountId) {
      const accountDoc = await db.collection("accounts").doc(transaction.accountId).get();
      if (accountDoc.exists) {
        transaction.account = docToObject(accountDoc);
      }
    }
    
    if (transaction.categoryId) {
      const categoryDoc = await db.collection("categories").doc(transaction.categoryId).get();
      if (categoryDoc.exists) {
        transaction.category = docToObject(categoryDoc);
      }
    }
    
    if (transaction.tagIds && Array.isArray(transaction.tagIds) && transaction.tagIds.length > 0) {
      const tagDocs = await getDocumentsByIds(db.collection("tags"), transaction.tagIds);
      transaction.tags = tagDocs.map(doc => docToObject(doc));
    }

    res.json({ transaction });
  } catch (error: any) {
    console.error("Get transaction error:", error);
    res.status(500).json({ error: error.message || "Error al obtener transacción" });
  }
}

export async function deleteTransaction(req: AuthRequest, res: Response) {
  try {
    const transactionId = req.params.id;
    const transactionDoc = await db.collection("transactions").doc(transactionId).get();

    if (!transactionDoc.exists) {
      return res.status(404).json({ error: "Transacción no encontrada" });
    }

    const transactionData = transactionDoc.data()!;
    if (transactionData.userId !== req.user!.userId) {
      return res.status(403).json({ error: "No autorizado" });
    }

    // Eliminar tags asociados
    const tagsSnapshot = await db.collection("transactionTags")
      .where("transactionId", "==", transactionId)
      .get();
    
    const batch = db.batch();
    tagsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    batch.delete(db.collection("transactions").doc(transactionId));
    await batch.commit();

    res.status(204).send();
  } catch (error: any) {
    console.error("Delete transaction error:", error);
    res.status(500).json({ error: error.message || "Error al eliminar transacción" });
  }
}
