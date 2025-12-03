# 🚀 MEJORAS PENDIENTES

**Última actualización:** 2 de Diciembre 2025

---

## 💳 MEJORA: Gastos con Tarjeta de Crédito - Cuotas Automáticas

**✅ ESTADO: COMPLETADA** - 2 de Diciembre 2025

### 📋 Descripción

Cuando un usuario ingresa un **gasto usando una cuenta de tipo CREDIT (Tarjeta de Crédito)**, el sistema debe:

1. **Detectar automáticamente** que es una cuenta de crédito
2. **Solicitar información adicional:**
   - Cantidad de cuotas (ej: 3, 6, 12, 24 meses)
   - Monto comprometido total (el monto total de la compra)
3. **Crear automáticamente:**
   - Una deuda en la colección `debts` con:
     - `description`: Descripción del gasto
     - `totalAmountCents`: Monto total comprometido
     - `monthlyPaymentCents`: Monto total / cantidad de cuotas
     - `totalInstallments`: Cantidad de cuotas
     - `paidInstallments`: 0 (inicial)
     - `startMonth`: Mes actual
     - `currencyCode`: Moneda de la cuenta
     - `debtType`: "CREDIT" (nuevo campo para diferenciar de otros tipos)
   - Transacciones recurrentes mensuales para cada cuota
4. **Mostrar en la sección Deudas:**
   - Las deudas de crédito deben aparecer junto con otras deudas
   - Debe haber un **filtro** para distinguir entre:
     - **"Crédito"** (gastos de tarjeta de crédito)
     - **"Otros"** (préstamos, deudas manuales, etc.)

### 🎯 Casos de Uso

**Ejemplo 1: Compra en cuotas**
- Usuario compra un TV de $1,200 en 12 cuotas
- Selecciona cuenta "Visa Principal" (tipo CREDIT)
- Sistema detecta cuenta de crédito
- Muestra formulario adicional:
  - "¿Pagar en cuotas?" → Sí
  - "Cantidad de cuotas:" → 12
  - "Monto total:" → $1,200 (prellenado con el monto del gasto)
- Al guardar:
  - Crea deuda: $1,200 en 12 cuotas de $100/mes
  - Crea 12 transacciones recurrentes mensuales de $100
  - Aparece en "Deudas" con tipo "Crédito"

**Ejemplo 2: Compra sin cuotas**
- Usuario compra algo con tarjeta de crédito pero paga al contado
- Selecciona cuenta "Visa Principal" (tipo CREDIT)
- Sistema detecta cuenta de crédito
- Muestra opción: "¿Pagar en cuotas?" → No
- Se crea solo la transacción normal (sin deuda)

### 🔧 Cambios Técnicos Necesarios

#### Backend (`apps/api/src/controllers/transactions.controller.ts`)

1. **Modificar `createTransaction()`:**
   ```typescript
   // Después de validar accountData
   if (accountData.type === "CREDIT" && type === "EXPENSE") {
     // Verificar si viene información de cuotas
     const installments = req.body.installments; // cantidad de cuotas
     const totalAmountCents = req.body.totalAmountCents; // monto total comprometido
     
     if (installments && installments > 1 && totalAmountCents) {
       // Crear deuda automáticamente
       const monthlyPaymentCents = Math.round(totalAmountCents / installments);
       
       // Crear deuda en batch junto con la transacción
       // Crear transacciones recurrentes para cada cuota
     }
   }
   ```

2. **Agregar campo `debtType` a la colección `debts`:**
   - Valores posibles: `"CREDIT"` | `"LOAN"` | `"OTHER"`
   - Por defecto: `"OTHER"` (para deudas creadas manualmente)

3. **Modificar `debts.controller.ts`:**
   - Agregar filtro por `debtType` en `listDebts()`
   - Endpoint: `GET /debts?type=CREDIT` o `GET /debts?type=OTHER`

#### Frontend (`apps/web/app/transactions/new/page.tsx`)

1. **Detectar cuenta de crédito:**
   ```typescript
   const selectedAccount = accounts.find(acc => acc.id === accountId);
   const isCreditAccount = selectedAccount?.type === "CREDIT";
   ```

