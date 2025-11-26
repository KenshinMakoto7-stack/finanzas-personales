/**
 * SCRIPT DE SEEDING - Datos de Prueba para QA
 * 
 * Ejecutar: npx ts-node --esm apps/api/src/scripts/seed-test-data.ts
 * 
 * Crea datos ficticios pero realistas para probar:
 * - Dashboard con gráficos poblados
 * - Filtros de búsqueda
 * - Estadísticas y reportes
 */

import { db } from "../lib/firebase.js";
import { Timestamp } from "firebase-admin/firestore";

// ⚠️ IMPORTANTE: Cambiar este ID por el userId real del usuario de prueba
const TEST_USER_ID = "TEST_USER_ID_REPLACE_ME";
const TEST_PREFIX = "__TEST__"; // Prefijo para identificar datos de prueba

interface SeedConfig {
  userId: string;
  months: number; // Meses de datos históricos
}

async function seedTestData(config: SeedConfig) {
  const { userId, months } = config;
  const batch = db.batch();
  
  console.log(`🌱 Iniciando seeding para usuario: ${userId}`);
  console.log(`📅 Generando ${months} meses de datos históricos...`);

  // 1. CUENTAS
  const accounts = [
    { name: `${TEST_PREFIX}Cuenta Corriente`, type: "CHECKING", currencyCode: "UYU", balanceCents: 15000000 },
    { name: `${TEST_PREFIX}Ahorro USD`, type: "SAVINGS", currencyCode: "USD", balanceCents: 250000 },
    { name: `${TEST_PREFIX}Efectivo`, type: "CASH", currencyCode: "UYU", balanceCents: 500000 },
    { name: `${TEST_PREFIX}Tarjeta Crédito`, type: "CREDIT_CARD", currencyCode: "UYU", balanceCents: -8000000 },
  ];

  const accountRefs: { [key: string]: string } = {};
  for (const acc of accounts) {
    const ref = db.collection("accounts").doc();
    accountRefs[acc.name] = ref.id;
    batch.set(ref, {
      ...acc,
      userId,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
  }

  // 2. CATEGORÍAS DE GASTOS
  const expenseCategories = [
    { name: `${TEST_PREFIX}Vivienda`, type: "EXPENSE", parentId: null },
    { name: `${TEST_PREFIX}Alquiler`, type: "EXPENSE", parentId: null }, // Se actualizará
    { name: `${TEST_PREFIX}Servicios`, type: "EXPENSE", parentId: null },
    { name: `${TEST_PREFIX}Alimentación`, type: "EXPENSE", parentId: null },
    { name: `${TEST_PREFIX}Supermercado`, type: "EXPENSE", parentId: null },
    { name: `${TEST_PREFIX}Restaurantes`, type: "EXPENSE", parentId: null },
    { name: `${TEST_PREFIX}Transporte`, type: "EXPENSE", parentId: null },
    { name: `${TEST_PREFIX}Combustible`, type: "EXPENSE", parentId: null },
    { name: `${TEST_PREFIX}Entretenimiento`, type: "EXPENSE", parentId: null },
    { name: `${TEST_PREFIX}Salud`, type: "EXPENSE", parentId: null },
    { name: `${TEST_PREFIX}Deudas`, type: "EXPENSE", parentId: null },
  ];

  const categoryRefs: { [key: string]: string } = {};
  
  // Primero crear categorías padre
  const parentCategories = expenseCategories.filter(c => 
    ["Vivienda", "Alimentación", "Transporte", "Entretenimiento", "Salud", "Deudas"].some(p => c.name.includes(p))
  );
  
  for (const cat of parentCategories) {
    const ref = db.collection("categories").doc();
    categoryRefs[cat.name] = ref.id;
    batch.set(ref, {
      ...cat,
      userId,
      createdAt: Timestamp.now()
    });
  }

  // Luego crear subcategorías
  const subCategories = [
    { name: `${TEST_PREFIX}Alquiler`, type: "EXPENSE", parentId: categoryRefs[`${TEST_PREFIX}Vivienda`] },
    { name: `${TEST_PREFIX}Servicios`, type: "EXPENSE", parentId: categoryRefs[`${TEST_PREFIX}Vivienda`] },
    { name: `${TEST_PREFIX}Supermercado`, type: "EXPENSE", parentId: categoryRefs[`${TEST_PREFIX}Alimentación`] },
    { name: `${TEST_PREFIX}Restaurantes`, type: "EXPENSE", parentId: categoryRefs[`${TEST_PREFIX}Alimentación`] },
    { name: `${TEST_PREFIX}Combustible`, type: "EXPENSE", parentId: categoryRefs[`${TEST_PREFIX}Transporte`] },
  ];

  for (const cat of subCategories) {
    const ref = db.collection("categories").doc();
    categoryRefs[cat.name] = ref.id;
    batch.set(ref, {
      ...cat,
      userId,
      createdAt: Timestamp.now()
    });
  }

  // 3. CATEGORÍAS DE INGRESOS
  const incomeCategories = [
    { name: `${TEST_PREFIX}Salario`, type: "INCOME", parentId: null },
    { name: `${TEST_PREFIX}Freelance`, type: "INCOME", parentId: null },
    { name: `${TEST_PREFIX}Inversiones`, type: "INCOME", parentId: null },
  ];

  for (const cat of incomeCategories) {
    const ref = db.collection("categories").doc();
    categoryRefs[cat.name] = ref.id;
    batch.set(ref, {
      ...cat,
      userId,
      createdAt: Timestamp.now()
    });
  }

  // Commit batch de cuentas y categorías
  await batch.commit();
  console.log("✅ Cuentas y categorías creadas");

  // 4. TRANSACCIONES (6 meses de datos)
  const today = new Date();
  const transactionBatch = db.batch();
  let txCount = 0;

  for (let m = 0; m < months; m++) {
    const monthDate = new Date(today.getFullYear(), today.getMonth() - m, 1);
    
    // Ingreso mensual (salario)
    const salaryRef = db.collection("transactions").doc();
    transactionBatch.set(salaryRef, {
      userId,
      accountId: accountRefs[`${TEST_PREFIX}Cuenta Corriente`],
      categoryId: categoryRefs[`${TEST_PREFIX}Salario`],
      type: "INCOME",
      amountCents: 8500000 + Math.floor(Math.random() * 500000), // ~85,000 UYU ± variación
      currencyCode: "UYU",
      occurredAt: Timestamp.fromDate(new Date(monthDate.getFullYear(), monthDate.getMonth(), 5)),
      description: `${TEST_PREFIX}Salario ${monthDate.toLocaleString('es', { month: 'long' })}`,
      isRecurring: true,
      recurringRule: JSON.stringify({ type: "monthly" }),
      createdAt: Timestamp.now()
    });
    txCount++;

    // Freelance ocasional
    if (Math.random() > 0.5) {
      const freelanceRef = db.collection("transactions").doc();
      transactionBatch.set(freelanceRef, {
        userId,
        accountId: accountRefs[`${TEST_PREFIX}Ahorro USD`],
        categoryId: categoryRefs[`${TEST_PREFIX}Freelance`],
        type: "INCOME",
        amountCents: 30000 + Math.floor(Math.random() * 20000), // $300-500 USD
        currencyCode: "USD",
        occurredAt: Timestamp.fromDate(new Date(monthDate.getFullYear(), monthDate.getMonth(), 15)),
        description: `${TEST_PREFIX}Proyecto freelance`,
        isRecurring: false,
        createdAt: Timestamp.now()
      });
      txCount++;
    }

    // Gastos fijos mensuales
    const fixedExpenses = [
      { cat: `${TEST_PREFIX}Alquiler`, amount: 3500000, day: 1, desc: "Alquiler mensual" },
      { cat: `${TEST_PREFIX}Servicios`, amount: 450000 + Math.floor(Math.random() * 100000), day: 10, desc: "UTE + OSE + Antel" },
      { cat: `${TEST_PREFIX}Salud`, amount: 350000, day: 1, desc: "Mutualista" },
    ];

    for (const exp of fixedExpenses) {
      const ref = db.collection("transactions").doc();
      transactionBatch.set(ref, {
        userId,
        accountId: accountRefs[`${TEST_PREFIX}Cuenta Corriente`],
        categoryId: categoryRefs[exp.cat],
        type: "EXPENSE",
        amountCents: exp.amount,
        currencyCode: "UYU",
        occurredAt: Timestamp.fromDate(new Date(monthDate.getFullYear(), monthDate.getMonth(), exp.day)),
        description: `${TEST_PREFIX}${exp.desc}`,
        isRecurring: true,
        recurringRule: JSON.stringify({ type: "monthly" }),
        createdAt: Timestamp.now()
      });
      txCount++;
    }

    // Gastos variables (supermercado, restaurantes, etc.)
    const variableExpenses = [
      { cat: `${TEST_PREFIX}Supermercado`, minAmount: 200000, maxAmount: 400000, frequency: 4 },
      { cat: `${TEST_PREFIX}Restaurantes`, minAmount: 80000, maxAmount: 200000, frequency: 3 },
      { cat: `${TEST_PREFIX}Combustible`, minAmount: 150000, maxAmount: 250000, frequency: 2 },
      { cat: `${TEST_PREFIX}Entretenimiento`, minAmount: 50000, maxAmount: 150000, frequency: 2 },
    ];

    for (const exp of variableExpenses) {
      for (let i = 0; i < exp.frequency; i++) {
        const ref = db.collection("transactions").doc();
        const day = Math.floor(Math.random() * 28) + 1;
        transactionBatch.set(ref, {
          userId,
          accountId: Math.random() > 0.3 
            ? accountRefs[`${TEST_PREFIX}Tarjeta Crédito`] 
            : accountRefs[`${TEST_PREFIX}Efectivo`],
          categoryId: categoryRefs[exp.cat],
          type: "EXPENSE",
          amountCents: exp.minAmount + Math.floor(Math.random() * (exp.maxAmount - exp.minAmount)),
          currencyCode: "UYU",
          occurredAt: Timestamp.fromDate(new Date(monthDate.getFullYear(), monthDate.getMonth(), day)),
          description: `${TEST_PREFIX}${exp.cat.replace(TEST_PREFIX, '')}`,
          isRecurring: false,
          createdAt: Timestamp.now()
        });
        txCount++;
      }
    }

    // Ahorro mensual (transferencia a cuenta de ahorro)
    const savingsRef = db.collection("transactions").doc();
    transactionBatch.set(savingsRef, {
      userId,
      accountId: accountRefs[`${TEST_PREFIX}Ahorro USD`],
      categoryId: categoryRefs[`${TEST_PREFIX}Inversiones`],
      type: "INCOME",
      amountCents: 20000 + Math.floor(Math.random() * 10000), // $200-300 USD
      currencyCode: "USD",
      occurredAt: Timestamp.fromDate(new Date(monthDate.getFullYear(), monthDate.getMonth(), 6)),
      description: `${TEST_PREFIX}Ahorro mensual`,
      isRecurring: true,
      recurringRule: JSON.stringify({ type: "monthly" }),
      createdAt: Timestamp.now()
    });
    txCount++;
  }

  await transactionBatch.commit();
  console.log(`✅ ${txCount} transacciones creadas`);

  // 5. METAS DE AHORRO
  const goalsBatch = db.batch();
  for (let m = 0; m < months; m++) {
    const monthDate = new Date(today.getFullYear(), today.getMonth() - m, 1);
    const goalRef = db.collection("monthlyGoals").doc();
    goalsBatch.set(goalRef, {
      userId,
      month: Timestamp.fromDate(monthDate),
      savingGoalCents: 50000, // $500 USD meta mensual
      notes: `${TEST_PREFIX}Meta de ahorro`,
      createdAt: Timestamp.now()
    });
  }
  await goalsBatch.commit();
  console.log("✅ Metas de ahorro creadas");

  // 6. DEUDAS
  const debtsBatch = db.batch();
  const debts = [
    { description: `${TEST_PREFIX}Préstamo Auto`, totalAmountCents: 1500000000, totalInstallments: 48, paidInstallments: 12, installmentAmountCents: 3500000 },
    { description: `${TEST_PREFIX}Tarjeta Visa`, totalAmountCents: 8000000, totalInstallments: 6, paidInstallments: 2, installmentAmountCents: 1400000 },
  ];

  for (const debt of debts) {
    const ref = db.collection("debts").doc();
    debtsBatch.set(ref, {
      ...debt,
      userId,
      currencyCode: "UYU",
      startDate: Timestamp.fromDate(new Date(today.getFullYear() - 1, 0, 1)),
      createdAt: Timestamp.now()
    });
  }
  await debtsBatch.commit();
  console.log("✅ Deudas creadas");

  // 7. TAGS
  const tagsBatch = db.batch();
  const tags = [
    { name: `${TEST_PREFIX}Urgente`, color: "#e74c3c" },
    { name: `${TEST_PREFIX}Recurrente`, color: "#3498db" },
    { name: `${TEST_PREFIX}Deducible`, color: "#27ae60" },
  ];

  for (const tag of tags) {
    const ref = db.collection("tags").doc();
    tagsBatch.set(ref, {
      ...tag,
      userId,
      createdAt: Timestamp.now()
    });
  }
  await tagsBatch.commit();
  console.log("✅ Tags creados");

  console.log("\n🎉 SEEDING COMPLETADO");
  console.log(`📊 Resumen:`);
  console.log(`   - ${accounts.length} cuentas`);
  console.log(`   - ${Object.keys(categoryRefs).length} categorías`);
  console.log(`   - ${txCount} transacciones`);
  console.log(`   - ${months} metas de ahorro`);
  console.log(`   - ${debts.length} deudas`);
  console.log(`   - ${tags.length} tags`);
  console.log(`\n⚠️ Prefijo de datos de prueba: "${TEST_PREFIX}"`);
}

// Ejecutar si es el archivo principal
const args = process.argv.slice(2);
const userId = args[0] || TEST_USER_ID;

if (userId === TEST_USER_ID) {
  console.error("❌ ERROR: Debes proporcionar un userId válido");
  console.log("Uso: npx ts-node --esm apps/api/src/scripts/seed-test-data.ts <userId>");
  process.exit(1);
}

seedTestData({ userId, months: 6 })
  .then(() => process.exit(0))
  .catch(err => {
    console.error("❌ Error:", err);
    process.exit(1);
  });

