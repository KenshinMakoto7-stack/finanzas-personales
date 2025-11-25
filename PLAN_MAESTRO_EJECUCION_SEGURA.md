# 🎯 PLAN MAESTRO DE EJECUCIÓN SEGURA
## Director Técnico de Proyecto + DevOps/QA

**Fecha:** $(date)  
**Basado en:** AUDITORIA_CONSOLIDADA.md  
**Objetivo:** Implementar correcciones críticas sin romper el sistema actual

---

## 📋 FASE 1: ANÁLISIS DE DEPENDENCIAS Y RIESGOS

### 1.1 Análisis de Bloqueos y Dependencias

**🔴 BLOQUEADOR PRINCIPAL: Autenticación Rota**
- **Problema:** Login no verifica contraseña (CRÍTICO 1.1)
- **Bloquea:** Toda la aplicación - usuarios no pueden autenticarse correctamente
- **Dependencias:** 
  - Frontend espera tokens JWT, backend genera custom tokens
  - Middleware de auth depende de tokens válidos
- **Riesgo:** Si se corrige mal, se bloquea TODO el acceso

**🟠 BLOQUEADOR SECUNDARIO: Queries Inválidos `__name__`**
- **Problema:** 24 instancias de queries inválidos (CRÍTICO 1.2)
- **Bloquea:** Funcionalidades que cargan relaciones (transacciones, estadísticas, búsqueda)
- **Dependencias:** 
  - Múltiples controladores afectados (8 archivos)
  - Si se corrige mal, datos no se cargan correctamente
- **Riesgo:** Medio - la app funciona pero con datos incompletos

**🟡 NO BLOQUEADORES (pero críticos):**
- Validación de variables de entorno (CRÍTICO 1.3) - Solo afecta startup
- Reglas de Firestore (CRÍTICO 1.4) - Solo afecta seguridad, no funcionalidad
- Conversión de monedas (CRÍTICO 1.5) - Solo afecta cálculos
- Búsqueda de texto (CRÍTICO 1.6) - Solo afecta búsqueda
- Índices faltantes (CRÍTICO 1.7) - Solo afecta performance en producción
- Operaciones no atómicas (CRÍTICO 1.8) - Solo afecta integridad de datos

### 1.2 Módulos Frágiles que Requieren Testeo Obligatorio

**🔴 MÁXIMA FRAGILIDAD:**
1. **`apps/api/src/controllers/auth.controller.ts`** (líneas 74-123)
   - Login actual NO verifica contraseña
   - Genera custom tokens sin validación
   - **Test obligatorio:** Verificar que login rechaza contraseñas incorrectas

2. **`apps/api/src/lib/firebase.ts`** (líneas 1-34)
   - No valida variables de entorno
   - Puede fallar silenciosamente
   - **Test obligatorio:** Verificar que falla con mensaje claro si faltan credenciales

**🟠 ALTA FRAGILIDAD:**
3. **8 controladores con queries `__name__`:**
   - `transactions.controller.ts` (líneas 109-110, 119)
   - `statistics.controller.ts` (líneas 82, 90, 303, 364-365, 455)
   - `search.controller.ts` (líneas 77-78, 87)
   - `notifications.controller.ts` (líneas 85-86, 124)
   - `patterns.controller.ts` (líneas 31-32, 193-194, 235-236)
   - `reports.controller.ts` (línea 37)
   - `export.controller.ts` (líneas 31-32)
   - **Test obligatorio:** Verificar que las relaciones se cargan correctamente

4. **`apps/api/src/controllers/transactions.controller.ts`** (líneas 214-245)
   - Actualización de deuda no atómica
   - **Test obligatorio:** Verificar que transacción + actualización de deuda es atómica

5. **`apps/api/src/controllers/debts.controller.ts`**
   - Creación de deuda + categoría no atómica
   - **Test obligatorio:** Verificar atomicidad

### 1.3 Unidad Mínima de Trabajo Seguro

**Estrategia de Unidad de Trabajo:**
- **Por archivo:** Cada corrección se hace en un archivo completo antes de pasar al siguiente
- **Por función:** Dentro de cada archivo, se corrige función por función
- **Validación incremental:** Después de cada archivo, se ejecuta test manual antes de continuar

