import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getDb } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const auth = getAdminAuth();
    const db = getDb();
    const decoded = await auth.verifyIdToken(token);
    const userId = decoded.uid;
    const email = decoded.email || "";

    const userRef = db.collection("users").doc(userId);
    const existing = await userRef.get();
    if (existing.exists) {
      return NextResponse.json({ ok: true });
    }

    await userRef.set({
      email,
      currencyCode: "UYU",
      timeZone: "America/Montevideo",
      createdAt: new Date().toISOString(),
    });

    const defaultCategories = [
      { name: "Sueldo", type: "INCOME", color: "#059669" },
      { name: "Vivienda", type: "EXPENSE", color: "#2fcdf4" },
      { name: "Alimentos", type: "EXPENSE", color: "#F59E0B" },
      { name: "Transporte", type: "EXPENSE", color: "#74a7ff", children: ["Uber", "Viajes"] },
      { name: "Suscripciones", type: "EXPENSE", color: "#667eea", children: ["Antel ADSL", "Celular Claro", "iCloud", "YouTube", "CrunchyRol"] },
      { name: "Salud", type: "EXPENSE", color: "#76bb40", children: ["Gimnasio", "Medicación", "Psicóloga"] },
      { name: "Himu", type: "EXPENSE", color: "#bc02d4", children: ["Comida Himu", "Veterinaria Himu", "Vacunas/remedios Himu"] },
      { name: "Actividades", type: "EXPENSE", color: "#ffa200", children: ["Pedidos cena/almuerzo", "Fútbol", "Juntadas", "Tenis", "Cumpleaños"] },
      { name: "Snacks/Alcohol", type: "EXPENSE", color: "#6b6e7b" },
      { name: "Faso", type: "EXPENSE", color: "#ff0000" },
      { name: "Deudas/Cuotas", type: "EXPENSE", color: "#e74c3c", children: ["Préstamo Fede", "Colchón ma y pa", "Monopatín"] },
      { name: "Piano Abuelo", type: "EXPENSE", color: "#ffeb14" },
      { name: "Inversiones", type: "EXPENSE", color: "#66ead4", children: ["Oficina"] },
    ];

    const batch = db.batch();

    for (const cat of defaultCategories) {
      const parentRef = db.collection("categories").doc();
      batch.set(parentRef, {
        userId,
        name: cat.name,
        type: cat.type,
        color: cat.color,
        parentId: null,
        createdAt: new Date().toISOString(),
      });

      if (cat.children) {
        for (const childName of cat.children) {
          const childRef = db.collection("categories").doc();
          batch.set(childRef, {
            userId,
            name: childName,
            type: cat.type,
            color: cat.color,
            parentId: parentRef.id,
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    const accountRef = db.collection("accounts").doc();
    batch.set(accountRef, {
      userId,
      name: "Banco ITAU",
      type: "BANK",
      currencyCode: "UYU",
      createdAt: new Date().toISOString(),
    });

    await batch.commit();

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json({ error: "Error al configurar cuenta" }, { status: 500 });
  }
}
