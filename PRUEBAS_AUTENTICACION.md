# 🔐 Pruebas de Autenticación y Sesión

**Fecha:** Diciembre 2025  
**Prioridad:** ⭐ CRÍTICO

---

## 📋 CHECKLIST DE PRUEBAS

### ✅ PRUEBA 1: Registro de Nuevo Usuario

**Pasos:**
1. Ir a: `https://tu-app.vercel.app/signup`
2. Completar el formulario:
   - **Email:** `test-usuario-1@test.com` (o cualquier email válido)
   - **Password:** `Test123456` (mínimo 6 caracteres)
   - **Moneda:** Seleccionar (ej: UYU)
   - **Zona horaria:** Seleccionar (ej: America/Montevideo)
3. Click en **"Crear Cuenta"**
4. **Verificar:**
   - ✅ Debe redirigir automáticamente a `/dashboard`
   - ✅ No debe aparecer error
   - ✅ Debe mostrar el dashboard con datos vacíos

**Resultado esperado:**
- ✅ Usuario creado exitosamente
- ✅ Redirección automática al dashboard
- ✅ Sesión iniciada automáticamente

---

### ✅ PRUEBA 2: Login con Credenciales Existentes

**Pasos:**
1. Ir a: `https://tu-app.vercel.app/login`
2. Ingresar credenciales:
   - **Email:** El email que usaste en la Prueba 1
   - **Password:** La contraseña que usaste
3. Click en **"Iniciar Sesión"**
4. **Verificar:**
   - ✅ Debe redirigir a `/dashboard`
   - ✅ No debe aparecer error
   - ✅ Debe mostrar el dashboard

**Resultado esperado:**
- ✅ Login exitoso
- ✅ Redirección al dashboard
- ✅ Sesión iniciada

---

### ✅ PRUEBA 3: Login con Credenciales Incorrectas

**Pasos:**
1. Ir a: `https://tu-app.vercel.app/login`
2. Ingresar credenciales incorrectas:
   - **Email:** `test-usuario-1@test.com`
   - **Password:** `PasswordIncorrecta123`
3. Click en **"Iniciar Sesión"**
4. **Verificar:**
   - ✅ Debe mostrar mensaje de error: "Credenciales inválidas"
   - ✅ NO debe redirigir al dashboard
   - ✅ Debe permanecer en la página de login

**Resultado esperado:**
- ✅ Error mostrado correctamente
- ✅ No se permite acceso con credenciales incorrectas

---

### ✅ PRUEBA 4: Persistencia de Sesión

**Pasos:**
1. Iniciar sesión (usar Prueba 2)
2. Verificar que estás en `/dashboard`
3. **Recargar la página** (F5 o Ctrl+R)
4. **Verificar:**
   - ✅ Debe permanecer en `/dashboard`
   - ✅ NO debe redirigir a `/login`
   - ✅ La sesión debe mantenerse

**Resultado esperado:**
- ✅ Sesión persiste después de recargar
- ✅ No se pierde la autenticación

---

### ✅ PRUEBA 5: Persistencia de Sesión (Cerrar Navegador)

**Pasos:**
1. Iniciar sesión (usar Prueba 2)
2. **Cerrar el navegador completamente**
3. **Abrir el navegador nuevamente**
4. Ir directamente a: `https://tu-app.vercel.app/dashboard`
5. **Verificar:**
   - ✅ Debe mostrar el dashboard
   - ✅ NO debe redirigir a `/login`
   - ✅ La sesión debe mantenerse

**Resultado esperado:**
- ✅ Sesión persiste después de cerrar y abrir navegador
- ✅ Token almacenado correctamente en localStorage

---

### ✅ PRUEBA 6: Logout

**Pasos:**
1. Iniciar sesión (usar Prueba 2)
2. Ir a `/dashboard`
3. Buscar el botón **"🚪 Salir"** (está en la parte superior del dashboard)
4. Click en **"🚪 Salir"**
5. **Verificar:**
   - ✅ Debe redirigir a `/login`
   - ✅ NO debe poder acceder a `/dashboard`
   - ✅ Si intentas ir a `/dashboard`, debe redirigir a `/login`

