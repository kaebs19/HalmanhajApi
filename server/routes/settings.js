const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { pool } = require('../config/db');
const authMiddleware = require('../middleware/auth');
const multer = require('multer');

// إنشاء مجلد الإعدادات تلقائياً
const settingsDir = path.join(__dirname, '../uploads/settings');
if (!fs.existsSync(settingsDir)) fs.mkdirSync(settingsDir, { recursive: true });

// رفع خاص بالإعدادات يدعم ICO و SVG
const logoUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, settingsDir),
    filename: (req, file, cb) => {
      const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
      cb(null, uniqueName);
    }
  }),
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('نوع الملف غير مدعوم'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

// GET /api/settings - عام (بدون مصادقة) - جلب كل الإعدادات
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT key, value FROM site_settings');
    const settings = {};
    result.rows.forEach(row => {
      // محاولة تحويل JSON
      try {
        settings[row.key] = JSON.parse(row.value);
      } catch {
        settings[row.key] = row.value;
      }
    });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في جلب الإعدادات' });
  }
});

// PUT /api/settings - أدمن فقط - تحديث الإعدادات
router.put('/', authMiddleware, async (req, res) => {
  try {
    const updates = req.body;

    for (const [key, value] of Object.entries(updates)) {
      const val = typeof value === 'object' ? JSON.stringify(value) : value;
      await pool.query(
        `INSERT INTO site_settings (key, value, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [key, val]
      );
    }

    // جلب الإعدادات المحدثة
    const result = await pool.query('SELECT key, value FROM site_settings');
    const settings = {};
    result.rows.forEach(row => {
      try {
        settings[row.key] = JSON.parse(row.value);
      } catch {
        settings[row.key] = row.value;
      }
    });

    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في تحديث الإعدادات' });
  }
});

// POST /api/settings/upload-logo - أدمن فقط - رفع شعار أو favicon
router.post('/upload-logo', authMiddleware, (req, res) => {
  logoUpload.single('file')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: 'حجم الملف كبير جداً (الحد الأقصى 5MB)' });
        }
        return res.status(400).json({ message: `خطأ في الرفع: ${err.message}` });
      }
      return res.status(400).json({ message: err.message || 'نوع الملف غير مدعوم' });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ message: 'لم يتم رفع ملف' });
      }

      const fileUrl = `/uploads/settings/${req.file.filename}`;
      const field = req.body.field || 'logo_url';

      await pool.query(
        `INSERT INTO site_settings (key, value, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [field, fileUrl]
      );

      res.json({ url: fileUrl, field });
    } catch (dbErr) {
      res.status(500).json({ message: 'خطأ في حفظ الملف في قاعدة البيانات' });
    }
  });
});

module.exports = router;
