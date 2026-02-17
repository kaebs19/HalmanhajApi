const express = require('express');
const { pool } = require('../config/db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// جلب جميع الاختبارات
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT q.*, s.name as subject_name, g.name as grade_name,
        jsonb_array_length(q.questions) as questions_count
      FROM quizzes q
      LEFT JOIN subjects s ON q.subject_id = s.id
      LEFT JOIN grades g ON q.grade_id = g.id
      ORDER BY q.sort_order ASC, q.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('GET /quizzes error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// جلب اختبار واحد
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM quizzes WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'الاختبار غير موجود' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// إنشاء اختبار
router.post('/', async (req, res) => {
  try {
    const { title, description, subject_id, grade_id, semester, questions, duration_minutes, is_published } = req.body;
    if (!title) {
      return res.status(400).json({ message: 'عنوان الاختبار مطلوب' });
    }

    const maxOrder = await pool.query('SELECT COALESCE(MAX(sort_order), 0) + 1 as next FROM quizzes');

    const result = await pool.query(
      `INSERT INTO quizzes (title, description, subject_id, grade_id, semester, questions, duration_minutes, is_published, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        title,
        description || null,
        subject_id || null,
        grade_id || null,
        semester !== undefined ? parseInt(semester) : 0,
        JSON.stringify(questions || []),
        duration_minutes || 30,
        is_published !== false,
        maxOrder.rows[0].next
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /quizzes error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// تعديل اختبار
router.put('/:id', async (req, res) => {
  try {
    const { title, description, subject_id, grade_id, semester, questions, duration_minutes, is_published } = req.body;
    if (!title) {
      return res.status(400).json({ message: 'عنوان الاختبار مطلوب' });
    }

    const result = await pool.query(
      `UPDATE quizzes SET title=$1, description=$2, subject_id=$3, grade_id=$4, semester=$5, questions=$6, duration_minutes=$7, is_published=$8, updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [
        title,
        description || null,
        subject_id || null,
        grade_id || null,
        semester !== undefined ? parseInt(semester) : 0,
        JSON.stringify(questions || []),
        duration_minutes || 30,
        is_published !== false,
        req.params.id
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'الاختبار غير موجود' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /quizzes error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// حذف اختبار
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM quizzes WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'الاختبار غير موجود' });
    }
    res.json({ message: 'تم حذف الاختبار بنجاح' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

module.exports = router;
