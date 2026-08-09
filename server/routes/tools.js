const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { PDFDocument } = require('pdf-lib');
const { createCanvas } = require('@napi-rs/canvas');
const { pool } = require('../config/db');
const { buildLessonSlug } = require('../utils/slug');
const authMiddleware = require('../middleware/auth');
const { createPdfToolsUpload, createUpload } = require('../middleware/upload');
const multer = require('multer');
const { execSync } = require('child_process');

// تحميل pdfjs-dist (ESM) ديناميكياً
let pdfjsLib = null;
async function getPdfjs() {
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return pdfjsLib;
}

// دالة توليد thumbnail من PDF باستخدام أفضل طريقة متاحة
async function generatePdfThumbnail(pdfPath, outputPath) {
  // أولاً: محاولة استخدام pdfjs-dist + canvas
  try {
    const pdfjs = await getPdfjs();
    const pdfBytes = new Uint8Array(fs.readFileSync(pdfPath));
    const loadingTask = pdfjs.getDocument({
      data: pdfBytes,
      useSystemFonts: true,
      disableFontFace: true,
      verbosity: 0
    });
    const pdfDoc = await loadingTask.promise;

    if (pdfDoc.numPages === 0) {
      pdfDoc.destroy();
      throw new Error('PDF فارغ');
    }

    const page = await pdfDoc.getPage(1);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, viewport.width, viewport.height);
    await page.render({ canvasContext: ctx, viewport }).promise;

    const pngBuffer = canvas.toBuffer('image/png');
    pdfDoc.destroy();

    // التحقق من جودة الصورة - إذا كانت صغيرة جداً فهي فارغة
    if (pngBuffer.length > 15000) {
      await sharp(pngBuffer)
        .resize(400, 566, { fit: 'cover', position: 'top' })
        .png({ quality: 90 })
        .toFile(outputPath);
      return true;
    }
    // الصورة صغيرة = pdfjs لم يرسم المحتوى بشكل صحيح
    console.log('pdfjs output too small, trying qlmanage fallback...');
  } catch (err) {
    console.log('pdfjs failed, trying qlmanage fallback:', err.message);
  }

  // ثانياً: محاولة استخدام qlmanage (macOS)
  try {
    const tmpDir = '/tmp/thumb-' + Date.now();
    fs.mkdirSync(tmpDir, { recursive: true });
    execSync(`qlmanage -t -s 800 -o "${tmpDir}" "${pdfPath}"`, { timeout: 15000, stdio: 'pipe' });

    // qlmanage يضيف .png للاسم
    const fileName = path.basename(pdfPath);
    const qlFile = path.join(tmpDir, fileName + '.png');

    if (fs.existsSync(qlFile)) {
      await sharp(qlFile)
        .resize(400, 566, { fit: 'cover', position: 'top' })
        .png({ quality: 90 })
        .toFile(outputPath);

      // تنظيف
      fs.unlinkSync(qlFile);
      fs.rmdirSync(tmpDir);
      return true;
    }
    // تنظيف
    try { fs.rmdirSync(tmpDir, { recursive: true }); } catch (e) {}
  } catch (err) {
    console.log('qlmanage failed:', err.message);
  }

  // ثالثاً: محاولة pdftoppm (Linux/poppler)
  try {
    const tmpPpm = '/tmp/thumb-ppm-' + Date.now();
    execSync(`pdftoppm -png -f 1 -l 1 -r 200 "${pdfPath}" "${tmpPpm}"`, { timeout: 15000, stdio: 'pipe' });
    const ppmFile = tmpPpm + '-1.png';
    if (fs.existsSync(ppmFile)) {
      await sharp(ppmFile)
        .resize(400, 566, { fit: 'cover', position: 'top' })
        .png({ quality: 90 })
        .toFile(outputPath);
      fs.unlinkSync(ppmFile);
      return true;
    }
  } catch (err) {
    // pdftoppm غير متوفر - هذا متوقع على macOS
  }

  return false;
}

const pdfUpload = createPdfToolsUpload();

// رفع صور مخصصة للـ thumbnail
const thumbnailStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/thumbnails');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const thumbnailUpload = multer({
  storage: thumbnailStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('نوع الملف غير مدعوم'), false);
    }
  },
  limits: { fileSize: 100 * 1024 * 1024 }
});

