# 🔍 INCOHERENCIAS Y DUDAS DETECTADAS EN LA APP

**Fecha de Análisis:** 2 de Diciembre 2025

**Objetivo:** Identificar comportamientos ambiguos, conflictos de funcionalidad, o decisiones de diseño que requieren clarificación.

---

## ❓ DUDAS E INCOHERENCIAS ENCONTRADAS

### 1. 🔄 Conflicto Potencial: Transacciones Recurrentes vs Pagos de Deudas

**Problema Detectado:**

Actualmente existen **dos formas** de manejar pagos periódicos:

1. **Transacciones Recurrentes** (`isRecurring: true`):
   - Se crean manualmente por el usuario
   - Tienen `recurringRule`, `nextOccurrence`, `totalOccurrences`
   - Aparecen en la página "Recurrentes"
   - Se pueden marcar como pagadas (`isPaid: true`)

2. **Pagos de Deudas** (a través de categorías de "Deudas"):
   - Se crean automáticamente cuando se paga una cuota de deuda
   - Actualizan `paidInstallments` en la deuda
   - Aparecen en el historial de transacciones

**Pregunta:** ¿Qué pasa si un usuario crea una transacción recurrente para pagar una deuda?

**Escenarios Conflictivos:**

**Escenario A:** Usuario crea transacción recurrente para pagar deuda
- Crea transacción recurrente: "Pago Préstamo Personal" - $500/mes
- ¿Esta transacción debería actualizar automáticamente `paidInstallments`?
- ¿O el usuario debe crear la transacción recurrente Y también marcar la deuda como pagada?
- **Riesgo:** Duplicación de lógica o confusión del usuario

**Escenario B:** Deuda creada automáticamente desde gasto de crédito (mejora futura)
- Si implementamos la mejora de "Gastos con Tarjeta de Crédito en Cuotas"
- Se crearán transacciones recurrentes automáticamente para cada cuota
- ¿Estas transacciones recurrentes también actualizan la deuda?
- ¿O son dos sistemas separados que el usuario debe mantener sincronizados?

**Recomendación:**
- **Opción 1:** Las transacciones recurrentes que usan categorías de "Deudas" deberían actualizar automáticamente `paidInstallments` cuando se marcan como pagadas
- **Opción 2:** Deshabilitar la creación de transacciones recurrentes para categorías de "Deudas" y forzar el uso del sistema de deudas
- **Opción 3:** Unificar ambos sistemas: las deudas generan transacciones recurrentes automáticamente, y el usuario solo marca como pagadas

**¿Cuál prefieres?**

---

### 2. 💰 Incoherencia: Montos en Transacciones Recurrentes vs Deudas

**Problema Detectado:**

- **Transacciones Recurrentes:** Tienen un `amountCents` fijo que se repite
- **Deudas:** Tienen `monthlyPaymentCents` que puede ser diferente del `totalAmountCents / totalInstallments` (si hay intereses o ajustes)

**Pregunta:** Si una deuda tiene `monthlyPaymentCents = $550` pero `totalAmountCents / totalInstallments = $500`, ¿cómo se maneja esto en transacciones recurrentes?

**Escenario:**
- Deuda: $6,000 en 12 cuotas
- `monthlyPaymentCents`: $550 (incluye intereses)
- `totalAmountCents / 12`: $500 (sin intereses)

Si creamos transacciones recurrentes automáticamente, ¿usamos $550 o $500?

**Recomendación:**
- Usar siempre `monthlyPaymentCents` de la deuda para las transacciones recurrentes
- Mostrar claramente al usuario la diferencia entre "monto de cuota" y "monto total / cuotas"

**¿Estás de acuerdo?**

---

### 3. 📅 Incoherencia: Fechas de Inicio en Deudas vs Transacciones Recurrentes

**Problema Detectado:**

- **Deudas:** Tienen `startMonth` (primer día del mes en UTC)
- **Transacciones Recurrentes:** Tienen `nextOccurrence` (fecha/hora específica)

**Pregunta:** Si una deuda empieza en "Enero 2025", ¿cuándo debería ser la primera transacción recurrente?

