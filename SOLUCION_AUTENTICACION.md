# 🔐 Solución: Error de Autenticación GitHub

## Problema
```
error: Permission to KenshinMakoto7-stack/finanzas-personales.git denied to sincroniauy-dot
```

Esto significa que Git está usando credenciales de otra cuenta (`sincroniauy-dot`) en vez de `KenshinMakoto7-stack`.

---

## ✅ Solución 1: Usar Token de Acceso Personal (Recomendado)

### Paso 1: Crear Token en GitHub
1. Ir a: https://github.com/settings/tokens
2. **"Generate new token"** → **"Generate new token (classic)"**
3. Nombre: `finanzas-personales-deployment`
4. Seleccionar scopes:
   - ✅ `repo` (acceso completo a repositorios)
5. **"Generate token"**
6. **COPIAR EL TOKEN** (solo se muestra una vez)

### Paso 2: Usar Token en Git
```powershell
cd "C:\Users\Gamer\Desktop\PROYECTO APP FINANZA"

# Usar el token en la URL
git remote set-url origin https://TU-TOKEN@github.com/KenshinMakoto7-stack/finanzas-personales.git

# O mejor, usar el usuario:
git remote set-url origin https://KenshinMakoto7-stack@github.com/KenshinMakoto7-stack/finanzas-personales.git

# Luego hacer push (te pedirá la contraseña, usa el TOKEN)
git push -u origin main
```

---

## ✅ Solución 2: Limpiar Credenciales Guardadas

### Windows (Credential Manager)
1. Presiona `Win + R`
2. Escribe: `control /name Microsoft.CredentialManager`
3. Click en **"Credenciales de Windows"**
4. Buscar `git:https://github.com`
5. Eliminar las credenciales guardadas
6. Intentar push de nuevo (te pedirá usuario y contraseña/token)

### O desde PowerShell:
```powershell
# Ver credenciales guardadas
cmdkey /list | Select-String "github"

# Eliminar credenciales de GitHub
cmdkey /delete:git:https://github.com
```

---

## ✅ Solución 3: Usar SSH (Más Seguro)

### Paso 1: Generar SSH Key
```powershell
ssh-keygen -t ed25519 -C "tu-email@example.com"
# Presionar Enter para usar ubicación por defecto
# Opcional: agregar passphrase
```

### Paso 2: Agregar SSH Key a GitHub
1. Copiar la clave pública:
   ```powershell
   cat ~/.ssh/id_ed25519.pub
   ```
2. Ir a: https://github.com/settings/keys
3. **"New SSH key"**
4. Pegar la clave
5. **"Add SSH key"**

### Paso 3: Cambiar Remote a SSH
```powershell
git remote set-url origin git@github.com:KenshinMakoto7-stack/finanzas-personales.git
git push -u origin main
```

---

## ✅ Solución 4: Usar GitHub CLI (Más Fácil)

```powershell
# Instalar GitHub CLI (si no está instalado)
# winget install GitHub.cli

# Login
gh auth login

# Seleccionar GitHub.com
# Seleccionar HTTPS
# Autenticar en el navegador

# Luego hacer push normalmente
git push -u origin main
```

---

## 🎯 Recomendación Rápida

**Opción más rápida:**
1. Ir a: https://github.com/settings/tokens
2. Crear token con scope `repo`
3. Copiar token
4. Ejecutar:
   ```powershell
   cd "C:\Users\Gamer\Desktop\PROYECTO APP FINANZA"
   git push -u origin main
   ```
5. Cuando pida usuario: `KenshinMakoto7-stack`
6. Cuando pida contraseña: **PEGAR EL TOKEN**

---

## ✅ Verificar que Funcionó

```powershell
git push -u origin main
```

Debería mostrar:
```
Enumerating objects: ...
Counting objects: 100% ...
Writing objects: 100% ...
To https://github.com/KenshinMakoto7-stack/finanzas-personales.git
 * [new branch]      main -> main
Branch 'main' set up to track remote branch 'main' from 'origin'.
```

