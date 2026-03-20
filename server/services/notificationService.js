const { getMessaging } = require('../config/firebase');
const { pool } = require('../config/db');

// رسائل التذكير اليومي
const DAILY_MESSAGES = [
  { title: '📚 وقت المراجعة!', body: '5 دقائق تكفي لتتقدم' },
  { title: '🎯 لا تنسى تحدي اليوم!', body: 'جرب حظك وحل التحدي' },
  { title: '⭐ أنت قريب من إنجاز جديد', body: 'تعال أكمل مسيرتك' },
];

// رسائل تذكير الـ Streak
const STREAK_MESSAGES = {
  reminder: (streak) => ({ title: '🔥 لا تكسر سلسلتك!', body: `عندك ${streak} يوم متتالي — واصل اليوم` }),
  broken: { title: '😢 سلسلتك انكسرت!', body: 'ابدأ من جديد اليوم وحقق سلسلة أطول' },
  milestone: (streak) => ({ title: '💪 واصل!', body: `سلسلتك وصلت ${streak} يوم — أنت بطل!` }),
};

// رسائل الغياب
const ABSENCE_MESSAGES = [
  { title: '👋 وحشتنا!', body: 'تعال نكمل من وين وقفنا' },
  { title: '📖 عندك دروس جديدة بانتظارك', body: 'ارجع وتابع تعلمك' },
];

/**
 * إرسال إشعار FCM لمستخدم واحد
 */
async function sendNotification(userId, title, body, data = {}) {
  try {
    const messaging = getMessaging();
    if (!messaging) return;

    // جلب FCM tokens للمستخدم
    const tokens = await pool.query(
      'SELECT token FROM fcm_tokens WHERE user_id = $1',
      [userId]
    );

    if (tokens.rows.length === 0) return;

    const message = {
      notification: { title, body },
      data: { ...data, type: data.type || 'general' },
      apns: {
        payload: { aps: { sound: 'default', badge: 1 } },
      },
    };

    const fcmTokens = tokens.rows.map(r => r.token);

    if (fcmTokens.length === 1) {
      message.token = fcmTokens[0];
      await messaging.send(message);
    } else {
      message.tokens = fcmTokens;
      const response = await messaging.sendEachForMulticast(message);
      // حذف التوكنات المنتهية
      await cleanupFailedTokens(response, fcmTokens);
    }

    // تسجيل في السجل
    await logNotification(userId, title, body, data.type || 'general', data);
  } catch (err) {
    console.error('خطأ في إرسال إشعار FCM:', err.message);
  }
}

/**
 * إرسال إشعار لعدة مستخدمين
 */
async function sendToMultiple(userIds, title, body, data = {}) {
  for (const userId of userIds) {
    await sendNotification(userId, title, body, data);
  }
}

/**
 * إرسال إشعار لجميع المستخدمين (broadcast)
 */
async function sendToAll(title, body, data = {}) {
  try {
    const messaging = getMessaging();
    if (!messaging) return { sent: 0 };

    const tokens = await pool.query('SELECT DISTINCT token FROM fcm_tokens');
    if (tokens.rows.length === 0) return { sent: 0 };

    const fcmTokens = tokens.rows.map(r => r.token);
    const message = {
      notification: { title, body },
      data: { ...data, type: data.type || 'broadcast' },
      apns: {
        payload: { aps: { sound: 'default', badge: 1 } },
      },
    };

    // إرسال بدفعات (500 توكن لكل دفعة)
    let totalSent = 0;
    for (let i = 0; i < fcmTokens.length; i += 500) {
      const batch = fcmTokens.slice(i, i + 500);
      const response = await messaging.sendEachForMulticast({ ...message, tokens: batch });
      totalSent += response.successCount;
      await cleanupFailedTokens(response, batch);
    }

    // تسجيل الإشعار لكل المستخدمين
    const userIds = await pool.query('SELECT DISTINCT user_id FROM fcm_tokens');
    for (const row of userIds.rows) {
      await logNotification(row.user_id, title, body, data.type || 'broadcast', data);
    }

    return { sent: totalSent };
  } catch (err) {
    console.error('خطأ في الإرسال الجماعي:', err.message);
    return { sent: 0 };
  }
}

/**
 * إرسال تذكيرات يومية (يُستدعى من cron)
 */
