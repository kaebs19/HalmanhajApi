const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { requireUserAuth } = require('../middleware/userAuth');

// ══════════════════════════════════════════
// GET /api/notifications
// قائمة إشعارات المستخدم + عدد غير المقروءة
// ══════════════════════════════════════════
router.get('/notifications', requireUserAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);

    const result = await pool.query(
      `SELECT id, type, title, body, ref_type, ref_id, is_read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const unreadCount = await pool.query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false',
      [userId]
    );

    res.json({
      notifications: result.rows,
      unread_count: parseInt(unreadCount.rows[0].count)
    });
  } catch (err) {
    console.error('خطأ في جلب الإشعارات:', err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// ══════════════════════════════════════════
// PATCH /api/notifications/read-all
// قراءة جميع الإشعارات
// ⚠️ يجب أن يكون قبل /:id/read لتجنب تطابق Express
// ══════════════════════════════════════════
router.patch('/notifications/read-all', requireUserAuth, async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
      [req.user.id]
    );

    res.json({ message: 'تم قراءة جميع الإشعارات' });
  } catch (err) {
    console.error('خطأ في تحديث الإشعارات:', err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// ══════════════════════════════════════════
// PATCH /api/notifications/:id/read
// قراءة إشعار واحد
// ══════════════════════════════════════════
router.patch('/notifications/:id/read', requireUserAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'الإشعار غير موجود' });
    }

    res.json({ message: 'تم' });
  } catch (err) {
    console.error('خطأ في تحديث الإشعار:', err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// ══════════════════════════════════════════
// POST /api/notifications/device-token
// تسجيل رمز جهاز للإشعارات
// ══════════════════════════════════════════
router.post('/notifications/device-token', requireUserAuth, async (req, res) => {
  try {
    const { device_token } = req.body;

    if (!device_token || !device_token.trim()) {
      return res.status(400).json({ message: 'رمز الجهاز مطلوب' });
    }

    await pool.query(
      `INSERT INTO user_device_tokens (user_id, device_token)
       VALUES ($1, $2)
       ON CONFLICT (device_token)
       DO UPDATE SET user_id = $1`,
      [req.user.id, device_token.trim()]
    );

    res.json({ message: 'تم تسجيل الجهاز' });
  } catch (err) {
    console.error('خطأ في تسجيل رمز الجهاز:', err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

module.exports = router;