**Escenarios:**
- Deuda creada el 15 de Enero con `startMonth = 2025-01-01`
- ¿La primera transacción recurrente debería ser el 1 de Enero o el 15 de Enero?
- ¿O el día del mes que el usuario prefiera?

**Recomendación:**
- Al crear deuda, preguntar al usuario: "¿Qué día del mes quieres pagar?" (por defecto: día actual)
- Usar ese día para todas las transacciones recurrentes
- `startMonth` de la deuda solo indica el mes de inicio, no el día específico

**¿Tiene sentido?**

---

### 4. 🔀 Conflicto: Transferencias entre Cuentas y Categorías

**Problema Detectado:**

Las transferencias (`type: "TRANSFER"`) actualmente:
- No requieren categoría (o la categoría es opcional)
- Mueven dinero de una cuenta a otra
- No afectan ingresos/gastos del mes

**Pregunta:** ¿Las transferencias deberían tener categoría?

**Escenarios:**
- Transferencia de "Banco Principal" a "Ahorro"
- ¿Debería tener categoría "Ahorro" o "Transferencia"?
- ¿O ninguna categoría es correcta?

**Recomendación Actual (basada en código):**
- Transferencias no requieren categoría
- Esto es correcto porque no son ingresos ni gastos

**¿Confirmas que esto está bien así?**

---

### 5. 🎯 Incoherencia: Metas de Ahorro vs Cuentas de Tipo SAVINGS

**Problema Detectado:**

Existen dos conceptos relacionados pero diferentes:

1. **Cuentas de tipo SAVINGS:**
   - Es una cuenta donde guardas dinero
   - Puede tener balance, transacciones
   - Aparece en la lista de cuentas

2. **Metas de Ahorro Mensual (`MonthlyGoal`):**
   - Es un objetivo de cuánto quieres ahorrar este mes
   - Se calcula como: Ingresos - Gastos - Meta = Balance disponible
   - Aparece en el Dashboard

**Pregunta:** ¿Cómo se relacionan?

**Escenarios:**
- Usuario tiene cuenta "Ahorro Emergencia" (tipo SAVINGS)
- Usuario tiene meta de ahorro mensual de $500
- ¿El dinero que transfiere a la cuenta SAVINGS cuenta para la meta?
- ¿O son conceptos independientes?

**Recomendación:**
- **Opción A:** El dinero transferido a cuentas SAVINGS cuenta automáticamente para la meta
- **Opción B:** Son independientes - la meta es un objetivo, las cuentas SAVINGS son donde guardas
- **Opción C:** Permitir al usuario vincular una cuenta SAVINGS específica a una meta

**¿Cuál es la intención del diseño?**

---

### 6. 📊 Incoherencia: Presupuestos por Categoría vs Presupuesto Diario

**Problema Detectado:**

Existen dos sistemas de presupuesto:

1. **Presupuestos por Categoría (`CategoryBudget`):**
   - Límite mensual por categoría
   - Se compara con gastos reales de esa categoría
   - Alertas cuando se excede

2. **Presupuesto Diario Dinámico:**
   - Se calcula como: (Ingresos - Gastos - Meta Ahorro) / Días restantes
   - Es un promedio diario disponible
   - No está vinculado a categorías específicas

**Pregunta:** ¿Cómo interactúan?

**Escenario:**
- Usuario tiene presupuesto de $500 para "Alimentación"
- Usuario tiene presupuesto diario disponible de $50
- Usuario gasta $600 en "Alimentación" (excede presupuesto de categoría)
- Pero aún tiene $1,000 disponibles en presupuesto diario

¿El sistema debería:
- **A)** Alertar por exceder presupuesto de categoría (independiente del diario)
- **B)** Solo alertar si excede presupuesto diario total
- **C)** Alertar por ambos (categoría Y diario)

**Recomendación Actual (basada en código):**
- Parece que son independientes
- Presupuesto de categoría = control granular
- Presupuesto diario = control general

**¿Confirmas que ambos sistemas deben coexistir independientemente?**

---

### 7. 🔄 Conflicto: Transacciones Recurrentes que se Completaron vs que se Cancelaron

**Problema Detectado:**

Las transacciones recurrentes tienen:
- `totalOccurrences`: Número total de veces que debe ocurrir
- `remainingOccurrences`: Cuántas quedan
- `isPaid`: Si la ocurrencia actual está pagada

