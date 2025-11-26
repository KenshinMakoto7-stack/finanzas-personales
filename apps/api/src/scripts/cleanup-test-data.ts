/**
 * SCRIPT DE LIMPIEZA - Elimina SOLO datos de prueba
 * 
 * Ejecutar: npx ts-node --esm apps/api/src/scripts/cleanup-test-data.ts <userId>
 * 
 * Elimina todos los documentos que contengan el prefijo "__TEST__"
 * NO TOCA datos reales del usuario
 */

import { db } from "../lib/firebase.js";

const TEST_PREFIX = "__TEST__";

interface CleanupStats {
  accounts: number;
  categories: number;
  transactions: number;
  monthlyGoals: number;
  debts: number;
  tags: number;
  transactionTags: number;
}

async function cleanupTestData(userId: string): Promise<CleanupStats> {
  console.log(`🧹 Iniciando limpieza de datos de prueba para usuario: ${userId}`);
  console.log(`🔍 Buscando documentos con prefijo: "${TEST_PREFIX}"`);

  const stats: CleanupStats = {
    accounts: 0,
    categories: 0,
    transactions: 0,
    monthlyGoals: 0,
    debts: 0,
    tags: 0,
    transactionTags: 0
  };

  // Helper para eliminar documentos en batch
  async function deleteDocuments(
    collectionName: string,
    fieldToCheck: string,
    statKey: keyof CleanupStats
  ) {
    const snapshot = await db.collection(collectionName)
      .where("userId", "==", userId)
      .get();

    const toDelete = snapshot.docs.filter(doc => {
      const data = doc.data();
      const fieldValue = data[fieldToCheck];
      return typeof fieldValue === "string" && fieldValue.includes(TEST_PREFIX);
    });

    if (toDelete.length === 0) {
      console.log(`   ${collectionName}: 0 documentos de prueba encontrados`);
      return;
    }

    // Eliminar en batches de 500 (límite de Firestore)
    const batchSize = 500;
    for (let i = 0; i < toDelete.length; i += batchSize) {
      const batch = db.batch();
      const chunk = toDelete.slice(i, i + batchSize);
      chunk.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }

    stats[statKey] = toDelete.length;
    console.log(`   ${collectionName}: ${toDelete.length} documentos eliminados`);
  }

  // 1. Obtener IDs de transacciones de prueba (para limpiar transactionTags)
  const txSnapshot = await db.collection("transactions")
    .where("userId", "==", userId)
    .get();
  
  const testTxIds = txSnapshot.docs
    .filter(doc => {
      const desc = doc.data().description;
      return typeof desc === "string" && desc.includes(TEST_PREFIX);
    })
    .map(doc => doc.id);

  // 2. Eliminar transactionTags asociados a transacciones de prueba
  if (testTxIds.length > 0) {
    const chunkSize = 10; // Firestore "in" limit
    for (let i = 0; i < testTxIds.length; i += chunkSize) {
      const chunk = testTxIds.slice(i, i + chunkSize);
      const tagsSnapshot = await db.collection("transactionTags")
        .where("transactionId", "in", chunk)
        .get();
      
      if (tagsSnapshot.docs.length > 0) {
        const batch = db.batch();
        tagsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        stats.transactionTags += tagsSnapshot.docs.length;
      }
    }
    console.log(`   transactionTags: ${stats.transactionTags} documentos eliminados`);
  }

  // 3. Eliminar documentos por colección
  await deleteDocuments("accounts", "name", "accounts");
  await deleteDocuments("categories", "name", "categories");
  await deleteDocuments("transactions", "description", "transactions");
  await deleteDocuments("debts", "description", "debts");
  await deleteDocuments("tags", "name", "tags");

  // 4. Eliminar monthlyGoals de prueba (por notas)
  const goalsSnapshot = await db.collection("monthlyGoals")
    .where("userId", "==", userId)
    .get();

  const testGoals = goalsSnapshot.docs.filter(doc => {
    const notes = doc.data().notes;
    return typeof notes === "string" && notes.includes(TEST_PREFIX);
  });

  if (testGoals.length > 0) {
    const batch = db.batch();
    testGoals.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    stats.monthlyGoals = testGoals.length;
  }
  console.log(`   monthlyGoals: ${stats.monthlyGoals} documentos eliminados`);

  console.log("\n✅ LIMPIEZA COMPLETADA");
  console.log(`📊 Total eliminado:`);
  console.log(`   - ${stats.accounts} cuentas`);
  console.log(`   - ${stats.categories} categorías`);
  console.log(`   - ${stats.transactions} transacciones`);
  console.log(`   - ${stats.monthlyGoals} metas de ahorro`);
  console.log(`   - ${stats.debts} deudas`);
  console.log(`   - ${stats.tags} tags`);
  console.log(`   - ${stats.transactionTags} transactionTags`);

  return stats;
}

// Ejecutar si es el archivo principal
const args = process.argv.slice(2);
const userId = args[0];

if (!userId) {
  console.error("❌ ERROR: Debes proporcionar un userId");
  console.log("Uso: npx ts-node --esm apps/api/src/scripts/cleanup-test-data.ts <userId>");
  process.exit(1);
}

cleanupTestData(userId)
  .then(() => process.exit(0))
  .catch(err => {
    console.error("❌ Error:", err);
    process.exit(1);
  });

