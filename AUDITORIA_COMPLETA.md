# 🔍 AUDITORÍA INTEGRAL - FINANZAS PERSONALES

**Fecha:** $(date)  
**Auditor:** Sistema de Análisis Multidisciplinario  
**Alcance:** Código completo del proyecto (Backend + Frontend)

---

## 🚨 1. CRÍTICO Y URGENTE (Must Fix)

### 1.1 **AUTENTICACIÓN ROTA - Flujo de Login Incompleto**
**Ubicación:** `apps/api/src/controllers/auth.controller.ts:30-45`, `apps/web/store/auth.ts`

**Problema:**
- El backend genera `customToken` de Firebase, pero el frontend NO lo usa correctamente
- El frontend espera un JWT tradicional, pero recibe un custom token
- El flujo actual: Backend → Custom Token → Frontend (no lo procesa) → Request sin token válido

**Impacto:** Los usuarios NO pueden autenticarse. La app está rota.

**Solución Inmediata:**
```typescript
// apps/web/lib/firebase-client.ts (CREAR)
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken } from 'firebase/auth';

// En authStore.ts después de login:
const customToken = response.data.token;
const auth = getAuth();
const userCredential = await signInWithCustomToken(auth, customToken);
const idToken = await userCredential.user.getIdToken();
setAuthToken(idToken); // Usar ID token, no custom token
```

**Prioridad:** 🔴 CRÍTICA - Bloquea toda la aplicación

---

### 1.2 **QUERY INVALIDO EN FIRESTORE - `__name__` No Existe**
**Ubicación:** Múltiples archivos (transactions, tags, budgets, statistics, etc.)

**Problema:**
```typescript
// INCORRECTO - Esto NO funciona en Firestore
.where("__name__", "in", categoryIds)
```

Firestore NO tiene `__name__` como campo. Para buscar por IDs, debes usar `FieldPath.documentId()` o hacer queries individuales.

**Impacto:** Queries fallan silenciosamente o retornan datos incorrectos. Las relaciones no se cargan.

**Solución Inmediata:**
```typescript
// Reemplazar TODAS las instancias de:
.where("__name__", "in", ids)

// Por:
import { FieldPath } from 'firebase-admin/firestore';
.where(FieldPath.documentId(), "in", ids)

// O mejor aún, usar batch gets:
const docs = await Promise.all(
  ids.map(id => db.collection("categories").doc(id).get())
);
```

**Archivos Afectados:**
- `transactions.controller.ts:78-82`
- `tags.controller.ts:50+`
- `budgets.controller.ts:30+`
- `statistics.controller.ts:75+`
- `export.controller.ts:25+`
- `patterns.controller.ts:100+`
- `notifications.controller.ts:60+`
- `search.controller.ts:25+`

**Prioridad:** 🔴 CRÍTICA - Rompe funcionalidad core

---

### 1.3 **FALTA VALIDACIÓN DE FIRESTORE RULES EN PRODUCCIÓN**
**Ubicación:** `apps/api/firestore.rules`

**Problema:**
- Las reglas usan `get()` que tiene límite de 10 llamadas por documento
- No hay validación de tipos de datos
- `transactionTags` tiene lógica compleja que puede fallar
- No hay rate limiting en las reglas

**Impacto:** Vulnerabilidades de seguridad, posibles accesos no autorizados, costos elevados.

**Solución:**
```javascript
// Agregar validación de tipos
match /transactions/{transactionId} {
  allow create: if isAuthenticated() 
    && request.resource.data.userId == request.auth.uid
    && request.resource.data.amountCents is int
    && request.resource.data.amountCents > 0
    && request.resource.data.type in ['INCOME', 'EXPENSE', 'TRANSFER'];
}
```

**Prioridad:** 🔴 CRÍTICA - Seguridad

---

### 1.4 **CONVERSIÓN DE MONEDAS SIN VALIDACIÓN DE ERRORES**
**Ubicación:** `apps/api/src/controllers/statistics.controller.ts:55-60`, múltiples lugares

**Problema:**
```typescript
await convertCurrency(tx.amountCents, tx.currencyCode, baseCurrency)
```
Si `convertCurrency` falla o retorna `NaN`, se propaga silenciosamente y corrompe los cálculos.

**Impacto:** Estadísticas incorrectas, balances erróneos, decisiones financieras basadas en datos corruptos.

