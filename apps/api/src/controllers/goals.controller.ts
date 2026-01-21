import { Request, Response } from "express";
import { db } from "../lib/firebase.js";
import { monthAnchorUTC } from "../lib/time.js";
import { AuthRequest } from "../server/middleware/auth.js";
import { objectToFirestore, docToObject } from "../lib/firestore-helpers.js";
import { Timestamp } from "firebase-admin/firestore";
import { touchUserData } from "../lib/cache.js";

export async function upsertGoal(req: AuthRequest, res: Response) {
  try {
    const year = Number(req.params.year);
    const month = Number(req.params.month);
    const { savingGoalCents } = req.body || {};
    const monthDate = monthAnchorUTC(year, month);

    // Buscar goal existente
    const goalsSnapshot = await db.collection("monthlyGoals")
      .where("userId", "==", req.user!.userId)
      .where("month", "==", Timestamp.fromDate(monthDate))
      .limit(1)
      .get();

    let goal;
    if (!goalsSnapshot.empty) {
      // Actualizar existente
      const goalDoc = goalsSnapshot.docs[0];
      await db.collection("monthlyGoals").doc(goalDoc.id).update({
        savingGoalCents: Number(savingGoalCents || 0)
      });
      goal = docToObject(await db.collection("monthlyGoals").doc(goalDoc.id).get());
    } else {
      // Crear nuevo
      const goalData = {
        userId: req.user!.userId,
        month: Timestamp.fromDate(monthDate),
        savingGoalCents: Number(savingGoalCents || 0),
        createdAt: Timestamp.now()
      };
      const docRef = await db.collection("monthlyGoals").add(objectToFirestore(goalData));
      goal = docToObject(await docRef.get());
    }

    void touchUserData(req.user!.userId);
    res.json({ goal });
  } catch (error: any) {
    console.error("Upsert goal error:", error);
    res.status(500).json({ error: error.message || "Error al guardar meta" });
  }
}

export async function getGoal(req: AuthRequest, res: Response) {
  try {
    const year = Number(req.params.year);
    const month = Number(req.params.month);
    const monthDate = monthAnchorUTC(year, month);

    const goalsSnapshot = await db.collection("monthlyGoals")
      .where("userId", "==", req.user!.userId)
      .where("month", "==", Timestamp.fromDate(monthDate))
      .limit(1)
      .get();

    if (goalsSnapshot.empty) {
      return res.json({ goal: null });
    }

    const goal = docToObject(goalsSnapshot.docs[0]);
    res.json({ goal });
  } catch (error: any) {
    console.error("Get goal error:", error);
    res.status(500).json({ error: error.message || "Error al obtener meta" });
  }
}

export async function getGoalByQuery(req: AuthRequest, res: Response) {
  try {
    const year = Number(req.query.year);
    const month = Number(req.query.month);
    
    if (!year || !month) {
      return res.status(400).json({ error: "year y month son requeridos" });
    }

    const monthDate = monthAnchorUTC(year, month);

    const goalsSnapshot = await db.collection("monthlyGoals")
      .where("userId", "==", req.user!.userId)
      .where("month", "==", Timestamp.fromDate(monthDate))
      .limit(1)
      .get();

    if (goalsSnapshot.empty) {
      return res.json({ goal: null });
    }

    const goal = docToObject(goalsSnapshot.docs[0]);
    res.json({ goal });
  } catch (error: any) {
    console.error("Get goal by query error:", error);
    res.status(500).json({ error: error.message || "Error al obtener meta" });
  }
}