**Orden de Ejecución:**
1. **Validación de entorno** (firebase.ts) - No rompe nada, solo agrega validación
2. **Corrección de autenticación** (auth.controller.ts) - BLOQUEADOR PRINCIPAL
3. **Corrección de queries** (8 archivos) - BLOQUEADOR SECUNDARIO
4. **Operaciones atómicas** (transactions, debts) - Integridad de datos
5. **Mejoras de seguridad** (reglas, validaciones) - Seguridad

---

## 📋 FASE 2: PREGUNTAS DE CALIBRACIÓN

### 2.1 Información Crítica Necesaria

**❓ PREGUNTA 1: Entorno de Desarrollo vs Producción**
- ¿Estamos corrigiendo en desarrollo local o directamente en producción?
- **Recomendación:** Desarrollo local primero, luego staging, luego producción
- **Si falta:** Asumir desarrollo local

**❓ PREGUNTA 2: Estrategia de Autenticación**
- ¿Prefieres que el frontend use Firebase Auth directamente (recomendado) o mantener el backend como intermediario?
- **Opciones:**
  - **Opción A:** Frontend autentica con Firebase Auth, backend verifica ID tokens (MÁS SEGURO)
  - **Opción B:** Backend verifica contraseña con Firebase Auth REST API, genera custom token (MÁS COMPLEJO)
- **Si falta:** Implementar Opción A (más segura y estándar)

**❓ PREGUNTA 3: Datos de Prueba**
- ¿Tienes usuarios de prueba en Firebase Auth para testear login?
- **Si falta:** Crear usuario de prueba durante la implementación

**❓ PREGUNTA 4: Estrategia de Rollback**
- ¿Tienes control de versiones (Git) configurado?
- **Si falta:** Asumir que sí (estándar)

**❓ PREGUNTA 5: Testing Manual vs Automatizado**
- ¿Prefieres tests manuales paso a paso o crear tests automatizados primero?
- **Recomendación:** Tests manuales primero (más rápido), automatizados después
- **Si falta:** Tests manuales

### 2.2 Respuestas del Usuario (CONFIRMADAS)

1. **Entorno:** ✅ Desarrollo local primero, luego staging, luego producción
2. **Autenticación:** ✅ Opción A (Frontend con Firebase Auth directo)
3. **Testing:** ✅ Manual primero (ejecutados por asistente), automatizados después
4. **Rollback:** ✅ Git configurado y disponible (verificado)
5. **Datos:** ✅ Crear usuario de prueba durante implementación, borrarlo después

---

## 📋 FASE 3: PLAN DE IMPLEMENTACIÓN ITERATIVO

### 🎯 PRINCIPIO RECTOR
**"Corrige → Verifica → Consolida → Siguiente paso"**

Cada paso debe ser:
- ✅ Independiente (no rompe si falla)
- ✅ Verificable (test claro)
- ✅ Reversible (rollback fácil)
- ✅ Documentado (qué cambió y por qué)

---

## PASO 1: Validación de Variables de Entorno
**Prioridad:** 🔴 CRÍTICA (pero no bloquea funcionalidad)

### La Acción:
Modificar `apps/api/src/lib/firebase.ts` para validar que las variables de entorno críticas existan al iniciar.

### El Objetivo:
Soluciona **CRÍTICO 1.3** - Evita que la app falle silenciosamente si faltan credenciales.

### Código a Implementar:
```typescript
// Agregar al inicio de firebase.ts, antes de inicializar
if (!admin.apps.length) {
  // Validar que existe al menos una forma de autenticarse
  if (!process.env.FIREBASE_SERVICE_ACCOUNT && 
      !process.env.FIREBASE_SERVICE_ACCOUNT_PATH && 
      !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error(
      'CRITICAL: Firebase credentials not found. ' +
      'Set FIREBASE_SERVICE_ACCOUNT, FIREBASE_SERVICE_ACCOUNT_PATH, or GOOGLE_APPLICATION_CREDENTIALS'
    );
  }

  // Si se usa PATH, validar que el archivo existe
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const fs = require('fs');
    const path = require('path');
    const fullPath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    if (!fs.existsSync(fullPath)) {
      throw new Error(
        `CRITICAL: Firebase service account file not found: ${fullPath}`
      );
    }
  }

  // ... resto del código de inicialización
}
```