2. **Mostrar formulario condicional:**
   - Si `isCreditAccount && type === "EXPENSE"`:
     - Checkbox: "¿Pagar en cuotas?"
     - Si está marcado:
       - Input: "Cantidad de cuotas" (número, mínimo 1)
       - Input: "Monto total comprometido" (prellenado con amount, editable)
       - Mostrar: "Cuota mensual: $X.XX"

3. **Enviar datos adicionales al backend:**
   ```typescript
   const payload = {
     // ... campos normales
     installments: isCreditAccount && payInInstallments ? numberOfInstallments : undefined,
     totalAmountCents: isCreditAccount && payInInstallments ? totalAmount * 100 : undefined
   };
   ```

#### Frontend (`apps/web/app/debts/page.tsx`)

1. **Agregar filtro de tipo:**
   ```typescript
   const [debtTypeFilter, setDebtTypeFilter] = useState<"ALL" | "CREDIT" | "OTHER">("ALL");
   
   // Filtrar deudas
   const filteredDebts = debts.filter(debt => {
     if (debtTypeFilter === "ALL") return true;
     return debt.debtType === debtTypeFilter;
   });
   ```

2. **UI del filtro:**
   - Botones o dropdown: "Todas" | "Crédito" | "Otros"
   - Mostrar badge/icono diferente según tipo

### 📊 Estructura de Datos

#### Colección `debts` - Nuevo campo:
```typescript
{
  // ... campos existentes
  debtType: "CREDIT" | "LOAN" | "OTHER", // Nuevo campo
  accountId?: string, // ID de la cuenta de crédito (si aplica)
  transactionId?: string // ID de la transacción original (si aplica)
}
```

#### Transacción - Campos opcionales:
```typescript
{
  // ... campos existentes
  installments?: number, // Cantidad de cuotas (solo si es crédito)
  totalAmountCents?: number, // Monto total comprometido (solo si es crédito)
  debtId?: string // ID de la deuda creada automáticamente
}
```

### 🎨 UX/UI Sugerida

**Formulario de Nueva Transacción:**
```
┌─────────────────────────────────────┐
│ Tipo: [Gasto ▼]                     │
│ Cuenta: [Visa Principal ▼] (CREDIT) │
│ Monto: [$100.00]                    │
│                                      │
│ ⚠️ Cuenta de Crédito detectada      │
│                                      │
│ ☑ Pagar en cuotas                   │
│                                      │
│ Cantidad de cuotas: [12 ▼]          │
│ Monto total: [$1,200.00]            │
│ Cuota mensual: $100.00               │
│                                      │
│ [Cancelar] [Guardar]                │
└─────────────────────────────────────┘
```

**Página de Deudas:**
```
┌─────────────────────────────────────┐
│ Deudas                              │
│                                      │
│ Filtros: [Todas] [Crédito] [Otros] │
│                                      │
│ 💳 Visa Principal - TV              │
│    12 cuotas de $100/mes            │
│    [Crédito]                        │
│                                      │
│ 📋 Préstamo Personal                │
│    10 cuotas de $500/mes            │
│    [Otro]                           │
└─────────────────────────────────────┘
```

### ✅ Criterios de Aceptación

- [ ] Al seleccionar cuenta CREDIT y tipo EXPENSE, se muestra opción de cuotas
- [ ] Se puede ingresar cantidad de cuotas (1-60)
- [ ] Se calcula automáticamente la cuota mensual
- [ ] Al guardar, se crea una deuda automáticamente con tipo "CREDIT"
- [ ] Se crean transacciones recurrentes mensuales para cada cuota
- [ ] Las deudas de crédito aparecen en la página de Deudas
- [ ] Existe filtro para ver solo crédito, solo otros, o todos
- [ ] Las deudas de crédito muestran el nombre de la cuenta de crédito
- [ ] Se puede editar/eliminar deudas de crédito igual que otras deudas

### 🔗 Archivos a Modificar

**Backend:**
- `apps/api/src/controllers/transactions.controller.ts` - Lógica de creación con cuotas
- `apps/api/src/controllers/debts.controller.ts` - Filtro por tipo
- `apps/api/src/server/middleware/validate.ts` - Schema para campos opcionales