**Pregunta:** ¿Qué pasa cuando `remainingOccurrences` llega a 0?

**Escenarios:**
- Transacción recurrente de Netflix: 12 meses, ya se pagaron las 12
- `remainingOccurrences = 0`
- ¿La transacción recurrente debería:
  - **A)** Desaparecer de la lista de recurrentes
  - **B)** Mostrarse como "Completada" pero seguir visible
  - **C)** Permitir al usuario "renovar" la recurrencia

**Recomendación:**
- Mostrar como "Completada" pero mantener visible (similar a deudas completadas)
- Permitir al usuario eliminarla o renovarla
- Filtrar por estado: "Activas", "Completadas", "Todas"

**¿Estás de acuerdo?**

---

### 8. 💳 Incoherencia: Gastos en Cuenta CREDIT y su Impacto en Balance

**Problema Detectado:**

Actualmente, cuando se registra un gasto en una cuenta de tipo CREDIT:
- Se registra como gasto normal
- Afecta el balance del mes
- Pero el dinero no sale realmente (es crédito)

**Pregunta:** ¿Los gastos en cuentas CREDIT deberían tratarse diferente?

**Escenarios:**
- Usuario gasta $1,000 en tarjeta de crédito
- Balance del mes muestra: Ingresos $2,000 - Gastos $1,000 = Balance $1,000
- Pero en realidad, el usuario debe $1,000 que pagará después

**Opciones:**
- **Opción A:** Los gastos en CREDIT no afectan el balance hasta que se paguen (se crea una "deuda pendiente")
- **Opción B:** Los gastos en CREDIT afectan el balance normalmente (comportamiento actual)
- **Opción C:** Mostrar dos balances: "Balance Efectivo" y "Balance con Crédito"

**Recomendación:**
- Mantener comportamiento actual (Opción B) pero agregar visualización clara de "Deuda Total en Tarjetas"
- Cuando se implemente la mejora de cuotas, las cuotas pagadas sí afectan el balance

**¿Cuál es tu preferencia?**

---

### 9. 🏷️ Incoherencia: Tags vs Categorías vs Subcategorías

**Problema Detectado:**

Existen tres formas de clasificar transacciones:

1. **Categorías:** Jerarquía principal (ej: "Alimentación")
2. **Subcategorías:** Hijas de categorías (ej: "Supermercado" dentro de "Alimentación")
3. **Tags:** Etiquetas flexibles (ej: "trabajo", "personal", "urgente")

**Pregunta:** ¿Cuándo usar cada una?

**Escenarios:**
- Transacción: Compra de comida en supermercado para trabajo
- ¿Categoría: "Alimentación" → Subcategoría: "Supermercado"?
- ¿Tag: "trabajo"?
- ¿O ambos?

**Recomendación Actual (basada en código):**
- Categorías/Subcategorías: Para agrupación y presupuestos
- Tags: Para filtrado flexible y búsqueda
- Pueden coexistir (una transacción puede tener categoría Y tags)

**¿Confirmas que esta es la intención?**

---

### 10. 📱 Incoherencia: PWA vs App Móvil Nativa (Futuro)

**Problema Detectado:**

Actualmente la app es una PWA (Progressive Web App):
- Funciona en navegador móvil
- Se puede instalar como app
- Usa Service Workers para offline

**Pregunta:** Si en el futuro se crea una app móvil nativa (React Native/Expo):
- ¿Compartirán la misma base de datos?
- ¿Tendrán las mismas funcionalidades?
- ¿O la app nativa tendrá features adicionales?

**Recomendación:**
- Mantener PWA como versión principal
- App nativa como complemento (si se necesita)
- Ambas usan la misma API y base de datos

**¿Tienes planes de crear app nativa o mantener solo PWA?**

---

## 📋 RESUMEN DE DUDAS PARA RESOLVER

### Prioridad ALTA (Afectan Funcionalidad Core):

1. **Transacciones Recurrentes vs Pagos de Deudas** - ¿Cómo interactúan?
2. **Gastos en Cuenta CREDIT** - ¿Afectan balance inmediatamente o cuando se pagan?
3. **Metas de Ahorro vs Cuentas SAVINGS** - ¿Cómo se relacionan?

