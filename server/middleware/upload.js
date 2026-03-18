const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

/**
 * تصغير الصورة بعد الرفع لتحسين الأداء
 * يُستخدم كـ middleware بعد multer
 */
function optimizeImage(maxWidth = 128) {
  return async (req, res, next) => {
    if (!req.file) return next();
    const ext = path.extname(req.file.filename).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) return next();

    try {
      const filePath = req.file.path;
      const tempPath = filePath + '.tmp';

      await sharp(filePath)
        .resize(maxWidth, maxWidth, { fit: 'cover', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(tempPath);

      // استبدال الملف الأصلي
      fs.unlinkSync(filePath);

      // تغيير الاسم لـ .webp
      const newFilename = req.file.filename.replace(ext, '.webp');
      const newPath = path.join(path.dirname(filePath), newFilename);
      fs.renameSync(tempPath, newPath);

      req.file.filename = newFilename;
      req.file.path = newPath;
    } catch (err) {
      // لو فشل التصغير، نكمل عادي بالملف الأصلي
      console.warn('⚠️ Image optimization failed:', err.message);
    }
    next();
  };
}

function createUpload(folder) {
  const uploadDir = path.join(__dirname, `../uploads/${folder}`);
  fs.mkdirSync(uploadDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
      cb(null, uniqueName);
    }
  });

  const fileFilter = (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('نوع الملف غير مدعوم'), false);
    }
  };

  return multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }
  });
}

function createLessonUpload(folder) {
  const uploadDir = path.join(__dirname, `../uploads/${folder}`);
  fs.mkdirSync(uploadDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
      cb(null, uniqueName);
    }
  });

  const fileFilter = (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'video/mp4', 'video/webm',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('نوع الملف غير مدعوم'), false);
    }
  };

  return multer({
    storage,
    fileFilter,
    limits: { fileSize: 200 * 1024 * 1024 }
  });
}

function createPdfToolsUpload() {
  const uploadDir = path.join(__dirname, '../uploads/pdf-tools');
  fs.mkdirSync(uploadDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
      cb(null, uniqueName);
    }
  });

  const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('يجب أن يكون الملف بصيغة PDF'), false);
    }
  };

  return multer({
    storage,
    fileFilter,
    limits: { fileSize: 100 * 1024 * 1024 }
  });
}

function createCsvUpload() {
  const uploadDir = path.join(__dirname, '../uploads/csv');
  fs.mkdirSync(uploadDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + '.csv';
      cb(null, uniqueName);
    }
  });

  const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('يجب أن يكون الملف بصيغة CSV'), false);
    }
  };

  return multer({
    storage,
    fileFilter,
    limits: { fileSize: 2 * 1024 * 1024 }
  });
}

function createAiGenerateUpload() {
  const uploadDir = path.join(__dirname, '../uploads/ai-temp');
  fs.mkdirSync(uploadDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
      cb(null, uniqueName);
    }
  });

  const fileFilter = (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'image/jpeg', 'image/png', 'image/webp'
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('نوع الملف غير مدعوم. الأنواع المسموحة: PDF, JPG, PNG, WebP'), false);
    }
  };

  return multer({
    storage,
    fileFilter,
    limits: { fileSize: 20 * 1024 * 1024 }
  });
}

function createImportUpload() {
  const uploadDir = path.join(__dirname, '../uploads/imports');
  fs.mkdirSync(uploadDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
      cb(null, uniqueName);
    }
  });

  const fileFilter = (req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/json',
      'text/plain'
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(file.mimetype) || ['.xlsx', '.xls', '.json'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('نوع الملف غير مدعوم. الأنواع المسموحة: xlsx, json'), false);
    }
  };

  return multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }
  });
}

// الافتراضي للمراحل (للتوافق مع الكود السابق)
const upload = createUpload('stages');
upload.createUpload = createUpload;

module.exports = upload;
module.exports.createUpload = createUpload;
module.exports.createLessonUpload = createLessonUpload;
module.exports.createPdfToolsUpload = createPdfToolsUpload;
module.exports.createCsvUpload = createCsvUpload;
module.exports.createAiGenerateUpload = createAiGenerateUpload;
module.exports.createImportUpload = createImportUpload;
module.exports.optimizeImage = optimizeImage;
