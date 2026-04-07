import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getDb } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  return withAuth(req, async (userId) => {
    const db = getDb();
    const doc = await db.collection("users").doc(userId).get();
    const data = doc.data() || {};

    return NextResponse.json({
      monthlyIncome: data.monthlyIncome ?? 0,
      monthlySavings: data.monthlySavings ?? 0,
      currencyCode: data.currencyCode ?? "UYU",
    });
  });
}

export async function PUT(req: NextRequest) {
  return withAuth(req, async (userId) => {
    const db = getDb();
    const body = await req.json();
    const updates: Record<string, unknown> = {};

    if (body.monthlyIncome !== undefined) {
      updates.monthlyIncome = Math.round(Math.abs(Number(body.monthlyIncome) || 0));
    }
    if (body.monthlySavings !== undefined) {
      updates.monthlySavings = Math.round(Math.abs(Number(body.monthlySavings) || 0));
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
    }

    updates.updatedAt = new Date().toISOString();
    await db.collection("users").doc(userId).set(updates, { merge: true });

    const doc = await db.collection("users").doc(userId).get();
    const data = doc.data() || {};

    return NextResponse.json({
      monthlyIncome: data.monthlyIncome ?? 0,
      monthlySavings: data.monthlySavings ?? 0,
      currencyCode: data.currencyCode ?? "UYU",
    });
  });
}
