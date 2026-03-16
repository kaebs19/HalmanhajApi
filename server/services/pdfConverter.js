/**
 * خدمة تحويل PDF لصور WebP
 * - تحويل كل صفحة لصورة WebP بجودة عالية (1200px, 85%)
 * - تحويل كل صفحة لصورة مصغرة WebP (400px, 70%)
 * - توليد صورة مصغرة للدرس (800x1130)
 * - التحويل في الخلفية (لا يوقف الرفع)
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { execSync } = require('child_process');
const { pool } = require('../config/db');

// تحميل pdfjs-dist ديناميكياً
let pdfjsLib = null;
async function getPdfjs() {
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return pdfjsLib;
}

// تحميل @napi-rs/canvas
let createCanvasFn = null;
function getCreateCanvas() {
  if (!createCanvasFn) {
    const { createCanvas } = require('@napi-rs/canvas');
    createCanvasFn = createCanvas;
  }
  return createCanvasFn;
}

// ═══════════════════════════════════════
// التحقق من أداة pdftoppm (أفضل على Linux)
// ═══════════════════════════════════════
let hasPdftoppm = null;
function checkPdftoppm() {
  if (hasPdftoppm !== null) return hasPdftoppm;
  try {
    execSync('which pdftoppm', { stdio: 'pipe' });
    hasPdftoppm = true;
  } catch {
    hasPdftoppm = false;
  }
  return hasPdftoppm;
}

// ═══════════════════════════════════════
// تحويل صفحة واحدة باستخدام pdfjs-dist
// ═══════════════════════════════════════
async function renderPageWithPdfjs(pdfDoc, pageNum, scale = 2.0) {
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const createCanvas = getCreateCanvas();
  const canvas = createCanvas(viewport.width, viewport.height);
  const ctx = canvas.getContext('2d');

  // خلفية بيضاء
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, viewport.width, viewport.height);

  await page.render({ canvasContext: ctx, viewport }).promise;
  const pngBuffer = canvas.toBuffer('image/png');

  return {
    buffer: pngBuffer,
    width: viewport.width,
    height: viewport.height
  };
}

// ═══════════════════════════════════════
// تحويل صفحة باستخدام pdftoppm (أفضل جودة)
// ═══════════════════════════════════════
function renderPageWithPdftoppm(pdfPath, pageNum, dpi = 200) {
  const tmpPrefix = `/tmp/pdfconv-${Date.now()}-${pageNum}`;
  try {
    execSync(
      `pdftoppm -png -f ${pageNum} -l ${pageNum} -r ${dpi} "${pdfPath}" "${tmpPrefix}"`,
      { timeout: 120000, stdio: 'pipe' }
    );

    // pdftoppm ينتج ملف باسم prefix-N.png
    const possibleNames = [
      `${tmpPrefix}-${pageNum}.png`,
      `${tmpPrefix}-${String(pageNum).padStart(2, '0')}.png`,
      `${tmpPrefix}-${String(pageNum).padStart(3, '0')}.png`,
    ];

    for (const name of possibleNames) {
      if (fs.existsSync(name)) {
        const buffer = fs.readFileSync(name);
        fs.unlinkSync(name);
        return buffer;
      }
    }

    // بحث عن أي ملف ينتجه pdftoppm
    const dir = path.dirname(tmpPrefix);
    const prefix = path.basename(tmpPrefix);
    const files = fs.readdirSync(dir).filter(f => f.startsWith(prefix) && f.endsWith('.png'));
    if (files.length > 0) {
      const filePath = path.join(dir, files[0]);
      const buffer = fs.readFileSync(filePath);
      fs.unlinkSync(filePath);
      return buffer;
    }

    return null;
  } catch (err) {
    // تنظيف
    try {
      const dir = path.dirname(tmpPrefix);
      const prefix = path.basename(tmpPrefix);
      fs.readdirSync(dir)
        .filter(f => f.startsWith(prefix))
        .forEach(f => { try { fs.unlinkSync(path.join(dir, f)); } catch {} });
    } catch {}
    return null;
  }
}

// ═══════════════════════════════════════
// تحويل كامل: PDF → صور WebP لجميع الصفحات
// ═══════════════════════════════════════
async function convertPdfToImages(lessonId, fileId, pdfPath) {
  const pagesDir = path.join(__dirname, '../uploads/pages', lessonId);
  const thumbsDir = path.join(pagesDir, 'thumbs');

  // إنشاء المجلدات
  fs.mkdirSync(pagesDir, { recursive: true });
  fs.mkdirSync(thumbsDir, { recursive: true });

  // تحديث الحالة إلى processing
  await pool.query(
    'UPDATE lesson_files SET pages_status = $1 WHERE id = $2',
    ['processing', fileId]
  );

  let totalPages = 0;
  let convertedPages = 0;
  let usePdftoppm = checkPdftoppm();

  try {
    // ═══ الحصول على عدد الصفحات ═══
    const pdfjs = await getPdfjs();
    const pdfBytes = new Uint8Array(fs.readFileSync(pdfPath));
    const loadingTask = pdfjs.getDocument({
      data: pdfBytes,
      useSystemFonts: true,
      disableFontFace: true,
      verbosity: 0
    });
    const pdfDoc = await loadingTask.promise;
    totalPages = pdfDoc.numPages;

    console.log(`📄 بدء تحويل PDF: ${totalPages} صفحة (lesson: ${lessonId})`);

    // تحديث عدد الصفحات في lesson_files
    await pool.query(
      'UPDATE lesson_files SET page_count = $1 WHERE id = $2',
      [totalPages, fileId]
    );

    // ═══ تحويل كل صفحة ═══
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      try {
        let pngBuffer = null;
        let pageWidth = 0;
        let pageHeight = 0;

        // محاولة pdftoppm أولاً (أفضل جودة على Linux)
        if (usePdftoppm) {
          pngBuffer = renderPageWithPdftoppm(pdfPath, pageNum, 200);
        }

        // fallback: pdfjs-dist
        if (!pngBuffer) {
          const result = await renderPageWithPdfjs(pdfDoc, pageNum, 2.0);
          pngBuffer = result.buffer;
          pageWidth = result.width;
          pageHeight = result.height;
        }

        if (!pngBuffer || pngBuffer.length < 5000) {
          console.warn(`⚠️ صفحة ${pageNum} فارغة أو صغيرة جداً`);
          continue;
        }

        // ═══ الصورة بالحجم الكامل (1200px عرض, WebP 85%) ═══
        const fullImagePath = path.join(pagesDir, `page-${pageNum}.webp`);
        const fullResult = await sharp(pngBuffer)
          .resize(1200, null, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 85 })
          .toFile(fullImagePath);

        // ═══ الصورة المصغرة (400px عرض, WebP 70%) ═══
        const thumbPath = path.join(thumbsDir, `thumb-${pageNum}.webp`);
        await sharp(pngBuffer)
          .resize(400, null, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 70 })
          .toFile(thumbPath);

        // ═══ حفظ في قاعدة البيانات ═══
        const imageUrl = `/uploads/pages/${lessonId}/page-${pageNum}.webp`;
        const thumbUrl = `/uploads/pages/${lessonId}/thumbs/thumb-${pageNum}.webp`;

        await pool.query(
          `INSERT INTO lesson_pages (lesson_id, file_id, page_number, image_url, thumb_url, width, height)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (lesson_id, page_number)
           DO UPDATE SET image_url = $4, thumb_url = $5, width = $6, height = $7, file_id = $2`,
          [lessonId, fileId, pageNum, imageUrl, thumbUrl, fullResult.width, fullResult.height]
        );

        convertedPages++;

        // ═══ توليد thumbnail للدرس من الصفحة الأولى ═══
        if (pageNum === 1) {
          await generateLessonThumbnail(lessonId, pngBuffer);
        }

        // تقدم كل 10 صفحات
        if (pageNum % 10 === 0) {
          console.log(`  📖 تم تحويل ${pageNum}/${totalPages} صفحة`);
        }
      } catch (pageErr) {
        console.error(`  ❌ خطأ في صفحة ${pageNum}:`, pageErr.message);
      }
    }

    pdfDoc.destroy();

    // ═══ تحديث الحالة إلى done ═══
    await pool.query(
      'UPDATE lesson_files SET pages_status = $1 WHERE id = $2',
      ['done', fileId]
    );

    console.log(`✅ تم تحويل ${convertedPages}/${totalPages} صفحة (lesson: ${lessonId})`);

    return { totalPages, convertedPages, status: 'done' };
  } catch (err) {
    console.error(`❌ فشل تحويل PDF (lesson: ${lessonId}):`, err.message);

    // تحديث الحالة إلى failed
    await pool.query(
      'UPDATE lesson_files SET pages_status = $1 WHERE id = $2',
      ['failed', fileId]
    );

    return { totalPages, convertedPages, status: 'failed', error: err.message };
  }
}

// ═══════════════════════════════════════
// توليد صورة مصغرة للدرس من الصفحة الأولى
// ═══════════════════════════════════════
async function generateLessonThumbnail(lessonId, pngBuffer) {
  try {
    const thumbnailDir = path.join(__dirname, '../uploads/thumbnails');
    if (!fs.existsSync(thumbnailDir)) fs.mkdirSync(thumbnailDir, { recursive: true });

    const thumbName = `lesson-thumb-${lessonId.substring(0, 8)}-${Date.now()}.webp`;
    const thumbPath = path.join(thumbnailDir, thumbName);

    await sharp(pngBuffer)
      .resize(800, 1130, { fit: 'cover', position: 'top' })
      .webp({ quality: 85 })
      .toFile(thumbPath);

    const thumbUrl = `/uploads/thumbnails/${thumbName}`;

    // حذف الصورة القديمة
    const oldThumb = await pool.query('SELECT thumbnail_url FROM lessons WHERE id = $1', [lessonId]);
    if (oldThumb.rows[0]?.thumbnail_url) {
      const oldPath = path.join(__dirname, '..', oldThumb.rows[0].thumbnail_url);
      if (fs.existsSync(oldPath)) {
        try { fs.unlinkSync(oldPath); } catch {}
      }
    }

    // تحديث في قاعدة البيانات
    await pool.query('UPDATE lessons SET thumbnail_url = $1 WHERE id = $2', [thumbUrl, lessonId]);

    console.log(`🖼️ تم توليد thumbnail للدرس: ${lessonId}`);
  } catch (err) {
    console.error(`⚠️ فشل توليد thumbnail:`, err.message);
  }
}

// ═══════════════════════════════════════
// بدء التحويل في الخلفية
// ═══════════════════════════════════════
function startBackgroundConversion(lessonId, fileId, pdfPath) {
  // لا ننتظر - يعمل في الخلفية
  setImmediate(async () => {
    try {
      await convertPdfToImages(lessonId, fileId, pdfPath);
    } catch (err) {
      console.error('خطأ في التحويل الخلفي:', err.message);
      // تحديث الحالة إلى failed
      try {
        await pool.query(
          'UPDATE lesson_files SET pages_status = $1 WHERE id = $2',
          ['failed', fileId]
        );
      } catch {}
    }
  });
}

// ═══════════════════════════════════════
// إعادة تحويل ملف PDF محدد
// ═══════════════════════════════════════
async function reconvertFile(fileId) {
  const file = await pool.query(
    `SELECT lf.*, l.id as lesson_uuid
     FROM lesson_files lf
     JOIN lessons l ON lf.lesson_id = l.id
     WHERE lf.id = $1 AND lf.file_type = 'pdf'`,
    [fileId]
  );

  if (file.rowCount === 0) {
    throw new Error('ملف PDF غير موجود');
  }

  const fileData = file.rows[0];
  const pdfPath = path.join(__dirname, '../uploads/lessons', fileData.file_name);

  if (!fs.existsSync(pdfPath)) {
    throw new Error('ملف PDF غير موجود على السيرفر');
  }

  // حذف الصفحات القديمة
  await pool.query('DELETE FROM lesson_pages WHERE file_id = $1', [fileId]);

  // حذف ملفات الصور القديمة
  const pagesDir = path.join(__dirname, '../uploads/pages', fileData.lesson_uuid);
  if (fs.existsSync(pagesDir)) {
    fs.rmSync(pagesDir, { recursive: true, force: true });
  }

  // بدء التحويل
  return convertPdfToImages(fileData.lesson_uuid, fileId, pdfPath);
}

module.exports = {
  convertPdfToImages,
  startBackgroundConversion,
  reconvertFile,
  generateLessonThumbnail
};