**Solución:**
```typescript
try {
  const converted = await convertCurrency(amount, from, to);
  if (isNaN(converted) || converted < 0) {
    console.error(`Invalid conversion: ${amount} ${from} -> ${to}`);
    return amount; // Fallback seguro
  }
  return converted;
} catch (error) {
  console.error('Currency conversion failed:', error);
  return amount; // Fallback
}
```

**Prioridad:** 🔴 CRÍTICA - Integridad de datos

---

### 1.5 **BÚSQUEDA DE TEXTO INEFICIENTE Y LIMITADA**
**Ubicación:** `apps/api/src/controllers/search.controller.ts:20-50`, `transactions.controller.ts:50+`

**Problema:**
- Se traen TODOS los documentos y se filtra en memoria
- No hay límite real en la cantidad de datos procesados
- Búsqueda case-sensitive en algunos lugares
- No hay índices para búsqueda de texto

**Impacto:** 
- Performance degradada con muchos datos
- Timeouts en producción
- Costos elevados de Firestore (lee muchos documentos innecesarios)

**Solución:**
```typescript
// Usar Algolia o Elasticsearch para búsqueda de texto
// O implementar búsqueda por prefijo con índices
.where("description_lower", ">=", searchTerm.toLowerCase())
.where("description_lower", "<=", searchTerm.toLowerCase() + "\uf8ff")
.limit(50) // Límite estricto
```

**Prioridad:** 🔴 CRÍTICA - Performance y costos

---

## ⚠️ 2. MUY IMPORTANTE (Should Fix)

### 2.1 **FALTA DE TRANSACCIONES ATÓMICAS EN OPERACIONES CRÍTICAS**
**Ubicación:** `apps/api/src/controllers/debts.controller.ts:120+`, `transactions.controller.ts:140+`

**Problema:**
```typescript
// Crear transacción
await db.collection("transactions").add(...);

// Luego actualizar deuda (separado - NO atómico)
await db.collection("debts").doc(debtId).update(...);
```

Si el segundo paso falla, la transacción queda creada pero la deuda no se actualiza. Inconsistencia de datos.

**Solución:**
```typescript
const batch = db.batch();
batch.set(db.collection("transactions").doc(), transactionData);
batch.update(db.collection("debts").doc(debtId), { paidInstallments: ... });
await batch.commit(); // Todo o nada
```

**Archivos Afectados:**
- `debts.controller.ts` - Creación de deuda + categoría
- `transactions.controller.ts` - Crear transacción + actualizar deuda
- `tags.controller.ts` - Crear tag + relaciones

**Prioridad:** 🟠 ALTA - Integridad de datos

---

### 2.2 **N+1 QUERIES EN ESTADÍSTICAS**
**Ubicación:** `apps/api/src/controllers/statistics.controller.ts:110-150`

**Problema:**
```typescript
// Por cada mes (12 iteraciones)
Array.from({ length: 12 }, async (_, i) => {
  // Cada una hace múltiples queries
  const incomeSnapshot = await db.collection("transactions")...
  const expenseSnapshot = await db.collection("transactions")...
  // Y luego convierte cada transacción individualmente
  await Promise.all(incomeTransactions.map(async (tx) => 
    await convertCurrency(...) // N queries más
  ));
});
```

**Impacto:** 
- 12 meses × 2 queries × N transacciones × conversiones = Cientos de queries
- Tiempo de respuesta: 5-10 segundos
- Costos de Firestore: Muy altos

**Solución:**
```typescript
// Una query para todo el año
const yearSnapshot = await db.collection("transactions")
  .where("userId", "==", userId)
  .where("occurredAt", ">=", yearStart)
  .where("occurredAt", "<=", yearEnd)
  .get();

// Procesar en memoria agrupando por mes
const byMonth = groupByMonth(yearSnapshot.docs);
// Una sola llamada de conversión por moneda única
const rates = await getExchangeRates([...uniqueCurrencies]);
```

**Prioridad:** 🟠 ALTA - Performance

---

### 2.3 **FALTA DE RATE LIMITING Y PROTECCIÓN CONTRA BRUTE FORCE**
**Ubicación:** `apps/api/src/controllers/auth.controller.ts`, `apps/api/src/server/app.ts`

**Problema:**
- No hay rate limiting en endpoints de autenticación
- Un atacante puede intentar login ilimitadamente
- No hay protección contra enumeración de emails

