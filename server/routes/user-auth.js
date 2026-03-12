const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool } = require('../config/db');
const { requireUserAuth } = require('../middleware/userAuth');
const { sendResetCode } = require('../services/mailer');

const router = express.Router();

// تسجيل حساب جديد
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, stage_id, grade_id } = req.body;

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
      'INSERT INTO users (name, email, password_hash, stage_id, grade_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, stage_id, grade_id, created_at',
      [name.trim(), email.toLowerCase(), password_hash, stage_id || null, grade_id || null]
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, email: user.email, type: 'user' },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, stage_id: user.stage_id, grade_id: user.grade_id }
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

// بيانات المستخدم الحالي (مع الإحصائيات الكاملة)
router.get('/me', requireUserAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const [userResult, longestStreakRes, streakRows, exerciseStats, badgesRes, breakdownRes, activityRes, subjectProgress] = await Promise.all([
      pool.query(
        'SELECT id, name, email, avatar_url, role, points, bio, stage_id, grade_id, created_at FROM users WHERE id = $1 AND is_active = true',
        [userId]
      ),
      pool.query(
        'SELECT COALESCE(MAX(streak_day), 0) as longest FROM student_daily_login WHERE user_id = $1',
        [userId]
      ),
      pool.query(
        'SELECT login_date, streak_day FROM student_daily_login WHERE user_id = $1 ORDER BY login_date DESC LIMIT 1',
        [userId]
      ),
      pool.query(
        `SELECT COUNT(*) as total_exercises, COUNT(*) FILTER (WHERE is_correct = true) as correct_answers
         FROM student_exercise_progress WHERE user_id = $1`,
        [userId]
      ),
      pool.query(
        'SELECT badge_type, earned_at FROM student_badges WHERE user_id = $1 ORDER BY earned_at',
        [userId]
      ),
      pool.query(
        `SELECT source, COALESCE(SUM(points), 0) as total FROM student_points_log WHERE user_id = $1 GROUP BY source`,
        [userId]
      ),
      pool.query(
        `SELECT login_date, points_earned, streak_day FROM student_daily_login
         WHERE user_id = $1 AND login_date >= CURRENT_DATE - INTERVAL '30 days' ORDER BY login_date`,
        [userId]
      ),
      pool.query(
        `SELECT s.id AS subject_id, s.name AS subject_name,
          COUNT(sep.id) AS total_questions,
          COUNT(sep.id) FILTER (WHERE sep.is_correct = true) AS correct_answers,
          CASE WHEN COUNT(sep.id) > 0
            THEN ROUND(COUNT(sep.id) FILTER (WHERE sep.is_correct = true) * 100.0 / COUNT(sep.id))
            ELSE 0 END AS progress_pct
         FROM student_exercise_progress sep
         JOIN exercises e ON e.id = sep.exercise_id
         JOIN subjects s ON s.id = e.subject_id
         WHERE sep.user_id = $1
         GROUP BY s.id, s.name ORDER BY total_questions DESC`,
        [userId]
      ),
    ]);

    // تحديث آخر نشاط (fire & forget)
    pool.query('UPDATE users SET last_active_at = NOW() WHERE id = $1', [userId]);

    if (userResult.rowCount === 0) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    // حساب streak الحالي
    let currentStreak = 0;
    if (streakRows.rows.length > 0) {
      const lastDate = new Date(streakRows.rows[0].login_date);
      const today = new Date();
      const diffMs = new Date(today.setHours(0, 0, 0, 0)) - new Date(lastDate.setHours(0, 0, 0, 0));
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays <= 1) currentStreak = streakRows.rows[0].streak_day;
    }

    const totalExercises = parseInt(exerciseStats.rows[0].total_exercises);
    const correctAnswers = parseInt(exerciseStats.rows[0].correct_answers);
    const pointsBreakdown = {};
    breakdownRes.rows.forEach(r => { pointsBreakdown[r.source] = parseInt(r.total); });

    res.json({
      ...userResult.rows[0],
      stats: {
        current_streak: currentStreak,
        longest_streak: parseInt(longestStreakRes.rows[0].longest),
        total_exercises: totalExercises,
        correct_answers: correctAnswers,
        accuracy_rate: totalExercises > 0 ? Math.round((correctAnswers / totalExercises) * 100) : 0,
        badges: badgesRes.rows,
        points_breakdown: pointsBreakdown,
        activity_last_30_days: activityRes.rows,
      },
      subject_progress: subjectProgress.rows.map(r => ({
        subject_id: r.subject_id,
        subject_name: r.subject_name,
        total_questions: parseInt(r.total_questions),
        correct_answers: parseInt(r.correct_answers),
        progress_pct: parseInt(r.progress_pct),
      })),
    });
  } catch (err) {
    console.error('خطأ في جلب بيانات المستخدم:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// طلب استعادة كلمة المرور
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'البريد الإلكتروني مطلوب' });
    }

    // دائماً نرد بنفس الرسالة لحماية الخصوصية
    const successMsg = { message: 'إذا كان البريد مسجلاً، سيصلك رمز التحقق' };

    const user = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND is_active = true',
      [email.toLowerCase()]
    );
    if (user.rowCount === 0) return res.json(successMsg);

    const userId = user.rows[0].id;
    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 دقيقة

    // حذف أكواد سابقة + إضافة الجديد
    await pool.query('DELETE FROM password_reset_codes WHERE user_id = $1', [userId]);
    await pool.query(
      'INSERT INTO password_reset_codes (user_id, code, expires_at) VALUES ($1, $2, $3)',
      [userId, code, expiresAt]
    );

    await sendResetCode(email.toLowerCase(), code);
    res.json(successMsg);
  } catch (err) {
    console.error('خطأ في طلب استعادة كلمة المرور:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// إعادة تعيين كلمة المرور بالرمز
router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, new_password } = req.body;
    if (!email || !code || !new_password) {
      return res.status(400).json({ message: 'جميع الحقول مطلوبة' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
    }

    const user = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND is_active = true',
      [email.toLowerCase()]
    );
    if (user.rowCount === 0) {
      return res.status(400).json({ message: 'رمز التحقق غير صحيح أو منتهي الصلاحية' });
    }

    const userId = user.rows[0].id;
    const resetCode = await pool.query(
      'SELECT id FROM password_reset_codes WHERE user_id = $1 AND code = $2 AND used = false AND expires_at > NOW()',
      [userId, code]
    );
    if (resetCode.rowCount === 0) {
      return res.status(400).json({ message: 'رمز التحقق غير صحيح أو منتهي الصلاحية' });
    }

    const password_hash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [password_hash, userId]);
    await pool.query('UPDATE password_reset_codes SET used = true WHERE id = $1', [resetCode.rows[0].id]);

    res.json({ message: 'تم تغيير كلمة المرور بنجاح' });
  } catch (err) {
    console.error('خطأ في إعادة تعيين كلمة المرور:', err);
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
