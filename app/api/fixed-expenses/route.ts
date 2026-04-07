import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getDb } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  return withAuth(req, async (userId) => {
    const db = getDb();
    const snapshot = await db
      .collection("fixedExpenses")
      .where("userId", "==", userId)
      .get();

    const items = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => (a.name as string).localeCompare(b.name as string));

    return NextResponse.json(items);
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (userId) => {
    const db = getDb();
    const body = await req.json();
    const { name, amount, categoryId, categoryName } = body;

    if (!name || !amount) {
      return NextResponse.json({ error: "Nombre y monto son requeridos" }, { status: 400 });
    }

    const doc = {
      userId,
      name: name.trim(),
      amount: Math.round(Math.abs(Number(amount))),
      categoryId: categoryId || "",
      categoryName: categoryName || "",
      createdAt: new Date().toISOString(),
    };

    const ref = await db.collection("fixedExpenses").add(doc);
    return NextResponse.json({ id: ref.id, ...doc }, { status: 201 });
  });
}
