#!/usr/bin/env node
/**
 * سكريبت تحويل جماعي لكل ملفات PDF المعلقة
 * يحوّل ملف واحد في كل مرة لتجنب مشاكل الذاكرة
 *
 * التشغيل: cd /var/www/halmanhaj/server && node scripts/convertAllPdfs.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const path = require('path');
const fs = require('fs');
const { pool } = require('../config/db');
const { convertPdfToImages } = require('../services/pdfConverter');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('  📖 تحويل جماعي لملفات PDF');
  console.log('═══════════════════════════════════════');
  console.log('');

  // جلب كل الملفات المعلقة
  const result = await pool.query(`
    SELECT lf.id, lf.lesson_id, lf.file_name, lf.original_name, lf.page_count, lf.pages_status,
           l.title as lesson_title
    FROM lesson_files lf
    JOIN lessons l ON l.id = lf.lesson_id
    WHERE lf.file_type = 'pdf' AND lf.pages_status IN ('pending', 'failed')
    ORDER BY lf.created_at ASC
  `);

  const files = result.rows;
  if (files.length === 0) {
    console.log('✅ لا يوجد ملفات تحتاج تحويل!');
    process.exit(0);
  }

  console.log(`📋 وجدت ${files.length} ملف PDF تحتاج تحويل\n`);

  let success = 0;
  let failed = 0;
  let totalPages = 0;
  const startTime = Date.now();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const pdfPath = path.join(UPLOADS_DIR, file.file_name);
    const fileStart = Date.now();

    process.stdout.write(`[${i + 1}/${files.length}] ${file.original_name || file.lesson_title}... `);

    // تحقق أن الملف موجود
    if (!fs.existsSync(pdfPath)) {
      console.log('❌ الملف غير موجود على القرص');
      await pool.query(
        "UPDATE lesson_files SET pages_status = 'failed' WHERE id = $1",
        [file.id]
      );
      failed++;
      continue;
    }

    try {
      const result = await convertPdfToImages(file.lesson_id, file.id, pdfPath);
      const elapsed = ((Date.now() - fileStart) / 1000).toFixed(1);
      const pages = result?.convertedPages || file.page_count || '?';
      totalPages += parseInt(pages) || 0;
      console.log(`✅ ${pages} صفحة (${elapsed}s)`);
      success++;
    } catch (err) {
      const elapsed = ((Date.now() - fileStart) / 1000).toFixed(1);
      console.log(`❌ فشل (${elapsed}s) — ${err.message}`);
      failed++;
    }

    // تنظيف الذاكرة بعد كل ملف
    if (global.gc) global.gc();
  }

  const totalElapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  console.log('');
  console.log('═══════════════════════════════════════');
  console.log(`  📊 النتائج:`);
  console.log(`     ✅ نجح: ${success}`);
  console.log(`     ❌ فشل: ${failed}`);
  console.log(`     📄 إجمالي الصفحات: ${totalPages}`);
  console.log(`     ⏱️  الوقت: ${totalElapsed} دقيقة`);
  console.log('═══════════════════════════════════════');
  console.log('');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('❌ خطأ غير متوقع:', err);
  process.exit(1);
});
