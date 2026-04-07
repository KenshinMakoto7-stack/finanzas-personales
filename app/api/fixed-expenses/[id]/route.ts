import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getDb } from "@/lib/firebase-admin";

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
