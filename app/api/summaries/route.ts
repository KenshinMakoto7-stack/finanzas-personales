import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getDb } from "@/lib/firebase-admin";

interface CategoryTotal {
  categoryId: string;
  categoryName: string;
  color: string;
  total: number;
  count: number;
}

interface MonthlySummary {
  userId: string;
  month: string;
  totalIncome: number;
  totalExpenses: number;
  transactionCount: number;
  categoryBreakdown: CategoryTotal[];
  closedAt: string;
}

async function loadCategoryMap(db: FirebaseFirestore.Firestore, userId: string) {
  const snap = await db.collection("categories").where("userId", "==", userId).get();
  const map = new Map<string, { name: string; color: string }>();
  for (const doc of snap.docs) {
    const d = doc.data();
    map.set(doc.id, { name: d.name || "Sin nombre", color: d.color || "#94a3b8" });
  }
  return map;
}

async function generateSummary(db: FirebaseFirestore.Firestore, userId: string, month: string): Promise<MonthlySummary> {
  const [y, m] = month.split("-").map(Number);
  const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;

  const [txSnap, catLookup] = await Promise.all([
    db.collection("transactions")
      .where("userId", "==", userId)
      .where("appVersion", "==", "2.0")
      .where("date", ">=", month)
      .where("date", "<", nextMonth)
      .get(),
    loadCategoryMap(db, userId),
  ]);

  let totalIncome = 0;
  let totalExpenses = 0;
  const catMap = new Map<string, CategoryTotal>();

  for (const doc of txSnap.docs) {
    const data = doc.data();
    if (data.type === "INCOME") {
      totalIncome += data.amount || 0;
    } else if (data.type === "EXPENSE") {
      totalExpenses += data.amount || 0;
      const catId = data.categoryId || "";
      const cat = catLookup.get(catId);
      const key = catId || data.categoryName || "otros";
      const existing = catMap.get(key) || {
        categoryId: catId,
        categoryName: cat?.name || data.categoryName || "Otros",
        color: cat?.color || "#94a3b8",
        total: 0,
        count: 0,
      };
      existing.total += data.amount || 0;
      existing.count += 1;
      catMap.set(key, existing);
    }
  }

  return {
    userId,
    month,
    totalIncome,
    totalExpenses,
    transactionCount: txSnap.docs.length,
    categoryBreakdown: Array.from(catMap.values()).sort((a, b) => b.total - a.total),
    closedAt: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  return withAuth(req, async (userId) => {
    try {
      const db = getDb();
      const url = new URL(req.url);
      const year = url.searchParams.get("year");

      if (!year) {
        return NextResponse.json({ error: "Parámetro year es requerido" }, { status: 400 });
      }

      const y = Number(year);
      const today = new Date();
      const serverMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

      const clientMonth = url.searchParams.get("currentMonth");
      const currentMonth =
        clientMonth && /^\d{4}-\d{2}$/.test(clientMonth)
          ? clientMonth
          : serverMonth;

      const existingSnapshot = await db
        .collection("monthlySummaries")
        .where("userId", "==", userId)
        .where("month", ">=", `${y}-01`)
        .where("month", "<=", `${y}-12`)
        .get();

      const existingMap = new Map<string, MonthlySummary>();
      for (const doc of existingSnapshot.docs) {
        const data = doc.data() as MonthlySummary;
        existingMap.set(data.month, data);
      }

      const maxMonth = y < today.getFullYear() ? 12 : today.getMonth();
      const summaries: MonthlySummary[] = [];

      for (let m = 1; m <= maxMonth; m++) {
        const monthKey = `${y}-${String(m).padStart(2, "0")}`;
        if (monthKey >= currentMonth) continue;

        const existing = existingMap.get(monthKey);
        if (existing) {
          summaries.push(existing);
        } else {
          const summary = await generateSummary(db, userId, monthKey);
          if (summary.transactionCount > 0) {
            const docId = `${userId}_${monthKey}`;
            await db.collection("monthlySummaries").doc(docId).set(summary);
            summaries.push(summary);
          }
        }
      }

      return NextResponse.json(summaries);
    } catch (err) {
      console.error("Error fetching summaries:", err);
      return NextResponse.json([], { status: 200 });
    }
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (userId) => {
    try {
      const db = getDb();
      const body = await req.json();
      const { month } = body;

      if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        return NextResponse.json({ error: "Formato de mes inválido (YYYY-MM)" }, { status: 400 });
      }

      const summary = await generateSummary(db, userId, month);
      const docId = `${userId}_${month}`;
      await db.collection("monthlySummaries").doc(docId).set(summary);

      return NextResponse.json(summary, { status: 201 });
    } catch (err) {
      console.error("Error generating summary:", err);
      return NextResponse.json({ error: "Error al generar resumen" }, { status: 500 });
    }
  });
}