**Solución:**
```typescript
import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 intentos
  message: 'Demasiados intentos, intenta más tarde'
});

app.use('/auth/login', authLimiter);
app.use('/auth/register', authLimiter);
```

**Prioridad:** 🟠 ALTA - Seguridad

---

### 2.4 **MANEJO DE ERRORES INCONSISTENTE**
**Ubicación:** Todos los controladores

**Problema:**
- Algunos usan `try-catch`, otros no
- Mensajes de error expuestos al cliente pueden revelar información sensible
- No hay logging estructurado
- Errores de Firestore no se traducen a mensajes amigables

**Ejemplo Problemático:**
```typescript
catch (error: any) {
  res.status(500).json({ error: error.message }); // Expone stack traces
}
```

**Solución:**
```typescript
// apps/api/src/lib/errors.ts
export class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 500,
    public isOperational: boolean = true
  ) {
    super(message);
  }
}

// En controladores:
catch (error: any) {
  logger.error('Transaction creation failed', { error, userId });
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({ error: error.message });
  }
  res.status(500).json({ error: 'Error interno del servidor' });
}
```

**Prioridad:** 🟠 ALTA - Mantenibilidad y seguridad

---

### 2.5 **FALTA DE VALIDACIÓN DE INPUT EN LADO DEL SERVIDOR**
**Ubicación:** Múltiples controladores

**Problema:**
- Aunque se usa Zod, algunos campos se validan parcialmente
- No hay sanitización de strings (XSS potencial en descripciones)
- No hay validación de rangos numéricos razonables
- Fechas no se validan contra valores absurdos

**Ejemplo:**
```typescript
// Falta validar que amountCents no sea mayor a Number.MAX_SAFE_INTEGER
// Falta validar que dates no sean del año 3000
// Falta sanitizar description para prevenir XSS
```

**Solución:**
```typescript
const TransactionSchema = z.object({
  amountCents: z.number().int().positive().max(999999999999), // ~10 billones
  description: z.string().max(500).transform(s => s.trim().slice(0, 500)),
  occurredAt: z.string().datetime().refine(date => {
    const d = new Date(date);
    return d.getFullYear() >= 1900 && d.getFullYear() <= 2100;
  })
});
```

**Prioridad:** 🟠 ALTA - Seguridad y robustez

---

### 2.6 **CACHE DE TIPO DE CAMBIO SIN INVALIDACIÓN**
**Ubicación:** `apps/api/src/services/exchange.service.ts:12-25`

**Problema:**
- Cache de 24 horas puede estar desactualizado
- No hay invalidación manual
- Si la API falla, usa valores viejos indefinidamente

**Solución:**
```typescript
const CACHE_DURATION_MS = 6 * 60 * 60 * 1000; // 6 horas
// Agregar invalidación por eventos
// Agregar fallback a múltiples APIs
```

**Prioridad:** 🟠 MEDIA - Precisión de datos

---

### 2.7 **PAGINACIÓN INEFICIENTE EN FIRESTORE**
**Ubicación:** `apps/api/src/controllers/transactions.controller.ts:60+`

**Problema:**
```typescript
const countSnapshot = await db.collection("transactions")
  .where("userId", "==", userId)
  .count()
  .get();
```

Firestore cuenta documentos leyéndolos todos (costoso). Para grandes datasets, esto es prohibitivo.

**Solución:**
```typescript
// Usar cursor-based pagination en lugar de offset
// O mantener contadores en documentos separados
// O usar aproximaciones (primeros 1000 resultados)
```

**Prioridad:** 🟠 MEDIA - Performance y costos

---

### 2.8 **FALTA DE ÍNDICES PARA QUERIES COMPLEJAS**
**Ubicación:** `apps/api/firestore.indexes.json`

**Problema:**
- Faltan índices compuestos para queries comunes
- Algunos queries requieren múltiples campos pero no hay índice
- Firebase fallará en runtime cuando se necesite

**Ejemplo Faltante:**
```json
{
  "collectionGroup": "transactions",
  "fields": [
    { "fieldPath": "userId", "order": "ASCENDING" },
    { "fieldPath": "type", "order": "ASCENDING" },
    { "fieldPath": "occurredAt", "order": "DESCENDING" },
    { "fieldPath": "amountCents", "order": "DESCENDING" }
  ]
}
```

**Prioridad:** 🟠 MEDIA - Performance

---

### 2.9 **CONVERSIÓN DE MONEDAS SECUENCIAL EN LUGAR DE PARALELA**
**Ubicación:** `apps/api/src/controllers/statistics.controller.ts:137-150`

