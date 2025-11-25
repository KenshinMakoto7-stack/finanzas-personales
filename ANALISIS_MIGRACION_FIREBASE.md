# 🔥 Análisis Exhaustivo: Migración a Firebase

## 📊 FASE 1: ANÁLISIS DEL SISTEMA ACTUAL

### 1.1 Modelos de Datos (Prisma Schema)

#### Modelos Identificados:
1. **User** - Usuario principal
2. **Account** - Cuentas bancarias/cash
3. **Category** - Categorías jerárquicas (con parentId)
4. **Transaction** - Transacciones (income/expense/transfer)
5. **MonthlyGoal** - Metas de ahorro mensuales
6. **CategoryBudget** - Presupuestos por categoría
7. **Tag** - Etiquetas para transacciones
8. **TransactionTag** - Relación many-to-many
9. **TransactionPattern** - Patrones reconocidos
10. **Debt** - Deudas con cuotas

#### Relaciones Críticas:
- User → Accounts (1:N)
- User → Categories (1:N, con jerarquía)
- User → Transactions (1:N)
- Category → Subcategories (auto-referencia)
- Transaction → Category (N:1)
- Transaction → Account (N:1)
- Transaction → Tags (N:M)
- Category → Budgets (1:N)
- User → Debts (1:N)

### 1.2 Sistema de Autenticación Actual

**Tecnología**: JWT + Argon2
- **Registro**: Hash de contraseña con Argon2
- **Login**: Verificación de hash, generación de JWT
- **Middleware**: Verificación de JWT en cada request
- **Password Recovery**: Token custom con expiración
- **Email**: Nodemailer para reset de contraseña

**Estructura JWT**:
```typescript
{ userId: string }
expiresIn: "7d"
```

### 1.3 Operaciones de Base de Datos

**Patrones Identificados**:
- `findMany` con filtros complejos (fechas, categorías, tipos)
- `findUnique` por ID
- `findFirst` con condiciones
- `create` con relaciones
- `update` con validaciones
- `delete` con cascadas
- `aggregate` para sumas y conteos
- `count` para paginación
- Queries con `include` para relaciones
- Índices en userId, fechas, categorías

**Queries Complejas**:
- Filtros por rango de fechas
- Búsqueda de texto (contains, insensitive)
- Agregaciones por categoría
- Cálculos de presupuesto diario
- Estadísticas por período

### 1.4 Lógica de Negocio Crítica

1. **Cálculo de Presupuesto Diario**:
   - Rollover de días anteriores
   - Considera metas de ahorro
   - Respeta timezone del usuario

2. **Conversión de Monedas**:
   - USD ↔ UYU
   - Conversión para estadísticas

3. **Jerarquía de Categorías**:
   - Validación de ciclos
   - Construcción de árboles

4. **Transacciones Recurrentes**:
   - Cálculo de nextOccurrence
   - Tracking de ocurrencias

5. **Deudas**:
   - Actualización automática de cuotas pagadas
   - Creación automática de categorías

---

## 🎯 FASE 2: DISEÑO DEL ESQUEMA FIRESTORE

### 2.1 Estructura de Colecciones

```
users/{userId}
  - email, name, currencyCode, locale, timeZone
  - createdAt

accounts/{accountId}
  - userId, name, type, currencyCode, createdAt

categories/{categoryId}
  - userId, name, type, parentId, icon, color, createdAt

transactions/{transactionId}
  - userId, accountId, categoryId, type, amountCents
  - currencyCode, occurredAt, description
  - isRecurring, recurringRule, nextOccurrence
  - isPaid, totalOccurrences, remainingOccurrences
  - createdAt

monthlyGoals/{goalId}
  - userId, month (Timestamp), savingGoalCents, createdAt

categoryBudgets/{budgetId}
  - userId, categoryId, month (Timestamp)
  - budgetCents, alertThreshold, createdAt, updatedAt

tags/{tagId}
  - userId, name, color, createdAt

transactionTags/{transactionTagId}
  - transactionId, tagId, createdAt

transactionPatterns/{patternId}
  - userId, amountCents, categoryId, accountId
  - descriptionPattern, dayOfWeek, dayOfMonth
  - frequency, lastMatched, createdAt, updatedAt

debts/{debtId}
  - userId, description, totalAmountCents
  - monthlyPaymentCents, totalInstallments
  - paidInstallments, startMonth (Timestamp)
  - currencyCode, createdAt, updatedAt
```