**Frontend:**
- `apps/web/app/transactions/new/page.tsx` - Formulario condicional
- `apps/web/app/debts/page.tsx` - Filtro y visualización
- `apps/web/lib/schemas.ts` - Schema actualizado

**Base de Datos:**
- Agregar campo `debtType` a documentos existentes (migración)
- Agregar campo `accountId` opcional a deudas

### 📝 Notas Adicionales

- Las transacciones recurrentes deben crearse con `isRecurring: true`
- La primera cuota puede marcarse como pagada si el usuario lo indica
- Las cuotas deben aparecer en "Transacciones Recurrentes" también
- Considerar intereses si se implementa en el futuro (por ahora solo cuotas sin interés)

---

## 🎯 Prioridad

**ALTA** - Mejora significativa de UX para usuarios que usan tarjetas de crédito frecuentemente.

---

## 📅 Fecha de Solicitud

2 de Diciembre 2025

---

## 📸 MEJORA: Adjuntar Fotos/Comprobantes a Transacciones

### 📋 Descripción

Permitir a los usuarios adjuntar imágenes (fotos) a las transacciones para guardar comprobantes, facturas o tickets. Esto permite:

1. **Capturar comprobantes visuales** de gastos e ingresos
2. **Consultar facturas históricas** sin necesidad de guardar copias físicas
3. **Mejorar la trazabilidad** de las transacciones
4. **Facilitar auditorías** y verificación de gastos

### 🎯 Funcionalidades Requeridas

1. **Captura de Imágenes:**
   - Seleccionar foto desde galería del dispositivo
   - Tomar foto con cámara del dispositivo (móvil o webcam)
   - Soporte para múltiples formatos: JPG, PNG, WebP
   - Compresión automática de imágenes para optimizar almacenamiento

2. **Visualización:**
   - Ver imagen adjunta en el detalle de la transacción
   - Vista previa en lista de transacciones (thumbnail)
   - Zoom y visualización fullscreen
   - Descarga de imagen original

3. **Gestión:**
   - Editar/eliminar imagen adjunta
   - Reemplazar imagen existente
   - Límite de tamaño por imagen (ej: 5 MB)
   - Límite de imágenes por transacción: **2 imágenes máximo**
   - Compresión automática de imágenes antes de subir

### 💾 Análisis de Almacenamiento y Costos

#### Límites de Firebase (Plan Gratuito - Spark)

**Firebase Storage:**
- **Almacenamiento gratuito:** 5 GB
- **Descargas gratuitas:** 1 GB/día
- **Operaciones de escritura:** 20,000/día
- **Operaciones de lectura:** 50,000/día

**Después de la cuota gratuita:**
- **Almacenamiento:** $0.026/GB/mes
- **Descargas:** $0.12/GB
- **Operaciones:** $0.05 por 100,000 operaciones

#### Estimaciones de Uso

**Escenario Conservador (100 usuarios activos):**
- Transacciones por usuario/mes: 30
- Porcentaje de transacciones con foto: 20% (6 fotos/usuario/mes)
- Tamaño promedio de foto comprimida: 200 KB
- **Total fotos/mes:** 100 × 6 = 600 fotos
- **Almacenamiento/mes:** 600 × 200 KB = 120 MB
- **Almacenamiento/año:** 1.44 GB
- **Almacenamiento acumulado (3 años):** ~4.3 GB

**Escenario Moderado (500 usuarios activos):**
- Transacciones por usuario/mes: 30
- Porcentaje con foto: 30% (9 fotos/usuario/mes)
- Tamaño promedio: 300 KB
- **Total fotos/mes:** 500 × 9 = 4,500 fotos
- **Almacenamiento/mes:** 4,500 × 300 KB = 1.35 GB
- **Almacenamiento/año:** 16.2 GB
- **Almacenamiento acumulado (3 años):** ~48.6 GB

**Escenario Agresivo (1,000 usuarios activos):**
- Transacciones por usuario/mes: 50
- Porcentaje con foto: 40% (20 fotos/usuario/mes)
- Tamaño promedio: 400 KB
- **Total fotos/mes:** 1,000 × 20 = 20,000 fotos
- **Almacenamiento/mes:** 20,000 × 400 KB = 8 GB
- **Almacenamiento/año:** 96 GB
- **Almacenamiento acumulado (3 años):** ~288 GB

