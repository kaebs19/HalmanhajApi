const express = require('express');
const { pool } = require('../config/db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

// جلب جميع الفصول
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM semesters ORDER BY created_at ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// إضافة فصل
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'اسم الفصل مطلوب' });
    }

    const result = await pool.query(
      'INSERT INTO semesters (name) VALUES ($1) RETURNING *',
      [name]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// تعديل فصل
router.put('/:id', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'اسم الفصل مطلوب' });
    }

    const result = await pool.query(
      'UPDATE semesters SET name = $1 WHERE id = $2 RETURNING *',
      [name, req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'الفصل غير موجود' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// حذف فصل
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM semesters WHERE id = $1', [req.params.id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'الفصل غير موجود' });
    }

    res.json({ message: 'تم حذف الفصل بنجاح' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

module.exports = router;
