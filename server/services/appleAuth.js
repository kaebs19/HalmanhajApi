const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';
const APPLE_ISSUER = 'https://appleid.apple.com';
const BUNDLE_ID = process.env.APNS_BUNDLE_ID || 'deepp.net.Darfor';
const WEB_CLIENT_ID = process.env.APPLE_CLIENT_ID || 'com.halmanhaj.web';

const client = jwksClient({
  jwksUri: APPLE_JWKS_URL,
  cache: true,
  cacheMaxAge: 86400000, // 24 ساعة
});

function getAppleSigningKey(kid) {
  return new Promise((resolve, reject) => {
    client.getSigningKey(kid, (err, key) => {
      if (err) return reject(err);
      resolve(key.getPublicKey());
    });
  });
}

/**
 * التحقق من Apple Identity Token واستخراج بيانات المستخدم
 * @param {string} identityToken - JWT من Apple
 * @returns {{ appleId: string, email: string|null }}
 */
async function verifyAppleToken(identityToken) {
  // فك الـ header للحصول على kid
  const decoded = jwt.decode(identityToken, { complete: true });
  if (!decoded || !decoded.header || !decoded.header.kid) {
    throw new Error('Apple token غير صالح');
  }

  // جلب المفتاح العام من Apple
  const publicKey = await getAppleSigningKey(decoded.header.kid);

  // التحقق من التوقيع والصلاحية (قبول iOS bundle ID + Web client ID)
  const payload = jwt.verify(identityToken, publicKey, {
    algorithms: ['RS256'],
    issuer: APPLE_ISSUER,
    audience: [BUNDLE_ID, WEB_CLIENT_ID],
  });

  return {
    appleId: payload.sub,
    email: payload.email || null,
    emailVerified: payload.email_verified === 'true' || payload.email_verified === true,
  };
}

module.exports = { verifyAppleToken };
