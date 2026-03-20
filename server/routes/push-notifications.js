const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { requireUserAuth } = require('../middleware/userAuth');
const authMiddleware = require('../middleware/auth');
const { sendNotification, sendToMultiple, sendToAll } = require('../services/notificationService');

// ══════════════════════════════════════════
// POST /register-token
// تسجيل/تحديث FCM Token
// ══════════════════════════════════════════
router.post('/register-token', requireUserAuth, async (req, res) => {
  try {
    const { token, device_type } = req.body;
    if (!token || !token.trim()) {
      return res.status(400).json({ message: 'FCM token مطلوب' });
    }

    await pool.query(
      `INSERT INTO fcm_tokens (user_id, token, device_type)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, token)
       DO UPDATE SET device_type = $3, updated_at = NOW()`,
      [req.user.id, token.trim(), device_type || 'ios']
    );

    // إنشاء إعدادات الإشعارات الافتراضية لو ما موجودة
    await pool.query(
      `INSERT INTO notification_settings (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING`,
      [req.user.id]
    );

    res.json({ message: 'تم تسجيل الجهاز' });
  } catch (err) {
    console.error('خطأ في تسجيل FCM token:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ══════════════════════════════════════════
// DELETE /remove-token
// حذف Token (عند تسجيل الخروج)
// ══════════════════════════════════════════
router.delete('/remove-token', requireUserAuth, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ message: 'FCM token مطلوب' });
    }

    await pool.query(
      'DELETE FROM fcm_tokens WHERE user_id = $1 AND token = $2',
      [req.user.id, token]
    );

    res.json({ message: 'تم إزالة الجهاز' });
  } catch (err) {
    console.error('خطأ في حذف FCM token:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ══════════════════════════════════════════
// GET /settings
// جلب إعدادات الإشعارات
// ══════════════════════════════════════════
router.get('/settings', requireUserAuth, async (req, res) => {
  try {
    let result = await pool.query(
      'SELECT daily_reminder, daily_reminder_time, achievement_alerts, challenge_alerts, streak_alerts FROM notification_settings WHERE user_id = $1',
      [req.user.id]
    );

    if (result.rowCount === 0) {
      // إنشاء إعدادات افتراضية
      await pool.query(
        'INSERT INTO notification_settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING',
        [req.user.id]
      );
      result = await pool.query(
        'SELECT daily_reminder, daily_reminder_time, achievement_alerts, challenge_alerts, streak_alerts FROM notification_settings WHERE user_id = $1',
        [req.user.id]
      );
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('خطأ في جلب إعدادات الإشعارات:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ══════════════════════════════════════════
// PUT /settings
// تحديث إعدادات الإشعارات
// ══════════════════════════════════════════
router.put('/settings', requireUserAuth, async (req, res) => {
  try {
    const { daily_reminder, daily_reminder_time, achievement_alerts, challenge_alerts, streak_alerts } = req.body;

    const result = await pool.query(
      `INSERT INTO notification_settings (user_id, daily_reminder, daily_reminder_time, achievement_alerts, challenge_alerts, streak_alerts)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id) DO UPDATE SET
         daily_reminder = COALESCE($2, notification_settings.daily_reminder),
         daily_reminder_time = COALESCE($3, notification_settings.daily_reminder_time),
         achievement_alerts = COALESCE($4, notification_settings.achievement_alerts),
         challenge_alerts = COALESCE($5, notification_settings.challenge_alerts),
         streak_alerts = COALESCE($6, notification_settings.streak_alerts)
       RETURNING daily_reminder, daily_reminder_time, achievement_alerts, challenge_alerts, streak_alerts`,
      [req.user.id, daily_reminder, daily_reminder_time, achievement_alerts, challenge_alerts, streak_alerts]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('خطأ في تحديث إعدادات الإشعارات:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ══════════════════════════════════════════
// GET /history
// سجل الإشعارات
// ══════════════════════════════════════════
router.get('/history', requireUserAuth, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 50);
    const offset = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      pool.query(
        'SELECT id, title, body, type, data, sent_at, read_at FROM notifications_log WHERE user_id = $1 ORDER BY sent_at DESC LIMIT $2 OFFSET $3',
        [req.user.id, limit, offset]
      ),
      pool.query(
        'SELECT COUNT(*) FROM notifications_log WHERE user_id = $1',
        [req.user.id]
      ),
    ]);

    const totalCount = parseInt(total.rows[0].count);
    res.json({
      notifications: notifications.rows,
      total: totalCount,
      page,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (err) {
    console.error('خطأ في جلب سجل الإشعارات:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ══════════════════════════════════════════
// PUT /read/:id
// تحديث حالة القراءة
// ══════════════════════════════════════════
router.put('/read/:id', requireUserAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE notifications_log SET read_at = NOW() WHERE id = $1 AND user_id = $2 AND read_at IS NULL RETURNING id',
      [req.params.id, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'الإشعار غير موجود' });
    }

    res.json({ message: 'تم' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ══════════════════════════════════════════
// PUT /read-all
// قراءة جميع الإشعارات
// ══════════════════════════════════════════
router.put('/read-all', requireUserAuth, async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications_log SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL',
      [req.user.id]
    );

    res.json({ message: 'تم قراءة جميع الإشعارات' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ══════════════════════════════════════════
// GET /unread-count
// عدد الإشعارات غير المقروءة
// ══════════════════════════════════════════
router.get('/unread-count', requireUserAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT COUNT(*) FROM notifications_log WHERE user_id = $1 AND read_at IS NULL',
      [req.user.id]
    );

    res.json({ count: parseInt(result.rows[0].count) });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ══════════════════════════════════════════════════════
//                  Admin Endpoints
// ══════════════════════════════════════════════════════

// POST /admin/send — إرسال إشعار من لوحة التحكم
router.post('/admin/send', authMiddleware, async (req, res) => {
  try {
    const { title, body, target, user_ids } = req.body;

    if (!title || !body) {
      return res.status(400).json({ message: 'العنوان والنص مطلوبان' });
    }

    let result;

    if (target === 'all') {
      result = await sendToAll(title, body, { type: 'admin_broadcast' });
      res.json({ message: `تم الإرسال لـ ${result.sent} جهاز`, sent: result.sent });
    } else if (target === 'specific' && Array.isArray(user_ids) && user_ids.length > 0) {
      await sendToMultiple(user_ids, title, body, { type: 'admin_message' });
      res.json({ message: `تم الإرسال لـ ${user_ids.length} مستخدم` });
    } else {
      return res.status(400).json({ message: 'يجب تحديد الهدف: all أو specific مع user_ids' });
    }
  } catch (err) {
    console.error('خطأ في إرسال إشعار من الأدمن:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// GET /admin/stats — إحصائيات الإشعارات
router.get('/admin/stats', authMiddleware, async (req, res) => {
  try {
    const [totalTokens, uniqueUsers, sentToday, sentTotal] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM fcm_tokens'),
      pool.query('SELECT COUNT(DISTINCT user_id) FROM fcm_tokens'),
      pool.query("SELECT COUNT(*) FROM notifications_log WHERE sent_at >= CURRENT_DATE"),
      pool.query('SELECT COUNT(*) FROM notifications_log'),
    ]);

    res.json({
      total_devices: parseInt(totalTokens.rows[0].count),
      total_users_with_tokens: parseInt(uniqueUsers.rows[0].count),
      sent_today: parseInt(sentToday.rows[0].count),
      total_sent: parseInt(sentTotal.rows[0].count),
    });
  } catch (err) {
    console.error('خطأ في إحصائيات الإشعارات:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

module.exports = router;