### Prioridad MEDIA (Afectan UX):

4. **Montos en Deudas vs Transacciones Recurrentes** - ¿Usar monthlyPaymentCents o calcular?
5. **Fechas de Inicio en Deudas** - ¿Día específico o solo mes?
6. **Presupuestos por Categoría vs Diario** - ¿Cómo interactúan?

### Prioridad BAJA (Clarificación):

7. **Transacciones Recurrentes Completadas** - ¿Mostrar o ocultar?
8. **Tags vs Categorías** - ¿Confirmar uso actual?
9. **Transferencias y Categorías** - ¿Confirmar que no requieren categoría?
10. **PWA vs App Nativa** - ¿Planes futuros?

---

## 🎯 RECOMENDACIONES INMEDIATAS

1. **Documentar decisiones:** Crear un documento de "Decisiones de Diseño" con las respuestas a estas dudas
2. **Unificar lógica:** Si hay conflictos, elegir un comportamiento y documentarlo
3. **Mejorar UX:** Agregar tooltips o ayuda contextual que explique estas relaciones al usuario

---

**¿Quieres que profundice en alguna de estas dudas o que proponga soluciones específicas?**

---

--- INICIO DEL REPORTE DE AUDITORÍA (SESIÓN 2025-12-04) ---

## 🔍 Sección 1: Integridad y Lógica (Nuevos Hallazgos)

### **[apps/web/app/transactions/new/page.tsx]** - **[Variable Null: `authReady` declarada pero nunca usada]**

* **Análisis:** En la línea 40, se declara `const [authReady, setAuthReady] = useState(false);` pero esta variable nunca se lee ni se modifica en ningún lugar del componente. Esto indica código muerto que puede confundir a futuros desarrolladores. Además, si originalmente se planeó usar esta variable para controlar el estado de autenticación, su ausencia podría indicar una lógica incompleta.

* **Sugerencia:** Eliminar la declaración de `authReady` y `setAuthReady` si no se planea usar, o implementar la lógica que originalmente se pensó para esta variable (por ejemplo, mostrar un spinner mientras se verifica la autenticación antes de permitir crear transacciones).

---

### **[apps/web/app/transactions/new/page.tsx]** - **[Lógica: Doble recarga innecesaria y potencialmente problemática]**

* **Análisis:** En las líneas 215-222, después de crear una transacción exitosamente, se ejecuta:
  1. `router.push("/dashboard?refresh=" + Date.now())` - Navegación programática
  2. `setTimeout(() => { window.location.reload(); }, 100)` - Recarga completa de la página

  Esto es redundante y problemático porque:
  - `router.push` ya navega a la página, lo que debería disparar los `useEffect` del dashboard para recargar datos
  - `window.location.reload()` fuerza una recarga completa que descarta el estado de React y recarga todo el bundle, lo cual es costoso
  - El `setTimeout` de 100ms puede ejecutarse antes de que `router.push` complete la navegación, causando comportamientos impredecibles
  - El parámetro `?refresh=` en la URL no se está usando en el dashboard para forzar recarga

* **Sugerencia:** Eliminar `window.location.reload()` y confiar en `router.push` + el sistema de recarga del dashboard (que ya tiene `refreshKey` y listeners de `focus`). Si se necesita forzar recarga, usar `router.refresh()` de Next.js o actualizar el estado `refreshKey` del dashboard mediante un contexto compartido o parámetros de URL que el dashboard lea.

---

### **[apps/web/app/dashboard/page.tsx]** - **[Lógica: Dependencia faltante en useEffect que puede causar bugs silenciosos]**

* **Análisis:** En la línea 43-52, hay un `useEffect` que escucha el evento `focus` y llama a `loadData()`:

```typescript
useEffect(() => {
  const handleFocus = () => {
    if (user && token) {
      loadData();  // ⚠️ loadData no está en las dependencias
    }
  };
  window.addEventListener("focus", handleFocus);
  return () => window.removeEventListener("focus", handleFocus);
}, [user, token]);  // ⚠️ Falta loadData
```

  El problema es que `loadData` no está en el array de dependencias. Aunque en este caso específico puede funcionar porque `loadData` está definida dentro del componente y se recrea en cada render, esto viola las reglas de hooks de React y puede causar:
  - Warnings de ESLint que se ignoran
  - Bugs sutiles si `loadData` se memoiza en el futuro con `useCallback`
  - Comportamiento inconsistente si `loadData` cambia pero el listener sigue usando la versión antigua