#### Costos Estimados

**Plan Gratuito (5 GB):**
- ✅ Cubre escenario conservador por ~3 años
- ⚠️ Escenario moderado: ~3 meses gratis, luego ~$0.40/mes
- ❌ Escenario agresivo: ~1 mes gratis, luego ~$2.50/mes

**Costos Adicionales (después de cuota gratuita):**
- **Almacenamiento:** Mínimo $0.026/GB/mes
- **Descargas:** $0.12/GB (solo si usuarios descargan mucho)
- **Operaciones:** Generalmente dentro de la cuota gratuita

### 🛠️ Soluciones Propuestas

#### Opción 1: Firebase Storage (Recomendada para inicio)

**Ventajas:**
- ✅ Integración nativa con Firebase
- ✅ Seguridad y autenticación integrada
- ✅ Escalable automáticamente
- ✅ 5 GB gratis al inicio
- ✅ CDN global incluido

**Desventajas:**
- ⚠️ Costos crecen con el uso
- ⚠️ Requiere gestión de cuotas

**Implementación:**
```typescript
// Backend: Endpoint para subir imagen
POST /transactions/:id/attachments
- Multipart form-data
- Validar tamaño (máx 5 MB)
- Comprimir imagen (usar sharp o jimp)
- Subir a Firebase Storage: transactions/{userId}/{transactionId}/{timestamp}.jpg
- Guardar URL en Firestore: transaction.attachments = [url1, url2, ...]

// Frontend: Componente de captura
- Input type="file" accept="image/*"
- Captura desde cámara (navigator.mediaDevices.getUserMedia)
- Preview antes de subir
- Barra de progreso durante upload
```

#### Opción 2: Cloudinary (Alternativa Externa)

**Ventajas:**
- ✅ 25 GB gratis (más generoso)
- ✅ Transformaciones automáticas (resize, compress)
- ✅ CDN incluido
- ✅ Optimización automática de imágenes

**Desventajas:**
- ⚠️ Servicio externo adicional
- ⚠️ Requiere cuenta y configuración separada

**Costo después de cuota gratuita:**
- $99/mes para plan básico (25 GB + 25 GB de transferencia)

#### Opción 3: Híbrida - Firebase Storage + Compresión Agresiva

**Estrategia:**
1. **Compresión en cliente:**
   - Reducir calidad a 70-80%
   - Redimensionar a máximo 1920x1080px
   - Convertir a WebP si es posible
   - Tamaño objetivo: 100-200 KB por imagen

2. **Compresión en servidor:**
   - Re-comprimir al subir
   - Generar thumbnails (150x150px)
   - Almacenar original + thumbnail

3. **Política de retención:**
   - Eliminar imágenes de transacciones eliminadas
   - Opción de "limpiar imágenes antiguas" (ej: >2 años)
   - Permitir al usuario eliminar imágenes manualmente

**Implementación:**
```typescript
// Cliente: Comprimir antes de subir
import imageCompression from 'browser-image-compression';

const compressImage = async (file: File) => {
  const options = {
    maxSizeMB: 0.2, // 200 KB
    maxWidthOrHeight: 1920,
    useWebWorker: true
  };
  return await imageCompression(file, options);
};

// Servidor: Re-comprimir y generar thumbnail
import sharp from 'sharp';

const processImage = async (buffer: Buffer) => {
  const compressed = await sharp(buffer)
    .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 75 })
    .toBuffer();
  
  const thumbnail = await sharp(buffer)
    .resize(150, 150, { fit: 'cover' })
    .jpeg({ quality: 80 })
    .toBuffer();
  
  return { compressed, thumbnail };
};
```

#### Opción 4: Almacenamiento Local (Solo para PWA)

**Estrategia:**
- Usar IndexedDB del navegador
- Solo funciona en PWA instalada
- No requiere servidor
- Límite: ~50% del espacio disponible del dispositivo

**Desventajas:**
- ❌ No sincroniza entre dispositivos
- ❌ Se pierde si se desinstala la app
- ❌ No accesible desde web

**No recomendado** para este caso de uso.

### 📊 Estructura de Datos Propuesta

