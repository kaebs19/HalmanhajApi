const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const authMiddleware = require('../middleware/auth');
const { createPdfToolsUpload } = require('../middleware/upload');

const pdfUpload = createPdfToolsUpload();
const uploadDir = path.join(__dirname, '../uploads/pdf-tools');

// التأكد من وجود مجلد الرفع
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// دالة مساعدة لحذف الملفات المؤقتة
const cleanupFile = (filePath) => {
  try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}
};

// دالة مساعدة لتنسيق الحجم
const formatSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
};

// ===== معلومات الملف =====
router.post('/info', authMiddleware, pdfUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'الملف مطلوب' });

    const pdfBytes = fs.readFileSync(req.file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

    const info = {
      pageCount: pdfDoc.getPageCount(),
      fileSize: req.file.size,
      fileSizeFormatted: formatSize(req.file.size),
      fileName: req.file.originalname,
    };

    cleanupFile(req.file.path);
    res.json(info);
  } catch (err) {
    if (req.file) cleanupFile(req.file.path);
    res.status(500).json({ message: 'خطأ في قراءة الملف: ' + err.message });
  }
});

// ===== ضغط PDF =====
router.post('/compress', authMiddleware, pdfUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'الملف مطلوب' });

    const pdfBytes = fs.readFileSync(req.file.path);
    const originalSize = pdfBytes.length;

    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

    // إزالة metadata لتقليل الحجم
    pdfDoc.setTitle('');
    pdfDoc.setAuthor('');
    pdfDoc.setSubject('');
    pdfDoc.setKeywords([]);
    pdfDoc.setProducer('');
    pdfDoc.setCreator('');

    const compressedBytes = await pdfDoc.save({
      useObjectStreams: true,
      addDefaultPage: false,
    });

    const compressedSize = compressedBytes.length;
    const outputName = 'compressed-' + Date.now() + '.pdf';
    const outputPath = path.join(uploadDir, outputName);
    fs.writeFileSync(outputPath, compressedBytes);

    cleanupFile(req.file.path);

    res.json({
      downloadUrl: '/uploads/pdf-tools/' + outputName,
      originalSize,
      compressedSize,
      originalSizeFormatted: formatSize(originalSize),
      compressedSizeFormatted: formatSize(compressedSize),
      savedPercent: ((1 - compressedSize / originalSize) * 100).toFixed(1),
    });
  } catch (err) {
    if (req.file) cleanupFile(req.file.path);
    res.status(500).json({ message: 'خطأ في ضغط الملف: ' + err.message });
  }
});

// ===== تقسيم PDF =====
router.post('/split', authMiddleware, pdfUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'الملف مطلوب' });

    const splitAfterPage = parseInt(req.body.splitAfterPage);
    if (!splitAfterPage || splitAfterPage < 1) {
      cleanupFile(req.file.path);
      return res.status(400).json({ message: 'رقم الصفحة غير صالح' });
    }

    const pdfBytes = fs.readFileSync(req.file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const totalPages = pdfDoc.getPageCount();

    if (splitAfterPage >= totalPages) {
      cleanupFile(req.file.path);
      return res.status(400).json({ message: `رقم الصفحة يجب أن يكون أقل من ${totalPages}` });
    }

    // الجزء الأول
    const part1Doc = await PDFDocument.create();
    const pages1 = await part1Doc.copyPages(pdfDoc, Array.from({ length: splitAfterPage }, (_, i) => i));
    pages1.forEach(p => part1Doc.addPage(p));

    // الجزء الثاني
    const part2Doc = await PDFDocument.create();
    const pages2 = await part2Doc.copyPages(pdfDoc, Array.from({ length: totalPages - splitAfterPage }, (_, i) => i + splitAfterPage));
    pages2.forEach(p => part2Doc.addPage(p));

    const ts = Date.now();
    const part1Name = 'split-part1-' + ts + '.pdf';
    const part2Name = 'split-part2-' + ts + '.pdf';

    fs.writeFileSync(path.join(uploadDir, part1Name), await part1Doc.save());
    fs.writeFileSync(path.join(uploadDir, part2Name), await part2Doc.save());

    cleanupFile(req.file.path);

    res.json({
      parts: [
        { downloadUrl: '/uploads/pdf-tools/' + part1Name, pages: splitAfterPage, label: `الجزء 1 (صفحة 1-${splitAfterPage})` },
        { downloadUrl: '/uploads/pdf-tools/' + part2Name, pages: totalPages - splitAfterPage, label: `الجزء 2 (صفحة ${splitAfterPage + 1}-${totalPages})` },
      ],
      totalPages,
    });
  } catch (err) {
    if (req.file) cleanupFile(req.file.path);
    res.status(500).json({ message: 'خطأ في تقسيم الملف: ' + err.message });
  }
});

