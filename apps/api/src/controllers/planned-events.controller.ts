import { Response } from "express";
import { db } from "../lib/firebase.js";
import { AuthRequest } from "../server/middleware/auth.js";
import { Timestamp } from "firebase-admin/firestore";
import { docToObject, objectToFirestore } from "../lib/firestore-helpers.js";

/**
 * GET /planned-events
 * Lista todos los eventos planificados del usuario
 */
export async function listPlannedEvents(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const { month, year } = req.query;
    
    let query = db.collection("plannedEvents")
      .where("userId", "==", userId)
      .orderBy("scheduledDate", "asc");
    
    // Filtrar por mes/año si se proporciona
    if (month && year) {
      const monthNum = parseInt(month as string);
      const yearNum = parseInt(year as string);
      const startDate = new Date(Date.UTC(yearNum, monthNum - 1, 1));
      const endDate = new Date(Date.UTC(yearNum, monthNum, 0, 23, 59, 59));
      
      query = query
        .where("scheduledDate", ">=", Timestamp.fromDate(startDate))
        .where("scheduledDate", "<=", Timestamp.fromDate(endDate));
    }
    
    const snapshot = await query.get();
    const events = snapshot.docs.map(doc => docToObject(doc));
    
    res.json({ events });
  } catch (error: any) {
    console.error("Error listing planned events:", error);
    res.status(500).json({ error: "Error al listar eventos planificados" });
  }
}

/**
 * POST /planned-events
 * Crea un nuevo evento planificado
 */
export async function createPlannedEvent(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const { description, amountCents, currencyCode, type, scheduledDate, categoryId, accountId } = req.body;
    
    if (!description || !amountCents || !scheduledDate || !type) {
      return res.status(400).json({ error: "Faltan campos requeridos" });
    }
    
    const eventData = {
      userId,
      description,
      amountCents: Math.round(Number(amountCents)),
      currencyCode: currencyCode || "USD",
      type, // "INCOME" o "EXPENSE"
      scheduledDate: Timestamp.fromDate(new Date(scheduledDate)),
      categoryId: categoryId || null,
      accountId: accountId || null,
      isConfirmed: false,
      confirmedAt: null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    
    const docRef = await db.collection("plannedEvents").add(objectToFirestore(eventData));
    const event = docToObject(await docRef.get());
    
    res.status(201).json({ event });
  } catch (error: any) {
    console.error("Error creating planned event:", error);
    res.status(500).json({ error: "Error al crear evento planificado" });
  }
}

/**
 * PUT /planned-events/:id
 * Actualiza un evento planificado
 */
export async function updatePlannedEvent(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const { description, amountCents, currencyCode, scheduledDate, categoryId, accountId } = req.body;
    
    const eventDoc = await db.collection("plannedEvents").doc(id).get();
    if (!eventDoc.exists) {
      return res.status(404).json({ error: "Evento no encontrado" });
    }
    
    const eventData = eventDoc.data()!;
    if (eventData.userId !== userId) {
      return res.status(403).json({ error: "No autorizado" });
    }
    
    const updateData: any = {
      updatedAt: Timestamp.now()
    };
    
    if (description !== undefined) updateData.description = description;
    if (amountCents !== undefined) updateData.amountCents = Math.round(Number(amountCents));
    if (currencyCode !== undefined) updateData.currencyCode = currencyCode;
    if (scheduledDate !== undefined) updateData.scheduledDate = Timestamp.fromDate(new Date(scheduledDate));
    if (categoryId !== undefined) updateData.categoryId = categoryId;
    if (accountId !== undefined) updateData.accountId = accountId;
    
    await db.collection("plannedEvents").doc(id).update(objectToFirestore(updateData));
    const updatedEvent = docToObject(await db.collection("plannedEvents").doc(id).get());
    
    res.json({ event: updatedEvent });
  } catch (error: any) {
    console.error("Error updating planned event:", error);
    res.status(500).json({ error: "Error al actualizar evento planificado" });
  }
}

/**
 * POST /planned-events/:id/confirm
 * Confirma un evento planificado (lo convierte en transacción real)
 */
export async function confirmPlannedEvent(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const { confirmed, accountId } = req.body; // confirmed: true/false
    
    const eventDoc = await db.collection("plannedEvents").doc(id).get();
    if (!eventDoc.exists) {
      return res.status(404).json({ error: "Evento no encontrado" });
    }
    
    const eventData = eventDoc.data()!;
    if (eventData.userId !== userId) {
      return res.status(403).json({ error: "No autorizado" });
    }
    
    if (eventData.isConfirmed) {
      return res.status(400).json({ error: "El evento ya fue confirmado" });
    }
    
    const batch = db.batch();
    
    // Marcar evento como confirmado
    batch.update(db.collection("plannedEvents").doc(id), {
      isConfirmed: confirmed,
      confirmedAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    
    // Si se confirma, crear la transacción real
    if (confirmed) {
      const finalAccountId = accountId || eventData.accountId;
      if (!finalAccountId) {
        return res.status(400).json({ error: "Se requiere una cuenta para confirmar el evento" });
      }
      
      // Verificar que la cuenta existe
      const accountDoc = await db.collection("accounts").doc(finalAccountId).get();
      if (!accountDoc.exists || accountDoc.data()!.userId !== userId) {
        return res.status(400).json({ error: "Cuenta no válida" });
      }
      
      // Crear transacción
      const transactionRef = db.collection("transactions").doc();
      const transactionData = {
        userId,
        accountId: finalAccountId,
        categoryId: eventData.categoryId || null,
        type: eventData.type,
        amountCents: eventData.amountCents,
        currencyCode: eventData.currencyCode,
        occurredAt: eventData.scheduledDate,
        description: eventData.description,
        isRecurring: false,
        plannedEventId: id,
        createdAt: Timestamp.now()
      };
      batch.set(transactionRef, objectToFirestore(transactionData));
    }
    
    await batch.commit();
    
    const updatedEvent = docToObject(await db.collection("plannedEvents").doc(id).get());
    res.json({ event: updatedEvent, message: confirmed ? "Evento confirmado y transacción creada" : "Evento marcado como no realizado" });
  } catch (error: any) {
    console.error("Error confirming planned event:", error);
    res.status(500).json({ error: "Error al confirmar evento planificado" });
  }
}

/**
 * DELETE /planned-events/:id
 * Elimina un evento planificado
 */
export async function deletePlannedEvent(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    
    const eventDoc = await db.collection("plannedEvents").doc(id).get();
    if (!eventDoc.exists) {
      return res.status(404).json({ error: "Evento no encontrado" });
    }
    
    if (eventDoc.data()!.userId !== userId) {
      return res.status(403).json({ error: "No autorizado" });
    }
    
    await db.collection("plannedEvents").doc(id).delete();
    res.status(204).send();
  } catch (error: any) {
    console.error("Error deleting planned event:", error);
    res.status(500).json({ error: "Error al eliminar evento planificado" });
  }
}

