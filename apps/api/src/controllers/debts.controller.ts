import { Request, Response } from "express";
import { db } from "../lib/firebase.js";
import { AuthRequest } from "../server/middleware/auth.js";
import { monthAnchorUTC } from "../lib/time.js";
import { objectToFirestore, docToObject } from "../lib/firestore-helpers.js";
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

  // Crear categoría "Deudas"
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

export async function listDebts(req: AuthRequest, res: Response) {
  try {
    const { type } = req.query as any; // "CREDIT" | "OTHER" | undefined
    
    const snapshot = await db.collection("debts")
      .where("userId", "==", req.user!.userId)
      .get();

    // Filtrar y ordenar en memoria para evitar índice compuesto
    let debts = snapshot.docs
      .map(doc => docToObject(doc))
      .filter((debt: any) => {
        // Si se especifica un tipo, filtrar por él
        if (type && type !== "ALL") {
          const debtType = debt.debtType || "OTHER"; // Por defecto "OTHER" si no tiene tipo
          return debtType === type;
        }
        return true; // Si no se especifica tipo, mostrar todas
      })
      .sort((a: any, b: any) => {
        const dateA = a.startMonth ? new Date(a.startMonth).getTime() : 0;
        const dateB = b.startMonth ? new Date(b.startMonth).getTime() : 0;
        return dateA - dateB;
      });
    res.json({ debts });
  } catch (error: any) {
    console.error("List debts error:", error);
    res.status(500).json({ error: error.message || "Error al listar deudas" });
  }
}