// ===== دمج PDF =====
router.post('/merge', authMiddleware, pdfUpload.array('files', 20), async (req, res) => {
  try {
    if (!req.files || req.files.length < 2) {
      if (req.files) req.files.forEach(f => cleanupFile(f.path));
      return res.status(400).json({ message: 'يجب رفع ملفين على الأقل' });
    }

    const mergedDoc = await PDFDocument.create();

    // ترتيب الملفات حسب order المرسل أو حسب الترتيب الأصلي
    const order = req.body.order ? JSON.parse(req.body.order) : req.files.map((_, i) => i);

    for (const idx of order) {
      const file = req.files[idx];
      if (!file) continue;
      const pdfBytes = fs.readFileSync(file.path);
      const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
      const pages = await mergedDoc.copyPages(doc, doc.getPageIndices());
      pages.forEach(p => mergedDoc.addPage(p));
    }

    const mergedName = 'merged-' + Date.now() + '.pdf';
    const mergedPath = path.join(uploadDir, mergedName);
    fs.writeFileSync(mergedPath, await mergedDoc.save());

    req.files.forEach(f => cleanupFile(f.path));

    res.json({
      downloadUrl: '/uploads/pdf-tools/' + mergedName,
      totalPages: mergedDoc.getPageCount(),
      fileCount: req.files.length,
    });
  } catch (err) {
    if (req.files) req.files.forEach(f => cleanupFile(f.path));
    res.status(500).json({ message: 'خطأ في دمج الملفات: ' + err.message });
  }
});

// ===== حذف صفحات =====
router.post('/remove-pages', authMiddleware, pdfUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'الملف مطلوب' });

    const pagesToRemove = JSON.parse(req.body.pages || '[]');
    if (!pagesToRemove.length) {
      cleanupFile(req.file.path);
      return res.status(400).json({ message: 'يجب تحديد صفحات للحذف' });
    }

    const pdfBytes = fs.readFileSync(req.file.path);
    const srcDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const totalPages = srcDoc.getPageCount();

    // التحقق من صحة أرقام الصفحات
    const removeSet = new Set(pagesToRemove.map(p => p - 1)); // تحويل من 1-based إلى 0-based
    const keepIndices = [];
    for (let i = 0; i < totalPages; i++) {
      if (!removeSet.has(i)) keepIndices.push(i);
    }

    if (keepIndices.length === 0) {
      cleanupFile(req.file.path);
      return res.status(400).json({ message: 'لا يمكن حذف جميع الصفحات' });
    }

    const newDoc = await PDFDocument.create();
    const pages = await newDoc.copyPages(srcDoc, keepIndices);
    pages.forEach(p => newDoc.addPage(p));

    const outputName = 'removed-pages-' + Date.now() + '.pdf';
    fs.writeFileSync(path.join(uploadDir, outputName), await newDoc.save());

    cleanupFile(req.file.path);

    res.json({
      downloadUrl: '/uploads/pdf-tools/' + outputName,
      originalPages: totalPages,
      removedPages: pagesToRemove.length,
      remainingPages: keepIndices.length,
    });
  } catch (err) {
    if (req.file) cleanupFile(req.file.path);
    res.status(500).json({ message: 'خطأ في حذف الصفحات: ' + err.message });
  }
});

// ===== ترتيب صفحات =====
router.post('/reorder-pages', authMiddleware, pdfUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'الملف مطلوب' });

    const newOrder = JSON.parse(req.body.order || '[]');
    if (!newOrder.length) {
      cleanupFile(req.file.path);
      return res.status(400).json({ message: 'يجب تحديد ترتيب الصفحات' });
    }

    const pdfBytes = fs.readFileSync(req.file.path);
    const srcDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const totalPages = srcDoc.getPageCount();

    // newOrder هو مصفوفة أرقام 0-based
    const orderIndices = newOrder.map(p => p - 1); // تحويل من 1-based إلى 0-based

    const newDoc = await PDFDocument.create();
    const pages = await newDoc.copyPages(srcDoc, orderIndices);
    pages.forEach(p => newDoc.addPage(p));

    const outputName = 'reordered-' + Date.now() + '.pdf';
    fs.writeFileSync(path.join(uploadDir, outputName), await newDoc.save());

    cleanupFile(req.file.path);

    res.json({
      downloadUrl: '/uploads/pdf-tools/' + outputName,
      totalPages: newDoc.getPageCount(),
    });
  } catch (err) {
    if (req.file) cleanupFile(req.file.path);
    res.status(500).json({ message: 'خطأ في ترتيب الصفحات: ' + err.message });
  }
});

module.exports = router;
