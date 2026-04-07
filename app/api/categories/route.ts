import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getDb } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  return withAuth(req, async (userId) => {
    const db = getDb();
    const snapshot = await db
      .collection("categories")
      .where("userId", "==", userId)
      .get();

    interface CatDoc { id: string; name: string; parentId: string | null; [k: string]: unknown }
    const all = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }) as CatDoc);

    const parents = all
      .filter((c) => !c.parentId)
      .sort((a, b) => a.name.localeCompare(b.name));

    const tree = parents.map((p) => ({
      ...p,
      children: all
        .filter((c) => c.parentId === p.id)
        .sort((a, b) => a.name.localeCompare(b.name)),
    }));

    return NextResponse.json(tree);
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (userId) => {
    const db = getDb();
    const body = await req.json();
    const { name, type, color, parentId } = body;

    if (!name?.trim() || !type) {
      return NextResponse.json({ error: "Nombre y tipo son requeridos" }, { status: 400 });
    }

    if (type !== "EXPENSE" && type !== "INCOME") {
      return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
    }

    const doc = {
      userId,
      name: name.trim(),
      type,
      color: color || "#94a3b8",
      parentId: parentId || null,
      createdAt: new Date().toISOString(),
    };

    const ref = await db.collection("categories").add(doc);
    return NextResponse.json({ id: ref.id, ...doc }, { status: 201 });
  });
}