### El Check de Validación:
```bash
# Test 1: Sin variables de entorno (debe fallar con mensaje claro)
unset FIREBASE_SERVICE_ACCOUNT
unset FIREBASE_SERVICE_ACCOUNT_PATH
cd apps/api
npm run dev
# ✅ ESPERADO: Error claro indicando que faltan credenciales
# ❌ NO ESPERADO: Error críptico o fallo silencioso

# Test 2: Con variables válidas (debe funcionar)
export FIREBASE_SERVICE_ACCOUNT_PATH="./path/to/serviceAccount.json"
npm run dev
# ✅ ESPERADO: Servidor inicia correctamente
# ❌ NO ESPERADO: Error de inicialización
```

### Rollback:
```bash
# Si falla, revertir cambios en firebase.ts
git checkout apps/api/src/lib/firebase.ts
```

### Archivos Afectados:
- `apps/api/src/lib/firebase.ts`

### Tiempo Estimado:
5 minutos

---

## PASO 2: Corrección de Autenticación - Backend (Verificación de Contraseña)
**Prioridad:** 🔴 CRÍTICA - BLOQUEADOR PRINCIPAL

### La Acción:
Modificar `apps/api/src/controllers/auth.controller.ts` para que el login verifique la contraseña usando Firebase Auth REST API.

### El Objetivo:
Soluciona **CRÍTICO 1.1** - El login actual NO verifica contraseña, cualquiera puede acceder con solo el email.

### Código a Implementar:
```typescript
// En login function (línea 74)
export async function login(req: Request, res: Response) {
  try {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join(", ");
      return res.status(400).json({ error: `Error de validación: ${errors}` });
    }

    const { email, password } = parsed.data;

    // OPCIÓN A: Usar Firebase Auth REST API para verificar contraseña
    // Esto requiere API_KEY de Firebase
    const API_KEY = process.env.FIREBASE_API_KEY;
    if (!API_KEY) {
      console.warn('FIREBASE_API_KEY not set, using custom token without password verification');
      // Fallback al comportamiento actual (NO SEGURO, pero no rompe)
      // TODO: Agregar FIREBASE_API_KEY a variables de entorno
    }

    // Verificar credenciales con Firebase Auth REST API
    try {
      const verifyResponse = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, returnSecureToken: true })
        }
      );

      const verifyData = await verifyResponse.json();

      if (!verifyResponse.ok || verifyData.error) {
        return res.status(401).json({ error: "Credenciales inválidas" });
      }

      // Si la verificación fue exitosa, obtener datos del usuario
      const userId = verifyData.localId;
      const userRecord = await auth.getUser(userId);

      // Obtener datos del usuario de Firestore
      const userDoc = await db.collection("users").doc(userId).get();
      if (!userDoc.exists) {
        return res.status(401).json({ error: "Credenciales inválidas" });
      }

      const userData = userDoc.data()!;

      // Generar custom token para el cliente
      const customToken = await auth.createCustomToken(userId);

      res.json({
        token: customToken,
        user: {
          id: userId,
          email: userRecord.email,
          name: userData.name,
          currencyCode: userData.currencyCode || "USD",
          locale: userData.locale || "en-US",
          timeZone: userData.timeZone || "UTC"
        }
      });
    } catch (error: any) {
      console.error("Login verification error:", error);
      return res.status(401).json({ error: "Credenciales inválidas" });
    }
  } catch (error: any) {
    console.error("Login error:", error);
    res.status(500).json({ error: error.message || "Error al iniciar sesión" });
  }
}
```

### El Check de Validación:
```bash
# Test 1: Login con contraseña correcta (debe funcionar)
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
# ✅ ESPERADO: 200 OK con token y datos de usuario
# ❌ NO ESPERADO: 401 o error

# Test 2: Login con contraseña incorrecta (debe rechazar)
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"wrongpassword"}'
# ✅ ESPERADO: 401 Unauthorized con mensaje "Credenciales inválidas"
# ❌ NO ESPERADO: 200 OK con token

# Test 3: Login con email inexistente (debe rechazar)
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"nonexistent@example.com","password":"anypassword"}'
# ✅ ESPERADO: 401 Unauthorized
# ❌ NO ESPERADO: 200 OK
```