**Resultado esperado:**
- ✅ Logout funciona correctamente
   - ✅ Sesión cerrada
   - ✅ Redirección a login
   - ✅ Protección de rutas funciona

---

### ✅ PRUEBA 7: Protección de Rutas

**Pasos:**
1. **Asegúrate de estar deslogueado** (usar Prueba 6)
2. Intentar acceder directamente a rutas protegidas:
   - `https://tu-app.vercel.app/dashboard`
   - `https://tu-app.vercel.app/transactions`
   - `https://tu-app.vercel.app/accounts`
   - `https://tu-app.vercel.app/categories`
3. **Verificar:**
   - ✅ Todas deben redirigir a `/login`
   - ✅ NO debe mostrar contenido protegido

**Resultado esperado:**
- ✅ Rutas protegidas funcionan correctamente
- ✅ Redirección automática a login cuando no hay sesión

---

### ⚠️ PRUEBA 8: Recuperación de Contraseña (PENDIENTE - Requiere SendGrid)

**⚠️ IMPORTANTE:** Esta prueba requiere que SendGrid esté configurado en Render.

**Verificar primero:**
- [ ] ¿Ya configuraste SendGrid en Render? (3 variables de entorno)
- [ ] ¿Hiciste redeploy en Render después de configurar?

**Si SendGrid está configurado:**

**Pasos:**
1. Ir a: `https://tu-app.vercel.app/forgot-password`
2. Ingresar un email válido (que esté registrado)
3. Click en **"Enviar Enlace de Recuperación"**
4. **Verificar:**
   - ✅ Debe mostrar mensaje: "Si el email existe, recibirás un enlace..."
   - ✅ Revisar el email (y carpeta de spam)
   - ✅ Debe llegar el email de recuperación
   - ✅ El email debe contener un enlace para resetear contraseña

**Resultado esperado:**
- ✅ Email enviado correctamente
- ✅ Email llega al buzón
- ✅ Enlace de recuperación funciona

**Si SendGrid NO está configurado:**
- ⚠️ El sistema mostrará éxito pero NO enviará el email
- ⚠️ Revisa los logs de Render para ver el URL de recuperación
- ⚠️ Configura SendGrid siguiendo: `apps/api/GUIA_SENDGRID_PASO_A_PASO.md`

---

## 📊 RESUMEN DE PRUEBAS

| Prueba | Estado | Prioridad |
|--------|--------|-----------|
| 1. Registro | ⬜ Pendiente | ⭐ Crítico |
| 2. Login | ⬜ Pendiente | ⭐ Crítico |
| 3. Login Incorrecto | ⬜ Pendiente | ⭐ Crítico |
| 4. Persistencia (Recargar) | ⬜ Pendiente | ⭐ Crítico |
| 5. Persistencia (Cerrar) | ⬜ Pendiente | ⭐ Crítico |
| 6. Logout | ⬜ Pendiente | ⭐ Crítico |
| 7. Protección Rutas | ⬜ Pendiente | ⭐ Crítico |
| 8. Recuperación Contraseña | ⬜ Pendiente | ⚠️ Requiere SendGrid |

---

## 🐛 SI ENCUENTRAS PROBLEMAS

### Error: "Credenciales inválidas" al hacer login correcto
- **Causa:** Puede ser que `FIREBASE_API_KEY` no esté configurada en Render
- **Solución:** Verificar que `FIREBASE_API_KEY` esté en variables de entorno de Render

### Error: Sesión no persiste
- **Causa:** Problema con Zustand persist o localStorage
- **Solución:** Revisar consola del navegador para errores de JavaScript

### Error: Redirección infinita
- **Causa:** Problema con la lógica de protección de rutas
- **Solución:** Revisar `apps/web/app/page.tsx` y middleware de autenticación

### Error: Email de recuperación no llega
- **Causa:** SendGrid no configurado o mal configurado
- **Solución:** Seguir `apps/api/GUIA_SENDGRID_PASO_A_PASO.md`

---

## ✅ SIGUIENTE PASO

Después de completar estas pruebas:
1. Anotar cualquier problema encontrado
2. Continuar con pruebas de navegación y menú
3. Luego pruebas de transacciones

---

**¡Vamos paso a paso! Empieza con la Prueba 1 y avísame cómo va.**