async function sendDailyReminders() {
  try {
    const now = new Date();
    const currentHour = now.getHours().toString().padStart(2, '0') + ':00';

    // جلب المستخدمين الذين وقت تذكيرهم الآن
    const users = await pool.query(`
      SELECT ft.user_id, ft.token
      FROM fcm_tokens ft
      JOIN notification_settings ns ON ns.user_id = ft.user_id
      WHERE ns.daily_reminder = true
        AND ns.daily_reminder_time = $1
    `, [currentHour]);

    if (users.rows.length === 0) return;

    const msg = DAILY_MESSAGES[Math.floor(Math.random() * DAILY_MESSAGES.length)];

    // تجميع حسب المستخدم
    const userTokens = {};
    for (const row of users.rows) {
      if (!userTokens[row.user_id]) userTokens[row.user_id] = [];
      userTokens[row.user_id].push(row.token);
    }

    for (const [userId, tokens] of Object.entries(userTokens)) {
      await sendNotification(userId, msg.title, msg.body, { type: 'daily_reminder' });
    }

    console.log(`📬 تذكير يومي: أُرسل لـ ${Object.keys(userTokens).length} مستخدم`);
  } catch (err) {
    console.error('خطأ في التذكيرات اليومية:', err.message);
  }
}

/**
 * تذكير الـ Streak — للمستخدمين الذين لم يدخلوا اليوم
 */
async function sendStreakReminders() {
  try {
    const users = await pool.query(`
      SELECT ft.user_id, sdl.streak_day
      FROM fcm_tokens ft
      JOIN notification_settings ns ON ns.user_id = ft.user_id AND ns.streak_alerts = true
      LEFT JOIN student_daily_login sdl ON sdl.user_id = ft.user_id
        AND sdl.login_date = CURRENT_DATE
      JOIN (
        SELECT user_id, MAX(streak_day) as max_streak
        FROM student_daily_login
        WHERE login_date >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY user_id
        HAVING MAX(streak_day) >= 2
      ) active ON active.user_id = ft.user_id
      WHERE sdl.id IS NULL
    `);

    const seen = new Set();
    for (const row of users.rows) {
      if (seen.has(row.user_id)) continue;
      seen.add(row.user_id);

      // جلب آخر streak للمستخدم
      const lastStreak = await pool.query(
        'SELECT streak_day FROM student_daily_login WHERE user_id = $1 ORDER BY login_date DESC LIMIT 1',
        [row.user_id]
      );
      const streak = lastStreak.rows[0]?.streak_day || 0;

      if (streak > 0) {
        const msg = STREAK_MESSAGES.reminder(streak);
        await sendNotification(row.user_id, msg.title, msg.body, { type: 'streak_reminder' });
      }
    }

    console.log(`🔥 تذكير سلسلة: أُرسل لـ ${seen.size} مستخدم`);
  } catch (err) {
    console.error('خطأ في تذكيرات السلسلة:', err.message);
  }
}

/**
 * تذكير بعد الغياب — للمستخدمين الذين لم يدخلوا من يومين+
 */
async function sendAbsenceReminders() {
  try {
    const users = await pool.query(`
      SELECT DISTINCT ft.user_id
      FROM fcm_tokens ft
      JOIN users u ON u.id = ft.user_id AND u.is_active = true
      WHERE NOT EXISTS (
        SELECT 1 FROM student_daily_login sdl
        WHERE sdl.user_id = ft.user_id
          AND sdl.login_date >= CURRENT_DATE - INTERVAL '1 day'
      )
      AND EXISTS (
        SELECT 1 FROM student_daily_login sdl2
        WHERE sdl2.user_id = ft.user_id
          AND sdl2.login_date >= CURRENT_DATE - INTERVAL '7 days'
          AND sdl2.login_date < CURRENT_DATE - INTERVAL '1 day'
      )
    `);

    const msg = ABSENCE_MESSAGES[Math.floor(Math.random() * ABSENCE_MESSAGES.length)];

    for (const row of users.rows) {
      await sendNotification(row.user_id, msg.title, msg.body, { type: 'absence_reminder' });
    }

    console.log(`👋 تذكير غياب: أُرسل لـ ${users.rows.length} مستخدم`);
  } catch (err) {
    console.error('خطأ في تذكيرات الغياب:', err.message);
  }
}

/**
 * تسجيل إشعار في قاعدة البيانات
 */
async function logNotification(userId, title, body, type, data = {}) {
  try {
    await pool.query(
      'INSERT INTO notifications_log (user_id, title, body, type, data) VALUES ($1, $2, $3, $4, $5)',
      [userId, title, body, type, JSON.stringify(data)]
    );
  } catch (err) {
    console.error('خطأ في تسجيل الإشعار:', err.message);
  }
}

/**
 * حذف التوكنات المنتهية
 */
async function cleanupFailedTokens(response, tokens) {
  if (!response.responses) return;
  for (let i = 0; i < response.responses.length; i++) {
    if (response.responses[i].error) {
      const errorCode = response.responses[i].error.code;
      if (
        errorCode === 'messaging/invalid-registration-token' ||
        errorCode === 'messaging/registration-token-not-registered'
      ) {
        await pool.query('DELETE FROM fcm_tokens WHERE token = $1', [tokens[i]]);
      }
    }
  }
}

module.exports = {
  sendNotification,
  sendToMultiple,
  sendToAll,
  sendDailyReminders,
  sendStreakReminders,
  sendAbsenceReminders,
  logNotification,
};
