import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getDb } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  return withAuth(req, async (userId) => {
    const db = getDb();
    const snapshot = await db
      .collection("debts")
      .where("userId", "==", userId)
      .get();

    interface DebtDoc { id: string; name: string; status: string; [k: string]: unknown }
    const items = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }) as DebtDoc)
      .sort((a, b) => {
        if (a.status === "active" && b.status !== "active") return -1;
        if (a.status !== "active" && b.status === "active") return 1;
        return a.name.localeCompare(b.name);
      });

    return NextResponse.json(items);
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (userId) => {
    const db = getDb();
    const body = await req.json();
    const { name, totalAmount, installmentAmount, totalInstallments, dueDay } = body;

    if (!name?.trim() || !totalAmount || !installmentAmount || !totalInstallments) {
      return NextResponse.json(
        { error: "Nombre, monto total, monto de cuota y cantidad de cuotas son requeridos" },
        { status: 400 }
      );
    }

    const doc = {
      userId,
      name: name.trim(),
      totalAmount: Math.round(Math.abs(Number(totalAmount))),
      installmentAmount: Math.round(Math.abs(Number(installmentAmount))),
      totalInstallments: Math.max(1, Math.round(Number(totalInstallments))),
      paidInstallments: 0,
      dueDay: Math.max(1, Math.min(31, Math.round(Number(dueDay) || 1))),
      startDate: new Date().toISOString().slice(0, 7),
      status: "active",
      createdAt: new Date().toISOString(),
    };

    const ref = await db.collection("debts").add(doc);
    return NextResponse.json({ id: ref.id, ...doc }, { status: 201 });
  });
}
