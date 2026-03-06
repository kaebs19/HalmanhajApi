const apn = require('@parse/node-apn');
const path = require('path');
const { pool } = require('../config/db');

// APNs provider — lazy singleton
let apnProvider = null;

function getProvider() {
  if (apnProvider) return apnProvider;

  apnProvider = new apn.Provider({
    token: {
      key: path.join(__dirname, '../config/AuthKey_43J3HP6K23.p8'),
      keyId: process.env.APNS_KEY_ID,
      teamId: process.env.APNS_TEAM_ID,
    },
    production: process.env.NODE_ENV === 'production',
  });

  return apnProvider;
}

/**
 * حفظ إشعار في قاعدة البيانات + إرسال push عبر APNs
 * لا يرمي خطأ أبداً — silent fail مع console.error
 *
 * @param {string} userId - UUID المستخدم المستهدف
 * @param {object} opts
 * @param {string} opts.type - نوع الإشعار (new_answer, best_answer, badge_earned, xp_earned, streak_milestone)
 * @param {string} opts.title - عنوان الإشعار
 * @param {string} opts.body - نص الإشعار
 * @param {string} [opts.refType] - نوع المرجع (question, badge, exercise)
 * @param {string} [opts.refId] - UUID المرجع
 */
async function sendPushNotification(userId, { type, title, body, refType, refId }) {
  try {
    // 1) حفظ في جدول الإشعارات (in-app)
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, ref_type, ref_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, type, title, body, refType || null, refId || null]
    );

    // 2) جلب رموز أجهزة المستخدم
    const tokens = await pool.query(
      'SELECT device_token FROM user_device_tokens WHERE user_id = $1',
      [userId]
    );

    if (tokens.rows.length === 0) return;

    // 3) بناء إشعار APNs
    const provider = getProvider();
    const note = new apn.Notification();
    note.expiry = Math.floor(Date.now() / 1000) + 3600; // ساعة واحدة
    note.badge = 1;
    note.sound = 'default';
    note.alert = { title, body };
    note.topic = process.env.APNS_BUNDLE_ID;
    note.payload = { type, refType, refId };

    // 4) إرسال لكل الأجهزة المسجّلة
    const deviceTokens = tokens.rows.map(r => r.device_token);
    const result = await provider.send(note, deviceTokens);

    // 5) حذف رموز منتهية الصلاحية
    if (result.failed && result.failed.length > 0) {
      for (const fail of result.failed) {
        if (fail.status === '410' || fail.response?.reason === 'Unregistered') {
          await pool.query(
            'DELETE FROM user_device_tokens WHERE device_token = $1',
            [fail.device]
          );
        }
      }
    }
  } catch (err) {
    console.error('خطأ في إرسال الإشعار:', err.message);
    // لا نرمي خطأ — لا نقطع العملية الأساسية
  }
}

module.exports = { sendPushNotification };