#### Firestore - Colección `transactions`
```typescript
{
  // ... campos existentes
  attachments?: string[]; // URLs de imágenes en Firebase Storage
  attachmentsMetadata?: {
    url: string;
    filename: string;
    size: number; // bytes
    uploadedAt: Timestamp;
    thumbnailUrl?: string; // URL del thumbnail
  }[];
}
```

#### Firebase Storage - Estructura de Carpetas
```
transactions/
  {userId}/
    {transactionId}/
      {timestamp}-{index}.jpg      // Imagen original comprimida
      {timestamp}-{index}-thumb.jpg // Thumbnail
```

### 🔒 Reglas de Seguridad Firebase Storage

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Solo el usuario puede subir/leer sus propias imágenes
    match /transactions/{userId}/{transactionId}/{fileName} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && 
                      request.auth.uid == userId &&
                      request.resource.size < 5 * 1024 * 1024 && // 5 MB
                      request.resource.contentType.matches('image/.*');
      allow delete: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### 🎨 UX/UI Sugerida

**Formulario de Nueva Transacción:**
```
┌─────────────────────────────────────┐
│ Nueva Transacción                    │
│                                      │
│ [Campos normales...]                 │
│                                      │
│ 📷 Adjuntar Comprobante              │
│ ┌─────────────────────────────────┐ │
│ │  [📷 Tomar Foto] [🖼️ Galería]  │ │
│ │                                 │ │
│ │  [Preview de imágenes]          │ │
│ │  🖼️ factura.jpg (200 KB) [✕]    │ │
│ │  🖼️ ticket.jpg (150 KB) [✕]     │ │
│ └─────────────────────────────────┘ │
│                                      │
│ [Guardar]                            │
└─────────────────────────────────────┘
```

**Vista de Transacción:**
```
┌─────────────────────────────────────┐
│ Transacción: Compra Supermercado    │
│ $1,500 - 15 Dic 2024               │
│                                      │
│ 📷 Comprobantes (2)                  │
│ ┌─────────┐ ┌─────────┐            │
│ │ [thumb] │ │ [thumb] │            │
│ └─────────┘ └─────────┘            │
│                                      │
│ [Ver todas] [Descargar]              │
└─────────────────────────────────────┘
```

### ✅ Criterios de Aceptación

- [ ] Usuario puede seleccionar foto desde galería
- [ ] Usuario puede tomar foto con cámara
- [ ] Imágenes se comprimen antes de subir
- [ ] Preview de imágenes antes de guardar
- [ ] Límite de tamaño por imagen (5 MB)
- [ ] Límite de imágenes por transacción: **2 máximo**
- [ ] Compresión automática antes de subir
- [ ] Imágenes se muestran en detalle de transacción
- [ ] Thumbnails en lista de transacciones
- [ ] Zoom y visualización fullscreen
- [ ] Eliminar imagen adjunta
- [ ] Reemplazar imagen existente
- [ ] Reglas de seguridad implementadas
- [ ] Optimización de almacenamiento (compresión)

### 🔗 Archivos a Crear/Modificar

**Backend:**
- `apps/api/src/controllers/transactions.controller.ts` - Agregar endpoint para attachments
- `apps/api/src/services/storage.service.ts` - Servicio para Firebase Storage (nuevo)
- `apps/api/src/middleware/upload.ts` - Middleware para manejar multipart/form-data (nuevo)
- `apps/api/firebase.storage.rules` - Reglas de seguridad (nuevo)

**Frontend:**
- `apps/web/components/ImageUploader.tsx` - Componente de captura/subida (nuevo)
- `apps/web/app/transactions/new/page.tsx` - Integrar ImageUploader
- `apps/web/app/transactions/[id]/page.tsx` - Mostrar imágenes adjuntas
- `apps/web/lib/image-compression.ts` - Utilidades de compresión (nuevo)

**Dependencias:**
- Backend: `multer` o `busboy` (para multipart), `sharp` (para compresión)
- Frontend: `browser-image-compression` (para compresión en cliente)

### 📝 Recomendaciones de Implementación

#### Fase 1: MVP (Mínimo Viable)
1. Implementar subida básica a Firebase Storage
2. Compresión en cliente (200 KB máximo)
3. Una imagen por transacción
4. Visualización básica

