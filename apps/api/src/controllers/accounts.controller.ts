import { Request, Response } from "express";
import { db } from "../lib/firebase.js";
import { AccountSchema } from "@pf/shared";
import { AuthRequest } from "../server/middleware/auth.js";
import { objectToFirestore, docToObject } from "../lib/firestore-helpers.js";
import { Timestamp } from "firebase-admin/firestore";
import { touchUserData } from "../lib/cache.js";

export async function listAccounts(req: AuthRequest, res: Response) {
  try {
    const snapshot = await db.collection("accounts")
      .where("userId", "==", req.user!.userId)
      .get();

    const accounts = snapshot.docs.map(doc => docToObject(doc));
    res.json({ accounts });
  } catch (error: any) {
    console.error("List accounts error:", error);
    res.status(500).json({ error: error.message || "Error al listar cuentas" });
  }
}

export async function createAccount(req: AuthRequest, res: Response) {
  try {
    const parsed = AccountSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join(", ");
      return res.status(400).json({ error: `Error de validación: ${errors}` });
    }

    const { name, type, currencyCode } = parsed.data;

    const accountData = {
      userId: req.user!.userId,
      name,
      type,
      currencyCode,
      createdAt: Timestamp.now()
    };

    const docRef = await db.collection("accounts").add(objectToFirestore(accountData));
    const account = { id: docRef.id, ...accountData };
    void touchUserData(req.user!.userId);

    res.status(201).json({ account: docToObject(await docRef.get()) });
  } catch (error: any) {
    console.error("Create account error:", error);
    res.status(500).json({ error: error.message || "Error al crear cuenta" });
  }
}

export async function updateAccount(req: AuthRequest, res: Response) {
  try {
    const { name } = req.body || {};
    const accountId = req.params.id;

    // Verificar que la cuenta pertenece al usuario
    const accountDoc = await db.collection("accounts").doc(accountId).get();
    if (!accountDoc.exists) {
      return res.status(404).json({ error: "Cuenta no encontrada" });
    }

    const accountData = accountDoc.data()!;
    if (accountData.userId !== req.user!.userId) {
      return res.status(403).json({ error: "No autorizado" });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;

    await db.collection("accounts").doc(accountId).update(objectToFirestore(updateData));
    void touchUserData(req.user!.userId);

    const updatedDoc = await db.collection("accounts").doc(accountId).get();
    res.json({ account: docToObject(updatedDoc) });
  } catch (error: any) {
    console.error("Update account error:", error);
    res.status(500).json({ error: error.message || "Error al actualizar cuenta" });
  }
}

export async function deleteAccount(req: AuthRequest, res: Response) {
  try {
    const accountId = req.params.id;

    // Verificar que la cuenta pertenece al usuario
    const accountDoc = await db.collection("accounts").doc(accountId).get();
    if (!accountDoc.exists) {
      return res.status(404).json({ error: "Cuenta no encontrada" });
    }

    const accountData = accountDoc.data()!;
    if (accountData.userId !== req.user!.userId) {
      return res.status(403).json({ error: "No autorizado" });
    }

    // Verificar si tiene transacciones (opcional: podrías bloquear o pedir migración)
    const transactionsSnapshot = await db.collection("transactions")
      .where("accountId", "==", accountId)
      .limit(1)
      .get();

    if (!transactionsSnapshot.empty) {
      // Por ahora permitimos borrar, pero podrías retornar error aquí
      // return res.status(400).json({ error: "No se puede eliminar una cuenta con transacciones" });
    }

    await db.collection("accounts").doc(accountId).delete();
    void touchUserData(req.user!.userId);
    res.status(204).send();
  } catch (error: any) {
    console.error("Delete account error:", error);
    res.status(500).json({ error: error.message || "Error al eliminar cuenta" });
  }
}
