import { Response } from "express";
import { prisma } from "../lib/db.js";
import { AuthRequest } from "../server/middleware/auth.js";

export async function globalSearch(req: AuthRequest, res: Response) {
  const { q, limit = "10" } = req.query;
  const userId = req.user!.userId;
  const searchLimit = Math.min(Number(limit) || 10, 50);

  if (!q || typeof q !== "string" || q.trim().length < 2) {
    return res.json({
      transactions: [],
      categories: [],
      accounts: [],
      tags: []
    });
  }

  const searchTerm = q.trim();
  const searchPattern = `%${searchTerm}%`;

  try {
    // Buscar transacciones
    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        OR: [
          { description: { contains: searchTerm, mode: "insensitive" } },
          {
            category: {
              name: { contains: searchTerm, mode: "insensitive" }
            }
          },
          {
            account: {
              name: { contains: searchTerm, mode: "insensitive" }
            }
          }
        ]
      },
      include: {
        category: true,
        account: true,
        tags: {
          include: {
            tag: true
          }
        }
      },
      orderBy: { occurredAt: "desc" },
      take: searchLimit
    });

    // Buscar categorías
    const categories = await prisma.category.findMany({
      where: {
        userId,
        name: { contains: searchTerm, mode: "insensitive" }
      },
      take: searchLimit
    });

    // Buscar cuentas
    const accounts = await prisma.account.findMany({
      where: {
        userId,
        name: { contains: searchTerm, mode: "insensitive" }
      },
      take: searchLimit
    });

    // Buscar tags
    const tags = await prisma.tag.findMany({
      where: {
        userId,
        name: { contains: searchTerm, mode: "insensitive" }
      },
      take: searchLimit
    });

    // Formatear transacciones
    const formattedTransactions = transactions.map(tx => ({
      ...tx,
      tags: tx.tags.map(tt => tt.tag)
    }));

    res.json({
      transactions: formattedTransactions,
      categories,
      accounts,
      tags,
      query: searchTerm
    });
  } catch (error: any) {
    console.error("Search error:", error);
    res.status(500).json({ error: "Error en la búsqueda" });
  }
}

export async function searchSuggestions(req: AuthRequest, res: Response) {
  const { q } = req.query;
  const userId = req.user!.userId;

  if (!q || typeof q !== "string" || q.trim().length < 1) {
    return res.json({ suggestions: [] });
  }

  const searchTerm = q.trim().toLowerCase();

  try {
    const suggestions: any[] = [];

    // Sugerencias de categorías
    const categories = await prisma.category.findMany({
      where: {
        userId,
        name: { contains: searchTerm, mode: "insensitive" }
      },
      take: 5
    });
    categories.forEach(cat => {
      suggestions.push({
        type: "category",
        id: cat.id,
        title: cat.name,
        subtitle: cat.type === "INCOME" ? "Ingreso" : "Gasto",
        icon: cat.icon || "📁"
      });
    });

    // Sugerencias de cuentas
    const accounts = await prisma.account.findMany({
      where: {
        userId,
        name: { contains: searchTerm, mode: "insensitive" }
      },
      take: 5
    });
    accounts.forEach(acc => {
      suggestions.push({
        type: "account",
        id: acc.id,
        title: acc.name,
        subtitle: acc.type,
        icon: "💳"
      });
    });

    // Sugerencias de tags
    const tags = await prisma.tag.findMany({
      where: {
        userId,
        name: { contains: searchTerm, mode: "insensitive" }
      },
      take: 5
    });
    tags.forEach(tag => {
      suggestions.push({
        type: "tag",
        id: tag.id,
        title: tag.name,
        subtitle: "Etiqueta",
        icon: "🏷️"
      });
    });

    // Sugerencias de descripciones comunes de transacciones
    const commonDescriptions = await prisma.transaction.findMany({
      where: {
        userId,
        description: { contains: searchTerm, mode: "insensitive" }
      },
      select: {
        description: true
      },
      distinct: ["description"],
      take: 5
    });
    commonDescriptions.forEach(tx => {
      if (tx.description) {
        suggestions.push({
          type: "description",
          id: tx.description,
          title: tx.description,
          subtitle: "Descripción común",
          icon: "📝"
        });
      }
    });

    res.json({ suggestions: suggestions.slice(0, 10) });
  } catch (error: any) {
    console.error("Suggestions error:", error);
    res.status(500).json({ error: "Error en las sugerencias" });
  }
}

