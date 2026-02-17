const express = require('express');
const { pool } = require('../config/db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// ═══════════════════════════════════════
// جلب جميع أسئلة المجتمع (لوحة التحكم)
// ═══════════════════════════════════════
router.get('/questions', async (req, res) => {
  try {
    const { search, is_published, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];

    let query = `
      SELECT q.*,
        u.name as user_name, u.email as user_email, u.avatar_url as user_avatar,
        st.name as stage_name,
        g.name as grade_name,
        s.name as subject_name
      FROM community_questions q
      JOIN users u ON q.user_id = u.id
      LEFT JOIN stages st ON q.stage_id = st.id
      LEFT JOIN grades g ON q.grade_id = g.id
      LEFT JOIN subjects s ON q.subject_id = s.id
      WHERE 1=1
    `;

    if (is_published !== undefined && is_published !== '') {
      query += ` AND q.is_published = $${params.length + 1}`;
      params.push(is_published === 'true');
    }
    if (search) {
      query += ` AND (q.title ILIKE $${params.length + 1} OR q.body ILIKE $${params.length + 1} OR u.name ILIKE $${params.length + 1})`;
      params.push(`%${search}%`);
    }

    // Count
    const countParams = [...params];
    const whereIdx = query.indexOf('WHERE');
    const whereClause = query.substring(whereIdx);
    const countQuery = `SELECT COUNT(*) as total FROM community_questions q JOIN users u ON q.user_id = u.id LEFT JOIN stages st ON q.stage_id = st.id LEFT JOIN grades g ON q.grade_id = g.id LEFT JOIN subjects s ON q.subject_id = s.id ${whereClause}`;
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    query += ' ORDER BY q.created_at DESC';
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);

    res.json({
      questions: result.rows,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (err) {
    console.error('خطأ في جلب أسئلة المجتمع:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// عرض سؤال مع إجاباته (لوحة التحكم)
// ═══════════════════════════════════════
router.get('/questions/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const question = await pool.query(`
      SELECT q.*,
        u.name as user_name, u.email as user_email, u.avatar_url as user_avatar,
        st.name as stage_name, g.name as grade_name, s.name as subject_name
      FROM community_questions q
      JOIN users u ON q.user_id = u.id
      LEFT JOIN stages st ON q.stage_id = st.id
      LEFT JOIN grades g ON q.grade_id = g.id
      LEFT JOIN subjects s ON q.subject_id = s.id
      WHERE q.id = $1
    `, [id]);

    if (question.rowCount === 0) {
      return res.status(404).json({ message: 'السؤال غير موجود' });
    }

    const answers = await pool.query(`
      SELECT a.*, u.name as user_name, u.email as user_email, u.avatar_url as user_avatar
      FROM community_answers a
      JOIN users u ON a.user_id = u.id
      WHERE a.question_id = $1
      ORDER BY a.is_best DESC, a.created_at ASC
    `, [id]);

    res.json({
      question: question.rows[0],
      answers: answers.rows
    });
  } catch (err) {
    console.error('خطأ:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// تعديل سؤال (أدمن)
// ═══════════════════════════════════════
router.put('/questions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, body, is_published, is_closed } = req.body;

    const result = await pool.query(
      `UPDATE community_questions SET title = COALESCE($1, title), body = COALESCE($2, body),
       is_published = COALESCE($3, is_published), is_closed = COALESCE($4, is_closed), updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [title, body, is_published, is_closed, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'السؤال غير موجود' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('خطأ في تعديل السؤال:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// حذف سؤال (أدمن)
// ═══════════════════════════════════════
router.delete('/questions/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM community_questions WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'السؤال غير موجود' });
    }
    res.json({ message: 'تم حذف السؤال' });
  } catch (err) {
    console.error('خطأ في حذف السؤال:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// حذف إجابة (أدمن)
// ═══════════════════════════════════════
router.delete('/answers/:id', async (req, res) => {
  try {
    // جلب بيانات الإجابة لتحديث العداد
    const answer = await pool.query('SELECT question_id FROM community_answers WHERE id = $1', [req.params.id]);
    if (answer.rowCount === 0) {
      return res.status(404).json({ message: 'الإجابة غير موجودة' });
    }

    await pool.query('DELETE FROM community_answers WHERE id = $1', [req.params.id]);
    // تحديث العداد
    await pool.query(
      'UPDATE community_questions SET answers_count = GREATEST(0, answers_count - 1) WHERE id = $1',
      [answer.rows[0].question_id]
    );

    res.json({ message: 'تم حذف الإجابة' });
  } catch (err) {
    console.error('خطأ في حذف الإجابة:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// إضافة سؤال من الأدمن كسؤال مجتمع
// ═══════════════════════════════════════
router.post('/questions', async (req, res) => {
  try {
    const { title, body, stage_id, grade_id, subject_id, semester, user_id } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'عنوان السؤال مطلوب' });
    }

    // إذا لم يحدد user_id نستخدم أول مستخدم
    let actualUserId = user_id;
    if (!actualUserId) {
      const firstUser = await pool.query('SELECT id FROM users LIMIT 1');
      if (firstUser.rowCount === 0) {
        return res.status(400).json({ message: 'لا يوجد مستخدمين' });
      }
      actualUserId = firstUser.rows[0].id;
    }

    const result = await pool.query(
      `INSERT INTO community_questions (user_id, title, body, stage_id, grade_id, subject_id, semester)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [actualUserId, title.trim(), body?.trim() || null, stage_id || null, grade_id || null, subject_id || null, semester || 0]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('خطأ في إنشاء سؤال:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

module.exports = router;