#### Fase 2: Mejoras
1. Múltiples imágenes por transacción
2. Thumbnails automáticos
3. Compresión en servidor
4. Política de retención

#### Fase 3: Optimización
1. Lazy loading de imágenes
2. Cache de thumbnails
3. Análisis de uso de almacenamiento
4. Dashboard de gestión de espacio

### ⚠️ Consideraciones Importantes

1. **Privacidad:**
   - Las imágenes contienen información sensible (datos de tarjetas, direcciones)
   - Asegurar que solo el usuario propietario pueda acceder
   - Considerar encriptación para imágenes muy sensibles

2. **Rendimiento:**
   - Subida asíncrona (no bloquear guardado de transacción)
   - Mostrar progreso de subida
   - Manejar errores de red gracefully

3. **Costos:**
   - Monitorear uso de almacenamiento mensualmente
   - Implementar alertas cuando se acerque a límites
   - Considerar migrar a Cloudinary si se superan 20 GB

4. **Límites Técnicos:**
   - Firestore: documentos máximo 1 MiB (no almacenar imágenes aquí)
   - Firebase Storage: archivos máximo 5 TB (más que suficiente)
   - Navegador: límites de memoria para compresión

### 🎯 Prioridad

**MEDIA** - Mejora de UX importante pero no crítica. Puede implementarse después de funcionalidades core.

### 📅 Fecha de Solicitud

2 de Diciembre 2025

---

## 💳 MEJORA: "Marcar como Pagada" debe crear Transacción Automáticamente

**✅ ESTADO: COMPLETADA** - 2 de Diciembre 2025

### 📋 Descripción

Actualmente, cuando un usuario marca una deuda como "pagada" (Opción 1), solo se actualiza el contador de cuotas pagadas pero **no se crea una transacción**. Esto significa que:

- ❌ El pago no aparece en el historial de transacciones
- ❌ No se cuenta en los gastos del mes
- ❌ No aparece en las estadísticas
- ❌ No mantiene la integridad de los datos

**Problema:** El manual de usuario indica que la Opción 2 (Registrar Pago) es la recomendada porque crea una transacción, pero la Opción 1 debería hacer lo mismo para mantener todo integrado.

### 🎯 Solución Propuesta

**Cuando el usuario hace clic en "Marcar como Pagada":**

1. **Mostrar confirmación con opción de monto:**
   - Por defecto: usar `monthlyPaymentCents` (monto de la cuota)
   - Permitir editar el monto si pagó una cantidad diferente
   - Mostrar: "¿Confirmar pago de $X.XX?"

2. **Crear transacción automáticamente:**
   - Tipo: `EXPENSE`
   - Monto: monto confirmado por el usuario
   - Cuenta: se puede preguntar o usar una cuenta por defecto
   - Categoría: usar la subcategoría de la deuda (ya existe en el sistema)
   - Descripción: "Pago de cuota - {descripción de la deuda}"
   - Fecha: fecha actual (o permitir seleccionar)
   - Campo especial: `debtId` = ID de la deuda
   - Campo especial: `isDebtPayment` = true

3. **Actualizar la deuda:**
   - Incrementar `paidInstallments` en 1
   - Actualizar `updatedAt`

### 🔧 Cambios Técnicos Necesarios

#### Backend (`apps/api/src/controllers/debts.controller.ts`)

**Modificar `updateDebt()` o crear nuevo endpoint:**

