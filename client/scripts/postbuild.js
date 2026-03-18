/**
 * Post-build script: تحسينات الأداء بعد البناء
 * 1. تحويل CSS من render-blocking إلى async loading
 * 2. إضافة preload للـ CSS
 */
const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'build', 'index.html');

if (!fs.existsSync(indexPath)) {
  console.log('⚠️ build/index.html not found, skipping postbuild');
  process.exit(0);
}

let html = fs.readFileSync(indexPath, 'utf8');

// تحويل CSS link إلى non-blocking
// Pattern: <link href="/static/css/main.HASH.css" rel="stylesheet">
html = html.replace(
  /<link href="(\/static\/css\/[^"]+\.css)" rel="stylesheet">/g,
  (match, cssHref) => {
    return `<link rel="preload" href="${cssHref}" as="style" onload="this.onload=null;this.rel='stylesheet'"><noscript><link rel="stylesheet" href="${cssHref}"></noscript>`;
  }
);

fs.writeFileSync(indexPath, html);
console.log('✅ Postbuild: CSS converted to async loading');