* **Sugerencia:** Agregar `loadData` a las dependencias O envolver `loadData` en `useCallback` con sus dependencias correctas y luego incluirlo en el array de dependencias del `useEffect`. La mejor solución es usar `useCallback` para `loadData`:

```typescript
const loadData = useCallback(async () => {
  // ... código existente
}, [user, token, selectedDate, refreshKey, router, logout]);

useEffect(() => {
  const handleFocus = () => {
    if (user && token) {
      loadData();
    }
  };
  window.addEventListener("focus", handleFocus);
  return () => window.removeEventListener("focus", handleFocus);
}, [user, token, loadData]);
```

---

### **[apps/web/app/dashboard/page.tsx]** - **[Lógica: Mismo problema en el segundo useEffect]**

* **Análisis:** En la línea 54-68, el `useEffect` principal también llama a `loadData()` pero `loadData` no está en las dependencias. Aunque `loadData` se ejecuta correctamente porque está definida en el mismo componente, esto es técnicamente incorrecto según las reglas de hooks.

* **Sugerencia:** Aplicar la misma solución: usar `useCallback` para `loadData` y agregarlo a las dependencias, o al menos documentar por qué se omite (aunque no es recomendable).

---

### **[Rutas faltantes]** - **[Link Roto: Referencias a `/manual` y `/calendar` que pueden no existir]**

* **Análisis:** Según el contexto del proyecto, se mencionó crear páginas para `/manual` y `/calendar`, pero al buscar estos archivos con `glob_file_search`, no se encontraron. Si hay enlaces en el código que apuntan a estas rutas (por ejemplo, en `NavigationMenu.tsx` o en el dashboard), estos enlaces llevarán a páginas 404.

* **Sugerencia:** 
  1. Verificar si existen enlaces a `/manual` y `/calendar` en el código
  2. Si existen enlaces pero las páginas no están creadas, crear las páginas o eliminar/comentar los enlaces temporalmente
  3. Si las páginas están planificadas pero no implementadas, agregar un componente placeholder que indique "Próximamente" en lugar de dejar un 404

---

### **[apps/web/app/dashboard/page.tsx]** - **[Variable Null: `setAlerts` comentado pero variable no declarada]**

* **Análisis:** En la línea 313, hay un comentario `// setAlerts(a.data.alerts);` que sugiere que originalmente se planeó guardar alertas en un estado, pero:
  - No hay declaración de `const [alerts, setAlerts] = useState(...)` en el componente
  - La variable `a` se obtiene de `api.get('/alerts/preview?date=${dateStr}')` pero nunca se usa

  Esto indica código incompleto o funcionalidad deshabilitada que debería limpiarse o completarse.

* **Sugerencia:** 
  - Si las alertas no se van a usar: eliminar la llamada a `/alerts/preview` y el comentario
  - Si se planea usar: implementar el estado `alerts` y descomentar la línea, o crear un TODO claro

---

### **[apps/web/app/transactions/new/page.tsx]** - **[Lógica de Negocio: Validación inconsistente para transferencias]**

* **Análisis:** En el código de creación de transacciones, las transferencias (`type: "TRANSFER"`) no requieren `categoryId`, lo cual es correcto. Sin embargo, si el usuario selecciona "TRANSFER" pero luego cambia a "EXPENSE" o "INCOME" sin seleccionar una categoría, la validación puede fallar de manera confusa. Además, cuando se cambia el tipo a "TRANSFER", se limpia `categoryId` (línea ~150), pero si el usuario vuelve a cambiar a "EXPENSE", debe recordar seleccionar una categoría.

* **Sugerencia:** Agregar validación clara que muestre un mensaje específico cuando falte la categoría para EXPENSE/INCOME, y asegurar que el UI muestre claramente que la categoría es requerida para estos tipos pero no para TRANSFER.

---

