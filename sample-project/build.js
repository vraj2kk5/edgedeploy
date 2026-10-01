const fs = require('fs');
const path = require('path');

console.log('🚀 Starting build for Edge Sample App...');

const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

const publicDir = path.join(__dirname, 'public');
if (fs.existsSync(publicDir)) {
  const files = fs.readdirSync(publicDir);
  for (const file of files) {
    const srcPath = path.join(publicDir, file);
    const destPath = path.join(distDir, file);
    fs.copyFileSync(srcPath, destPath);
    console.log(`  ✓ Copied ${file} -> dist/${file}`);
  }
}

console.log('✅ Sample App Build completed successfully!');