### Rollback:
```bash
# Si falla, revertir cambios
git checkout apps/api/src/controllers/auth.controller.ts
```

### Archivos Afectados:
- `apps/api/src/controllers/auth.controller.ts`
- `.env` (agregar FIREBASE_API_KEY)

### Tiempo Estimado:
15 minutos

### Nota Importante:
Si no tienes `FIREBASE_API_KEY`, puedes obtenerla de:
- Firebase Console → Project Settings → General → Web API Key

---

## PASO 3: Corrección de Queries `__name__` - Helper Function
**Prioridad:** 🔴 CRÍTICA - BLOQUEADOR SECUNDARIO

### La Acción:
Crear función helper en `apps/api/src/lib/firestore-helpers.ts` para hacer queries por IDs de forma correcta (usando `FieldPath.documentId()` y chunking).

### El Objetivo:
Soluciona **CRÍTICO 1.2** - Los queries `__name__` no funcionan en Firestore. Necesitamos usar `FieldPath.documentId()` y dividir en chunks de 10.

### Código a Implementar:
```typescript
// Agregar a apps/api/src/lib/firestore-helpers.ts
import { FieldPath } from 'firebase-admin/firestore';

/**
 * Helper para dividir array en chunks
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Obtener documentos por IDs (respeta límite de 10 de Firestore)
 */
export async function getDocumentsByIds<T = any>(
  collection: string,
  ids: string[]
): Promise<T[]> {
  if (ids.length === 0) {
    return [];
  }

  // Firestore limita queries "in" a 10 elementos
  const chunks = chunkArray(ids, 10);
  
  const results = await Promise.all(
    chunks.map(chunk =>
      db.collection(collection)
        .where(FieldPath.documentId(), "in", chunk)
        .get()
    )
  );

  const allDocs = results.flatMap(snapshot => snapshot.docs);
  return allDocs.map(doc => docToObject(doc) as T);
}
```

### El Check de Validación:
```bash
# Test 1: Compilar sin errores
cd apps/api
npm run build
# ✅ ESPERADO: Build exitoso sin errores TypeScript
# ❌ NO ESPERADO: Errores de compilación

# Test 2: Verificar que la función existe
# (Se verificará en el siguiente paso cuando se use)
```

### Rollback:
```bash
# Si falla, revertir cambios
git checkout apps/api/src/lib/firestore-helpers.ts
```

### Archivos Afectados:
- `apps/api/src/lib/firestore-helpers.ts`

### Tiempo Estimado:
10 minutos

---

## PASO 4: Corrección de Queries `__name__` - Reemplazar en Controladores
**Prioridad:** 🔴 CRÍTICA - BLOQUEADOR SECUNDARIO

### La Acción:
Reemplazar todas las instancias de `.where("__name__", "in", ids)` con la nueva función helper `getDocumentsByIds()`.

### El Objetivo:
Soluciona **CRÍTICO 1.2** - Aplica la corrección a los 8 archivos afectados.

### Archivos a Modificar (en orden de prioridad):

#### 4.1 `transactions.controller.ts` (líneas 109-110, 119)
```typescript
// ANTES:
const [categoriesSnapshot, accountsSnapshot, tagsSnapshot] = await Promise.all([
  categoryIds.length > 0 ? db.collection("categories").where("__name__", "in", categoryIds).get() : Promise.resolve({ docs: [] }),
  accountIds.length > 0 ? db.collection("accounts").where("__name__", "in", accountIds).get() : Promise.resolve({ docs: [] }),
  // ...
]);
const tagsDocs = tagIds.length > 0 ? await db.collection("tags").where("__name__", "in", tagIds).get() : { docs: [] };

// DESPUÉS:
import { getDocumentsByIds } from "../lib/firestore-helpers.js";

const [categories, accounts, tags] = await Promise.all([
  getDocumentsByIds("categories", categoryIds),
  getDocumentsByIds("accounts", accountIds),
  getDocumentsByIds("tags", tagIds)
]);

const categoriesMap = new Map(categories.map(cat => [cat.id, cat]));
const accountsMap = new Map(accounts.map(acc => [acc.id, acc]));
const tagsMap = new Map(tags.map(tag => [tag.id, tag]));
```