### 2.2 Índices Necesarios en Firestore

```
Collection: transactions
- userId + occurredAt (desc)
- userId + categoryId
- userId + accountId
- userId + isRecurring

Collection: categories
- userId
- userId + parentId

Collection: monthlyGoals
- userId + month

Collection: categoryBudgets
- userId + month
- userId + categoryId + month

Collection: debts
- userId
- userId + startMonth
```

### 2.3 Reglas de Seguridad Firestore

```javascript
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
    
    // Users: solo lectura de su propio perfil
    match /users/{userId} {
      allow read, write: if isOwner(userId);
    }
    
    // Accounts: solo del usuario
    match /accounts/{accountId} {
      allow read, write: if isOwner(resource.data.userId);
    }
    
    // Categories: solo del usuario
    match /categories/{categoryId} {
      allow read, write: if isOwner(resource.data.userId);
    }
    
    // Transactions: solo del usuario
    match /transactions/{transactionId} {
      allow read, write: if isOwner(resource.data.userId);
    }
    
    // Monthly Goals: solo del usuario
    match /monthlyGoals/{goalId} {
      allow read, write: if isOwner(resource.data.userId);
    }
    
    // Category Budgets: solo del usuario
    match /categoryBudgets/{budgetId} {
      allow read, write: if isOwner(resource.data.userId);
    }
    
    // Tags: solo del usuario
    match /tags/{tagId} {
      allow read, write: if isOwner(resource.data.userId);
    }
    
    // Transaction Tags: validar que transaction y tag pertenezcan al usuario
    match /transactionTags/{tagId} {
      allow read, write: if isAuthenticated() && 
        get(/databases/$(database)/documents/transactions/$(resource.data.transactionId)).data.userId == request.auth.uid;
    }
    
    // Transaction Patterns: solo del usuario
    match /transactionPatterns/{patternId} {
      allow read, write: if isOwner(resource.data.userId);
    }
    
    // Debts: solo del usuario
    match /debts/{debtId} {
      allow read, write: if isOwner(resource.data.userId);
    }
  }
}
```

---

## 🔄 FASE 3: PLAN DE MIGRACIÓN

### 3.1 Autenticación → Firebase Auth

**Cambios Necesarios**:
1. Reemplazar JWT por Firebase Auth Tokens
2. Usar `firebase-admin` en backend para verificar tokens
3. Migrar usuarios existentes a Firebase Auth (si hay)
4. Adaptar middleware de autenticación
5. Password recovery usando Firebase Auth

**Archivos a Modificar**:
- `apps/api/src/controllers/auth.controller.ts`
- `apps/api/src/server/middleware/auth.ts`
- `apps/api/src/lib/crypto.ts` (eliminar, usar Firebase)

### 3.2 Base de Datos → Firestore

**Cambios Necesarios**:
1. Reemplazar Prisma por Firebase Admin SDK
2. Crear funciones helper para queries comunes
3. Adaptar todas las operaciones CRUD
4. Implementar paginación con Firestore
5. Adaptar agregaciones (sum, count)
6. Implementar búsquedas de texto

**Archivos a Modificar**:
- `apps/api/src/lib/db.ts` → `apps/api/src/lib/firestore.ts`
- Todos los controladores (17 archivos)
- `apps/api/src/services/budget.service.ts`
- `apps/api/src/services/exchange.service.ts` (mantener)

### 3.3 Relaciones y Queries

