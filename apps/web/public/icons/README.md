# Iconos PWA

## Iconos Generados

Los iconos SVG están creados. Para convertirlos a PNG:

### Opción 1: Online (Más Fácil)
1. Ir a https://cloudconvert.com/svg-to-png
2. Subir `icon-192x192.svg` → Descargar como `icon-192x192.png`
3. Subir `icon-512x512.svg` → Descargar como `icon-512x512.png`
4. Guardar ambos PNG en esta carpeta

### Opción 2: Usar el HTML Generator
1. Abrir `generate-icons.html` en el navegador
2. Click en "Generar y Descargar Iconos"
3. Los PNG se descargarán automáticamente

### Opción 3: Usar Node.js (si tienes sharp)
```bash
npm install sharp
node convert-icons.js
```

## Verificación

Después de crear los PNG, verifica que existan:
- ✅ `icon-192x192.png`
- ✅ `icon-512x512.png`

El manifest.json ya está configurado para usar estos iconos.

