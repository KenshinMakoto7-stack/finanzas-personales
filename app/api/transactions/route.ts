import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getDb } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  return withAuth(req, async (userId) => {
    const db = getDb();
    const url = new URL(req.url);
    const max = Math.min(Number(url.searchParams.get("limit")) || 200, 500);
    const month = url.searchParams.get("month"); // "2026-04"

    const snapshot = await db
      .collection("transactions")
      .where("userId", "==", userId)
      .get();

    let transactions = snapshot.docs
      .filter((doc) => doc.data().appVersion === "2.0")
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          amount: data.amount,
          type: data.type,
          categoryId: data.categoryId,
          categoryName: data.categoryName,
          note: data.note || "",
          date: data.date,
          createdAt: data.createdAt,
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    if (month) {
      transactions = transactions.filter((t) => t.date?.startsWith(month));
    }

    return NextResponse.json(transactions.slice(0, max));
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (userId) => {
    const db = getDb();
    const body = await req.json();
    const { amount, type, categoryId, categoryName, note } = body;

    if (!amount || !type || !categoryId || !categoryName) {
      return NextResponse.json(
        { error: "Faltan campos requeridos" },
        { status: 400 }
      );
    }

    if (type !== "EXPENSE" && type !== "INCOME") {
      return NextResponse.json(
        { error: "Tipo inválido" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const doc = {
      userId,
      amount: Math.round(Math.abs(Number(amount))),
      type,
      categoryId,
      categoryName,
      note: note || "",
      date: now.slice(0, 10),
      createdAt: now,
      appVersion: "2.0",
    };

    const ref = await db.collection("transactions").add(doc);

    return NextResponse.json({ id: ref.id, ...doc }, { status: 201 });
  });
}
