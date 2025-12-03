# 🚀 Configurar Vercel para Monorepo

## ✅ Estado Actual

- ✅ **Monorepo**: `PROYECTO_APP_FINANZA` (GitHub: `finanzas-personales`)
- ✅ **Backend**: `apps/api/` → Render ✅ Funcionando
- ✅ **Frontend**: `apps/web/` → Vercel (necesita configuración)
- ✅ **Todos los cambios**: Mejoras 1, 3, 4 y 6 están en el monorepo

## 📋 Pasos para Configurar Vercel

### Paso 1: Ir a Vercel Dashboard
1. Abre: https://vercel.com/dashboard
2. Selecciona el proyecto `finanzas-web` (o el nombre que tengas)

### Paso 2: Configurar Root Directory
1. Ve a **Settings** → **General**
2. Busca la sección **"Root Directory"**
3. Haz clic en **"Edit"**
4. Ingresa: `apps/web`
5. Haz clic en **"Save"**

### Paso 3: Verificar Build Settings
1. En **Settings** → **General**, verifica:
   - **Framework Preset**: Next.js (debería detectarse automáticamente)
   - **Root Directory**: `apps/web` ✅
   - **Build Command**: `npm run build` (o `cd apps/web && npm run build`)
   - **Output Directory**: `.next` (o `apps/web/.next`)

### Paso 4: Cambiar el Repositorio Conectado (Opcional pero Recomendado)
1. Ve a **Settings** → **Git**
2. Si está conectado a `finanzas-web`, puedes:
   - **Opción A**: Desconectar `finanzas-web` y conectar `finanzas-personales`
   - **Opción B**: Mantener ambos (Vercel puede tener múltiples proyectos)

**Recomendación**: Conectar `finanzas-personales` y usar Root Directory `apps/web`

### Paso 5: Trigger Manual Deployment (Opcional)
1. Ve a **Deployments**
2. Haz clic en los **tres puntos (⋯)** del deployment actual
3. Selecciona **"Redeploy"**
4. Esto forzará un nuevo build con la nueva configuración

## ✅ Verificación

Después de configurar:

1. **Verifica que Vercel detecte el nuevo commit**:
   - Debería aparecer un nuevo deployment con el commit `92d5188`
   - O el commit más reciente del monorepo

2. **Verifica el build**:
   - El build debería ejecutarse desde `apps/web/`
   - Debería compilar correctamente

3. **Verifica en producción**:
   - Abre la URL de Vercel
   - Verifica que los cambios estén aplicados (nuevo diseño, mejoras, etc.)

## 🔄 Flujo de Trabajo Futuro

Una vez configurado, trabajarás así:

```powershell
# 1. Trabajar en el monorepo
cd C:\Users\Gamer\Desktop\PROYECTO_APP_FINANZA

# 2. Hacer cambios en apps/web/ (frontend)
# o apps/api/ (backend)

# 3. Commit y push
git add .
git commit -m "feat: Nuevo cambio"
git push origin main

# 4. Automáticamente:
# - Render detecta cambios en apps/api/ → despliega backend
# - Vercel detecta cambios en apps/web/ → despliega frontend
```

## ⚠️ Notas Importantes

1. **Root Directory es crítico**: Sin esto, Vercel buscará `package.json` en la raíz y fallará
2. **Build Command**: Puede necesitar ajuste si `package.json` está en `apps/web/`
3. **Environment Variables**: Si tienes variables en Vercel, se mantienen igual

## 🎉 Resultado Final

- ✅ Un solo repositorio para mantener
- ✅ Deploys automáticos desde el monorepo
- ✅ Sin necesidad de sincronizar manualmente
- ✅ Menos confusión sobre dónde trabajar