#### 4.2 `statistics.controller.ts` (líneas 82, 90, 303, 364-365, 455)
```typescript
// Similar reemplazo en todas las instancias
```

#### 4.3 `search.controller.ts` (líneas 77-78, 87)
#### 4.4 `notifications.controller.ts` (líneas 85-86, 124)
#### 4.5 `patterns.controller.ts` (líneas 31-32, 193-194, 235-236)
#### 4.6 `reports.controller.ts` (línea 37)
#### 4.7 `export.controller.ts` (líneas 31-32)

### El Check de Validación (por archivo):
```bash
# Test 1: Compilar sin errores
cd apps/api
npm run build
# ✅ ESPERADO: Build exitoso

# Test 2: Probar endpoint que usa el controlador
# Ejemplo para transactions:
curl -X GET http://localhost:4000/api/transactions \
  -H "Authorization: Bearer YOUR_TOKEN"
# ✅ ESPERADO: 200 OK con transacciones y relaciones cargadas (categories, accounts, tags)
# ❌ NO ESPERADO: 500 Error o relaciones vacías/null

# Test 3: Verificar logs del servidor
# ✅ ESPERADO: No hay errores de "FieldPath" o "__name__"
# ❌ NO ESPERADO: Errores de query
```

### Rollback:
```bash
# Si falla un archivo específico, revertir solo ese archivo
git checkout apps/api/src/controllers/[nombre].controller.ts
```

### Archivos Afectados:
- `apps/api/src/controllers/transactions.controller.ts`
- `apps/api/src/controllers/statistics.controller.ts`
- `apps/api/src/controllers/search.controller.ts`
- `apps/api/src/controllers/notifications.controller.ts`
- `apps/api/src/controllers/patterns.controller.ts`
- `apps/api/src/controllers/reports.controller.ts`
- `apps/api/src/controllers/export.controller.ts`

### Tiempo Estimado:
30 minutos (4 minutos por archivo)

### Estrategia:
**Hacer un archivo a la vez, verificar, luego continuar.**

---

## PASO 5: Operaciones Atómicas - Transacciones y Deudas
**Prioridad:** 🔴 CRÍTICA - Integridad de datos

### La Acción:
Modificar `apps/api/src/controllers/transactions.controller.ts` y `debts.controller.ts` para usar batch writes de Firestore en operaciones que requieren atomicidad.

### El Objetivo:
Soluciona **CRÍTICO 1.8** - Cuando se crea una transacción de deuda, debe actualizar `paidInstallments` de forma atómica.

### Código a Implementar:

#### 5.1 `transactions.controller.ts` (líneas 214-245)
```typescript
// Buscar la sección donde se crea transacción y se actualiza deuda
// Reemplazar con batch write

import { db } from "../lib/firebase.js";
import { Timestamp } from "firebase-admin/firestore";

// En la función createTransaction, después de validar que es una deuda:
if (needsDebtUpdate && debtId) {
  const debtRef = db.collection("debts").doc(debtId);
  const debtDoc = await debtRef.get();
  
  if (debtDoc.exists) {
    const debt = docToObject(debtDoc);
    const newPaidInstallments = (debt.paidInstallments || 0) + 1;
    
    // Usar batch write para atomicidad
    const batch = db.batch();
    const transactionRef = db.collection("transactions").doc();
    
    batch.set(transactionRef, objectToFirestore({
      ...transactionData,
      id: transactionRef.id
    }));
    
    batch.update(debtRef, {
      paidInstallments: newPaidInstallments,
      updatedAt: Timestamp.now()
    });
    
    await batch.commit();
    
    // Retornar transacción creada
    const createdDoc = await transactionRef.get();
    return res.status(201).json({ transaction: docToObject(createdDoc) });
  }
}
```

#### 5.2 `debts.controller.ts` (creación de deuda + categoría)
```typescript
// Similar: usar batch write para crear deuda y categoría atómicamente
```

