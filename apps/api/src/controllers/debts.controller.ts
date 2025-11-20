import { Request, Response } from "express";
import { prisma } from "../lib/db.js";
import { AuthRequest } from "../server/middleware/auth.js";
import { monthAnchorUTC } from "../lib/time.js";

// Función auxiliar para obtener o crear la categoría "Deudas"
async function getOrCreateDebtsCategory(userId: string) {
  let debtsCategory = await prisma.category.findFirst({
    where: {
      userId,
      name: "Deudas",
      type: "EXPENSE",
      parentId: null
    }
  });

  if (!debtsCategory) {
    debtsCategory = await prisma.category.create({
      data: {
        userId,
        name: "Deudas",
        type: "EXPENSE",
        parentId: null,
        icon: "💳",
        color: "#e74c3c"
      }
    });
  }

  return debtsCategory;
}

export async function listDebts(req: AuthRequest, res: Response) {
  const debts = await prisma.debt.findMany({
    where: { userId: req.user!.userId },
    orderBy: { startMonth: "asc" }
  });
  res.json({ debts });
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
    // startMonth viene como "YYYY-MM-DD" (ej: "2024-01-01")
    // Parsear directamente el año y mes para evitar problemas de zona horaria
    let year: number;
    let month: number;
    
    try {
      const dateStr = startMonth.includes('-') ? startMonth : `${startMonth}-01`;
      const parts = dateStr.split('-');
      if (parts.length < 2) {
        return res.status(400).json({ error: "Formato de fecha inválido. Use YYYY-MM o YYYY-MM-DD" });
      }
      year = Number(parts[0]);
      month = Number(parts[1]); // Mes viene como 1-12 (enero = 1, diciembre = 12)
      
      // Validar que el año y mes sean números válidos
      if (isNaN(year) || isNaN(month)) {
        return res.status(400).json({ error: "Año o mes inválido" });
      }
      
      // Validar que el mes esté en rango válido
      if (month < 1 || month > 12) {
        return res.status(400).json({ error: "Mes inválido. Debe estar entre 1 y 12." });
      }
      
      // Validar que el año sea razonable
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

    // Obtener o crear la categoría "Deudas"
    const debtsCategory = await getOrCreateDebtsCategory(req.user!.userId);

    // Verificar si ya existe una subcategoría con este nombre
    let debtSubcategory = await prisma.category.findFirst({
      where: {
        userId: req.user!.userId,
        name: String(description),
        type: "EXPENSE",
        parentId: debtsCategory.id
      }
    });

    // Si no existe, crearla
    if (!debtSubcategory) {
      debtSubcategory = await prisma.category.create({
        data: {
          userId: req.user!.userId,
          name: String(description),
          type: "EXPENSE",
          parentId: debtsCategory.id,
          icon: "📋",
          color: "#c0392b"
        }
      });
    }

    const debt = await prisma.debt.create({
      data: {
        userId: req.user!.userId,
        description: String(description),
        totalAmountCents: Math.round(Number(totalAmountCents)),
        monthlyPaymentCents: Math.round(Number(monthlyPaymentCents)),
        totalInstallments: Number(totalInstallments),
        paidInstallments: Number(paidInstallments) || 0,
        startMonth: monthStart,
        currencyCode: currencyCode || "USD"
      }
    });

    res.status(201).json({ debt, category: debtSubcategory });
  } catch (error: any) {
    console.error("Error creating debt:", error);
    console.error("Error stack:", error?.stack);
    return res.status(500).json({ 
      error: error?.message || "Error interno al crear la deuda. Verifica los datos e intenta nuevamente.",
      details: process.env.NODE_ENV === "development" ? error?.stack : undefined
    });
  }
}

