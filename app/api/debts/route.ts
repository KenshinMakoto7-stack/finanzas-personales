import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getDb } from "@/lib/firebase-admin";

const DEBT_CATEGORY_COLOR = "#8b5cf6";

async function findOrCreateDebtParent(db: FirebaseFirestore.Firestore, userId: string) {
  const snap = await db
    .collection("categories")
    .where("userId", "==", userId)
    .where("name", "==", "Deudas")
    .where("type", "==", "EXPENSE")
    .where("parentId", "==", null)
    .get();

  if (snap.docs.length > 0) {
    return { id: snap.docs[0].id, color: snap.docs[0].data().color || DEBT_CATEGORY_COLOR };
  }

  const ref = await db.collection("categories").add({
    userId,
    name: "Deudas",
    type: "EXPENSE",
    color: DEBT_CATEGORY_COLOR,
    parentId: null,
    createdAt: new Date().toISOString(),
  });
  return { id: ref.id, color: DEBT_CATEGORY_COLOR };
}

export async function GET(req: NextRequest) {
  return withAuth(req, async (userId) => {
    try {
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
    } catch (err) {
      console.error("Error fetching debts:", err);
      return NextResponse.json([], { status: 200 });
    }
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

    const debtDoc = {
      userId,
      name: name.trim(),
      totalAmount: Math.round(Math.abs(Number(totalAmount))),
      installmentAmount: Math.round(Math.abs(Number(installmentAmount))),
      totalInstallments: Math.max(1, Math.round(Number(totalInstallments))),
      paidInstallments: 0,
      dueDay: Math.max(1, Math.min(31, Math.round(Number(dueDay) || 1))),
      startDate: new Date().toISOString().slice(0, 7),
      status: "active",
      lastPaymentDate: null,
      createdAt: new Date().toISOString(),
    };

    const ref = await db.collection("debts").add(debtDoc);

    const parent = await findOrCreateDebtParent(db, userId);
    const subCatRef = await db.collection("categories").add({
      userId,
      name: name.trim(),
      type: "EXPENSE",
      color: parent.color,
      parentId: parent.id,
      debtId: ref.id,
      createdAt: new Date().toISOString(),
    });

    await ref.update({ categoryId: subCatRef.id });

    return NextResponse.json(
      { id: ref.id, ...debtDoc, categoryId: subCatRef.id },
      { status: 201 }
    );
  });
}
