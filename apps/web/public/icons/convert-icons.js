// Script para convertir SVG a PNG usando sharp
// Ejecutar: npm install sharp && node convert-icons.js

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [192, 512];

async function convertIcons() {
  for (const size of sizes) {
    const svgPath = path.join(__dirname, `icon-${size}x${size}.svg`);
    const pngPath = path.join(__dirname, `icon-${size}x${size}.png`);
    
    if (!fs.existsSync(svgPath)) {
      console.error(`❌ No se encuentra: ${svgPath}`);
      continue;
    }
    
    try {
      await sharp(svgPath)
        .resize(size, size)
        .png()
        .toFile(pngPath);
      console.log(`✅ Creado: icon-${size}x${size}.png`);
    } catch (error) {
      console.error(`❌ Error creando icon-${size}x${size}.png:`, error.message);
    }
  }
}

convertIcons();