### **[apps/web/app/debts/page.tsx]** - **[Variable Null: `formData.currencyCode` usa `user?.currencyCode` antes de que `user` esté disponible]**

* **Análisis:** En la línea 48, se inicializa `formData` con `currencyCode: user?.currencyCode || "USD"`, pero `formData` se declara fuera de cualquier `useEffect`, lo que significa que se evalúa en el primer render cuando `user` probablemente es `undefined`. Aunque el `|| "USD"` proporciona un fallback, esto puede causar que el formulario muestre "USD" inicialmente incluso si el usuario tiene otra moneda preferida, y luego no se actualice cuando `user` esté disponible.

* **Sugerencia:** Inicializar `formData` dentro de un `useEffect` que se ejecute cuando `user` esté disponible, o usar un estado separado para `currencyCode` que se actualice cuando `user` cambie:

```typescript
useEffect(() => {
  if (user?.currencyCode) {
    setFormData(prev => ({ ...prev, currencyCode: user.currencyCode }));
  }
}, [user]);
```

---

## ⚡ Sección 2: Oportunidades de Rendimiento

### **[apps/web/app/dashboard/page.tsx]** - **[Re-renderizado innecesario: `loadData` se recrea en cada render]**

* **Diagnóstico:** La función `loadData` está definida como una función regular dentro del componente (línea 70), lo que significa que se recrea en cada render. Esto causa que:
  1. Cualquier `useEffect` o `useCallback` que dependa de `loadData` se ejecute en cada render
  2. Los event listeners que usan `loadData` (como el de `focus`) pueden tener referencias obsoletas
  3. Si `loadData` se pasa como prop a componentes hijos, causará re-renders innecesarios

* **Propuesta:** Envolver `loadData` en `useCallback` con sus dependencias correctas:

```typescript
const loadData = useCallback(async () => {
  // ... código existente de loadData
}, [selectedDate, user, token, router, logout]);
```

  Esto asegura que `loadData` solo se recree cuando sus dependencias cambien, reduciendo re-renders y mejorando el rendimiento, especialmente en el dashboard que es una página pesada con múltiples llamadas API.

---

### **[apps/web/app/statistics/page.tsx]** - **[Re-renderizado innecesario: `loadData` se ejecuta en cada cambio de `activeTab`]**

* **Diagnóstico:** En la línea 39, el `useEffect` que llama a `loadData()` tiene `activeTab` en las dependencias, lo que significa que cada vez que el usuario cambia de pestaña, se vuelven a cargar TODOS los datos (expenses, savings, income, fixed, ai) aunque solo se necesite actualizar la pestaña activa. Esto es ineficiente porque:
  - Se hacen 5 llamadas API incluso si el usuario solo quiere ver una pestaña
  - Los datos de otras pestañas se sobrescriben innecesariamente
  - En conexiones lentas, esto causa delays innecesarios

* **Propuesta:** Implementar carga lazy por pestaña:

```typescript
useEffect(() => {
  // Solo cargar datos de la pestaña activa
  if (activeTab === "expenses" && !expensesData) {
    loadExpensesData();
  } else if (activeTab === "savings" && !savingsData) {
    loadSavingsData();
  }
  // ... etc
}, [activeTab]);

// O mejor aún, cargar solo cuando el usuario hace click en la pestaña
const handleTabChange = (tab: string) => {
  setActiveTab(tab);
  if (tab === "expenses" && !expensesData) loadExpensesData();
  // ... etc
};
```

  Esto reduce las llamadas API iniciales y mejora el tiempo de carga percibido.

---

### **[apps/web/app/dashboard/page.tsx]** - **[Función compleja: `loadData` tiene demasiadas responsabilidades]**

* **Diagnóstico:** La función `loadData` (líneas 70-323) tiene más de 250 líneas y hace múltiples cosas:
  - Calcula fechas
  - Hace 4+ llamadas API en paralelo
  - Procesa transacciones
  - Calcula estadísticas
  - Filtra transacciones recurrentes
  - Maneja errores

  Esto viola el principio de responsabilidad única y hace el código difícil de mantener, testear y depurar.

* **Propuesta:** Refactorizar en funciones más pequeñas y específicas:

