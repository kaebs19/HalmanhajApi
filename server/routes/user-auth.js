const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const { requireUserAuth } = require('../middleware/userAuth');

const router = express.Router();

// تسجيل حساب جديد
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'جميع الحقول مطلوبة' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
    }

    // التأكد من عدم وجود الإيميل
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rowCount > 0) {
      return res.status(400).json({ message: 'البريد الإلكتروني مستخدم بالفعل' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, role, created_at',
      [name.trim(), email.toLowerCase(), password_hash]
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, email: user.email, type: 'user' },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('خطأ في التسجيل:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// تسجيل الدخول
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'البريد الإلكتروني وكلمة المرور مطلوبان' });
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1 AND is_active = true', [email.toLowerCase()]);
    if (result.rowCount === 0) {
      return res.status(401).json({ message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
    }

    // التحقق من الحظر
    if (user.is_banned) {
      return res.status(403).json({ message: 'تم حظر حسابك. السبب: ' + (user.ban_reason || 'مخالفة الشروط') });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, type: 'user' },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, avatar_url: user.avatar_url, role: user.role }
    });
  } catch (err) {
    console.error('خطأ في تسجيل الدخول:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// بيانات المستخدم الحالي
router.get('/me', requireUserAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, avatar_url, role, points, bio, stage_id, grade_id, created_at FROM users WHERE id = $1 AND is_active = true',
      [req.user.id]
    );

    // تحديث آخر نشاط
    await pool.query('UPDATE users SET last_active_at = NOW() WHERE id = $1', [req.user.id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// المفضلة
router.get('/favorites', requireUserAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT l.id, l.title, l.slug, l.thumbnail_url, l.type, l.views,
        s.name as subject_name, s.icon as subject_icon, uf.created_at as favorited_at
      FROM user_favorites uf
      JOIN lessons l ON uf.lesson_id = l.id
      JOIN subjects s ON l.subject_id = s.id
      WHERE uf.user_id = $1 AND l.is_published = true
      ORDER BY uf.created_at DESC
    `, [req.user.id]);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// تحديث الملف الشخصي
router.put('/profile', requireUserAuth, async (req, res) => {
  try {
    const { name, bio, stage_id, grade_id } = req.body;

    const result = await pool.query(
      `UPDATE users SET name = COALESCE($1, name), bio = $2, stage_id = $3, grade_id = $4, updated_at = NOW()
       WHERE id = $5 RETURNING id, name, email, avatar_url, bio, role, points, stage_id, grade_id, created_at`,
      [name, bio || null, stage_id || null, grade_id || null, req.user.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('خطأ في تحديث الملف الشخصي:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// الملف الشخصي العام لمستخدم
router.get('/profile/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const user = await pool.query(`
      SELECT u.id, u.name, u.avatar_url, u.bio, u.role, u.points, u.created_at,
        st.name as stage_name, g.name as grade_name
      FROM users u
      LEFT JOIN stages st ON u.stage_id = st.id
      LEFT JOIN grades g ON u.grade_id = g.id
      WHERE u.id = $1 AND u.is_active = true AND u.is_banned = false
    `, [id]);

    if (user.rowCount === 0) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    // إحصائيات
    const [questionsCount, answersCount, bestAnswers] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM community_questions WHERE user_id = $1 AND is_published = true', [id]),
      pool.query('SELECT COUNT(*) as count FROM community_answers WHERE user_id = $1', [id]),
      pool.query('SELECT COUNT(*) as count FROM community_answers WHERE user_id = $1 AND is_best = true', [id]),
    ]);

    // آخر الأسئلة
    const recentQuestions = await pool.query(`
      SELECT q.id, q.title, q.views, q.answers_count, q.best_answer_id, q.created_at,
        st.name as stage_name, g.name as grade_name, s.name as subject_name
      FROM community_questions q
      LEFT JOIN stages st ON q.stage_id = st.id
      LEFT JOIN grades g ON q.grade_id = g.id
      LEFT JOIN subjects s ON q.subject_id = s.id
      WHERE q.user_id = $1 AND q.is_published = true
      ORDER BY q.created_at DESC LIMIT 10
    `, [id]);

    // آخر الإجابات
    const recentAnswers = await pool.query(`
      SELECT a.id, a.body, a.is_best, a.upvotes, a.downvotes, a.created_at,
        q.title as question_title, q.id as question_id
      FROM community_answers a
      JOIN community_questions q ON a.question_id = q.id
      WHERE a.user_id = $1
      ORDER BY a.created_at DESC LIMIT 10
    `, [id]);

    res.json({
      user: user.rows[0],
      stats: {
        questions_count: parseInt(questionsCount.rows[0].count),
        answers_count: parseInt(answersCount.rows[0].count),
        best_answers_count: parseInt(bestAnswers.rows[0].count),
      },
      recent_questions: recentQuestions.rows,
      recent_answers: recentAnswers.rows,
    });
  } catch (err) {
    console.error('خطأ في جلب الملف الشخصي:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// إضافة/إزالة مفضلة
router.post('/favorites/:lessonId', requireUserAuth, async (req, res) => {
  try {
    const { lessonId } = req.params;

    const existing = await pool.query(
      'SELECT id FROM user_favorites WHERE user_id = $1 AND lesson_id = $2',
      [req.user.id, lessonId]
    );

    if (existing.rowCount > 0) {
      await pool.query('DELETE FROM user_favorites WHERE user_id = $1 AND lesson_id = $2', [req.user.id, lessonId]);
      res.json({ favorited: false });
    } else {
      await pool.query('INSERT INTO user_favorites (user_id, lesson_id) VALUES ($1, $2)', [req.user.id, lessonId]);
      res.json({ favorited: true });
    }
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

module.exports = router;
