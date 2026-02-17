const express = require('express');
const { pool } = require('../config/db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// جلب جميع الأسئلة مع بيانات الصف والمادة
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT f.*,
        g.name as grade_name,
        s.name as subject_name,
        st.name as stage_name
      FROM faqs f
      LEFT JOIN grades g ON f.grade_id = g.id
      LEFT JOIN subjects s ON f.subject_id = s.id
      LEFT JOIN stages st ON g.stage_id = st.id
      ORDER BY f.sort_order ASC, f.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('خطأ في جلب الأسئلة:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// إنشاء سؤال
router.post('/', async (req, res) => {
  try {
    const { question, answer, grade_id, subject_id, semester, is_published } = req.body;
    if (!question || !answer) {
      return res.status(400).json({ message: 'السؤال والإجابة مطلوبان' });
    }

    const maxOrder = await pool.query('SELECT COALESCE(MAX(sort_order), 0) + 1 as next FROM faqs');

    const result = await pool.query(
      `INSERT INTO faqs (question, answer, grade_id, subject_id, semester, is_published, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        question,
        answer,
        grade_id || null,
        subject_id || null,
        semester || 0,
        is_published !== false,
        maxOrder.rows[0].next
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('خطأ في إنشاء سؤال:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// تعديل سؤال
router.put('/:id', async (req, res) => {
  try {
    const { question, answer, grade_id, subject_id, semester, is_published } = req.body;
    if (!question || !answer) {
      return res.status(400).json({ message: 'السؤال والإجابة مطلوبان' });
    }

    const result = await pool.query(
      `UPDATE faqs SET question=$1, answer=$2, grade_id=$3, subject_id=$4, semester=$5, is_published=$6
       WHERE id=$7 RETURNING *`,
      [
        question,
        answer,
        grade_id || null,
        subject_id || null,
        semester || 0,
        is_published !== false,
        req.params.id
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'السؤال غير موجود' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('خطأ في تعديل سؤال:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// حذف سؤال
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM faqs WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'السؤال غير موجود' });
    }
    res.json({ message: 'تم حذف السؤال بنجاح' });
  } catch (err) {
    console.error('خطأ في حذف سؤال:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

module.exports = router;
