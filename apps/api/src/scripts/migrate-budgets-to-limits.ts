/**
 * Script de migración: convertir alertThreshold (número) → alertThresholds (array)
 * Ejecutar una sola vez para migrar datos existentes
 */

import { db } from "../lib/firebase.js";
import { docToObject, objectToFirestore } from "../lib/firestore-helpers.js";
import { Timestamp } from "firebase-admin/firestore";

async function migrateBudgetsToLimits() {
  console.log("🔄 Iniciando migración de presupuestos a límites...");
  
  try {
    // Obtener todos los categoryBudgets
    const snapshot = await db.collection("categoryBudgets").get();
    console.log(`📊 Encontrados ${snapshot.size} límites para migrar`);
    
    let migrated = 0;
    let skipped = 0;
    const batch = db.batch();
    let batchCount = 0;
    const BATCH_SIZE = 500; // Firestore limita a 500 operaciones por batch
    
    for (const doc of snapshot.docs) {
      const budget = docToObject(doc);
      
      // Si ya tiene alertThresholds, saltar
      if (budget.alertThresholds && Array.isArray(budget.alertThresholds)) {
        skipped++;
        continue;
      }
      
      // Si tiene alertThreshold antiguo, convertirlo a array
      if (budget.alertThreshold !== undefined) {
        const updateData: any = {
          alertThresholds: [budget.alertThreshold],
          triggeredThresholds: budget.triggeredThresholds || [],
          updatedAt: Timestamp.now()
        };
        
        const budgetRef = db.collection("categoryBudgets").doc(doc.id);
        batch.update(budgetRef, objectToFirestore(updateData));
        batchCount++;
        migrated++;
        
        // Ejecutar batch si alcanza el límite
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          console.log(`✅ Migrados ${migrated} límites...`);
          batchCount = 0;
        }
      } else {
        // Sin umbrales configurados, usar por defecto
        const updateData: any = {
          alertThresholds: [80],
          triggeredThresholds: [],
          updatedAt: Timestamp.now()
        };
        
        const budgetRef = db.collection("categoryBudgets").doc(doc.id);
        batch.update(budgetRef, objectToFirestore(updateData));
        batchCount++;
        migrated++;
        
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          console.log(`✅ Migrados ${migrated} límites...`);
          batchCount = 0;
        }
      }
    }
    
    // Ejecutar batch final si hay operaciones pendientes
    if (batchCount > 0) {
      await batch.commit();
    }
    
    console.log(`✅ Migración completada:`);
    console.log(`   - Migrados: ${migrated}`);
    console.log(`   - Omitidos (ya migrados): ${skipped}`);
    console.log(`   - Total: ${snapshot.size}`);
    
  } catch (error: any) {
    console.error("❌ Error en migración:", error);
    throw error;
  }
}

export { migrateBudgetsToLimits };

