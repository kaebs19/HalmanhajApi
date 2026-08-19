const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

// مكتبة الصور المرفوعة سابقاً — الملفات تبقى محفوظة ليعاد استخدامها بدل رفعها من جديد
const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];

// أسماء الجداول محصورة هنا — لا تأتي من الطلب
const FOLDER_TABLES = {
  subjects: 'subjects',
  stages: 'stages',
  tracks: 'tracks',
};

function uploadDir(folder) {
  return path.join(__dirname, `../uploads/${folder}`);
}

/**
 * التحقق من أن الرابط المُرسل يشير فعلاً لملف صورة داخل مجلد المكتبة
 * يعيد الرابط النظيف أو null
 */
function resolveLibraryImage(folder, url) {
  if (!FOLDER_TABLES[folder]) return null;
  if (!url || typeof url !== 'string') return null;
  const prefix = `/uploads/${folder}/`;
  if (!url.startsWith(prefix)) return null;
  const filename = url.slice(prefix.length);
  if (!filename || filename !== path.basename(filename)) return null;
  if (!IMAGE_EXTS.includes(path.extname(filename).toLowerCase())) return null;
  if (!fs.existsSync(path.join(uploadDir(folder), filename))) return null;
  return prefix + filename;
}

/**
 * يضيف مساري المكتبة للراوتر:
 *   GET    /icon-library  — سرد الصور المرفوعة سابقاً
 *   DELETE /icon-library  — حذف صورة غير مستخدمة
 * يجب استدعاؤه قبل تعريف مسارات /:id حتى لا تُفسَّر كمعرّف
 */
function registerIconLibraryRoutes(router, folder) {
  const table = FOLDER_TABLES[folder];
  if (!table) throw new Error(`مجلد غير مدعوم: ${folder}`);
  const prefix = `/uploads/${folder}/`;
  const dir = uploadDir(folder);

  router.get('/icon-library', async (req, res) => {
    try {
      let files = [];
      try {
        files = await fs.promises.readdir(dir);
      } catch {
        return res.json([]);
      }

      const used = await pool.query(
        `SELECT DISTINCT image_url FROM ${table} WHERE image_url IS NOT NULL`
      );
      const usedUrls = new Set(used.rows.map((r) => r.image_url));

      const images = [];
      for (const file of files) {
        if (!IMAGE_EXTS.includes(path.extname(file).toLowerCase())) continue;
        let stat;
        try {
          stat = await fs.promises.stat(path.join(dir, file));
        } catch {
          continue;
        }
        if (!stat.isFile()) continue;
        const url = prefix + file;
        images.push({ url, size: stat.size, uploaded_at: stat.mtime, in_use: usedUrls.has(url) });
      }

      images.sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at));
      res.json(images);
    } catch (err) {
      console.error(`GET /${folder}/icon-library error:`, err.message);
      res.status(500).json({ message: 'خطأ في جلب مكتبة الأيقونات' });
    }
  });

  router.delete('/icon-library', async (req, res) => {
    try {
      const url = resolveLibraryImage(folder, req.body?.url || req.query.url);
      if (!url) {
        return res.status(400).json({ message: 'الصورة غير موجودة في المكتبة' });
      }

      const inUse = await pool.query(
        `SELECT name FROM ${table} WHERE image_url = $1 LIMIT 3`,
        [url]
      );
      if (inUse.rowCount > 0) {
        const names = inUse.rows.map((r) => r.name).join('، ');
        return res.status(400).json({ message: `الصورة مستخدمة في: ${names}` });
      }

      await fs.promises.unlink(path.join(__dirname, '..', url)).catch(() => {});
      res.json({ message: 'تم حذف الصورة من المكتبة' });
    } catch (err) {
      console.error(`DELETE /${folder}/icon-library error:`, err.message);
      res.status(500).json({ message: 'خطأ في حذف الصورة' });
    }
  });
}

module.exports = { resolveLibraryImage, registerIconLibraryRoutes, IMAGE_EXTS };
