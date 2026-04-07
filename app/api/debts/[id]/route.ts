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
      if (paid >= total) {
        updates.status = "completed";
      }
    }

    if (body.undoPayment === true) {
      const paid = Math.max(0, (data.paidInstallments || 0) - 1);
      updates.paidInstallments = paid;
      if (data.status === "completed") {
        updates.status = "active";
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

    await docRef.delete();
    return NextResponse.json({ ok: true });
  });
}