// التأكد من وجود المجلدات
const thumbnailDir = path.join(__dirname, '../uploads/thumbnails');
if (!fs.existsSync(thumbnailDir)) fs.mkdirSync(thumbnailDir, { recursive: true });

// ===== توليد صورة مصغرة من أول صفحة PDF =====
router.post('/thumbnail/generate', authMiddleware, thumbnailUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'الملف مطلوب' });

    const outputName = 'thumb-' + Date.now() + '.png';
    const outputPath = path.join(thumbnailDir, outputName);

    if (req.file.mimetype === 'application/pdf') {
      const success = await generatePdfThumbnail(req.file.path, outputPath);
      if (!success) {
        fs.unlinkSync(req.file.path);
        return res.status(500).json({ message: 'فشل في توليد الصورة المصغرة من PDF' });
      }
      fs.unlinkSync(req.file.path);
    } else {
      // صورة عادية - تصغيرها
      await sharp(req.file.path)
        .resize(400, 566, { fit: 'cover' })
        .png({ quality: 85 })
        .toFile(outputPath);

      fs.unlinkSync(req.file.path);
    }

    res.json({
      thumbnailUrl: '/uploads/thumbnails/' + outputName,
      width: 400,
      height: 566,
    });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error('Thumbnail generation error:', err);
    res.status(500).json({ message: 'خطأ في توليد الصورة المصغرة: ' + err.message });
  }
});

// ===== رفع صورة مصغرة مخصصة =====
router.post('/thumbnail/upload', authMiddleware, thumbnailUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'الصورة مطلوبة' });

    const outputName = 'custom-thumb-' + Date.now() + '.png';
    const outputPath = path.join(thumbnailDir, outputName);

    await sharp(req.file.path)
      .resize(400, 566, { fit: 'cover' })
      .png({ quality: 85 })
      .toFile(outputPath);

    fs.unlinkSync(req.file.path);

    res.json({
      thumbnailUrl: '/uploads/thumbnails/' + outputName,
      width: 400,
      height: 566,
    });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ message: 'خطأ في رفع الصورة: ' + err.message });
  }
});