```typescript
export async function markDebtAsPaid(req: AuthRequest, res: Response) {
  try {
    const { debtId, amountCents, accountId, occurredAt } = req.body;
    
    // 1. Validar que la deuda existe y pertenece al usuario
    const debtDoc = await db.collection("debts").doc(debtId).get();
    if (!debtDoc.exists) {
      return res.status(404).json({ error: "Deuda no encontrada" });
    }
    
    const debt = docToObject(debtDoc);
    if (debt.userId !== req.user!.userId) {
      return res.status(403).json({ error: "No autorizado" });
    }
    
    // 2. Validar que no esté completamente pagada
    if (debt.paidInstallments >= debt.totalInstallments) {
      return res.status(400).json({ error: "La deuda ya está completamente pagada" });
    }
    
    // 3. Obtener la categoría de la deuda (subcategoría de "Deudas")
    const debtsCategoryDoc = await getOrCreateDebtsCategory(req.user!.userId);
    const debtsCategoryId = debtsCategoryDoc.id;
    
    const subcategorySnapshot = await db.collection("categories")
      .where("userId", "==", req.user!.userId)
      .where("name", "==", debt.description)
      .where("type", "==", "EXPENSE")
      .where("parentId", "==", debtsCategoryId)
      .limit(1)
      .get();
    
    if (subcategorySnapshot.empty) {
      return res.status(400).json({ error: "Categoría de deuda no encontrada" });
    }
    const categoryId = subcategorySnapshot.docs[0].id;
    
    // 4. Validar cuenta (si no se proporciona, usar primera cuenta del usuario)
    let finalAccountId = accountId;
    if (!finalAccountId) {
      const accountsSnapshot = await db.collection("accounts")
        .where("userId", "==", req.user!.userId)
        .limit(1)
        .get();
      if (accountsSnapshot.empty) {
        return res.status(400).json({ error: "No hay cuentas disponibles" });
      }
      finalAccountId = accountsSnapshot.docs[0].id;
    }
    
    // 5. Usar batch write para atomicidad
    const batch = db.batch();
    
    // 5a. Crear transacción
    const transactionRef = db.collection("transactions").doc();
    const transactionData = {
      userId: req.user!.userId,
      accountId: finalAccountId,
      categoryId: categoryId,
      type: "EXPENSE",
      amountCents: amountCents || debt.monthlyPaymentCents,
      currencyCode: debt.currencyCode,
      occurredAt: occurredAt ? Timestamp.fromDate(new Date(occurredAt)) : Timestamp.now(),
      description: `Pago de cuota - ${debt.description}`,
      debtId: debtId,
      isDebtPayment: true,
      createdAt: Timestamp.now()
    };
    batch.set(transactionRef, objectToFirestore(transactionData));
    
    // 5b. Actualizar deuda
    const debtRef = db.collection("debts").doc(debtId);
    batch.update(debtRef, {
      paidInstallments: debt.paidInstallments + 1,
      updatedAt: Timestamp.now()
    });
    
    // 6. Commit atómico
    await batch.commit();
    
    // 7. Obtener datos actualizados
    const updatedDebt = docToObject(await debtRef.get());
    const createdTransaction = docToObject(await transactionRef.get());
    
    res.json({ 
      debt: updatedDebt, 
      transaction: createdTransaction,
      message: "Pago registrado exitosamente"
    });
  } catch (error: any) {
    console.error("Error marking debt as paid:", error);
    res.status(500).json({ error: error.message || "Error al registrar el pago" });
  }
}
```

**Agregar ruta:**
```typescript
// En debts.routes.ts
router.post("/:id/mark-paid", authenticate, markDebtAsPaid);
```

#### Frontend (`apps/web/app/debts/page.tsx`)

**Modificar el botón "Marcar como Pagada":**

```typescript
const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
const [selectedDebt, setSelectedDebt] = useState<any>(null);
const [paymentAmount, setPaymentAmount] = useState("");
const [paymentAccountId, setPaymentAccountId] = useState("");

const handleMarkAsPaid = async (debt: any) => {
  setSelectedDebt(debt);
  setPaymentAmount((debt.monthlyPaymentCents / 100).toFixed(2));
  setShowMarkPaidModal(true);
};

const confirmMarkAsPaid = async () => {
  try {
    const amountCents = Math.round(Number(paymentAmount) * 100);
    
    await api.post(`/debts/${selectedDebt.id}/mark-paid`, {
      amountCents,
      accountId: paymentAccountId || undefined,
      occurredAt: new Date().toISOString()
    });
    
    setShowMarkPaidModal(false);
    loadData(); // Recargar deudas y transacciones
    // Mostrar toast de éxito
  } catch (error: any) {
    // Mostrar error
  }
};

// En el JSX del botón:
<button onClick={() => handleMarkAsPaid(debt)}>
  Marcar como Pagada
</button>

// Modal de confirmación:
{showMarkPaidModal && (
  <div style={{ /* estilos del modal */ }}>
    <h3>Confirmar Pago de Cuota</h3>
    <p>Deuda: {selectedDebt?.description}</p>
    <p>Cuota mensual: {fmtMoney(selectedDebt?.monthlyPaymentCents)}</p>
    
    <label>Monto a pagar:</label>
    <input
      type="number"
      value={paymentAmount}
      onChange={(e) => setPaymentAmount(e.target.value)}
      min="0"
      step="0.01"
    />
    
    <label>Cuenta:</label>
    <select
      value={paymentAccountId}
      onChange={(e) => setPaymentAccountId(e.target.value)}
    >
      <option value="">Seleccionar cuenta...</option>
      {accounts.map(acc => (
        <option key={acc.id} value={acc.id}>
          {acc.name} ({acc.currencyCode})
        </option>
      ))}
    </select>
    
    <button onClick={confirmMarkAsPaid}>Confirmar Pago</button>
    <button onClick={() => setShowMarkPaidModal(false)}>Cancelar</button>
  </div>
)}
```

