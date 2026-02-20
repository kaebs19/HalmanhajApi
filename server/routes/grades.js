const express = require('express');
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');
const authMiddleware = require('../middleware/auth');
const { createUpload } = require('../middleware/upload');

const upload = createUpload('grades');
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

// جلب جميع الصفوف (مع فلتر حسب المرحلة والمسار)
router.get('/', async (req, res) => {
  try {
    const { stage_id, track_id } = req.query;
    let query = `
      SELECT g.*, s.name as stage_name, s.sort_order as stage_sort_order, t.name as track_name,
        (SELECT COUNT(*) FROM subject_grades sg WHERE sg.grade_id = g.id) AS subjects_count
      FROM grades g
      JOIN stages s ON g.stage_id = s.id
      LEFT JOIN tracks t ON g.track_id = t.id
    `;
    const params = [];
    const conditions = [];

    if (stage_id) {
      conditions.push(`g.stage_id = $${params.length + 1}`);
      params.push(stage_id);
    }

    if (track_id) {
      conditions.push(`g.track_id = $${params.length + 1}`);
      params.push(track_id);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY g.stage_id, g.sort_order ASC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// إضافة صف
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { name, stage_id, track_id, copy_from_grade_id } = req.body;
    if (!name || !stage_id) {
      return res.status(400).json({ message: 'اسم الصف والمرحلة مطلوبان' });
    }

    const stageExists = await pool.query('SELECT id FROM stages WHERE id = $1', [stage_id]);
    if (stageExists.rowCount === 0) {
      return res.status(400).json({ message: 'المرحلة غير موجودة' });
    }

    if (track_id) {
      const trackExists = await pool.query('SELECT id FROM tracks WHERE id = $1 AND stage_id = $2', [track_id, stage_id]);
      if (trackExists.rowCount === 0) {
        return res.status(400).json({ message: 'المسار غير موجود أو لا ينتمي لهذه المرحلة' });
      }
    }

    const slug = generateSlug(name);
    const image_url = req.file ? `/uploads/grades/${req.file.filename}` : null;
    const maxOrder = await pool.query(
      'SELECT COALESCE(MAX(sort_order), 0) + 1 as next FROM grades WHERE stage_id = $1',
      [stage_id]
    );

    const result = await pool.query(
      'INSERT INTO grades (name, slug, stage_id, track_id, image_url, sort_order) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, slug, stage_id, track_id || null, image_url, maxOrder.rows[0].next]
    );

    const newGradeId = result.rows[0].id;

    // نسخ المواد من صف آخر
    if (copy_from_grade_id) {
      const sourceSubjects = await pool.query(
        'SELECT subject_id FROM subject_grades WHERE grade_id = $1',
        [copy_from_grade_id]
      );
      for (const row of sourceSubjects.rows) {
        await pool.query(
          'INSERT INTO subject_grades (subject_id, grade_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [row.subject_id, newGradeId]
        );
      }
    }

    const grade = await pool.query(
      'SELECT g.*, s.name as stage_name, t.name as track_name FROM grades g JOIN stages s ON g.stage_id = s.id LEFT JOIN tracks t ON g.track_id = t.id WHERE g.id = $1',
      [newGradeId]
    );
    res.status(201).json(grade.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// تعديل صف
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const { name, stage_id, track_id } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'اسم الصف مطلوب' });
    }

    const existing = await pool.query('SELECT * FROM grades WHERE id = $1', [req.params.id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ message: 'الصف غير موجود' });
    }

    let image_url = existing.rows[0].image_url;

    if (req.file) {
      if (image_url) {
        const oldPath = path.join(__dirname, '..', image_url);
        fs.unlink(oldPath, () => {});
      }
      image_url = `/uploads/grades/${req.file.filename}`;
    }

    const finalStageId = stage_id || existing.rows[0].stage_id;
    const finalTrackId = track_id === '' ? null : (track_id === undefined ? existing.rows[0].track_id : (track_id || null));

    const result = await pool.query(
      'UPDATE grades SET name = $1, stage_id = $2, track_id = $3, image_url = $4 WHERE id = $5 RETURNING *',
      [name, finalStageId, finalTrackId, image_url, req.params.id]
    );

    const grade = await pool.query(
      'SELECT g.*, s.name as stage_name, t.name as track_name FROM grades g JOIN stages s ON g.stage_id = s.id LEFT JOIN tracks t ON g.track_id = t.id WHERE g.id = $1',
      [result.rows[0].id]
    );
    res.json(grade.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// حذف صف
router.delete('/:id', async (req, res) => {
  try {
    const existing = await pool.query('SELECT * FROM grades WHERE id = $1', [req.params.id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ message: 'الصف غير موجود' });
    }

    if (existing.rows[0].image_url) {
      const filePath = path.join(__dirname, '..', existing.rows[0].image_url);
      fs.unlink(filePath, () => {});
    }

    await pool.query('DELETE FROM grades WHERE id = $1', [req.params.id]);
    res.json({ message: 'تم حذف الصف بنجاح' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

module.exports = router;