### El Check de Validación:
```bash
# Test 1: Crear transacción de deuda
curl -X POST http://localhost:4000/api/transactions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amountCents": 10000,
    "type": "EXPENSE",
    "categoryId": "deuda-subcategory-id",
    "description": "Pago de deuda",
    "occurredAt": "2024-11-20T10:00:00Z"
  }'
# ✅ ESPERADO: 201 Created con transacción
# Verificar en Firestore que:
# - La transacción existe
# - El campo paidInstallments de la deuda se incrementó en 1
# ❌ NO ESPERADO: Transacción creada pero deuda no actualizada (o viceversa)

# Test 2: Simular fallo (desconectar internet durante commit)
# ✅ ESPERADO: O ambos se crean o ninguno (atomicidad)
# ❌ NO ESPERADO: Solo uno se crea
```

### Rollback:
```bash
# Si falla, revertir cambios
git checkout apps/api/src/controllers/transactions.controller.ts
git checkout apps/api/src/controllers/debts.controller.ts
```

### Archivos Afectados:
- `apps/api/src/controllers/transactions.controller.ts`
- `apps/api/src/controllers/debts.controller.ts`

### Tiempo Estimado:
20 minutos

---

## PASO 6: Mejora de Reglas de Firestore
**Prioridad:** 🔴 CRÍTICA - Seguridad

### La Acción:
Mejorar `apps/api/firestore.rules` para agregar validaciones de tipos y valores en `create`.

### El Objetivo:
Soluciona **CRÍTICO 1.4** - Las reglas actuales no validan tipos de datos ni valores en create.

### Código a Implementar:
```javascript
// Mejorar firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper: usuario autenticado
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Helper: es el dueño del recurso
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }
    
    // Helper: validar que userId coincide con auth.uid
    function isValidUserId() {
      return request.resource.data.userId == request.auth.uid;
    }
    
    // Transactions: validaciones mejoradas
    match /transactions/{transactionId} {
      allow create: if isAuthenticated() && 
        isValidUserId() &&
        request.resource.data.amountCents is int &&
        request.resource.data.amountCents > 0 &&
        request.resource.data.type in ['INCOME', 'EXPENSE', 'TRANSFER'] &&
        request.resource.data.occurredAt is timestamp;
      allow read, update, delete: if isOwner(resource.data.userId);
      allow update: if isOwner(resource.data.userId) &&
        request.resource.data.amountCents is int &&
        request.resource.data.amountCents > 0;
    }
    
    // Accounts: validaciones mejoradas
    match /accounts/{accountId} {
      allow create: if isAuthenticated() && 
        isValidUserId() &&
        request.resource.data.name is string &&
        request.resource.data.name.size() > 0 &&
        request.resource.data.name.size() <= 100 &&
        request.resource.data.type in ['CASH', 'BANK', 'CREDIT', 'SAVINGS', 'OTHER'];
      allow read, update, delete: if isOwner(resource.data.userId);
    }
    
    // Categories: validaciones mejoradas
    match /categories/{categoryId} {
      allow create: if isAuthenticated() && 
        isValidUserId() &&
        request.resource.data.name is string &&
        request.resource.data.name.size() > 0 &&
        request.resource.data.name.size() <= 100;
      allow read, update, delete: if isOwner(resource.data.userId);
    }
    
    // ... resto de colecciones con validaciones similares
  }
}
```

### El Check de Validación:
```bash
# Test 1: Desplegar reglas a Firebase
firebase deploy --only firestore:rules
# ✅ ESPERADO: Deploy exitoso

# Test 2: Intentar crear transacción con amountCents negativo (debe fallar)
curl -X POST http://localhost:4000/api/transactions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amountCents": -1000,
    "type": "EXPENSE",
    "description": "Test"
  }'
# ✅ ESPERADO: 403 Forbidden (reglas de Firestore rechazan)
# ❌ NO ESPERADO: 201 Created

# Test 3: Intentar crear transacción para otro usuario (debe fallar)
# ✅ ESPERADO: 403 Forbidden
# ❌ NO ESPERADO: 201 Created
```

### Rollback:
```bash
# Si falla, revertir reglas
git checkout apps/api/firestore.rules
firebase deploy --only firestore:rules
```