export async function updateDebt(req: AuthRequest, res: Response) {
  const { description, totalAmountCents, monthlyPaymentCents, totalInstallments, paidInstallments, startMonth, currencyCode } = req.body;

  // Obtener la deuda actual para verificar si cambió el nombre
  const currentDebt = await prisma.debt.findUnique({ 
    where: { id: req.params.id, userId: req.user!.userId } 
  });

  if (!currentDebt) {
    return res.status(404).json({ error: "Deuda no encontrada" });
  }

  const updateData: any = {};

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
    // Asegurar que no se exceda el total de cuotas
    updateData.paidInstallments = Math.min(paid, maxInstallments);
  }
  if (startMonth !== undefined) {
    try {
      // Parsear directamente el año y mes para evitar problemas de zona horaria
      const dateStr = startMonth.includes('-') ? startMonth : `${startMonth}-01`;
      const parts = dateStr.split('-');
      if (parts.length < 2) {
        return res.status(400).json({ error: "Formato de fecha inválido. Use YYYY-MM o YYYY-MM-DD" });
      }
      const year = Number(parts[0]);
      const month = Number(parts[1]); // Mes viene como 1-12 (enero = 1, diciembre = 12)
      
      // Validar que el año y mes sean números válidos
      if (isNaN(year) || isNaN(month)) {
        return res.status(400).json({ error: "Año o mes inválido" });
      }
      
      // Validar que el mes esté en rango válido
      if (month < 1 || month > 12) {
        return res.status(400).json({ error: "Mes inválido. Debe estar entre 1 y 12." });
      }
      
      // Validar que el año sea razonable
      if (year < 1900 || year > 2100) {
        return res.status(400).json({ error: "Año inválido. Debe estar entre 1900 y 2100." });
      }
      
      updateData.startMonth = monthAnchorUTC(year, month);
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

  try {
    const debt = await prisma.debt.update({
      where: { id: req.params.id, userId: req.user!.userId },
      data: updateData
    });

    // Verificar si la deuda se completó automáticamente
    const finalDebt = await prisma.debt.findUnique({
      where: { id: req.params.id, userId: req.user!.userId }
    });

    // Si se completó (paidInstallments >= totalInstallments), asegurar que esté marcada correctamente
    if (finalDebt && finalDebt.paidInstallments >= finalDebt.totalInstallments) {
      // Ya está completada, no necesitamos hacer nada más
      // La lógica de visualización en el frontend se encargará de mostrarla como completada
    }

    // Si cambió la descripción, actualizar la categoría correspondiente
    if (description !== undefined && description !== currentDebt.description) {
      const debtsCategory = await getOrCreateDebtsCategory(req.user!.userId);
      
      // Buscar la categoría existente con el nombre anterior
      const oldCategory = await prisma.category.findFirst({
        where: {
          userId: req.user!.userId,
          name: currentDebt.description,
          type: "EXPENSE",
          parentId: debtsCategory.id
        }
      });

      if (oldCategory) {
        // Actualizar el nombre de la categoría
        await prisma.category.update({
          where: { id: oldCategory.id },
          data: { name: String(description) }
        });
      } else {
        // Si no existe, crear una nueva
        await prisma.category.create({
          data: {
            userId: req.user!.userId,
            name: String(description),
            type: "EXPENSE",
            parentId: debtsCategory.id,
            icon: "📋",
            color: "#c0392b"
          }
        });
      }
    }

    res.json({ debt });
  } catch (error: any) {
    console.error("Error updating debt:", error);
    return res.status(500).json({ error: error?.message || "Error interno al actualizar la deuda" });
  }
}

export async function deleteDebt(req: AuthRequest, res: Response) {
  // Obtener la deuda antes de eliminarla para poder eliminar la categoría asociada
  const debt = await prisma.debt.findUnique({
    where: { id: req.params.id, userId: req.user!.userId }
  });

  if (debt) {
    // Buscar y eliminar la categoría asociada (subcategoría de "Deudas")
    const debtsCategory = await prisma.category.findFirst({
      where: {
        userId: req.user!.userId,
        name: "Deudas",
        type: "EXPENSE",
        parentId: null
      }
    });

    if (debtsCategory) {
      const debtCategory = await prisma.category.findFirst({
        where: {
          userId: req.user!.userId,
          name: debt.description,
          type: "EXPENSE",
          parentId: debtsCategory.id
        }
      });

      // Solo eliminar la categoría si no tiene transacciones asociadas
      if (debtCategory) {
        const transactionCount = await prisma.transaction.count({
          where: { categoryId: debtCategory.id }
        });

        if (transactionCount === 0) {
          await prisma.category.delete({ where: { id: debtCategory.id } });
        }
      }
    }
  }

  await prisma.debt.delete({ where: { id: req.params.id, userId: req.user!.userId } });
  res.status(204).send();
}

export async function getDebtStatistics(req: AuthRequest, res: Response) {
  const debts = await prisma.debt.findMany({
    where: { userId: req.user!.userId }
  });

  const now = new Date();
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  let totalMonthlyPayment = 0;
  let totalRemainingMonths = 0;
  let activeDebts = 0;
  let latestEndDate: Date | null = null;

  debts.forEach(debt => {
    const remainingInstallments = debt.totalInstallments - debt.paidInstallments;
    const isCompleted = debt.paidInstallments >= debt.totalInstallments;
    
    if (!isCompleted && remainingInstallments > 0) {
      activeDebts++;
      totalMonthlyPayment += debt.monthlyPaymentCents;
      
      // Calcular cuándo termina esta deuda
      const startDate = new Date(debt.startMonth);
      const endMonth = new Date(startDate);
      endMonth.setMonth(endMonth.getMonth() + debt.totalInstallments - 1);
      
      if (!latestEndDate || endMonth > latestEndDate) {
        latestEndDate = endMonth;
      }
      
      // Calcular meses restantes desde hoy
      const monthsFromStart = Math.max(0, 
        (currentMonth.getFullYear() - startDate.getFullYear()) * 12 + 
        (currentMonth.getMonth() - startDate.getMonth())
      );
      const monthsRemaining = Math.max(0, remainingInstallments - (monthsFromStart - debt.paidInstallments));
      totalRemainingMonths += monthsRemaining;
    }
  });

  const averageDuration = activeDebts > 0 ? totalRemainingMonths / activeDebts : 0;

  res.json({
    totalMonthlyPayment,
    averageDuration: Math.round(averageDuration * 10) / 10,
    activeDebts,
    latestEndDate: latestEndDate?.toISOString() || null,
    totalDebts: debts.length
  });
}
