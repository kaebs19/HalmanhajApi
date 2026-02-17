const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const authMiddleware = require('../middleware/auth');
const { createUpload } = require('../middleware/upload');

const logoUpload = createUpload('settings');

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
router.post('/upload-logo', authMiddleware, logoUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'لم يتم رفع ملف' });
    }

    const fileUrl = `/uploads/settings/${req.file.filename}`;
    const field = req.body.field || 'logo_url'; // logo_url أو favicon_url

    await pool.query(
      `INSERT INTO site_settings (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [field, fileUrl]
    );

    res.json({ url: fileUrl, field });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في رفع الملف' });
  }
});

module.exports = router;
