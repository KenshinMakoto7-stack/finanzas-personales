// Script para crear iconos PNG desde SVG usando Node.js
// Requiere: npm install sharp (si no está instalado)

const fs = require('fs');
const path = require('path');

async function createPNGFromSVG() {
  try {
    // Intentar usar sharp si está disponible
    let sharp;
    try {
      sharp = require('sharp');
    } catch (e) {
      console.log('⚠️  Sharp no está instalado. Instalando...');
      const { execSync } = require('child_process');
      try {
        execSync('npm install sharp --save-dev', { cwd: path.join(__dirname, '../../..'), stdio: 'inherit' });
        sharp = require('sharp');
      } catch (err) {
        console.error('❌ No se pudo instalar sharp. Usa el método alternativo:');
        console.log('1. Abre generate-icons.html en el navegador');
        console.log('2. Click en "Generar y Descargar Iconos"');
        return;
      }
    }

    const sizes = [192, 512];
    const iconsDir = __dirname;

    for (const size of sizes) {
      const svgPath = path.join(iconsDir, `icon-${size}x${size}.svg`);
      const pngPath = path.join(iconsDir, `icon-${size}x${size}.png`);

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

    console.log('\n✅ ¡Iconos PNG creados exitosamente!');
  } catch (error) {
    console.error('Error general:', error);
  }
}

createPNGFromSVG();

