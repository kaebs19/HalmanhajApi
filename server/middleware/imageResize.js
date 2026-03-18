/**
 * Middleware لتصغير الصور تلقائياً حسب الحجم المطلوب
 * الاستخدام: /uploads/stages/image.webp?w=100
 * يخزن الصور المصغرة في مجلد cache
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const CACHE_DIR = path.join(__dirname, '..', 'uploads', '.cache');

// إنشاء مجلد الكاش
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function imageResizeMiddleware(req, res, next) {
  const width = parseInt(req.query.w);

  // لو ما في حجم مطلوب، أكمل عادي
  if (!width || width < 16 || width > 1920) return next();

  // فقط للصور
  const ext = path.extname(req.path).toLowerCase();
  if (!['.webp', '.jpg', '.jpeg', '.png'].includes(ext)) return next();

  const originalPath = path.join(UPLOADS_DIR, req.path);
  if (!fs.existsSync(originalPath)) return next();

  // مسار الكاش
  const cacheKey = `${req.path.replace(/\//g, '_')}_w${width}${ext}`;
  const cachePath = path.join(CACHE_DIR, cacheKey);

  // لو موجود في الكاش
  if (fs.existsSync(cachePath)) {
    const mimeTypes = { '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };
    res.set('Content-Type', mimeTypes[ext] || 'image/webp');
    res.set('Cache-Control', 'public, max-age=2592000, immutable');
    return res.sendFile(cachePath);
  }

  // تصغير وحفظ
  sharp(originalPath)
    .resize(width, width, { fit: 'cover' })
    .toFile(cachePath)
    .then(() => {
      const mimeTypes = { '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };
      res.set('Content-Type', mimeTypes[ext] || 'image/webp');
      res.set('Cache-Control', 'public, max-age=2592000, immutable');
      res.sendFile(cachePath);
    })
    .catch(() => next());
}

module.exports = imageResizeMiddleware;
