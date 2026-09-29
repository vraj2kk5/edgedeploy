const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'public');
const distDir = path.join(__dirname, 'dist');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

fs.cpSync(srcDir, distDir, { recursive: true });
console.log('Build complete! Files copied from public/ to dist/');
