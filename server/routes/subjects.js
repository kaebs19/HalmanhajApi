const express = require('express');
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');
const authMiddleware = require('../middleware/auth');
const { createUpload } = require('../middleware/upload');

const upload = createUpload('subjects');
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

// استعلام لجلب المادة مع الصفوف والمسارات وعدد الدروس
const SUBJECT_QUERY = `
  SELECT s.*,
    (SELECT COUNT(*) FROM lessons WHERE subject_id = s.id) as lessons_count,
    COALESCE(
      (SELECT json_agg(json_build_object('grade_id', g.id, 'grade_name', g.name, 'stage_id', st.id, 'stage_name', st.name))
       FROM subject_grades sg
       JOIN grades g ON sg.grade_id = g.id
       JOIN stages st ON g.stage_id = st.id
       WHERE sg.subject_id = s.id), '[]'
    ) as grades,
    COALESCE(
      (SELECT json_agg(json_build_object('track_id', t.id, 'track_name', t.name, 'stage_id', st2.id, 'stage_name', st2.name, 'icon', t.icon))
       FROM subject_tracks str
       JOIN tracks t ON str.track_id = t.id
       JOIN stages st2 ON t.stage_id = st2.id
       WHERE str.subject_id = s.id), '[]'
    ) as tracks
`;

