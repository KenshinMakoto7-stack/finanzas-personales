import { Request, Response } from "express";
import { db } from "../lib/firebase.js";
import { TransactionSchema } from "@pf/shared";
import { AuthRequest } from "../server/middleware/auth.js";
import { objectToFirestore, docToObject, textSearch, getDocumentsByIds, chunkArray } from "../lib/firestore-helpers.js";
import { Timestamp } from "firebase-admin/firestore";

// Función auxiliar para obtener o crear la categoría "Deudas"
async function getOrCreateDebtsCategory(userId: string) {
  const debtsSnapshot = await db.collection("categories")
    .where("userId", "==", userId)
    .where("name", "==", "Deudas")
    .where("type", "==", "EXPENSE")
    .where("parentId", "==", null)
    .limit(1)
    .get();

  if (!debtsSnapshot.empty) {
    return debtsSnapshot.docs[0];
  }

  const categoryData = {
    userId,
    name: "Deudas",
    type: "EXPENSE",
    parentId: null,
    icon: "💳",
    color: "#e74c3c",
    createdAt: Timestamp.now()
  };

  const docRef = await db.collection("categories").add(objectToFirestore(categoryData));
  return await docRef.get();
}

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

    const userId = req.user!.userId;

    const buildDateRange = () => {
      let fromDateUTC: Date | undefined;
      let toDateUTC: Date | undefined;

      if (from) {
        const fromStr = from as string;
        const fromDateStr = fromStr.includes("T") ? fromStr : `${fromStr}T00:00:00.000Z`;
        const fromDate = new Date(fromDateStr);
        fromDateUTC = new Date(Date.UTC(
          fromDate.getUTCFullYear(),
          fromDate.getUTCMonth(),
          fromDate.getUTCDate(),
          0, 0, 0, 0
        ));
      }

      if (to) {
        const toStr = to as string;
        const toDateStr = toStr.includes("T") ? toStr : `${toStr}T23:59:59.999Z`;
        const toDate = new Date(toDateStr);
        toDateUTC = new Date(Date.UTC(
          toDate.getUTCFullYear(),
          toDate.getUTCMonth(),
          toDate.getUTCDate(),
          23, 59, 59, 999
        ));
      }

      return { fromDateUTC, toDateUTC };
    };

    const { fromDateUTC, toDateUTC } = buildDateRange();

    const loadTransactionsFast = async () => {
      if (!fromDateUTC && !toDateUTC) {
        return null;
      }

      let query = db.collection("transactions").where("userId", "==", userId);
      if (fromDateUTC) query = query.where("occurredAt", ">=", Timestamp.fromDate(fromDateUTC));
      if (toDateUTC) query = query.where("occurredAt", "<=", Timestamp.fromDate(toDateUTC));

      const isRecurringBool = isRecurring !== undefined ? isRecurring === "true" : undefined;
      const primaryFilter = accountId
        ? { field: "accountId", value: String(accountId) }
        : categoryId
        ? { field: "categoryId", value: String(categoryId) }
        : type
        ? { field: "type", value: type }
        : isRecurringBool !== undefined
        ? { field: "isRecurring", value: isRecurringBool }
        : null;

      if (primaryFilter) {
        query = query.where(primaryFilter.field, "==", primaryFilter.value);
      }

      const order = sortOrder === "asc" ? "asc" : "desc";
      const snapshot = await query.orderBy("occurredAt", order).get();
      return snapshot;
    };

    let snapshot = null;
    try {
      snapshot = await loadTransactionsFast();
    } catch (error: any) {
      const message = String(error?.message || "");
      if (!message.includes("index") && !message.includes("INDEX")) {
        throw error;
      }
    }

    if (!snapshot) {
      snapshot = await db.collection("transactions")
        .where("userId", "==", userId)
        .get();
    }

    let allTransactions = snapshot.docs.map(doc => docToObject(doc));

    // Filtros de fecha
    if (fromDateUTC) {
      const fromTime = fromDateUTC.getTime();
      
      allTransactions = allTransactions.filter((tx: any) => {
        const txDate = tx.occurredAt instanceof Date ? tx.occurredAt : new Date(tx.occurredAt);
        // Comparar el timestamp real de la transacción con el inicio del día
        return txDate.getTime() >= fromTime;
      });
    }
    if (toDateUTC) {
      const toTime = toDateUTC.getTime();
      
      allTransactions = allTransactions.filter((tx: any) => {
        const txDate = tx.occurredAt instanceof Date ? tx.occurredAt : new Date(tx.occurredAt);
        // Comparar el timestamp real de la transacción (no normalizado) con el límite del día
        // Esto permite incluir todas las transacciones del día hasta 23:59:59.999
        return txDate.getTime() <= toTime;
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
    const categoryIds = [...new Set(transactions.map((t: any) => t.categoryId).filter(Boolean))] as string[];
    const accountIds = [...new Set(transactions.map((t: any) => t.accountId).filter(Boolean))] as string[];
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
    const tagIds = [...new Set(tagsSnapshotDocs.map(doc => doc.data().tagId))] as string[];
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
    const toAccountId = (parsed.data as any).toAccountId;
    const notificationSchedule = (req.body as any).notificationSchedule ? JSON.stringify((req.body as any).notificationSchedule) : null;
    const isPaid = (req.body as any).isPaid || false;
    const totalOccurrences = (req.body as any).totalOccurrences !== undefined ? (req.body as any).totalOccurrences : null;
    const remainingOccurrences = (req.body as any).remainingOccurrences !== undefined ? (req.body as any).remainingOccurrences : null;

    // Validar que amountCents sea positivo y entero
    if (amountCents <= 0) {
      return res.status(400).json({ error: "El importe debe ser mayor a 0" });
    }

    // Para transferencias, la categoría es opcional
    let categoryData: any = null;
    if (type === "TRANSFER") {
      // Para transferencias, usar categoría opcional o crear una por defecto
      if (categoryId) {
        const categoryDoc = await db.collection("categories").doc(categoryId).get();
        if (categoryDoc.exists) {
          categoryData = categoryDoc.data()!;
          if (categoryData.userId !== req.user!.userId) {
            return res.status(400).json({ error: "Categoría no válida" });
          }
        }
      }
    } else {
      // Para INCOME y EXPENSE, la categoría es obligatoria
      if (!categoryId) {
        return res.status(400).json({ error: "La categoría es obligatoria" });
      }
      const categoryDoc = await db.collection("categories").doc(categoryId).get();
      if (!categoryDoc.exists) {
        return res.status(400).json({ error: "Categoría no válida" });
      }
      categoryData = categoryDoc.data()!;
      if (categoryData.userId !== req.user!.userId) {
        return res.status(400).json({ error: "Categoría no válida" });
      }
    }

    // Verificar que la cuenta origen existe y pertenece al usuario
    const accountDoc = await db.collection("accounts").doc(accountId).get();
    if (!accountDoc.exists) {
      return res.status(400).json({ error: "Cuenta origen no válida" });
    }
    const accountData = accountDoc.data()!;
    if (accountData.userId !== req.user!.userId) {
      return res.status(400).json({ error: "Cuenta origen no válida" });
    }

    // Para transferencias, verificar cuenta destino
    let toAccountData: any = null;
    if (type === "TRANSFER") {
      if (!toAccountId) {
        return res.status(400).json({ error: "La cuenta destino es obligatoria para transferencias" });
      }
      if (toAccountId === accountId) {
        return res.status(400).json({ error: "La cuenta origen y destino no pueden ser la misma" });
      }
      const toAccountDoc = await db.collection("accounts").doc(toAccountId).get();
      if (!toAccountDoc.exists) {
        return res.status(400).json({ error: "Cuenta destino no válida" });
      }
      toAccountData = toAccountDoc.data()!;
      if (toAccountData.userId !== req.user!.userId) {
        return res.status(400).json({ error: "Cuenta destino no válida" });
      }
    }

    // Detectar si es cuenta de crédito y si viene información de cuotas (solo para EXPENSE, no TRANSFER)
    const installments = (req.body as any).installments;
    const totalAmountCents = (req.body as any).totalAmountCents;
    const isCreditAccount = accountData.type === "CREDIT";
    let shouldCreateDebt = type === "EXPENSE" && isCreditAccount && installments && installments > 1 && totalAmountCents;

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
      installments: shouldCreateDebt ? installments : undefined,
      totalAmountCents: shouldCreateDebt ? Math.round(Number(totalAmountCents)) : undefined,
      createdAt: Timestamp.now()
    };

    // Si la transacción usa una subcategoría de "Deudas", preparar actualización atómica
    let debtRef: FirebaseFirestore.DocumentReference | null = null;
    let newPaidInstallments: number | null = null;
    
    // Intentar obtener debtId del payload (opcional)
    const debtIdFromPayload = (req.body as any).debtId;
    
    if (debtIdFromPayload && type === "EXPENSE") {
      // Si viene debtId en el payload, usarlo directamente
      try {
        const debtDoc = await db.collection("debts").doc(debtIdFromPayload).get();
        if (debtDoc.exists) {
          const debtData = debtDoc.data()!;
          if (debtData.userId === req.user!.userId) {
            if (debtData.paidInstallments < debtData.totalInstallments) {
              debtRef = db.collection("debts").doc(debtIdFromPayload);
              newPaidInstallments = Math.min(debtData.paidInstallments + 1, debtData.totalInstallments);
            }
          }
        }
      } catch (error: any) {
        console.error("Error al buscar deuda por ID:", error);
      }
    } else if (categoryData && categoryData.parentId && type === "EXPENSE") {
      // Si no viene debtId, mantener comportamiento actual: buscar por nombre de subcategoría
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

    // Si es cuenta CREDIT con cuotas, preparar creación de deuda automática
    let newDebtRef: FirebaseFirestore.DocumentReference | null = null;
    let newDebtId: string | null = null;
    let debtCategoryId: string | null = null;
    let debtDescription: string | null = null;
    let monthlyPaymentCents: number | null = null;
    let subcategoryRef: FirebaseFirestore.DocumentReference | null = null;
    
    if (shouldCreateDebt) {
      try {
        // Obtener o crear categoría "Deudas"
        const debtsCategoryDoc = await getOrCreateDebtsCategory(req.user!.userId);
        debtCategoryId = debtsCategoryDoc.id;
        
        // Preparar descripción de la deuda
        debtDescription = description || `Gasto en ${accountData.name}`;
        
        // Verificar si ya existe una subcategoría con este nombre
        const subcategorySnapshot = await db.collection("categories")
          .where("userId", "==", req.user!.userId)
          .where("name", "==", debtDescription)
          .where("type", "==", "EXPENSE")
          .where("parentId", "==", debtCategoryId)
          .limit(1)
          .get();
        
        // Calcular cuota mensual
        monthlyPaymentCents = Math.round(Number(totalAmountCents) / installments);
        
        // Preparar referencia de deuda
        newDebtRef = db.collection("debts").doc();
        newDebtId = newDebtRef.id;
        
        // Si no existe la subcategoría, preparar su creación
        if (subcategorySnapshot.empty) {
          subcategoryRef = db.collection("categories").doc();
        }
      } catch (error: any) {
        console.error("Error al preparar deuda automática:", error);
        // Continuar sin crear deuda si hay error
        shouldCreateDebt = false;
      }
    }

    // Usar batch write para atomicidad: crear transacción(es), deuda (si aplica) y actualizar deuda existente (si aplica) en una sola operación
    const batch = db.batch();
    let transactionRef: FirebaseFirestore.DocumentReference;
    let fromTransactionRef: FirebaseFirestore.DocumentReference | null = null;
    let toTransactionRef: FirebaseFirestore.DocumentReference | null = null;
    
    // Si es transferencia, crear dos transacciones atómicamente
    if (type === "TRANSFER") {
      // Transacción EXPENSE desde cuenta origen
      fromTransactionRef = db.collection("transactions").doc();
      const transferId = fromTransactionRef.id;
      const fromTransactionData = {
        userId: req.user!.userId,
        accountId,
        categoryId: categoryId || null,
        type: "EXPENSE",
        amountCents: Math.round(Number(amountCents)),
        currencyCode: currencyCode || accountData.currencyCode,
        occurredAt: Timestamp.fromDate(new Date(occurredAt)),
        description: description || `Transferencia a ${toAccountData.name}`,
        transferToAccountId: toAccountId,
        transferId: transferId, // ID de la transacción origen para vincular
        createdAt: Timestamp.now()
      };
      batch.set(fromTransactionRef, objectToFirestore(fromTransactionData));
      
      // Transacción INCOME a cuenta destino
      toTransactionRef = db.collection("transactions").doc();
      const toTransactionData = {
        userId: req.user!.userId,
        accountId: toAccountId,
        categoryId: categoryId || null,
        type: "INCOME",
        amountCents: Math.round(Number(amountCents)),
        currencyCode: currencyCode || toAccountData.currencyCode,
        occurredAt: Timestamp.fromDate(new Date(occurredAt)),
        description: description || `Transferencia desde ${accountData.name}`,
        transferFromAccountId: accountId,
        transferId: transferId, // Mismo ID para vincular ambas transacciones
        createdAt: Timestamp.now()
      };
      batch.set(toTransactionRef, objectToFirestore(toTransactionData));
      
      // Usar la transacción origen como referencia principal
      transactionRef = fromTransactionRef;
    } else {
      // Para INCOME y EXPENSE, crear una sola transacción
      transactionRef = db.collection("transactions").doc();
      
      // Actualizar transactionData con debtId si se crea deuda o si viene del payload
      if (shouldCreateDebt && newDebtId) {
        (transactionData as any).debtId = newDebtId;
      } else if (debtIdFromPayload && debtRef) {
        (transactionData as any).debtId = debtIdFromPayload;
      }
      
      batch.set(transactionRef, objectToFirestore(transactionData));
    }
    
    // Si se debe crear una nueva deuda
    if (shouldCreateDebt && newDebtRef && newDebtId && debtDescription && monthlyPaymentCents && debtCategoryId) {
      // Preparar datos de la deuda
      const monthStart = new Date(occurredAt);
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      
      const debtData = {
        userId: req.user!.userId,
        description: debtDescription,
        totalAmountCents: Math.round(Number(totalAmountCents)),
        monthlyPaymentCents: monthlyPaymentCents,
        totalInstallments: Number(installments),
        paidInstallments: 0,
        startMonth: Timestamp.fromDate(monthStart),
        currencyCode: currencyCode || accountData.currencyCode,
        debtType: "CREDIT",
        accountId: accountId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };
      
      batch.set(newDebtRef, objectToFirestore(debtData));
      
      // Crear subcategoría si no existe
      if (subcategoryRef) {
        const subcategoryData = {
          userId: req.user!.userId,
          name: debtDescription,
          type: "EXPENSE",
          parentId: debtCategoryId,
          icon: "💳",
          color: "#c0392b",
          createdAt: Timestamp.now()
        };
        batch.set(subcategoryRef, objectToFirestore(subcategoryData));
      }
      
      // Crear transacciones recurrentes mensuales para cada cuota
      const baseDate = new Date(occurredAt);
      for (let i = 0; i < installments; i++) {
        const occurrenceDate = new Date(baseDate);
        occurrenceDate.setMonth(occurrenceDate.getMonth() + i);
        
        const recurringTransactionRef = db.collection("transactions").doc();
        const recurringCategoryId = subcategoryRef ? subcategoryRef.id : categoryId;
        const recurringTransactionData = {
          userId: req.user!.userId,
          accountId: accountId,
          categoryId: recurringCategoryId,
          type: "EXPENSE",
          amountCents: monthlyPaymentCents,
          currencyCode: currencyCode || accountData.currencyCode,
          occurredAt: Timestamp.fromDate(occurrenceDate),
          description: `${debtDescription} - Cuota ${i + 1}/${installments}`,
          isRecurring: true,
          recurringRule: JSON.stringify({ type: "monthly" }),
          nextOccurrence: i < installments - 1 ? Timestamp.fromDate(new Date(occurrenceDate.getTime() + 30 * 24 * 60 * 60 * 1000)) : null,
          isPaid: false,
          totalOccurrences: installments,
          remainingOccurrences: installments - i - 1,
          debtId: newDebtId,
          createdAt: Timestamp.now()
        };
        batch.set(recurringTransactionRef, objectToFirestore(recurringTransactionData));
      }
    }
    
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
    if (type === "TRANSFER" && fromTransactionRef && toTransactionRef) {
      // Para transferencias, cargar ambas transacciones y sus relaciones
      const [fromTxDoc, toTxDoc, fromAccountDoc, toAccountDoc] = await Promise.all([
        fromTransactionRef.get(),
        toTransactionRef.get(),
        db.collection("accounts").doc(accountId).get(),
        db.collection("accounts").doc(toAccountId!).get()
      ]);
      
      const fromTx = docToObject(fromTxDoc);
      const toTx = docToObject(toTxDoc);
      
      let categoryDoc: FirebaseFirestore.DocumentSnapshot | null = null;
      if (categoryId) {
        categoryDoc = await db.collection("categories").doc(categoryId).get();
      }
      
      const responseTx = {
        ...fromTx,
        category: categoryDoc && categoryDoc.exists ? docToObject(categoryDoc) : null,
        account: fromAccountDoc.exists ? docToObject(fromAccountDoc) : null,
        transferTo: {
          ...toTx,
          account: toAccountDoc.exists ? docToObject(toAccountDoc) : null
        }
      };
      
      return res.status(201).json({ transaction: responseTx });
    } else {
      // Para INCOME y EXPENSE, cargar relaciones normales
      const promises: Promise<FirebaseFirestore.DocumentSnapshot>[] = [
        db.collection("accounts").doc(accountId).get()
      ];
      
      if (categoryId) {
        promises.push(db.collection("categories").doc(categoryId).get());
      }
      
      const results = await Promise.all(promises);
      const account = results[0];
      const category = categoryId ? results[1] : null;

      const responseTx = {
        ...tx,
        category: category && category.exists ? docToObject(category) : null,
        account: account.exists ? docToObject(account) : null
      };
      
      return res.status(201).json({ transaction: responseTx });
    }
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
      transaction.tags = await getDocumentsByIds("tags", transaction.tagIds);
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