### 📊 Estructura de Datos

#### Transacción - Nuevos campos:
```typescript
{
  // ... campos existentes
  debtId?: string; // ID de la deuda asociada
  isDebtPayment?: boolean; // Flag para identificar pagos de deudas
}
```

### 🎨 UX/UI Sugerida

**Modal de Confirmación:**
```
┌─────────────────────────────────────┐
│ Confirmar Pago de Cuota             │
│                                      │
│ Deuda: Préstamo Personal            │
│ Cuota mensual: $500.00              │
│                                      │
│ Monto a pagar:                      │
│ [$500.00] (editable)                │
│                                      │
│ Cuenta:                             │
│ [Banco Principal ▼]                │
│                                      │
│ Fecha: [15 Dic 2024]                │
│                                      │
│ ✅ Se creará una transacción de     │
│    gasto automáticamente             │
│                                      │
│ [Cancelar] [Confirmar Pago]        │
└─────────────────────────────────────┘
```

### ✅ Criterios de Aceptación

- [ ] Al hacer clic en "Marcar como Pagada", se muestra modal de confirmación
- [ ] El monto por defecto es el `monthlyPaymentCents` de la deuda
- [ ] El usuario puede editar el monto si pagó una cantidad diferente
- [ ] El usuario puede seleccionar la cuenta desde la cual se pagó
- [ ] Al confirmar, se crea una transacción de tipo EXPENSE automáticamente
- [ ] La transacción tiene `debtId` y `isDebtPayment: true`
- [ ] La deuda se actualiza incrementando `paidInstallments` en 1
- [ ] La transacción aparece en el historial de transacciones
- [ ] La transacción se cuenta en los gastos del mes
- [ ] La transacción aparece en las estadísticas
- [ ] Todo se hace en una operación atómica (batch write)
- [ ] Si falla, no se actualiza ni la deuda ni se crea la transacción

### 🔗 Archivos a Modificar

**Backend:**
- `apps/api/src/controllers/debts.controller.ts` - Agregar función `markDebtAsPaid()`
- `apps/api/src/routes/debts.routes.ts` - Agregar ruta `POST /debts/:id/mark-paid`

**Frontend:**
- `apps/web/app/debts/page.tsx` - Modificar botón "Marcar como Pagada" y agregar modal
- `apps/web/app/debts/page.tsx` - Cargar lista de cuentas para el selector

**Base de Datos:**
- Agregar campos opcionales `debtId` e `isDebtPayment` a transacciones existentes (no requiere migración, son opcionales)

### 📝 Notas Adicionales

- **Ventaja:** Ahora ambas opciones (Marcar como Pagada y Registrar Pago) crean transacciones, manteniendo la integridad de los datos
- **Diferencia:** "Registrar Pago" permite más control (categoría, descripción personalizada), mientras que "Marcar como Pagada" es más rápido y automático
- **Filtros futuros:** Se puede agregar filtro en transacciones para ver solo pagos de deudas (`isDebtPayment: true`)
- **Estadísticas:** Los pagos de deudas se pueden incluir o excluir de ciertas estadísticas según se desee

### 🎯 Prioridad

**ALTA** - Corrige una inconsistencia importante en el flujo de trabajo y mejora la integridad de los datos.

### 📅 Fecha de Solicitud

2 de Diciembre 2025