**Problema:**
```typescript
await Promise.all(
  incomeTransactions.map(async (tx) => 
    await convertCurrency(...) // Cada una hace fetch a API
  )
);
```

Aunque usa `Promise.all`, cada conversión hace un fetch. Mejor: obtener rate una vez y aplicar.

**Solución:**
```typescript
const uniqueCurrencies = [...new Set(transactions.map(t => t.currencyCode))];
const rates = await Promise.all(
  uniqueCurrencies.map(c => getExchangeRate(c, baseCurrency))
);
const rateMap = new Map(uniqueCurrencies.map((c, i) => [c, rates[i]]));
// Aplicar rates en memoria (síncrono)
```

**Prioridad:** 🟠 MEDIA - Performance

---

### 2.10 **FALTA DE VALIDACIÓN DE CICLOS EN JERARQUÍA DE CATEGORÍAS**
**Ubicación:** `apps/api/src/controllers/categories.controller.ts:55-80`

**Problema:**
- La validación de ciclos es recursiva y puede ser lenta
- No hay límite de profundidad
- Con muchas categorías, puede hacer timeout

**Solución:**
```typescript
// Agregar límite de profundidad
const MAX_DEPTH = 10;
const checkDescendant = async (catId: string, targetId: string, depth = 0): Promise<boolean> => {
  if (depth > MAX_DEPTH) return false; // Prevenir loops infinitos
  // ... resto del código
};
```

**Prioridad:** 🟠 MEDIA - Robustez

---

## 🎨 3. MEJORAS DE EXPERIENCIA (UX/UI - Nice to have)

### 3.1 **FALTA DE ESTADOS DE CARGA VISIBLES**
**Ubicación:** `apps/web/app/dashboard/page.tsx`, todas las páginas

**Problema:**
- No hay spinners o skeletons mientras cargan datos
- El usuario no sabe si la app está trabajando o congelada
- Especialmente crítico en dashboard que hace múltiples requests

**Solución:**
```typescript
const [loading, setLoading] = useState(true);
const [data, setData] = useState(null);

if (loading) return <SkeletonLoader />;
if (!data) return <EmptyState />;
return <DashboardContent data={data} />;
```

**Prioridad:** 🟡 MEDIA - UX

---

### 3.2 **ERRORES NO AMIGABLES PARA EL USUARIO**
**Ubicación:** `apps/web` - Todos los componentes

**Problema:**
- Errores técnicos se muestran directamente al usuario
- "Error: Cannot read property 'map' of undefined"
- No hay mensajes contextuales

**Solución:**
```typescript
const errorMessages = {
  'ECONNREFUSED': 'No se pudo conectar con el servidor. Verifica tu conexión.',
  '401': 'Tu sesión expiró. Por favor, inicia sesión nuevamente.',
  '404': 'No se encontró el recurso solicitado.',
  default: 'Ocurrió un error. Por favor, intenta nuevamente.'
};
```

**Prioridad:** 🟡 MEDIA - UX

---

### 3.3 **FALTA DE OPTIMISTIC UPDATES**
**Ubicación:** `apps/web` - Formularios de creación/edición

**Problema:**
- Al crear una transacción, el usuario espera hasta que el servidor responde
- No hay feedback inmediato
- Si falla, el usuario perdió tiempo

**Solución:**
```typescript
// Actualizar UI inmediatamente
setTransactions([...transactions, optimisticTransaction]);
// Luego confirmar con servidor
try {
  const real = await api.post('/transactions', data);
  // Reemplazar optimista con real
} catch {
  // Revertir cambio
  setTransactions(originalTransactions);
}
```

**Prioridad:** 🟡 MEDIA - UX

---

### 3.4 **FALTA DE CONFIRMACIÓN EN ACCIONES DESTRUCTIVAS**
**Ubicación:** `apps/web` - Botones de eliminar

**Problema:**
- Eliminar transacciones, cuentas, categorías sin confirmación
- Fácil hacer clic por error

**Solución:**
```typescript
const handleDelete = async () => {
  if (!confirm('¿Estás seguro de eliminar esta transacción?')) return;
  // ... eliminar
};
```

**Prioridad:** 🟡 BAJA - UX

---

### 3.5 **FALTA DE VALIDACIÓN EN TIEMPO REAL EN FORMULARIOS**
**Ubicación:** `apps/web` - Todos los formularios

