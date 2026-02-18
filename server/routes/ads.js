const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const authMiddleware = require('../middleware/auth');

// GET /api/ads/public - عام (بدون مصادقة) - جلب الإعلانات النشطة
router.get('/public', async (req, res) => {
  try {
    const settingsResult = await pool.query(
      "SELECT key, value FROM site_settings WHERE key IN ('ads_enabled', 'ads_publisher_id')"
    );
    const settings = {};
    settingsResult.rows.forEach(row => {
      try { settings[row.key] = JSON.parse(row.value); } catch { settings[row.key] = row.value; }
    });

    const adsEnabled = settings.ads_enabled === true || settings.ads_enabled === 'true';
    const publisherId = settings.ads_publisher_id || '';

    if (!adsEnabled || !publisherId) {
      return res.json({ enabled: false, publisher_id: '', slots: [] });
    }

    const slotsResult = await pool.query(
      'SELECT id, name, slot_id, position, format, is_active, custom_code FROM ad_slots WHERE is_active = true ORDER BY sort_order'
    );

    res.json({
      enabled: true,
      publisher_id: publisherId,
      slots: slotsResult.rows
    });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في جلب الإعلانات' });
  }
});

// GET /api/ads/slots - أدمن فقط - جلب كل المواقع الإعلانية
router.get('/slots', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ad_slots ORDER BY sort_order, id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في جلب المواقع الإعلانية' });
  }
});

// POST /api/ads/slots - أدمن فقط - إنشاء موقع إعلاني
router.post('/slots', authMiddleware, async (req, res) => {
  try {
    const { name, slot_id, position, format, is_active, custom_code, sort_order } = req.body;

    if (!name || !position) {
      return res.status(400).json({ message: 'الاسم والموقع مطلوبان' });
    }

    const result = await pool.query(
      `INSERT INTO ad_slots (name, slot_id, position, format, is_active, custom_code, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [name, slot_id || null, position, format || 'auto', is_active !== false, custom_code || null, sort_order || 0]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ message: 'هذا الموقع الإعلاني موجود بالفعل' });
    }
    res.status(500).json({ message: 'خطأ في إنشاء الموقع الإعلاني' });
  }
});

// PUT /api/ads/slots/:id - أدمن فقط - تعديل موقع إعلاني
router.put('/slots/:id', authMiddleware, async (req, res) => {
  try {
    const { name, slot_id, position, format, is_active, custom_code, sort_order } = req.body;

    const result = await pool.query(
      `UPDATE ad_slots SET name = $1, slot_id = $2, position = $3, format = $4, is_active = $5, custom_code = $6, sort_order = $7
       WHERE id = $8 RETURNING *`,
      [name, slot_id || null, position, format || 'auto', is_active !== false, custom_code || null, sort_order || 0, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'الموقع الإعلاني غير موجود' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ message: 'هذا الموقع الإعلاني موجود بالفعل' });
    }
    res.status(500).json({ message: 'خطأ في تعديل الموقع الإعلاني' });
  }
});

// DELETE /api/ads/slots/:id - أدمن فقط - حذف موقع إعلاني
router.delete('/slots/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM ad_slots WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'الموقع الإعلاني غير موجود' });
    }

    res.json({ message: 'تم الحذف بنجاح' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في حذف الموقع الإعلاني' });
  }
});

module.exports = router;
