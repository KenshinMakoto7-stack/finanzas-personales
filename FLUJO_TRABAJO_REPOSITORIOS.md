# 📋 Flujo de Trabajo - Repositorios Separados

**Fecha**: Diciembre 2025  
**Estrategia**: Mantener repositorios separados hasta consolidar más adelante

---

## 🗂️ Estructura Actual

### Backend (Monorepo)
- **Carpeta local**: `C:\Users\Gamer\Desktop\PROYECTO_APP_FINANZA`
- **Repositorio GitHub**: `finanzas-personales`
- **Deploy**: Render (automático)
- **Código**: `apps/api/`

### Frontend (Separado)
- **Carpeta local**: `C:\Users\Gamer\Desktop\finanzas-web`
- **Repositorio GitHub**: `finanzas-web`
- **Deploy**: Vercel (automático)
- **Código**: `app/`, `components/`, `lib/`

### Frontend Obsoleto (Ignorar)
- **Carpeta local**: `C:\Users\Gamer\Desktop\PROYECTO_APP_FINANZA\apps\web`
- **Estado**: ❌ NO se usa en producción
- **Nota**: Existe pero Vercel NO lo despliega

---

## 🎯 ¿Dónde Trabajar?

### ✅ Backend (API, Lógica de Negocio)

**Trabajar en**: `C:\Users\Gamer\Desktop\PROYECTO_APP_FINANZA`

**Cambios que van aquí**:
- ✅ Endpoints de API (`apps/api/src/routes/`)
- ✅ Controladores (`apps/api/src/controllers/`)
- ✅ Servicios (`apps/api/src/services/`)
- ✅ Modelos de datos (`apps/api/src/models/`)
- ✅ Configuración de base de datos
- ✅ Autenticación backend
- ✅ Servicios de email
- ✅ Lógica de negocio

**Comandos**:
```powershell
cd C:\Users\Gamer\Desktop\PROYECTO_APP_FINANZA
# Hacer cambios en apps/api/
git add apps/api/
git commit -m "feat: Descripción del cambio"
git push origin main
# → Render despliega automáticamente
```

---

### ✅ Frontend (UI, Componentes, Páginas)

**Trabajar en**: `C:\Users\Gamer\Desktop\finanzas-web`

**Cambios que van aquí**:
- ✅ Páginas (`app/`)
- ✅ Componentes (`components/`)
- ✅ Estilos (`app/globals.css`)
- ✅ Utilidades del frontend (`lib/`)
- ✅ Estado del cliente (Zustand) (`store/`)
- ✅ Formularios
- ✅ Navegación
- ✅ Diseño y UX

**Comandos**:
```powershell
cd C:\Users\Gamer\Desktop\finanzas-web
# Hacer cambios en app/, components/, lib/
git add .
git commit -m "feat: Descripción del cambio"
git push origin main
# → Vercel despliega automáticamente
```

---

## ⚠️ Casos Especiales

### Cambios que Afectan Ambos

Si un cambio requiere modificar backend Y frontend:

1. **Primero el Backend**:
   ```powershell
   cd C:\Users\Gamer\Desktop\PROYECTO_APP_FINANZA
   # Hacer cambios en apps/api/
   git add apps/api/
   git commit -m "feat: Nuevo endpoint X"
   git push origin main
   ```

2. **Luego el Frontend**:
   ```powershell
   cd C:\Users\Gamer\Desktop\finanzas-web
   # Hacer cambios en app/ o components/ para usar el nuevo endpoint
   git add .
   git commit -m "feat: Integrar endpoint X en UI"
   git push origin main
   ```

---

## 🔍 Verificación Rápida

Antes de hacer commit, verifica:

1. **¿En qué carpeta estoy?**
   ```powershell
   pwd  # o Get-Location en PowerShell
   ```

2. **¿Qué repositorio es?**
   ```powershell
   git remote -v
   ```

3. **¿Qué estoy cambiando?**
   - Si es `apps/api/` → Backend → `PROYECTO_APP_FINANZA`
   - Si es `app/`, `components/`, `lib/` → Frontend → `finanzas-web`

---

## 📝 Resumen Visual

```
┌─────────────────────────────────────────┐
│  PROYECTO_APP_FINANZA                  │
│  GitHub: finanzas-personales           │
│  Deploy: Render                        │
│                                         │
│  ✅ Trabajar aquí para:                │
│     - apps/api/ (Backend)              │
│     - Lógica de negocio                │
│     - Endpoints                        │
│                                         │
│  ❌ NO trabajar aquí para frontend:    │
│     - apps/web/ (obsoleto)            │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  finanzas-web                           │
│  GitHub: finanzas-web                   │
│  Deploy: Vercel                        │
│                                         │
│  ✅ Trabajar aquí para:                │
│     - app/ (Páginas)                   │
│     - components/ (Componentes)        │
│     - lib/ (Utilidades)                │
│     - Estilos y diseño                 │
└─────────────────────────────────────────┘
```

---

## 🎯 Regla de Oro

**"Si cambias algo en `apps/api/`, trabaja en `PROYECTO_APP_FINANZA`.  
Si cambias algo en `app/`, `components/`, o `lib/`, trabaja en `finanzas-web`."**

---

## 🔄 Consolidación Futura

Cuando estemos listos para consolidar:

1. Verificar que ambos repositorios estén sincronizados
2. Configurar Vercel para usar monorepo con Root Directory: `apps/web`
3. Eliminar carpeta `finanzas-web` local
4. Trabajar siempre desde `PROYECTO_APP_FINANZA`

**Por ahora**: Mantener separados y trabajar en el que corresponda.

---

## ✅ Checklist Antes de Commit

- [ ] Verifico en qué carpeta estoy (`pwd`)
- [ ] Verifico qué repositorio es (`git remote -v`)
- [ ] Confirmo que estoy trabajando en el lugar correcto
- [ ] Hago commit con mensaje descriptivo
- [ ] Hago push
- [ ] Verifico que el deploy se inició (Render/Vercel)

---

**Última actualización**: Diciembre 2025

