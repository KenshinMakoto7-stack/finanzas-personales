import "dotenv/config";
import { prisma } from "./lib/db";
import { hashPassword } from "./lib/crypto";

async function main() {
  const email = "ana@example.com";
  const passwordHash = await hashPassword("Secreta123");

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash, currencyCode: "USD", locale: "es-AR", timeZone: "America/Argentina/Buenos_Aires" }
  });

  // Crear cuentas
  const cash = await prisma.account.upsert({
    where: { id: "seed-cash" },
    update: {},
    create: { id: "seed-cash", userId: user.id, name: "Efectivo", type: "CASH", currencyCode: user.currencyCode }
  });

  const bank = await prisma.account.upsert({
    where: { id: "seed-bank" },
    update: {},
    create: { id: "seed-bank", userId: user.id, name: "Banco Principal", type: "BANK", currencyCode: user.currencyCode }
  }).catch(() => null);

  // Crear categorías de gastos
  const comida = await prisma.category.upsert({
    where: { id: "seed-comida" },
    update: {},
    create: { id: "seed-comida", userId: user.id, name: "COMIDA", type: "EXPENSE", color: "#e74c3c" }
  });

  const almuerzo = await prisma.category.upsert({
    where: { id: "seed-almuerzo" },
    update: {},
    create: { id: "seed-almuerzo", userId: user.id, name: "Almuerzo", type: "EXPENSE", parentId: comida.id, color: "#c0392b" }
  });

  const transporte = await prisma.category.upsert({
    where: { id: "seed-transporte" },
    update: {},
    create: { id: "seed-transporte", userId: user.id, name: "TRANSPORTE", type: "EXPENSE", color: "#3498db" }
  });

  // Crear categorías de ingresos
  const ingresos = await prisma.category.upsert({
    where: { id: "seed-ingresos" },
    update: {},
    create: { id: "seed-ingresos", userId: user.id, name: "INGRESOS", type: "INCOME", color: "#27ae60" }
  });

  // Meta noviembre 2025
  await prisma.monthlyGoal.upsert({
    where: { userId_month: { userId: user.id, month: new Date(Date.UTC(2025, 10, 1)) } },
    update: { savingGoalCents: 30000 },
    create: { userId: user.id, month: new Date(Date.UTC(2025, 10, 1)), savingGoalCents: 30000 }
  });

  // Ingreso sueldo
  await prisma.transaction.create({
    data: { 
      userId: user.id, 
      accountId: cash.id, 
      categoryId: ingresos.id, 
      type: "INCOME", 
      amountCents: 300000, 
      currencyCode: user.currencyCode,
      occurredAt: new Date("2025-11-01T12:00:00Z"), 
      description: "Sueldo" 
    }
  });

  // Gastos previos
  await prisma.transaction.create({
    data: { 
      userId: user.id, 
      accountId: cash.id, 
      categoryId: almuerzo.id, 
      type: "EXPENSE", 
      amountCents: 120000, 
      currencyCode: user.currencyCode,
      occurredAt: new Date("2025-11-10T15:00:00Z"), 
      description: "Gastos previos" 
    }
  });

  await prisma.transaction.create({
    data: { 
      userId: user.id, 
      accountId: cash.id, 
      categoryId: transporte.id, 
      type: "EXPENSE", 
      amountCents: 50000, 
      currencyCode: user.currencyCode,
      occurredAt: new Date("2025-11-12T10:00:00Z"), 
      description: "Transporte" 
    }
  });

  // Gasto de hoy (ejemplo)
  await prisma.transaction.create({
    data: { 
      userId: user.id, 
      accountId: cash.id, 
      categoryId: almuerzo.id, 
      type: "EXPENSE", 
      amountCents: 3000, 
      currencyCode: user.currencyCode,
      occurredAt: new Date("2025-11-18T13:00:00Z"), 
      description: "Almuerzo 18/11" 
    }
  });

  console.log("Seed completado");
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });


