import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getDb } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  return withAuth(req, async (userId) => {
    const db = getDb();
    const url = new URL(req.url);
    const max = Math.min(Number(url.searchParams.get("limit")) || 200, 500);
    const month = url.searchParams.get("month"); // "2026-04"

    let query = db
      .collection("transactions")
      .where("userId", "==", userId)
      .where("appVersion", "==", "2.0");

    if (month) {
      const [y, m] = month.split("-").map(Number);
      const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
      query = query
        .where("date", ">=", month)
        .where("date", "<", nextMonth);
    }

    query = query.orderBy("date", "desc").limit(max);

    const snapshot = await query.get();

    const transactions = snapshot.docs.map((doc) => {
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
    });

    return NextResponse.json(transactions);
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
    const serverDate = now.slice(0, 10);

    const clientDate =
      typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
        ? body.date
        : serverDate;

    const dateMs = new Date(clientDate + "T12:00:00Z").getTime();
    const twoDays = 2 * 24 * 60 * 60 * 1000;
    const safeDate =
      Math.abs(dateMs - Date.now()) < twoDays ? clientDate : serverDate;

    const doc = {
      userId,
      amount: Math.round(Math.abs(Number(amount))),
      type,
      categoryId,
      categoryName,
      note: note || "",
      date: safeDate,
      createdAt: now,
      appVersion: "2.0",
    };

    const ref = await db.collection("transactions").add(doc);

    if (type === "EXPENSE" && categoryId) {
      try {
        const catDoc = await db.collection("categories").doc(categoryId).get();
        const catData = catDoc.exists ? catDoc.data() : null;
        if (catData?.debtId) {
          const debtRef = db.collection("debts").doc(catData.debtId);
          const debtDoc = await debtRef.get();
          if (debtDoc.exists && debtDoc.data()?.userId === userId && debtDoc.data()?.status === "active") {
            const debtData = debtDoc.data()!;
            const newPaid = (debtData.paidInstallments || 0) + 1;
            const debtUpdates: Record<string, unknown> = {
              paidInstallments: newPaid,
              lastPaymentDate: safeDate,
              updatedAt: now,
            };
            if (newPaid >= (debtData.totalInstallments || 1)) {
              debtUpdates.status = "completed";
            }
            await debtRef.update(debtUpdates);
          }
        }
      } catch {
        // Non-blocking: debt sync failure shouldn't prevent transaction creation
      }
    }

    return NextResponse.json({ id: ref.id, ...doc }, { status: 201 });
  });
}
