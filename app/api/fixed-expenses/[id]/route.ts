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
    const docRef = db.collection("fixedExpenses").doc(id);
    const doc = await docRef.get();

    if (!doc.exists || doc.data()?.userId !== userId) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    const body = await req.json();
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.amount !== undefined) updates.amount = Math.round(Math.abs(Number(body.amount)));

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
    }

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
    const docRef = db.collection("fixedExpenses").doc(id);
    const doc = await docRef.get();

    if (!doc.exists || doc.data()?.userId !== userId) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    await docRef.delete();
    return NextResponse.json({ ok: true });
  });
}