**Problema:**
- Validación solo al submit
- Usuario descubre errores tarde
- Experiencia frustrante

**Solución:**
```typescript
const [errors, setErrors] = useState({});
const validateField = (name, value) => {
  const error = schema.shape[name].safeParse(value);
  setErrors({ ...errors, [name]: error.error?.message });
};
```

**Prioridad:** 🟡 BAJA - UX

---

### 3.6 **FALTA DE FEEDBACK VISUAL EN ACCIONES EXITOSAS**
**Ubicación:** `apps/web` - Todas las acciones

**Problema:**
- No hay toasts o notificaciones de éxito
- Usuario no sabe si su acción funcionó

**Solución:**
```typescript
import { toast } from 'react-hot-toast';
toast.success('Transacción creada exitosamente');
```

**Prioridad:** 🟡 BAJA - UX

---

### 3.7 **DASHBOARD CARGA DEMASIADOS DATOS A LA VEZ**
**Ubicación:** `apps/web/app/dashboard/page.tsx`

**Problema:**
- Múltiples `useEffect` hacen requests simultáneos
- No hay priorización
- Dashboard tarda mucho en ser interactivo

**Solución:**
```typescript
// Cargar datos críticos primero
useEffect(() => loadDailyData(), []);
// Luego datos secundarios
useEffect(() => loadMonthlyData(), []);
// Finalmente datos opcionales
useEffect(() => loadCharts(), []);
```

**Prioridad:** 🟡 MEDIA - Performance UX

---

## 🚀 4. PROPUESTAS DE EXCELENCIA (Product Vision)

### 4.1 **SISTEMA DE BACKUP Y RESTAURACIÓN AUTOMÁTICA**
**Visión:** Permitir a usuarios exportar/importar todos sus datos fácilmente.

**Implementación:**
- Endpoint `/export/full` que genera JSON completo
- Endpoint `/import` que valida y restaura
- Backup automático mensual a cloud storage
- Versionado de backups

**Impacto:** Confianza del usuario, portabilidad de datos, recuperación ante desastres.

---

### 4.2 **ANÁLISIS PREDICTIVO CON ML**
**Visión:** Predecir gastos futuros basado en patrones históricos.

**Implementación:**
- Modelo simple de regresión para predecir gastos mensuales
- Alertas proactivas: "Basado en tu historial, este mes gastarás $X más"
- Sugerencias de ahorro personalizadas

**Impacto:** Valor diferencial, insights accionables.

---

### 4.3 **SINCRONIZACIÓN EN TIEMPO REAL**
**Visión:** Cambios se reflejan instantáneamente en todos los dispositivos.

**Implementación:**
- Firestore listeners en frontend
- WebSockets para updates en tiempo real
- Conflict resolution para ediciones simultáneas

**Impacto:** Experiencia moderna, colaboración multi-dispositivo.

---

### 4.4 **MODO OFFLINE COMPLETO**
**Visión:** App funciona sin conexión, sincroniza cuando vuelve online.

**Implementación:**
- Service Worker con cache estratégico
- IndexedDB para almacenamiento local
- Queue de operaciones offline
- Sincronización automática al reconectar

**Impacto:** Disponibilidad 100%, uso en áreas sin conexión.

---

### 4.5 **ANÁLISIS DE TENDENCIAS AVANZADO**
**Visión:** Visualizaciones interactivas con insights profundos.

**Implementación:**
- Gráficos de tendencias multi-período
- Comparación año-over-año
- Heatmaps de gastos por día de semana
- Análisis de correlaciones (ej: "Gastas más cuando llueve")

**Impacto:** Comprensión profunda de hábitos financieros.

---

### 4.6 **INTEGRACIÓN CON BANCOS (OPEN BANKING)**
**Visión:** Importar transacciones automáticamente desde bancos.

**Implementación:**
- Integración con APIs bancarias (Plaid, Yodlee)
- Reconocimiento automático de categorías
- Matching inteligente de transacciones duplicadas

**Impacto:** Reducción drástica de trabajo manual, precisión de datos.

---

### 4.7 **SISTEMA DE METAS Y GAMIFICACIÓN**
**Visión:** Hacer el ahorro divertido y motivador.

**Implementación:**
- Logros y badges
- Streaks de días sin gastos innecesarios
- Comparación social (opcional, anónima)
- Recompensas visuales por alcanzar metas

**Impacto:** Engagement, retención, cambio de hábitos.