// جلب جميع المواد مع دعم الفلتر والترتيب
router.get('/', async (req, res) => {
  try {
    const { grade_id, track_id, stage_id, sort } = req.query;
    let query;
    let params = [];

    if (grade_id) {
      query = `${SUBJECT_QUERY} FROM subjects s
        WHERE s.id IN (SELECT subject_id FROM subject_grades WHERE grade_id = $1)`;
      params = [grade_id];
    } else if (track_id) {
      query = `${SUBJECT_QUERY} FROM subjects s
        WHERE s.id IN (SELECT subject_id FROM subject_tracks WHERE track_id = $1)`;
      params = [track_id];
    } else if (stage_id) {
      // فلتر حسب المرحلة: المواد المرتبطة بصفوف في هذه المرحلة أو مسارات في هذه المرحلة
      query = `${SUBJECT_QUERY} FROM subjects s
        WHERE s.id IN (
          SELECT sg.subject_id FROM subject_grades sg
          JOIN grades g ON sg.grade_id = g.id
          WHERE g.stage_id = $1
        ) OR s.id IN (
          SELECT st.subject_id FROM subject_tracks st
          JOIN tracks t ON st.track_id = t.id
          WHERE t.stage_id = $1
        )`;
      params = [stage_id];
    } else {
      query = `${SUBJECT_QUERY} FROM subjects s`;
    }

    // ترتيب
    if (sort === 'name') {
      query += ' ORDER BY s.name ASC';
    } else if (sort === 'newest') {
      query += ' ORDER BY s.created_at DESC';
    } else if (sort === 'oldest') {
      query += ' ORDER BY s.created_at ASC';
    } else {
      query += ' ORDER BY s.sort_order ASC, s.created_at DESC';
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('GET /subjects error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// إضافة مادة جديدة
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { name, grade_ids, track_ids, icon } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'اسم المادة مطلوب' });
    }

    const parsedGradeIds = grade_ids ? JSON.parse(grade_ids) : [];
    const parsedTrackIds = track_ids ? JSON.parse(track_ids) : [];

    if (parsedGradeIds.length === 0 && parsedTrackIds.length === 0) {
      return res.status(400).json({ message: 'يجب تحديد صف أو مسار واحد على الأقل' });
    }

    // grade_id اختياري الآن (nullable)
    const firstGradeId = parsedGradeIds.length > 0 ? parsedGradeIds[0] : null;

    const slug = generateSlug(name);
    const image_url = req.file ? `/uploads/subjects/${req.file.filename}` : null;
    const maxOrder = await pool.query(
      'SELECT COALESCE(MAX(sort_order), 0) + 1 as next FROM subjects'
    );

    const result = await pool.query(
      'INSERT INTO subjects (name, slug, grade_id, image_url, icon, sort_order) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, slug, firstGradeId, image_url, icon || null, maxOrder.rows[0].next]
    );

    const subjectId = result.rows[0].id;

    // ربط المادة بالصفوف
    for (const gradeId of parsedGradeIds) {
      await pool.query(
        'INSERT INTO subject_grades (subject_id, grade_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [subjectId, gradeId]
      );
    }

    // ربط المادة بالمسارات
    for (const trackId of parsedTrackIds) {
      await pool.query(
        'INSERT INTO subject_tracks (subject_id, track_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [subjectId, trackId]
      );
    }

    // إرجاع المادة
    const subject = await pool.query(
      `${SUBJECT_QUERY} FROM subjects s WHERE s.id = $1`,
      [subjectId]
    );
    res.status(201).json(subject.rows[0]);
  } catch (err) {
    console.error('POST /subjects error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// تعديل مادة
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const { name, grade_ids, track_ids, icon } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'اسم المادة مطلوب' });
    }

    const existing = await pool.query('SELECT * FROM subjects WHERE id = $1', [req.params.id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ message: 'المادة غير موجودة' });
    }

    let image_url = existing.rows[0].image_url;
    if (req.file) {
      if (image_url) {
        const oldPath = path.join(__dirname, '..', image_url);
        fs.unlink(oldPath, () => {});
      }
      image_url = `/uploads/subjects/${req.file.filename}`;
    }

    // إذا تم رفع صورة جديدة، مسح الأيقونة. وإذا تم اختيار أيقونة، مسح الصورة
    let finalIcon = icon !== undefined ? (icon || null) : existing.rows[0].icon;
    if (req.file) finalIcon = null;
    if (icon && !req.file) image_url = existing.rows[0].image_url;

    const parsedGradeIds = grade_ids !== undefined ? JSON.parse(grade_ids) : null;
    const parsedTrackIds = track_ids !== undefined ? JSON.parse(track_ids) : null;
    const firstGradeId = parsedGradeIds && parsedGradeIds.length > 0 ? parsedGradeIds[0] : existing.rows[0].grade_id;

    await pool.query(
      'UPDATE subjects SET name = $1, image_url = $2, grade_id = $3, icon = $4, updated_at = NOW() WHERE id = $5',
      [name, image_url, firstGradeId, finalIcon, req.params.id]
    );

    // تحديث ربط الصفوف
    if (parsedGradeIds !== null) {
      await pool.query('DELETE FROM subject_grades WHERE subject_id = $1', [req.params.id]);
      for (const gradeId of parsedGradeIds) {
        await pool.query(
          'INSERT INTO subject_grades (subject_id, grade_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [req.params.id, gradeId]
        );
      }
    }

    // تحديث ربط المسارات
    if (parsedTrackIds !== null) {
      await pool.query('DELETE FROM subject_tracks WHERE subject_id = $1', [req.params.id]);
      for (const trackId of parsedTrackIds) {
        await pool.query(
          'INSERT INTO subject_tracks (subject_id, track_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [req.params.id, trackId]
        );
      }
    }

    // إرجاع المادة
    const subject = await pool.query(
      `${SUBJECT_QUERY} FROM subjects s WHERE s.id = $1`,
      [req.params.id]
    );
    res.json(subject.rows[0]);
  } catch (err) {
    console.error('PUT /subjects error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// تحديث ترتيب المواد
router.put('/reorder/batch', async (req, res) => {
  try {
    const { orders } = req.body;
    if (!orders || !Array.isArray(orders)) {
      return res.status(400).json({ message: 'بيانات الترتيب مطلوبة' });
    }

    for (const item of orders) {
      await pool.query(
        'UPDATE subjects SET sort_order = $1, updated_at = NOW() WHERE id = $2',
        [item.sort_order, item.id]
      );
    }

    res.json({ message: 'تم تحديث الترتيب بنجاح' });
  } catch (err) {
    console.error('PUT /subjects/reorder error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// حذف مادة
router.delete('/:id', async (req, res) => {
  try {
    const existing = await pool.query('SELECT * FROM subjects WHERE id = $1', [req.params.id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ message: 'المادة غير موجودة' });
    }

    if (existing.rows[0].image_url) {
      const filePath = path.join(__dirname, '..', existing.rows[0].image_url);
      fs.unlink(filePath, () => {});
    }

    await pool.query('DELETE FROM subjects WHERE id = $1', [req.params.id]);
    res.json({ message: 'تم حذف المادة بنجاح' });
  } catch (err) {
    console.error('DELETE /subjects error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

module.exports = router;