### Archivos Afectados:
- `apps/api/firestore.rules`

### Tiempo Estimado:
15 minutos

### Nota Importante:
Las reglas de Firestore se validan en el cliente también, pero el backend debe validar también (defensa en profundidad).

---

## PASO 7: Validación de Conversión de Monedas
**Prioridad:** 🔴 CRÍTICA - Integridad de datos

### La Acción:
Crear wrapper seguro `safeConvertCurrency()` y usarlo en todos los lugares donde se convierte moneda.

### El Objetivo:
Soluciona **CRÍTICO 1.5** - Si la conversión falla, no debe corromper los cálculos.

### Código a Implementar:
```typescript
// Agregar a apps/api/src/services/exchange.service.ts
export async function safeConvertCurrency(
  amount: number,
  from: string,
  to: string
): Promise<number> {
  try {
    // Si es la misma moneda, retornar sin conversión
    if (from === to) {
      return amount;
    }

    const converted = await convertCurrency(amount, from, to);
    
    // Validar resultado
    if (isNaN(converted) || converted < 0 || !isFinite(converted)) {
      console.error(`Invalid conversion: ${amount} ${from} -> ${to}, result: ${converted}`);
      // Fallback: retornar cantidad original
      return amount;
    }
    
    return converted;
  } catch (error) {
    console.error('Currency conversion failed:', error, { amount, from, to });
    // Fallback: retornar cantidad original
    return amount;
  }
}
```

Luego reemplazar en `statistics.controller.ts`:
```typescript
// ANTES:
await convertCurrency(tx.amountCents, tx.currencyCode, baseCurrency)

// DESPUÉS:
await safeConvertCurrency(tx.amountCents, tx.currencyCode, baseCurrency)
```

### El Check de Validación:
```bash
# Test 1: Conversión normal (debe funcionar)
# ✅ ESPERADO: Conversión correcta USD -> UYU

# Test 2: Simular fallo de API (desconectar internet)
# ✅ ESPERADO: Retorna cantidad original (fallback seguro)
# ❌ NO ESPERADO: NaN o error que rompe cálculos

# Test 3: Verificar logs
# ✅ ESPERADO: Logs de error si falla, pero no rompe
# ❌ NO ESPERADO: Errores no manejados
```

### Rollback:
```bash
git checkout apps/api/src/services/exchange.service.ts
git checkout apps/api/src/controllers/statistics.controller.ts
```

### Archivos Afectados:
- `apps/api/src/services/exchange.service.ts`
- `apps/api/src/controllers/statistics.controller.ts`
- Otros controladores que usen conversión

### Tiempo Estimado:
15 minutos

---

## 📊 RESUMEN DE PLAN DE EJECUCIÓN

### Orden de Ejecución:
1. ✅ **PASO 1:** Validación de variables de entorno (5 min)
2. ✅ **PASO 2:** Corrección de autenticación (15 min)
3. ✅ **PASO 3:** Helper para queries (10 min)
4. ✅ **PASO 4:** Reemplazar queries en controladores (30 min)
5. ✅ **PASO 5:** Operaciones atómicas (20 min)
6. ✅ **PASO 6:** Mejoras de reglas Firestore (15 min)
7. ✅ **PASO 7:** Validación de conversión de monedas (15 min)

### Tiempo Total Estimado:
**~2 horas** (incluyendo tests y verificación)

### Puntos de Control:
- Después de cada paso, ejecutar tests de validación
- Si un paso falla, hacer rollback antes de continuar
- Documentar cualquier desviación del plan

### Próximos Pasos (Después de Críticos):
- Búsqueda de texto eficiente (CRÍTICO 1.6)
- Índices de Firestore (CRÍTICO 1.7)
- Mejoras de "MUY IMPORTANTE" (Fase 2)

---

## 🚨 REGLAS DE ORO

1. **NUNCA** hacer múltiples cambios críticos a la vez
2. **SIEMPRE** verificar después de cada paso
3. **SIEMPRE** tener plan de rollback
4. **SIEMPRE** documentar cambios
5. **NUNCA** saltar tests de validación

---

**Documento generado:** $(date)  
**Versión:** 1.0  
**Estado:** Listo para ejecución

