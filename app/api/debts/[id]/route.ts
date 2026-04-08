import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getDb } from "@/lib/firebase-admin";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(req, async (userId) => {
    const { id } = await params;
    const db = getDb();
    const docRef = db.collection("debts").doc(id);
    const doc = await docRef.get();

    if (!doc.exists || doc.data()?.userId !== userId) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    const body = await req.json();
    const data = doc.data()!;
    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.installmentAmount !== undefined) updates.installmentAmount = Math.round(Math.abs(Number(body.installmentAmount)));
    if (body.dueDay !== undefined) updates.dueDay = Math.max(1, Math.min(31, Math.round(Number(body.dueDay))));

    if (body.registerPayment === true) {
      const paid = (data.paidInstallments || 0) + 1;
      const total = data.totalInstallments || 1;
      updates.paidInstallments = paid;
      updates.lastPaymentDate = new Date().toISOString().slice(0, 10);
      if (paid >= total) {
        updates.status = "completed";
      }

      if (data.categoryId) {
        const now = new Date().toISOString();
        await db.collection("transactions").add({
          userId,
          amount: data.installmentAmount,
          type: "EXPENSE",
          categoryId: data.categoryId,
          categoryName: data.name,
          note: `Cuota ${paid}/${total}`,
          date: now.slice(0, 10),
          createdAt: now,
          appVersion: "2.0",
        });
      }
    }

    if (body.undoPayment === true) {
      const paid = Math.max(0, (data.paidInstallments || 0) - 1);
      updates.paidInstallments = paid;
      if (data.status === "completed") {
        updates.status = "active";
      }

      if (data.categoryId) {
        const txSnap = await db
          .collection("transactions")
          .where("userId", "==", userId)
          .where("categoryId", "==", data.categoryId)
          .get();

        const txDocs = txSnap.docs
          .map((d) => ({ ref: d.ref, createdAt: d.data().createdAt || "", date: d.data().date || "" }))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

        if (txDocs.length > 0) {
          await txDocs[0].ref.delete();
        }

        if (paid === 0) {
          updates.lastPaymentDate = null;
        } else if (txDocs.length > 1) {
          updates.lastPaymentDate = txDocs[1].date || null;
        } else {
          updates.lastPaymentDate = null;
        }
      } else {
        if (paid === 0) updates.lastPaymentDate = null;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
    }

    updates.updatedAt = new Date().toISOString();
    await docRef.update(updates);
    const updated = await docRef.get();
    return NextResponse.json({ id: updated.id, ...updated.data() });
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(req, async (userId) => {
    const { id } = await params;
    const db = getDb();
    const docRef = db.collection("debts").doc(id);
    const doc = await docRef.get();

    if (!doc.exists || doc.data()?.userId !== userId) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    const data = doc.data()!;

    if (data.categoryId) {
      const catRef = db.collection("categories").doc(data.categoryId);
      const catDoc = await catRef.get();
      if (catDoc.exists && catDoc.data()?.userId === userId) {
        await catRef.delete();
      }
    }

    await docRef.delete();
    return NextResponse.json({ ok: true });
  });
}
