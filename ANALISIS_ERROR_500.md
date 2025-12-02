# Análisis del Error 500 en `/statistics/expenses-by-category`

## Problema

El error 500 persiste en Render a pesar de que el código local está correcto. Los logs muestran:

```
Expenses by category error: Error: 9 FAILED_PRECONDITION: The query requires an index.
```

## Análisis de los Logs de Render

### Commit Desplegado
- **Commit en Render**: `a042ee33353c4d5421cf880f6e65b963870ee529`
- **Fecha**: 2025-12-02T02:08:32

### Error Específico
El error indica que Firestore requiere un índice compuesto para la consulta:
- `type` (ASCENDING)
- `userId` (ASCENDING)  
- `occurredAt` (ASCENDING)

## Código Actual (Local)

El código local en `apps/api/src/controllers/statistics.controller.ts` está correcto:

```typescript
// Línea 48-52
const allTransactionsSnapshot = await db.collection("transactions")
  .where("userId", "==", req.user!.userId)
  .get();

// Línea 57-65: Filtrado en memoria
const expenseTransactions = allTransactionsSnapshot.docs
  .map(doc => docToObject(doc))
  .filter((tx: any) => {
    if (tx.type !== "EXPENSE") return false;
    const txDate = tx.occurredAt?.toDate?.() || new Date(tx.occurredAt);
    const txTime = txDate.getTime();
    return txTime >= startTime && txTime <= endTime;
  });
```

## Posibles Causas

1. **Render no ha desplegado el commit más reciente**: El commit `a042ee3` es anterior a nuestros cambios.
2. **Caché de build**: Render podría estar usando un caché de build antiguo.
3. **El código en GitHub no está actualizado**: Aunque hicimos `git push`, podría haber un problema de sincronización.

## Solución

### Paso 1: Verificar el Commit en GitHub
```bash
git log --oneline -5
git show HEAD:apps/api/src/controllers/statistics.controller.ts | grep -A 10 "expensesByCategory"
```

### Paso 2: Forzar Redeploy en Render
1. Ir al dashboard de Render
2. Seleccionar el servicio de backend
3. Hacer clic en "Manual Deploy" → "Clear build cache & deploy"
4. Esperar a que termine el deploy

### Paso 3: Verificar el Código Desplegado
Después del deploy, verificar en los logs de Render que el commit desplegado sea el más reciente.

## Otros Problemas Corregidos

1. ✅ **Trust Proxy Warning**: Cambiado de `true` a `1` para ser más específico
2. ✅ **Meta Tag Deprecado**: Removido `apple-mobile-web-app-capable` (ya tenemos `mobile-web-app-capable`)
3. ✅ **Accesibilidad**: Agregados `id` y `name` a todos los inputs, y `htmlFor` a los labels
4. ✅ **Favicon 404**: Ya está configurado en `layout.tsx`

## Próximos Pasos

1. Verificar que el commit más reciente esté en GitHub
2. Forzar redeploy en Render con "Clear build cache"
3. Verificar que el error 500 desaparezca después del deploy