```typescript
const loadBudgetData = useCallback(async (dateStr: string) => { /* ... */ }, []);
const loadMonthlyTransactions = useCallback(async (monthStart: string, monthEnd: string) => { /* ... */ }, []);
const loadStatistics = useCallback(async (year: number, month: number) => { /* ... */ }, []);
const loadRecurringTransactions = useCallback(async (monthStart: string, monthEnd: string) => { /* ... */ }, []);

const loadData = useCallback(async () => {
  setLoading(true);
  try {
    const [year, month] = selectedDate.split("-").map(Number);
    const dateStr = calculateDateString(year, month);
    
    const [budgetData, transactions, stats, goals] = await Promise.all([
      loadBudgetData(dateStr),
      loadMonthlyTransactions(monthStart, monthEnd),
      loadStatistics(year, month),
      loadGoals(year, month)
    ]);
    
    // Procesar y combinar resultados
    processAndSetData(budgetData, transactions, stats, goals);
  } catch (err) {
    handleError(err);
  } finally {
    setLoading(false);
  }
}, [selectedDate, loadBudgetData, loadMonthlyTransactions, ...]);
```

  Esto mejora la legibilidad, facilita el testing unitario y permite reutilizar funciones individuales.

---

### **[apps/web/app/transactions/new/page.tsx]** - **[Importación pesada: Recharts se importa pero puede no usarse en esta página]**

* **Diagnóstico:** Aunque no se encontró una importación directa de Recharts en este archivo, si hay componentes pesados importados que no se usan, esto aumenta el bundle size innecesariamente. Además, el componente tiene 998 líneas, lo que sugiere que podría beneficiarse de ser dividido en sub-componentes más pequeños.

* **Propuesta:** 
  1. Auditar todas las importaciones y eliminar las no usadas
  2. Dividir el componente en sub-componentes más pequeños (por ejemplo, `RecurringTransactionForm`, `InstallmentOptions`, `AttachmentUploader`)
  3. Usar `React.lazy` para cargar componentes pesados solo cuando se necesiten

---

### **[apps/web/app/dashboard/page.tsx]** - **[Re-renderizado: Múltiples `useEffect` que se ejecutan en secuencia]**

* **Diagnóstico:** Hay dos `useEffect` separados (líneas 43-52 y 54-68) que ambos pueden disparar `loadData()`:
  - El primero se ejecuta cuando la ventana gana foco
  - El segundo se ejecuta cuando cambian las dependencias (user, token, selectedDate, etc.)

  Si ambos se ejecutan casi simultáneamente (por ejemplo, cuando el usuario vuelve a la página y `selectedDate` cambia), `loadData()` se ejecutará dos veces, causando llamadas API duplicadas.

* **Propuesta:** Implementar un debounce o un flag para evitar llamadas duplicadas:

```typescript
const loadingRef = useRef(false);

const loadData = useCallback(async () => {
  if (loadingRef.current) return; // Evitar llamadas concurrentes
  loadingRef.current = true;
  try {
    // ... código existente
  } finally {
    loadingRef.current = false;
  }
}, [dependencies]);
```

  O mejor aún, unificar la lógica en un solo `useEffect` que maneje tanto el focus como los cambios de dependencias.

---

### **[apps/web/lib/api.ts]** - **[Optimización: Timeout de 30 segundos puede ser demasiado largo]**

* **Diagnóstico:** El timeout de axios está configurado a 30 segundos (línea 6), lo cual es muy generoso. En una aplicación web, los usuarios esperan respuestas en menos de 3-5 segundos. Un timeout de 30 segundos significa que si hay un problema de red, el usuario esperará 30 segundos antes de ver un error, lo cual es una mala experiencia de usuario.

* **Propuesta:** Reducir el timeout a 10-15 segundos para la mayoría de las requests, y usar timeouts más largos solo para operaciones específicas que se sepa que tardan más (como exportaciones o análisis pesados):

```typescript
const api = axios.create({ 
  baseURL,
  timeout: 10000, // 10 segundos por defecto
});

// Para operaciones específicas, crear instancias con timeout diferente
const apiLong = axios.create({ baseURL, timeout: 30000 });
```

---

--- FIN DEL REPORTE ---

