import { Request, Response } from "express";
import { db } from "../lib/firebase.js";
import { CategorySchema } from "@pf/shared";
import { AuthRequest } from "../server/middleware/auth.js";
import { objectToFirestore, docToObject } from "../lib/firestore-helpers.js";
import { Timestamp } from "firebase-admin/firestore";

export async function listCategories(req: AuthRequest, res: Response) {
  try {
    const type = (req.query.type as string) || undefined;
    const tree = (req.query.tree as string) === "true";

    let query: FirebaseFirestore.Query = db.collection("categories")
      .where("userId", "==", req.user!.userId);

    if (type) {
      query = query.where("type", "==", type);
    }

    // Solo ordenar si no hay filtro por tipo (evita necesidad de índice compuesto)
    if (!type) {
      query = query.orderBy("createdAt", "asc");
    }

    const snapshot = await query.get();
    
    // Si hay filtro por tipo, ordenar en memoria
    let rows = snapshot.docs.map(doc => docToObject(doc));
    if (type) {
      rows = rows.sort((a: any, b: any) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateA - dateB;
      });
    }
    if (tree) {
      // Devolver en formato árbol (solo raíces con sus hijos)
      const roots = rows.filter((c: any) => !c.parentId);
      const buildTree = (category: any): any => {
        return {
          ...category,
          subcategories: rows
            .filter((c: any) => c.parentId === category.id)
            .map(buildTree)
        };
      };
      const treeData = roots.map(buildTree);
      return res.json({ categories: treeData, flat: rows });
    }

    res.json({ categories: rows });
  } catch (error: any) {
    console.error("List categories error:", error);
    res.status(500).json({ error: error.message || "Error al listar categorías" });
  }
}

export async function createCategory(req: AuthRequest, res: Response) {
  try {
    const parsed = CategorySchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join(", ");
      return res.status(400).json({ error: `Error de validación: ${errors}` });
    }

    const { name, type, parentId, icon, color } = parsed.data;

    // Validar que parentId existe y pertenece al usuario (si se proporciona)
    if (parentId) {
      const parentDoc = await db.collection("categories").doc(parentId).get();
      if (!parentDoc.exists) {
        return res.status(400).json({ error: "Categoría padre no encontrada" });
      }
      const parentData = parentDoc.data()!;
      if (parentData.userId !== req.user!.userId) {
        return res.status(403).json({ error: "Categoría padre no pertenece al usuario" });
      }
    }

    const categoryData = {
      userId: req.user!.userId,
      name,
      type,
      parentId: parentId || null,
      icon: icon || null,
      color: color || null,
      createdAt: Timestamp.now()
    };

    const docRef = await db.collection("categories").add(objectToFirestore(categoryData));
    res.status(201).json({ category: docToObject(await docRef.get()) });
  } catch (error: any) {
    console.error("Create category error:", error);
    res.status(500).json({ error: error.message || "Error al crear categoría" });
  }
}

export async function updateCategory(req: AuthRequest, res: Response) {
  try {
    const { name, parentId, icon, color } = req.body || {};
    const categoryId = req.params.id;

    // Verificar que la categoría existe y pertenece al usuario
    const categoryDoc = await db.collection("categories").doc(categoryId).get();
    if (!categoryDoc.exists) {
      return res.status(404).json({ error: "Categoría no encontrada" });
    }

    const categoryData = categoryDoc.data()!;
    if (categoryData.userId !== req.user!.userId) {
      return res.status(403).json({ error: "No autorizado" });
    }

    // Validar que parentId no sea la misma categoría (evitar auto-referencia)
    if (parentId === categoryId) {
      return res.status(400).json({ error: "Una categoría no puede ser su propia padre" });
    }

    // Validar que parentId no sea un descendiente (evitar ciclos)
    if (parentId) {
      const MAX_DEPTH = 10; // Prevenir loops infinitos
      const checkDescendant = async (catId: string, targetId: string, depth = 0): Promise<boolean> => {
        if (depth > MAX_DEPTH) return false; // Límite de profundidad alcanzado
        
        const childrenSnapshot = await db.collection("categories")
          .where("parentId", "==", catId)
          .get();
        
        for (const childDoc of childrenSnapshot.docs) {
          if (childDoc.id === targetId) return true;
          if (await checkDescendant(childDoc.id, targetId, depth + 1)) return true;
        }
        return false;
      };

      if (await checkDescendant(categoryId, parentId)) {
        return res.status(400).json({ error: "No se puede mover una categoría dentro de sus propias subcategorías" });
      }

      // Verificar que el nuevo parent existe y pertenece al usuario
      const newParentDoc = await db.collection("categories").doc(parentId).get();
      if (!newParentDoc.exists) {
        return res.status(400).json({ error: "Categoría padre no encontrada" });
      }
      const newParentData = newParentDoc.data()!;
      if (newParentData.userId !== req.user!.userId) {
        return res.status(403).json({ error: "Categoría padre no pertenece al usuario" });
      }
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (parentId !== undefined) updateData.parentId = parentId || null;
    if (icon !== undefined) updateData.icon = icon || null;
    if (color !== undefined) updateData.color = color || null;

    await db.collection("categories").doc(categoryId).update(objectToFirestore(updateData));

    const updatedDoc = await db.collection("categories").doc(categoryId).get();
    res.json({ category: docToObject(updatedDoc) });
  } catch (error: any) {
    console.error("Update category error:", error);
    res.status(500).json({ error: error.message || "Error al actualizar categoría" });
  }
}

export async function deleteCategory(req: AuthRequest, res: Response) {
  try {
    const categoryId = req.params.id;

    // Verificar que la categoría existe y pertenece al usuario
    const categoryDoc = await db.collection("categories").doc(categoryId).get();
    if (!categoryDoc.exists) {
      return res.status(404).json({ error: "Categoría no encontrada" });
    }

    const categoryData = categoryDoc.data()!;
    if (categoryData.userId !== req.user!.userId) {
      return res.status(403).json({ error: "No autorizado" });
    }

    // Verificar si tiene subcategorías
    const subcategoriesSnapshot = await db.collection("categories")
      .where("parentId", "==", categoryId)
      .limit(1)
      .get();

    if (!subcategoriesSnapshot.empty) {
      return res.status(400).json({ error: "No se puede eliminar una categoría con subcategorías" });
    }

    // Verificar si tiene transacciones
    const transactionsSnapshot = await db.collection("transactions")
      .where("categoryId", "==", categoryId)
      .limit(1)
      .get();

    if (!transactionsSnapshot.empty) {
      return res.status(400).json({ error: "No se puede eliminar una categoría con transacciones" });
    }

    await db.collection("categories").doc(categoryId).delete();
    res.status(204).send();
  } catch (error: any) {
    console.error("Delete category error:", error);
    res.status(500).json({ error: error.message || "Error al eliminar categoría" });
  }
}