// ===== توليد SEO تلقائي =====
router.post('/seo/generate', authMiddleware, async (req, res) => {
  try {
    const { subject_id, grade_ids, track_ids, semester, type, title } = req.body;

    if (!subject_id) {
      return res.status(400).json({ message: 'معرف المادة مطلوب' });
    }

    // جلب اسم المادة
    const subjectResult = await pool.query('SELECT name FROM subjects WHERE id = $1', [subject_id]);
    if (subjectResult.rowCount === 0) {
      return res.status(404).json({ message: 'المادة غير موجودة' });
    }
    const subjectName = subjectResult.rows[0].name;

    // جلب أسماء الصفوف
    let gradeNames = [];
    if (grade_ids && grade_ids.length > 0) {
      const gradesResult = await pool.query(
        'SELECT g.name, s.name as stage_name FROM grades g JOIN stages s ON g.stage_id = s.id WHERE g.id = ANY($1::uuid[])',
        [grade_ids]
      );
      gradeNames = gradesResult.rows;
    }

    // جلب أسماء المسارات
    let trackNames = [];
    if (track_ids && track_ids.length > 0) {
      const tracksResult = await pool.query(
        'SELECT name FROM tracks WHERE id = ANY($1::uuid[])',
        [track_ids]
      );
      trackNames = tracksResult.rows.map(t => t.name);
    }

    const sem = parseInt(semester);
    const semesterName = sem === 1 ? 'الفصل الأول' : sem === 2 ? 'الفصل الثاني' : 'الفصلين';
    const typeName = type || 'حل';

    // ===== بناء عنوان SEO =====
    let seoTitle = '';
    const gradeList = gradeNames.map(g => g.name).join(' و ');
    const trackList = trackNames.join(' و ');

    if (typeName === 'حل') {
      seoTitle = `حل كتاب ${subjectName}`;
    } else if (typeName === 'كتاب') {
      seoTitle = `كتاب ${subjectName}`;
    } else if (typeName === 'تحضير') {
      seoTitle = `تحضير ${subjectName}`;
    } else if (typeName === 'تجميع') {
      seoTitle = `تجميعات ${subjectName}`;
    } else if (typeName === 'فيديو') {
      seoTitle = `شرح ${subjectName} فيديو`;
    } else {
      seoTitle = `${typeName} ${subjectName}`;
    }

    if (gradeList) seoTitle += ` ${gradeList}`;
    if (trackList) seoTitle += ` ${trackList}`;
    if (sem !== 0) seoTitle += ` ${semesterName}`;

    if (title && title.trim()) {
      seoTitle += ` - ${title.trim()}`;
    }

    // ===== بناء وصف SEO =====
    let seoDescription = '';
    if (typeName === 'حل') {
      seoDescription = `حل كتاب ${subjectName}`;
      if (gradeList) seoDescription += ` ${gradeList}`;
      if (trackList) seoDescription += ` ${trackList}`;
      seoDescription += ` ${semesterName}`;
      seoDescription += ` - حلول كاملة ومفصلة لجميع تمارين ومسائل المادة`;
      if (title) seoDescription += ` ${title}`;
      seoDescription += '. تحميل مباشر PDF.';
    } else if (typeName === 'كتاب') {
      seoDescription = `تحميل كتاب ${subjectName}`;
      if (gradeList) seoDescription += ` ${gradeList}`;
      seoDescription += ` ${semesterName} PDF.`;
      if (title) seoDescription += ` ${title}.`;
      seoDescription += ' النسخة الرسمية من وزارة التعليم.';
    } else if (typeName === 'تحضير') {
      seoDescription = `تحضير مادة ${subjectName}`;
      if (gradeList) seoDescription += ` ${gradeList}`;
      seoDescription += ` ${semesterName}.`;
      if (title) seoDescription += ` ${title}.`;
      seoDescription += ' تحضير شامل وجاهز للطباعة PDF.';
    } else if (typeName === 'تجميع') {
      seoDescription = `تجميعات ${subjectName}`;
      if (gradeList) seoDescription += ` ${gradeList}`;
      seoDescription += ` ${semesterName}.`;
      if (title) seoDescription += ` ${title}.`;
      seoDescription += ' أسئلة واختبارات مع الحلول PDF.';
    } else if (typeName === 'فيديو') {
      seoDescription = `شرح ${subjectName}`;
      if (gradeList) seoDescription += ` ${gradeList}`;
      seoDescription += ` ${semesterName} فيديو.`;
      if (title) seoDescription += ` ${title}.`;
      seoDescription += ' شرح مفصل وواضح.';
    } else {
      seoDescription = `${typeName} ${subjectName}`;
      if (gradeList) seoDescription += ` ${gradeList}`;
      seoDescription += ` ${semesterName}.`;
    }

    // قص الوصف لـ 155 حرف
    if (seoDescription.length > 155) {
      seoDescription = seoDescription.substring(0, 152) + '...';
    }

    // ===== بناء Slug ===== (منطق مشترك مع مسار حفظ الدرس)
    slug = buildLessonSlug({
      type: typeName,
      subjectName,
      gradeName: gradeNames.length > 0 ? gradeNames[0].name : null,
      trackName: trackNames.length > 0 ? trackNames[0] : null,
      semester: sem,
      title
    });

    res.json({
      seoTitle,
      seoDescription,
      slug,
    });
  } catch (err) {
    console.error('SEO generate error:', err);
    res.status(500).json({ message: 'خطأ في توليد بيانات SEO: ' + err.message });
  }
});

// تحويل نص عربي إلى slug

