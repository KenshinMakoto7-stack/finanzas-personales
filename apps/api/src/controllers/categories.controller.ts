import { Request, Response } from "express";
import { prisma } from "../lib/db.js";
import { CategorySchema } from "@pf/shared";
import { AuthRequest } from "../server/middleware/auth.js";

export async function listCategories(req: AuthRequest, res: Response) {
  const type = (req.query.type as string) || undefined;
  const tree = (req.query.tree as string) === "true";
  
  const rows = await prisma.category.findMany({
    where: { userId: req.user!.userId, ...(type ? { type: type as any } : {}) },
    include: { subcategories: true },
    orderBy: { createdAt: "asc" }
  });

  if (tree) {
    // Devolver en formato árbol (solo raíces con sus hijos)
    const roots = rows.filter(c => !c.parentId);
    const buildTree = (category: any) => {
      return {
        ...category,
        subcategories: rows
          .filter(c => c.parentId === category.id)
          .map(buildTree)
      };
    };
    const treeData = roots.map(buildTree);
    return res.json({ categories: treeData, flat: rows });
  }

  res.json({ categories: rows });
}

export async function createCategory(req: AuthRequest, res: Response) {
  const parsed = CategorySchema.safeParse(req.body);
  if (!parsed.success) {
    // Formatear errores de Zod de manera legible
    const errors = parsed.error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join(", ");
    return res.status(400).json({ error: `Error de validación: ${errors}` });
  }
  const { name, type, parentId, icon, color } = parsed.data;
  const cat = await prisma.category.create({ 
    data: { 
      userId: req.user!.userId, 
      name, 
      type, 
      parentId: parentId ?? null,
      icon: icon ?? null,
      color: color ?? null
    }
  });
  res.status(201).json({ category: cat });
}

export async function updateCategory(req: AuthRequest, res: Response) {
  const { name, parentId, icon, color } = req.body || {};
  
  // Validar que parentId no sea la misma categoría (evitar auto-referencia)
  if (parentId === req.params.id) {
    return res.status(400).json({ error: "Una categoría no puede ser su propia padre" });
  }
  
  // Validar que parentId no sea un descendiente (evitar ciclos)
  if (parentId) {
    const current = await prisma.category.findUnique({ where: { id: req.params.id } });
    if (current) {
      const checkDescendant = async (catId: string, targetId: string): Promise<boolean> => {
        const children = await prisma.category.findMany({ where: { parentId: catId } });
        for (const child of children) {
          if (child.id === targetId) return true;
          if (await checkDescendant(child.id, targetId)) return true;
        }
        return false;
      };
      if (await checkDescendant(req.params.id, parentId)) {
        return res.status(400).json({ error: "No se puede mover una categoría dentro de sus propias subcategorías" });
      }
    }
  }
  
  const cat = await prisma.category.update({ 
    where: { id: req.params.id, userId: req.user!.userId }, 
    data: { 
      name: name || undefined,
      parentId: parentId !== undefined ? (parentId && parentId.trim() !== "" ? parentId : null) : undefined,
      icon: icon !== undefined ? icon : undefined,
      color: color !== undefined ? color : undefined
    }
  });
  res.json({ category: cat });
}

export async function deleteCategory(req: AuthRequest, res: Response) {
  // Para simplicidad: permitir borrar si no tiene transacciones relacionadas
  // (producción: bloquear/merge). Prisma lanzará error si hay FK.
  await prisma.category.delete({ where: { id: req.params.id, userId: req.user!.userId }});
  res.status(204).send();
}