**Estrategia**:
- **Relaciones 1:N**: Campo `userId` en cada documento
- **Relaciones N:1**: Campo `categoryId`, `accountId` en documentos
- **Relaciones N:M**: Colección separada `transactionTags`
- **Jerarquías**: Campo `parentId` (igual que ahora)
- **Queries complejas**: Usar `where` + `orderBy` + `limit`
- **Agregaciones**: Hacer en código (Firestore no tiene SQL aggregate)

### 3.4 Funcionalidades Especiales

**Cálculo de Presupuesto**:
- Mantener lógica en `budget.service.ts`
- Adaptar queries a Firestore

**Conversión de Monedas**:
- Mantener igual (no depende de BD)

**Transacciones Recurrentes**:
- Mantener lógica, adaptar queries

**Deudas**:
- Mantener lógica, adaptar queries
- Actualización de categorías igual

---

## 📋 FASE 4: PLAN DE EJECUCIÓN

### Paso 1: Setup Firebase
1. Crear proyecto en Firebase Console
2. Habilitar Authentication (Email/Password)
3. Habilitar Firestore Database
4. Configurar reglas de seguridad
5. Obtener credenciales de servicio

### Paso 2: Instalar Dependencias
```bash
npm install firebase-admin
npm uninstall @prisma/client prisma
```

### Paso 3: Configurar Firebase Admin
- Crear `apps/api/src/lib/firebase.ts`
- Inicializar Firebase Admin con credenciales

### Paso 4: Migrar Autenticación
- Adaptar `auth.controller.ts`
- Adaptar `middleware/auth.ts`
- Eliminar `crypto.ts`

### Paso 5: Crear Helpers de Firestore
- `apps/api/src/lib/firestore-helpers.ts`
- Funciones para queries comunes
- Funciones para agregaciones

### Paso 6: Migrar Controladores (uno por uno)
1. accounts.controller.ts
2. categories.controller.ts
3. transactions.controller.ts
4. goals.controller.ts
5. budgets.controller.ts
6. tags.controller.ts
7. patterns.controller.ts
8. debts.controller.ts
9. statistics.controller.ts
10. search.controller.ts
11. ... (resto)

### Paso 7: Migrar Servicios
- budget.service.ts
- Mantener exchange.service.ts

### Paso 8: Testing
- Probar cada endpoint
- Verificar autenticación
- Verificar queries complejas
- Verificar agregaciones

### Paso 9: Deployment
- Configurar variables de entorno
- Deploy a Firebase Functions o hosting

---

## ⚠️ CONSIDERACIONES IMPORTANTES

### Limitaciones de Firestore:
1. **No hay JOINs**: Necesitas hacer múltiples queries
2. **Agregaciones limitadas**: Hacer en código
3. **Búsqueda de texto**: Limitada (necesitas Algolia o similar)
4. **Transacciones**: Solo dentro del mismo documento
5. **Índices**: Deben crearse manualmente en Firebase Console

### Ventajas de Firebase:
1. **Escalabilidad automática**
2. **Tiempo real** (opcional)
3. **Gratis hasta cierto límite**
4. **Integración con otros servicios Firebase**

### Costos:
- **Spark Plan (Gratis)**: 
  - 50K lecturas/día
  - 20K escrituras/día
  - 20K borrados/día
  - 1GB almacenamiento
- **Blaze Plan (Pay as you go)**:
  - $0.06 por 100K lecturas
  - $0.18 por 100K escrituras
  - $0.02 por 100K borrados

---

## ✅ DECISIÓN FINAL

**¿Proceder con la migración?**

**Pros**:
- Ya tienes cuenta Firebase
- Escalabilidad automática
- Integración con otros servicios

**Contras**:
- Requiere reescribir ~80% del código de base de datos
- Cambios en autenticación
- Testing exhaustivo necesario
- Tiempo estimado: 8-12 horas

**Alternativa más rápida**: Render.com (2 horas, sin cambios de código)

¿Quieres que proceda con la migración completa a Firebase?