---

### 4.8 **ASISTENTE VIRTUAL INTELIGENTE**
**Visión:** Chatbot que responde preguntas sobre finanzas personales.

**Implementación:**
- Integración con GPT/Claude
- Contexto de transacciones del usuario
- Respuestas como: "¿Cuánto gasté en comida este mes?" o "¿Debería ahorrar más?"

**Impacto:** Interacción natural, accesibilidad.

---

### 4.9 **PRESUPUESTO ADAPTATIVO CON IA**
**Visión:** El sistema aprende y ajusta presupuestos automáticamente.

**Implementación:**
- Análisis de patrones de gasto
- Sugerencias automáticas de ajuste de presupuesto
- Predicción de excedentes/déficits
- Recomendaciones personalizadas

**Impacto:** Optimización automática, menos trabajo manual.

---

### 4.10 **REPORTES AUTOMÁTICOS Y ALERTAS INTELIGENTES**
**Visión:** Notificaciones proactivas y reportes periódicos.

**Implementación:**
- Email semanal con resumen
- Alertas inteligentes: "Tu gasto en X subió 30% este mes"
- Reportes PDF descargables
- Compartir reportes con asesores financieros

**Impacto:** Visibilidad continua, toma de decisiones informada.

---

### 4.11 **MULTI-USUARIO Y PRESUPUESTOS COMPARTIDOS**
**Visión:** Familias pueden gestionar finanzas juntas.

**Implementación:**
- Invitaciones a cuentas compartidas
- Roles y permisos
- Presupuestos familiares
- Transacciones compartidas

**Impacto:** Casos de uso familiares, mayor valor.

---

### 4.12 **ANÁLISIS DE IMPACTO AMBIENTAL**
**Visión:** Conectar gastos con huella de carbono.

**Implementación:**
- Base de datos de emisiones por categoría
- Cálculo de huella de carbono
- Metas de reducción
- Comparación con promedios

**Impacto:** Responsabilidad social, diferenciación.

---

### 4.13 **RECONOCIMIENTO DE FACTURAS Y RECIBOS**
**Visión:** Escanear recibos y crear transacciones automáticamente.

**Implementación:**
- OCR para extraer texto de imágenes
- ML para identificar monto, fecha, categoría
- Almacenamiento de recibos como evidencia

**Impacto:** Automatización máxima, precisión de datos.

---

### 4.14 **PLANIFICACIÓN FINANCIERA A LARGO PLAZO**
**Visión:** Proyecciones a 1, 5, 10 años.

**Implementación:**
- Simuladores de escenarios
- "¿Qué pasa si ahorro $X más por mes?"
- Proyecciones de retiro
- Análisis de viabilidad de grandes compras

**Impacto:** Planificación estratégica, decisiones informadas.

---

### 4.15 **INTEGRACIÓN CON CALENDARIOS Y RECORDATORIOS**
**Visión:** Recordatorios inteligentes de pagos recurrentes.

**Implementación:**
- Sincronización con Google Calendar
- Notificaciones push antes de vencimientos
- Auto-creación de transacciones para pagos confirmados

**Impacto:** Nunca olvidar un pago, automatización completa.

---

## 📊 RESUMEN EJECUTIVO

### Priorización Recomendada:

**Semana 1 (Crítico):**
1. Arreglar autenticación (1.1)
2. Corregir queries `__name__` (1.2)
3. Agregar validación de reglas (1.3)

**Semana 2 (Alta Prioridad):**
4. Transacciones atómicas (2.1)
5. Optimizar estadísticas (2.2)
6. Rate limiting (2.3)

**Mes 1 (Mejoras):**
7. Manejo de errores (2.4)
8. Validación de input (2.5)
9. Estados de carga (3.1)

**Roadmap (Excelencia):**
10. Backup/restauración (4.1)
11. Modo offline (4.4)
12. Análisis predictivo (4.2)

---

**Puntuación Actual del Proyecto:**
- Funcionalidad: 7/10 (rota en algunos aspectos críticos)
- Seguridad: 5/10 (falta protección básica)
- Performance: 4/10 (ineficiencias graves)
- UX: 6/10 (funcional pero mejorable)
- Arquitectura: 7/10 (buena base, necesita refinamiento)

**Puntuación Potencial con Mejoras:**
- Funcionalidad: 10/10
- Seguridad: 9/10
- Performance: 9/10
- UX: 9/10
- Arquitectura: 9/10

