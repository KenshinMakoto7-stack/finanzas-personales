import { Response } from "express";
import { db } from "../lib/firebase.js";
import { AuthRequest } from "../server/middleware/auth.js";
import { z } from "zod";
import { objectToFirestore, docToObject } from "../lib/firestore-helpers.js";
import { Timestamp } from "firebase-admin/firestore";

const TagSchema = z.object({
  name: z.string().min(1),
  color: z.string().optional().default("#667eea")
});

export async function listTags(req: AuthRequest, res: Response) {
  try {
    const snapshot = await db.collection("tags")
      .where("userId", "==", req.user!.userId)
      .orderBy("name", "asc")
      .get();

    const tags = snapshot.docs.map(doc => docToObject(doc));

    // Contar transacciones por tag
    const tagsWithCount = await Promise.all(
      tags.map(async (tag: any) => {
        const transactionTagsSnapshot = await db.collection("transactionTags")
          .where("tagId", "==", tag.id)
          .count()
          .get();
        
        const transactionCount = transactionTagsSnapshot.data().count;
        return {
          ...tag,
          transactionCount
        };
      })
    );

    res.json({ tags: tagsWithCount });
  } catch (error: any) {
    console.error("List tags error:", error);
    res.status(500).json({ error: error.message || "Error al listar tags" });
  }
}

export async function createTag(req: AuthRequest, res: Response) {
  try {
    const parsed = TagSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join(", ");
      return res.status(400).json({ error: `Error de validación: ${errors}` });
    }

    const { name, color } = parsed.data;
    const userId = req.user!.userId;

    // Verificar que no exista un tag con el mismo nombre para este usuario
    const existingSnapshot = await db.collection("tags")
      .where("userId", "==", userId)
      .where("name", "==", name)
      .limit(1)
      .get();

    if (!existingSnapshot.empty) {
      return res.status(409).json({ error: "Ya existe un tag con este nombre" });
    }

    const tagData = {
      userId,
      name,
      color: color || "#667eea",
      createdAt: Timestamp.now()
    };

    const docRef = await db.collection("tags").add(objectToFirestore(tagData));
    const tag = docToObject(await docRef.get());

    res.status(201).json({ tag });
  } catch (error: any) {
    console.error("Create tag error:", error);
    res.status(500).json({ error: error.message || "Error al crear tag" });
  }
}

export async function updateTag(req: AuthRequest, res: Response) {
  try {
    const { name, color } = req.body;
    const userId = req.user!.userId;
    const tagId = req.params.id;

    // Verificar que el tag existe y pertenece al usuario
    const tagDoc = await db.collection("tags").doc(tagId).get();
    if (!tagDoc.exists) {
      return res.status(404).json({ error: "Tag no encontrado" });
    }

    const tagData = tagDoc.data()!;
    if (tagData.userId !== userId) {
      return res.status(403).json({ error: "No autorizado" });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (color !== undefined) updateData.color = color;

    await db.collection("tags").doc(tagId).update(objectToFirestore(updateData));

    const updatedTag = docToObject(await db.collection("tags").doc(tagId).get());
    res.json({ tag: updatedTag });
  } catch (error: any) {
    console.error("Update tag error:", error);
    res.status(500).json({ error: error.message || "Error al actualizar tag" });
  }
}

export async function deleteTag(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const tagId = req.params.id;

    // Verificar que el tag existe y pertenece al usuario
    const tagDoc = await db.collection("tags").doc(tagId).get();
    if (!tagDoc.exists) {
      return res.status(404).json({ error: "Tag no encontrado" });
    }

    const tagData = tagDoc.data()!;
    if (tagData.userId !== userId) {
      return res.status(403).json({ error: "No autorizado" });
    }

    // Eliminar todas las relaciones transactionTags
    const transactionTagsSnapshot = await db.collection("transactionTags")
      .where("tagId", "==", tagId)
      .get();

    const batch = db.batch();
    transactionTagsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    batch.delete(db.collection("tags").doc(tagId));
    await batch.commit();

    res.status(204).send();
  } catch (error: any) {
    console.error("Delete tag error:", error);
    res.status(500).json({ error: error.message || "Error al eliminar tag" });
  }
}

export async function addTagToTransaction(req: AuthRequest, res: Response) {
  try {
    const { transactionId, tagId } = req.body;
    const userId = req.user!.userId;

    // Verificar que la transacción pertenece al usuario
    const transactionDoc = await db.collection("transactions").doc(transactionId).get();
    if (!transactionDoc.exists) {
      return res.status(404).json({ error: "Transacción no encontrada" });
    }

    const transactionData = transactionDoc.data()!;
    if (transactionData.userId !== userId) {
      return res.status(403).json({ error: "No autorizado" });
    }

    // Verificar que el tag pertenece al usuario
    const tagDoc = await db.collection("tags").doc(tagId).get();
    if (!tagDoc.exists) {
      return res.status(404).json({ error: "Tag no encontrado" });
    }

    const tagData = tagDoc.data()!;
    if (tagData.userId !== userId) {
      return res.status(403).json({ error: "No autorizado" });
    }

    // Verificar que no existe ya la relación
    const existingSnapshot = await db.collection("transactionTags")
      .where("transactionId", "==", transactionId)
      .where("tagId", "==", tagId)
      .limit(1)
      .get();

    if (!existingSnapshot.empty) {
      const existing = docToObject(existingSnapshot.docs[0]);
      const tag = docToObject(tagDoc);
      return res.json({ transactionTag: { ...existing, tag } });
    }

    // Crear relación
    const transactionTagData = {
      transactionId,
      tagId,
      createdAt: Timestamp.now()
    };

    const docRef = await db.collection("transactionTags").add(objectToFirestore(transactionTagData));
    const transactionTag = docToObject(await docRef.get());
    const tag = docToObject(tagDoc);

    res.status(201).json({ transactionTag: { ...transactionTag, tag } });
  } catch (error: any) {
    console.error("Add tag to transaction error:", error);
    res.status(500).json({ error: error.message || "Error al agregar tag a transacción" });
  }
}

export async function removeTagFromTransaction(req: AuthRequest, res: Response) {
  try {
    const { transactionId, tagId } = req.params;
    const userId = req.user!.userId;

    // Verificar que la transacción pertenece al usuario
    const transactionDoc = await db.collection("transactions").doc(transactionId).get();
    if (!transactionDoc.exists) {
      return res.status(404).json({ error: "Transacción no encontrada" });
    }

    const transactionData = transactionDoc.data()!;
    if (transactionData.userId !== userId) {
      return res.status(403).json({ error: "No autorizado" });
    }

    // Eliminar relación
    const transactionTagsSnapshot = await db.collection("transactionTags")
      .where("transactionId", "==", transactionId)
      .where("tagId", "==", tagId)
      .get();

    const batch = db.batch();
    transactionTagsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    res.status(204).send();
  } catch (error: any) {
    console.error("Remove tag from transaction error:", error);
    res.status(500).json({ error: error.message || "Error al remover tag de transacción" });
  }
}
