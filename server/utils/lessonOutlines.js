/**
 * فهارس الكتب (أسماء الوحدات والدروس) المستخرجة بـ server/scripts/outlines/extract.py.
 * تُقرأ من server/data/lesson-outlines.json وتُعاد قراءتها إذا تغيّر الملف.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'lesson-outlines.json');
let cache = {};
let mtime = 0;

function getOutline(slug) {
  try {
    const m = fs.statSync(FILE).mtimeMs;
    if (m !== mtime) {
      cache = JSON.parse(fs.readFileSync(FILE, 'utf8'));
      mtime = m;
    }
  } catch {
    return null;
  }
  return cache[slug] || null;
}

module.exports = { getOutline };
