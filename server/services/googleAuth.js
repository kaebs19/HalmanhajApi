const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * معرّفات العملاء المقبولة كـ audience للتوكن.
 * لكل منصّة عميل OAuth خاص بها في مشروع Google الواحد، والتوكن الذي يصل
 * من أندرويد يحمل معرّف عميله لا معرّف عميل الويب — فقبول قيمة واحدة
 * فقط كان يرفض تسجيل دخول التطبيق برسالة «Google token غير صالح».
 *
 * تُضبط GOOGLE_CLIENT_IDS في .env مفصولة بفواصل، وتبقى GOOGLE_CLIENT_ID
 * مقبولة دائماً للتوافق.
 */
const allowedAudiences = [
  ...new Set(
    [
      process.env.GOOGLE_CLIENT_ID,
      ...(process.env.GOOGLE_CLIENT_IDS || '').split(',')
    ]
      .map((id) => (id || '').trim())
      .filter(Boolean)
  )
];

/**
 * التحقق من Google ID Token واستخراج بيانات المستخدم
 * @param {string} idToken - JWT من Google
 * @returns {{ googleId: string, email: string, name: string, picture: string|null }}
 */
async function verifyGoogleToken(idToken) {
  if (allowedAudiences.length === 0) {
    throw new Error('Google token: لم يُضبط أي GOOGLE_CLIENT_ID على الخادم');
  }

  const ticket = await client.verifyIdToken({
    idToken,
    audience: allowedAudiences,
  });

  const payload = ticket.getPayload();
  if (!payload) {
    throw new Error('Google token غير صالح');
  }

  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name || payload.email.split('@')[0],
    picture: payload.picture || null,
    emailVerified: payload.email_verified,
  };
}

module.exports = { verifyGoogleToken, allowedAudiences };