export async function createDebt(req: AuthRequest, res: Response) {
  try {
    const { description, totalAmountCents, monthlyPaymentCents, totalInstallments, paidInstallments, startMonth, currencyCode } = req.body;

    console.log("Creating debt with data:", { description, totalAmountCents, monthlyPaymentCents, totalInstallments, paidInstallments, startMonth, currencyCode });

    if (!description || !totalAmountCents || !monthlyPaymentCents || !totalInstallments || !startMonth) {
      return res.status(400).json({ error: "Faltan campos requeridos" });
    }

    if (totalInstallments < 1) {
      return res.status(400).json({ error: "El total de cuotas debe ser al menos 1" });
    }

    if (paidInstallments < 0 || paidInstallments > totalInstallments) {
      return res.status(400).json({ error: "Las cuotas pagadas deben estar entre 0 y el total de cuotas" });
    }

    // Convertir startMonth a primer día del mes en UTC
    let year: number;
    let month: number;
    
    try {
      const dateStr = startMonth.includes('-') ? startMonth : `${startMonth}-01`;
      const parts = dateStr.split('-');
      if (parts.length < 2) {
        return res.status(400).json({ error: "Formato de fecha inválido. Use YYYY-MM o YYYY-MM-DD" });
      }
      year = Number(parts[0]);
      month = Number(parts[1]);
      
      if (isNaN(year) || isNaN(month)) {
        return res.status(400).json({ error: "Año o mes inválido" });
      }
      
      if (month < 1 || month > 12) {
        return res.status(400).json({ error: "Mes inválido. Debe estar entre 1 y 12." });
      }
      
      if (year < 1900 || year > 2100) {
        return res.status(400).json({ error: "Año inválido. Debe estar entre 1900 y 2100." });
      }
    } catch (error: any) {
      console.error("Error parsing startMonth:", error);
      return res.status(400).json({ error: "Error al procesar la fecha de inicio: " + (error?.message || "Formato inválido") });
    }
    
    let monthStart: Date;
    try {
      monthStart = monthAnchorUTC(year, month);
    } catch (error: any) {
      console.error("Error creating month anchor:", error);
      return res.status(400).json({ error: "Error al crear la fecha de inicio: " + (error?.message || "Fecha inválida") });
    }

    try {
      // Obtener o verificar si existe la categoría "Deudas"
      const debtsCategoryDoc = await getOrCreateDebtsCategory(req.user!.userId);
      const debtsCategoryId = debtsCategoryDoc.id;

      // Verificar si ya existe una subcategoría con este nombre
      const subcategorySnapshot = await db.collection("categories")
        .where("userId", "==", req.user!.userId)
        .where("name", "==", String(description))
        .where("type", "==", "EXPENSE")
        .where("parentId", "==", debtsCategoryId)
        .limit(1)
        .get();

      // Preparar datos para batch write atómico
      const debtData = {
        userId: req.user!.userId,
        description: String(description),
        totalAmountCents: Math.round(Number(totalAmountCents)),
        monthlyPaymentCents: Math.round(Number(monthlyPaymentCents)),
        totalInstallments: Number(totalInstallments),
        paidInstallments: Number(paidInstallments) || 0,
        startMonth: Timestamp.fromDate(monthStart),
        currencyCode: currencyCode || "USD",
        debtType: (req.body as any).debtType || "OTHER", // Por defecto "OTHER" si no se especifica
        accountId: (req.body as any).accountId || null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      // Usar batch write para atomicidad: crear deuda y subcategoría en una sola operación
      const batch = db.batch();
      const debtRef = db.collection("debts").doc();
      let subcategoryRef: FirebaseFirestore.DocumentReference | null = null;
      
      batch.set(debtRef, objectToFirestore(debtData));
      
      // Si no existe la subcategoría, crearla en el batch
      if (subcategorySnapshot.empty) {
        subcategoryRef = db.collection("categories").doc();
        const subcategoryData = {
          userId: req.user!.userId,
          name: String(description),
          type: "EXPENSE",
          parentId: debtsCategoryId,
          icon: "📋",
          color: "#c0392b",
          createdAt: Timestamp.now()
        };
        batch.set(subcategoryRef, objectToFirestore(subcategoryData));
      }
      
      // Commit atómico: todo o nada
      await batch.commit();
      
      const debt = docToObject(await debtRef.get());
      
      // Obtener la subcategoría (ya existía o se acaba de crear)
      let category;
      if (subcategoryRef) {
        category = docToObject(await subcategoryRef.get());
      } else {
        category = docToObject(subcategorySnapshot.docs[0]);
      }

      res.status(201).json({ debt, category });
    } catch (error: any) {
      console.error("Error creating debt:", error);
      console.error("Error stack:", error?.stack);
      return res.status(500).json({
        error: error?.message || "Error interno al crear la deuda. Verifica los datos e intenta nuevamente.",
        details: process.env.NODE_ENV === "development" ? error?.stack : undefined
      });
    }
  } catch (error: any) {
    console.error("Error in createDebt:", error);
    res.status(500).json({ error: error.message || "Error al crear deuda" });
  }
}

export async function updateDebt(req: AuthRequest, res: Response) {
  try {
    const { description, totalAmountCents, monthlyPaymentCents, totalInstallments, paidInstallments, startMonth, currencyCode } = req.body;
    const debtId = req.params.id;

    // Obtener la deuda actual
    const debtDoc = await db.collection("debts").doc(debtId).get();
    if (!debtDoc.exists) {
      return res.status(404).json({ error: "Deuda no encontrada" });
    }

    const currentDebt = docToObject(debtDoc);
    if (currentDebt.userId !== req.user!.userId) {
      return res.status(403).json({ error: "No autorizado" });
    }

    const updateData: any = { updatedAt: Timestamp.now() };

    if (description !== undefined) updateData.description = String(description);
    if (totalAmountCents !== undefined) updateData.totalAmountCents = Math.round(Number(totalAmountCents));
    if (monthlyPaymentCents !== undefined) updateData.monthlyPaymentCents = Math.round(Number(monthlyPaymentCents));
    if (totalInstallments !== undefined) {
      const total = Number(totalInstallments);
      if (total < 1) {
        return res.status(400).json({ error: "El total de cuotas debe ser al menos 1" });
      }
      updateData.totalInstallments = total;
    }
    if (paidInstallments !== undefined) {
      const paid = Number(paidInstallments);
      const maxInstallments = updateData.totalInstallments || currentDebt.totalInstallments;
      if (paid < 0 || paid > maxInstallments) {
        return res.status(400).json({ error: "Las cuotas pagadas deben estar entre 0 y el total de cuotas" });
      }
      updateData.paidInstallments = Math.min(paid, maxInstallments);
    }
    if (startMonth !== undefined) {
      try {
        const dateStr = startMonth.includes('-') ? startMonth : `${startMonth}-01`;
        const parts = dateStr.split('-');
        if (parts.length < 2) {
          return res.status(400).json({ error: "Formato de fecha inválido. Use YYYY-MM o YYYY-MM-DD" });
        }
        const year = Number(parts[0]);
        const month = Number(parts[1]);
        
        if (isNaN(year) || isNaN(month)) {
          return res.status(400).json({ error: "Año o mes inválido" });
        }
        
        if (month < 1 || month > 12) {
          return res.status(400).json({ error: "Mes inválido. Debe estar entre 1 y 12." });
        }
        
        if (year < 1900 || year > 2100) {
          return res.status(400).json({ error: "Año inválido. Debe estar entre 1900 y 2100." });
        }
        
        updateData.startMonth = Timestamp.fromDate(monthAnchorUTC(year, month));
      } catch (error: any) {
        console.error("Error parsing startMonth in update:", error);
        return res.status(400).json({ error: "Error al procesar la fecha de inicio" });
      }
    }
    if (currencyCode !== undefined) updateData.currencyCode = String(currencyCode);

    // Asegurar que paidInstallments no exceda totalInstallments
    if (updateData.paidInstallments !== undefined) {
      const maxInstallments = updateData.totalInstallments || currentDebt.totalInstallments;
      updateData.paidInstallments = Math.min(updateData.paidInstallments, maxInstallments);
    }

    await db.collection("debts").doc(debtId).update(objectToFirestore(updateData));

    // Si cambió la descripción, actualizar la categoría correspondiente
    if (description !== undefined && description !== currentDebt.description) {
      const debtsCategoryDoc = await getOrCreateDebtsCategory(req.user!.userId);
      const debtsCategoryId = debtsCategoryDoc.id;
      
      // Buscar la categoría existente con el nombre anterior
      const oldCategorySnapshot = await db.collection("categories")
        .where("userId", "==", req.user!.userId)
        .where("name", "==", currentDebt.description)
        .where("type", "==", "EXPENSE")
        .where("parentId", "==", debtsCategoryId)
        .limit(1)
        .get();

      if (!oldCategorySnapshot.empty) {
        // Actualizar el nombre de la categoría
        await db.collection("categories").doc(oldCategorySnapshot.docs[0].id).update({
          name: String(description)
        });
      } else {
        // Si no existe, crear una nueva
        const subcategoryData = {
          userId: req.user!.userId,
          name: String(description),
          type: "EXPENSE",
          parentId: debtsCategoryId,
          icon: "📋",
          color: "#c0392b",
          createdAt: Timestamp.now()
        };
        await db.collection("categories").add(objectToFirestore(subcategoryData));
      }
    }

    const updatedDebt = docToObject(await db.collection("debts").doc(debtId).get());
    res.json({ debt: updatedDebt });
  } catch (error: any) {
    console.error("Error updating debt:", error);
    res.status(500).json({ error: error.message || "Error al actualizar deuda" });
  }
}

export async function deleteDebt(req: AuthRequest, res: Response) {
  try {
    const debtId = req.params.id;

    // Obtener la deuda antes de eliminarla
    const debtDoc = await db.collection("debts").doc(debtId).get();
    if (!debtDoc.exists) {
      return res.status(404).json({ error: "Deuda no encontrada" });
    }

    const debt = docToObject(debtDoc);
    if (debt.userId !== req.user!.userId) {
      return res.status(403).json({ error: "No autorizado" });
    }

    // Buscar y eliminar la categoría asociada (subcategoría de "Deudas")
    const debtsCategorySnapshot = await db.collection("categories")
      .where("userId", "==", req.user!.userId)
      .where("name", "==", "Deudas")
      .where("type", "==", "EXPENSE")
      .where("parentId", "==", null)
      .limit(1)
      .get();

    if (!debtsCategorySnapshot.empty) {
      const debtsCategoryId = debtsCategorySnapshot.docs[0].id;
      const debtCategorySnapshot = await db.collection("categories")
        .where("userId", "==", req.user!.userId)
        .where("name", "==", debt.description)
        .where("type", "==", "EXPENSE")
        .where("parentId", "==", debtsCategoryId)
        .limit(1)
        .get();

      // Solo eliminar la categoría si no tiene transacciones asociadas
      if (!debtCategorySnapshot.empty) {
        const debtCategoryId = debtCategorySnapshot.docs[0].id;
        const transactionsSnapshot = await db.collection("transactions")
          .where("categoryId", "==", debtCategoryId)
          .limit(1)
          .get();

        if (transactionsSnapshot.empty) {
          await db.collection("categories").doc(debtCategoryId).delete();
        }
      }
    }

    await db.collection("debts").doc(debtId).delete();
    res.status(204).send();
  } catch (error: any) {
    console.error("Error deleting debt:", error);
    res.status(500).json({ error: error.message || "Error al eliminar deuda" });
  }
}

export async function markDebtAsPaid(req: AuthRequest, res: Response) {
  try {
    const { debtId, amountCents, accountId, occurredAt } = req.body;
    
    // 1. Validar que la deuda existe y pertenece al usuario
    const debtDoc = await db.collection("debts").doc(debtId).get();
    if (!debtDoc.exists) {
      return res.status(404).json({ error: "Deuda no encontrada" });
    }
    
    const debt = docToObject(debtDoc);
    if (debt.userId !== req.user!.userId) {
      return res.status(403).json({ error: "No autorizado" });
    }
    
    // 2. Validar que no esté completamente pagada
    if (debt.paidInstallments >= debt.totalInstallments) {
      return res.status(400).json({ error: "La deuda ya está completamente pagada" });
    }
    
    // 3. Obtener la categoría de la deuda (subcategoría de "Deudas")
    const debtsCategoryDoc = await getOrCreateDebtsCategory(req.user!.userId);
    const debtsCategoryId = debtsCategoryDoc.id;
    
    const subcategorySnapshot = await db.collection("categories")
      .where("userId", "==", req.user!.userId)
      .where("name", "==", debt.description)
      .where("type", "==", "EXPENSE")
      .where("parentId", "==", debtsCategoryId)
      .limit(1)
      .get();
    
    let categoryId: string;
    if (subcategorySnapshot.empty) {
      // Crear la subcategoría si no existe
      const subcategoryRef = db.collection("categories").doc();
      const subcategoryData = {
        userId: req.user!.userId,
        name: debt.description,
        type: "EXPENSE",
        parentId: debtsCategoryId,
        icon: "📋",
        color: "#c0392b",
        createdAt: Timestamp.now()
      };
      await db.collection("categories").doc(subcategoryRef.id).set(objectToFirestore(subcategoryData));
      categoryId = subcategoryRef.id;
    } else {
      categoryId = subcategorySnapshot.docs[0].id;
    }
    
    // 4. Validar cuenta (si no se proporciona, usar primera cuenta del usuario)
    let finalAccountId = accountId;
    if (!finalAccountId) {
      const accountsSnapshot = await db.collection("accounts")
        .where("userId", "==", req.user!.userId)
        .limit(1)
        .get();
      if (accountsSnapshot.empty) {
        return res.status(400).json({ error: "No hay cuentas disponibles" });
      }
      finalAccountId = accountsSnapshot.docs[0].id;
    } else {
      // Verificar que la cuenta existe y pertenece al usuario
      const accountDoc = await db.collection("accounts").doc(finalAccountId).get();
      if (!accountDoc.exists || accountDoc.data()!.userId !== req.user!.userId) {
        return res.status(400).json({ error: "Cuenta no válida" });
      }
    }
    
    // 5. Usar batch write para atomicidad
    const batch = db.batch();
    
    // 5a. Crear transacción
    const transactionRef = db.collection("transactions").doc();
    const finalAmountCents = amountCents || debt.monthlyPaymentCents;
    const finalOccurredAt = occurredAt ? Timestamp.fromDate(new Date(occurredAt)) : Timestamp.now();
    const transactionData = {
      userId: req.user!.userId,
      accountId: finalAccountId,
      categoryId: categoryId,
      type: "EXPENSE",
      amountCents: Math.round(Number(finalAmountCents)),
      currencyCode: debt.currencyCode,
      occurredAt: finalOccurredAt,
      description: `Pago de cuota - ${debt.description}`,
      debtId: debtId,
      isDebtPayment: true,
      createdAt: Timestamp.now()
    };
    batch.set(transactionRef, objectToFirestore(transactionData));
    
    // 5b. Actualizar deuda
    const debtRef = db.collection("debts").doc(debtId);
    batch.update(debtRef, {
      paidInstallments: debt.paidInstallments + 1,
      updatedAt: Timestamp.now()
    });
    
    // 6. Commit atómico
    await batch.commit();
    
    // 7. Obtener datos actualizados
    const updatedDebt = docToObject(await debtRef.get());
    const createdTransaction = docToObject(await transactionRef.get());
    
    res.json({ 
      debt: updatedDebt, 
      transaction: createdTransaction,
      message: "Pago registrado exitosamente"
    });
  } catch (error: any) {
    console.error("Error marking debt as paid:", error);
    res.status(500).json({ error: error.message || "Error al registrar el pago" });
  }
}

export async function getDebtStatistics(req: AuthRequest, res: Response) {
  try {
    const snapshot = await db.collection("debts")
      .where("userId", "==", req.user!.userId)
      .get();

    const debts = snapshot.docs.map(doc => docToObject(doc));

    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let totalMonthlyPayment = 0;
    let totalRemainingMonths = 0;
    let activeDebts = 0;
    let latestEndDate: Date | null = null;
    
    // Estadísticas de comportamiento
    let completedDebts = 0;
    let totalPaidInCompleted = 0;
    let totalTimeToComplete: number[] = [];
    let totalAmountCompleted = 0;
    let fastestDebt: { months: number; description: string } | null = null;
    let slowestDebt: { months: number; description: string } | null = null;
    
    // Para duración total promedio (promedio de totalInstallments de todas las deudas)
    let totalInstallmentsSum = 0;
    let totalDebtsCount = 0;

    debts.forEach((debt: any) => {
      const remainingInstallments = debt.totalInstallments - debt.paidInstallments;
      const isCompleted = debt.paidInstallments >= debt.totalInstallments;
      
      // Acumular para duración total promedio (todas las deudas)
      totalInstallmentsSum += debt.totalInstallments;
      totalDebtsCount++;
      
      if (!isCompleted && remainingInstallments > 0) {
        activeDebts++;
        totalMonthlyPayment += debt.monthlyPaymentCents;
        
        // Calcular cuándo termina esta deuda usando UTC correctamente
        const startDate = debt.startMonth instanceof Date ? debt.startMonth : new Date(debt.startMonth);
        const startYear = startDate.getUTCFullYear();
        const startMonthNum = startDate.getUTCMonth(); // 0-11
        
        // Calcular fecha de fin usando UTC (igual que en calculateDebtInfo del frontend)
        const endYear = startYear + Math.floor((startMonthNum + debt.totalInstallments - 1) / 12);
        const endMonth = (startMonthNum + debt.totalInstallments - 1) % 12;
        const endDate = new Date(Date.UTC(endYear, endMonth, 1));
        
        if (latestEndDate === null || endDate > latestEndDate) {
          latestEndDate = endDate;
        }
        
        // Calcular meses restantes desde hoy
        const monthsFromStart = Math.max(0,
          (currentMonth.getFullYear() - startDate.getFullYear()) * 12 +
          (currentMonth.getMonth() - startDate.getMonth())
        );
        const monthsRemaining = Math.max(0, remainingInstallments - (monthsFromStart - debt.paidInstallments));
        totalRemainingMonths += monthsRemaining;
      } else if (isCompleted) {
        // Estadísticas de deudas completadas
        completedDebts++;
        totalAmountCompleted += debt.totalAmountCents;
        totalPaidInCompleted += debt.totalAmountCents;
        
        // Calcular tiempo que tomó completar
        const startDate = debt.startMonth instanceof Date ? debt.startMonth : new Date(debt.startMonth);
        const startYear = startDate.getUTCFullYear();
        const startMonthNum = startDate.getUTCMonth();
        
        // Calcular fecha de finalización (última cuota)
        const endYear = startYear + Math.floor((startMonthNum + debt.totalInstallments - 1) / 12);
        const endMonth = (startMonthNum + debt.totalInstallments - 1) % 12;
        const endDate = new Date(Date.UTC(endYear, endMonth, 1));
        
        const monthsToComplete = Math.max(1, 
          (endYear - startYear) * 12 + (endMonth - startMonthNum) + 1
        );
        totalTimeToComplete.push(monthsToComplete);
        
        // Rastrear deuda más rápida y más lenta
        if (fastestDebt === null || monthsToComplete < fastestDebt.months) {
          fastestDebt = { months: monthsToComplete, description: debt.description };
        }
        if (slowestDebt === null || monthsToComplete > slowestDebt.months) {
          slowestDebt = { months: monthsToComplete, description: debt.description };
        }
      }
    });

    const averageDuration = activeDebts > 0 ? totalRemainingMonths / activeDebts : 0;
    const averageTotalDuration = totalDebtsCount > 0 ? totalInstallmentsSum / totalDebtsCount : 0; // Promedio de totalInstallments de todas las deudas
    const averageTimeToComplete = totalTimeToComplete.length > 0
      ? totalTimeToComplete.reduce((a, b) => a + b, 0) / totalTimeToComplete.length
      : 0;
    const completionRate = debts.length > 0
      ? (completedDebts / debts.length) * 100
      : 0;
    
    // Calcular rango de cuotas más común en deudas completadas
    const installmentsCounts = new Map<number, number>();
    debts.forEach((debt: any) => {
      if (debt.paidInstallments >= debt.totalInstallments) {
        const count = installmentsCounts.get(debt.totalInstallments) || 0;
        installmentsCounts.set(debt.totalInstallments, count + 1);
      }
    });
    let mostCommonInstallments = 0;
    let maxCount = 0;
    installmentsCounts.forEach((count, installments) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommonInstallments = installments;
      }
    });

    const latestEndDateISO: string | null = (latestEndDate !== null) 
      ? (latestEndDate as Date).toISOString() 
      : null;

    res.json({
      // Estadísticas existentes
      totalMonthlyPayment,
      averageDuration: Math.round(averageDuration * 10) / 10,
      averageTotalDuration: Math.round(averageTotalDuration * 10) / 10, // Duración total promedio (promedio de totalInstallments)
      activeDebts,
      latestEndDate: latestEndDateISO,
      totalDebts: debts.length,
      
      // Nuevas estadísticas de comportamiento
      completedDebts,
      totalAmountCompleted,
      averageTimeToComplete: Math.round(averageTimeToComplete * 10) / 10,
      completionRate: Math.round(completionRate * 10) / 10,
      mostCommonInstallments,
      fastestDebt,
      slowestDebt
    });
  } catch (error: any) {
    console.error("Error getting debt statistics:", error);
    res.status(500).json({ error: error.message || "Error al obtener estadísticas de deudas" });
  }
}
