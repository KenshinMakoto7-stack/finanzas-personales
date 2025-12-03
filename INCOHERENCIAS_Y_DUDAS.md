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

