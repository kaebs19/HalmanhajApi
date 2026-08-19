const express = require('express');
const { pool } = require('../config/db');
const authMiddleware = require('../middleware/auth');
const { resolveLibraryImage, registerIconLibraryRoutes } = require('../utils/iconLibrary');
const upload = require('../middleware/upload');

const router = express.Router();

router.use(authMiddleware);

function generateSlug(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\u0621-\u064Aa-z0-9-]/g, '')
    .substring(0, 100) + '-' + Date.now();
}

// جلب جميع المراحل
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM stages ORDER BY sort_order ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// إضافة مرحلة
// مكتبة الصور المرفوعة سابقاً — تُعرَّف قبل مسارات /:id
registerIconLibraryRoutes(router, 'stages');

router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { name, icon } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'اسم المرحلة مطلوب' });
    }

    const slug = generateSlug(name);
    // إمّا صورة مرفوعة الآن، أو صورة مختارة من مكتبة الصور المرفوعة سابقاً
    const image_url = req.file
      ? `/uploads/stages/${req.file.filename}`
      : resolveLibraryImage('stages', req.body.image_url);
    const maxOrder = await pool.query('SELECT COALESCE(MAX(sort_order), 0) + 1 as next FROM stages');

    const result = await pool.query(
      'INSERT INTO stages (name, slug, icon, image_url, sort_order) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, slug, icon || null, image_url, maxOrder.rows[0].next]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// تعديل مرحلة
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const { name, icon } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'اسم المرحلة مطلوب' });
    }

    const existing = await pool.query('SELECT * FROM stages WHERE id = $1', [req.params.id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ message: 'المرحلة غير موجودة' });
    }

    const libraryImage = resolveLibraryImage('stages', req.body.image_url);
    const removeImage = req.body.remove_image === 'true' || req.body.remove_image === true;

    // الملف القديم يبقى في مكتبة الأيقونات ليعاد استخدامه — يُحذف يدوياً من المكتبة
    let image_url = existing.rows[0].image_url;
    if (req.file) {
      image_url = `/uploads/stages/${req.file.filename}`;
    } else if (libraryImage) {
      image_url = libraryImage;
    } else if (removeImage) {
      image_url = null;
    }

    // الصورة والأيقونة يستبعد أحدهما الآخر
    const finalIcon = image_url ? null : (icon || existing.rows[0].icon);

    const result = await pool.query(
      'UPDATE stages SET name = $1, icon = $2, image_url = $3, updated_at = NOW() WHERE id = $4 RETURNING *',
      [name, finalIcon, image_url, req.params.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// حذف مرحلة
router.delete('/:id', async (req, res) => {
  try {
    const existing = await pool.query('SELECT * FROM stages WHERE id = $1', [req.params.id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ message: 'المرحلة غير موجودة' });
    }

    // الصورة تبقى في مكتبة الأيقونات (قد تستخدمها عناصر أخرى) وتُحذف يدوياً منها

    await pool.query('DELETE FROM stages WHERE id = $1', [req.params.id]);
    res.json({ message: 'تم حذف المرحلة بنجاح' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

module.exports = router;