// ===== إعادة توليد الصور المصغرة لجميع الدروس =====
router.post('/thumbnail/regenerate-all', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT l.id, l.title, l.thumbnail_url, lf.file_name
      FROM lessons l
      JOIN lesson_files lf ON l.id = lf.lesson_id
      WHERE lf.file_type = 'pdf'
      ORDER BY l.created_at DESC
    `);

    if (result.rows.length === 0) {
      return res.json({ message: 'لا توجد دروس بملفات PDF', updated: 0 });
    }

    let updated = 0;
    let errors = [];

    for (const lesson of result.rows) {
      try {
        const pdfPath = path.join(__dirname, '../uploads/lessons', lesson.file_name);

        if (!fs.existsSync(pdfPath)) {
          errors.push({ id: lesson.id, title: lesson.title, error: 'ملف PDF غير موجود' });
          continue;
        }

        const outputName = 'thumb-' + Date.now() + '-' + lesson.id.substring(0, 8) + '.png';
        const outputPath = path.join(thumbnailDir, outputName);

        const success = await generatePdfThumbnail(pdfPath, outputPath);
        if (!success) {
          errors.push({ id: lesson.id, title: lesson.title, error: 'فشل في التوليد' });
          continue;
        }

        const newUrl = '/uploads/thumbnails/' + outputName;

        // حذف الصورة القديمة
        if (lesson.thumbnail_url) {
          const oldPath = path.join(__dirname, '..', lesson.thumbnail_url);
          if (fs.existsSync(oldPath)) {
            try { fs.unlinkSync(oldPath); } catch (e) {}
          }
        }

        await pool.query('UPDATE lessons SET thumbnail_url = $1 WHERE id = $2', [newUrl, lesson.id]);
        updated++;
        console.log(`✅ Regenerated thumbnail for: ${lesson.title}`);
      } catch (err) {
        errors.push({ id: lesson.id, title: lesson.title, error: err.message });
        console.error(`❌ Failed for: ${lesson.title}`, err.message);
      }
    }

    res.json({
      message: `تم إعادة توليد ${updated} صورة مصغرة من أصل ${result.rows.length}`,
      updated,
      total: result.rows.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err) {
    console.error('Regenerate thumbnails error:', err);
    res.status(500).json({ message: 'خطأ في إعادة التوليد: ' + err.message });
  }
});

// ===== توليد معاينة صفحات PDF (أول 3 صفحات) =====
async function generatePagePreviews(fileId, pdfPath, maxPages = 3) {
  const results = [];
  const previewDir = path.join(__dirname, '../uploads/previews');
  if (!fs.existsSync(previewDir)) fs.mkdirSync(previewDir, { recursive: true });

  try {
    const pdfjs = await getPdfjs();
    const pdfBytes = new Uint8Array(fs.readFileSync(pdfPath));
    const loadingTask = pdfjs.getDocument({
      data: pdfBytes,
      useSystemFonts: true,
      disableFontFace: true,
      verbosity: 0
    });
    const pdfDoc = await loadingTask.promise;
    const totalPages = pdfDoc.numPages;

    // تحديث عدد الصفحات في قاعدة البيانات
    await pool.query('UPDATE lesson_files SET page_count = $1 WHERE id = $2', [totalPages, fileId]);

    const pagesToRender = Math.min(maxPages, totalPages);

    for (let i = 1; i <= pagesToRender; i++) {
      try {
        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 }); // جودة معقولة للمعاينة
        const canvas = createCanvas(viewport.width, viewport.height);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, viewport.width, viewport.height);
        await page.render({ canvasContext: ctx, viewport }).promise;

        const pngBuffer = canvas.toBuffer('image/png');

        // ضغط وتصغير الصورة
        const outputName = `preview-${fileId.substring(0, 8)}-p${i}-${Date.now()}.webp`;
        const outputPath = path.join(previewDir, outputName);

        await sharp(pngBuffer)
          .resize(800, null, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 75 })
          .toFile(outputPath);

        const imageUrl = '/uploads/previews/' + outputName;
        const imageInfo = await sharp(outputPath).metadata();

        // حفظ في قاعدة البيانات
        await pool.query(
          `INSERT INTO file_previews (file_id, page_number, image_url, width, height)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (file_id, page_number) DO UPDATE SET image_url = $3, width = $4, height = $5`,
          [fileId, i, imageUrl, imageInfo.width || 0, imageInfo.height || 0]
        );

        results.push({ page: i, url: imageUrl, width: imageInfo.width, height: imageInfo.height });
      } catch (pageErr) {
        console.error(`خطأ في صفحة ${i}:`, pageErr.message);
      }
    }

    pdfDoc.destroy();
    return { totalPages, previews: results };
  } catch (err) {
    console.error('خطأ في توليد المعاينة:', err.message);

    // fallback: qlmanage للصفحة الأولى فقط
    try {
      const outputName = `preview-${fileId.substring(0, 8)}-p1-${Date.now()}.webp`;
      const outputPath = path.join(previewDir, outputName);
      const tmpDir = '/tmp/preview-' + Date.now();
      fs.mkdirSync(tmpDir, { recursive: true });
      execSync(`qlmanage -t -s 800 -o "${tmpDir}" "${pdfPath}"`, { timeout: 15000, stdio: 'pipe' });
      const qlFile = path.join(tmpDir, path.basename(pdfPath) + '.png');
      if (fs.existsSync(qlFile)) {
        await sharp(qlFile).webp({ quality: 75 }).toFile(outputPath);
        fs.unlinkSync(qlFile);
        fs.rmdirSync(tmpDir);

        const imageInfo = await sharp(outputPath).metadata();
        const imageUrl = '/uploads/previews/' + outputName;
        await pool.query(
          `INSERT INTO file_previews (file_id, page_number, image_url, width, height)
           VALUES ($1, 1, $2, $3, $4)
           ON CONFLICT (file_id, page_number) DO UPDATE SET image_url = $2, width = $3, height = $4`,
          [fileId, imageUrl, imageInfo.width || 0, imageInfo.height || 0]
        );
        results.push({ page: 1, url: imageUrl, width: imageInfo.width, height: imageInfo.height });
      }
      try { fs.rmdirSync(tmpDir, { recursive: true }); } catch (e) {}
    } catch (fallbackErr) {
      console.error('fallback preview failed:', fallbackErr.message);
    }

    return { totalPages: 0, previews: results };
  }
}

// توليد معاينة لملف محدد
router.post('/preview/generate/:fileId', authMiddleware, async (req, res) => {
  try {
    const { fileId } = req.params;
    const maxPages = parseInt(req.query.pages) || 3;

    const file = await pool.query('SELECT * FROM lesson_files WHERE id = $1', [fileId]);
    if (file.rowCount === 0) return res.status(404).json({ message: 'الملف غير موجود' });

    const fileData = file.rows[0];
    if (fileData.file_type !== 'pdf') return res.status(400).json({ message: 'المعاينة متاحة فقط لملفات PDF' });

    const pdfPath = path.join(__dirname, '../uploads/lessons', fileData.file_name);
    if (!fs.existsSync(pdfPath)) return res.status(404).json({ message: 'ملف PDF غير موجود على السيرفر' });

    // حذف المعاينات القديمة
    const oldPreviews = await pool.query('SELECT image_url FROM file_previews WHERE file_id = $1', [fileId]);
    for (const p of oldPreviews.rows) {
      const oldPath = path.join(__dirname, '..', p.image_url);
      if (fs.existsSync(oldPath)) try { fs.unlinkSync(oldPath); } catch (e) {}
    }
    await pool.query('DELETE FROM file_previews WHERE file_id = $1', [fileId]);

    const result = await generatePagePreviews(fileId, pdfPath, maxPages);

    res.json({
      message: `تم توليد معاينة ${result.previews.length} صفحة`,
      totalPages: result.totalPages,
      previews: result.previews
    });
  } catch (err) {
    console.error('Preview generation error:', err);
    res.status(500).json({ message: 'خطأ في توليد المعاينة: ' + err.message });
  }
});

// توليد معاينة لجميع ملفات PDF (bulk)
router.post('/preview/generate-all', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT lf.id, lf.file_name, lf.lesson_id, l.title
      FROM lesson_files lf
      JOIN lessons l ON lf.lesson_id = l.id
      WHERE lf.file_type = 'pdf'
      AND lf.id NOT IN (SELECT DISTINCT file_id FROM file_previews)
      ORDER BY l.created_at DESC
    `);

    let generated = 0;
    let errors = [];

    for (const file of result.rows) {
      const pdfPath = path.join(__dirname, '../uploads/lessons', file.file_name);
      if (!fs.existsSync(pdfPath)) {
        errors.push({ id: file.id, title: file.title, error: 'ملف غير موجود' });
        continue;
      }
      try {
        await generatePagePreviews(file.id, pdfPath, 3);
        generated++;
        console.log(`✅ Preview generated: ${file.title}`);
      } catch (err) {
        errors.push({ id: file.id, title: file.title, error: err.message });
      }
    }

    res.json({
      message: `تم توليد معاينة ${generated} ملف من أصل ${result.rows.length}`,
      generated,
      total: result.rows.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err) {
    res.status(500).json({ message: 'خطأ: ' + err.message });
  }
});

module.exports = router;
