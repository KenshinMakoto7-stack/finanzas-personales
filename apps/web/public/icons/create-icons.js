// Script Node.js para generar iconos PWA
// Ejecutar: node create-icons.js

const fs = require('fs');
const path = require('path');

// Crear directorio si no existe
const iconsDir = path.join(__dirname);
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Función para crear un icono SVG
function createIconSVG(size) {
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="url(#grad)"/>
  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${size * 0.5}" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">$</text>
</svg>`;
}

// Tamaños necesarios
const sizes = [192, 512];

console.log('Generando iconos SVG...');

sizes.forEach(size => {
  const svg = createIconSVG(size);
  const filename = `icon-${size}x${size}.svg`;
  fs.writeFileSync(path.join(iconsDir, filename), svg);
  console.log(`✓ Creado: ${filename}`);
});

console.log('\n⚠️  Nota: Los archivos son SVG. Para PNG, usa una herramienta online como:');
console.log('   - https://cloudconvert.com/svg-to-png');
console.log('   - https://convertio.co/svg-png/');
console.log('\nO instala sharp y ejecuta: npm install sharp');

