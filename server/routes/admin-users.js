const express = require('express');
const { pool } = require('../config/db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// ═══════════════════════════════════════
// جلب جميع المستخدمين مع إحصائيات
// ═══════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const { search, status, sort = 'latest', page = 1, limit = 20, provider } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    let conditions = [];

    if (status === 'active') {
      conditions.push(`u.is_active = $${params.length + 1}`);
      params.push(true);
    } else if (status === 'banned') {
      conditions.push(`u.is_banned = $${params.length + 1}`);
      params.push(true);
    }

    if (search) {
      conditions.push(`(u.name ILIKE $${params.length + 1} OR u.email ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }

    if (provider && ['local', 'apple', 'both'].includes(provider)) {
      conditions.push(`u.auth_provider = $${params.length + 1}`);
      params.push(provider);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // Count
    const countResult = await pool.query(`SELECT COUNT(*) as total FROM users u ${whereClause}`, [...params]);
    const total = parseInt(countResult.rows[0].total);

    // ترتيب
    let orderBy;
    if (sort === 'points') {
      orderBy = 'u.points DESC';
    } else if (sort === 'active') {
      orderBy = 'u.last_active_at DESC NULLS LAST';
    } else if (sort === 'name') {
      orderBy = 'u.name ASC';
    } else {
      orderBy = 'u.created_at DESC';
    }

    const query = `
      SELECT u.id, u.name, u.email, u.avatar_url, u.role, u.points, u.bio,
        u.is_active, u.is_banned, u.ban_reason, u.created_at, u.last_active_at,
        u.stage_id, u.grade_id, u.updated_at, u.auth_provider,
        st.name as stage_name, g.name as grade_name,
        COALESCE(q.questions_count, 0)::int as questions_count,
        COALESCE(a.answers_count, 0)::int as answers_count,
        COALESCE(ba.best_answers_count, 0)::int as best_answers_count
      FROM users u
      LEFT JOIN stages st ON u.stage_id = st.id
      LEFT JOIN grades g ON u.grade_id = g.id
      LEFT JOIN (SELECT user_id, COUNT(*) as questions_count FROM community_questions GROUP BY user_id) q ON u.id = q.user_id
      LEFT JOIN (SELECT user_id, COUNT(*) as answers_count FROM community_answers GROUP BY user_id) a ON u.id = a.user_id
      LEFT JOIN (SELECT user_id, COUNT(*) as best_answers_count FROM community_answers WHERE is_best = true GROUP BY user_id) ba ON u.id = ba.user_id
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);

    res.json({
      users: result.rows,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (err) {
    console.error('خطأ في جلب المستخدمين:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// عرض تفاصيل مستخدم مع نشاطه
// ═══════════════════════════════════════
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const user = await pool.query(`
      SELECT u.*, st.name as stage_name, g.name as grade_name
      FROM users u
      LEFT JOIN stages st ON u.stage_id = st.id
      LEFT JOIN grades g ON u.grade_id = g.id
      WHERE u.id = $1
    `, [id]);

    if (user.rowCount === 0) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    // إحصائيات
    const [questionsCount, answersCount, bestAnswers, recentQuestions, recentAnswers, favorites] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM community_questions WHERE user_id = $1', [id]),
      pool.query('SELECT COUNT(*) as count FROM community_answers WHERE user_id = $1', [id]),
      pool.query('SELECT COUNT(*) as count FROM community_answers WHERE user_id = $1 AND is_best = true', [id]),
      pool.query(`
        SELECT q.id, q.title, q.views, q.answers_count, q.best_answer_id, q.created_at
        FROM community_questions q WHERE q.user_id = $1
        ORDER BY q.created_at DESC LIMIT 5
      `, [id]),
      pool.query(`
        SELECT a.id, a.body, a.is_best, a.upvotes, a.downvotes, a.created_at,
          q.title as question_title, q.id as question_id
        FROM community_answers a
        JOIN community_questions q ON a.question_id = q.id
        WHERE a.user_id = $1
        ORDER BY a.created_at DESC LIMIT 5
      `, [id]),
      pool.query('SELECT COUNT(*) as count FROM user_favorites WHERE user_id = $1', [id]),
    ]);

    const userData = user.rows[0];
    delete userData.password_hash;

    res.json({
      user: userData,
      stats: {
        questions_count: parseInt(questionsCount.rows[0].count),
        answers_count: parseInt(answersCount.rows[0].count),
        best_answers_count: parseInt(bestAnswers.rows[0].count),
        favorites_count: parseInt(favorites.rows[0].count),
      },
      recent_questions: recentQuestions.rows,
      recent_answers: recentAnswers.rows,
    });
  } catch (err) {
    console.error('خطأ في جلب تفاصيل المستخدم:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// حظر / إلغاء حظر مستخدم
// ═══════════════════════════════════════
router.put('/:id/ban', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, unban } = req.body;

    const shouldBan = !unban;
    const result = await pool.query(
      'UPDATE users SET is_banned = $1, ban_reason = $2, updated_at = NOW() WHERE id = $3 RETURNING id, name, is_banned, ban_reason',
      [shouldBan, shouldBan ? (reason || null) : null, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('خطأ في حظر المستخدم:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// تفعيل / إلغاء تفعيل مستخدم
// ═══════════════════════════════════════
router.put('/:id/toggle-active', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'UPDATE users SET is_active = NOT is_active, updated_at = NOW() WHERE id = $1 RETURNING id, name, is_active',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('خطأ:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// حذف مستخدم
// ═══════════════════════════════════════
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }
    res.json({ message: 'تم حذف المستخدم' });
  } catch (err) {
    console.error('خطأ في حذف المستخدم:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

module.exports = router;
