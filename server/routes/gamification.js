const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { requireUserAuth } = require('../middleware/userAuth');
const { sendNotification } = require('../services/notificationService');

// ─── تسميات الشارات بالعربي ───
function getBadgeLabel(badgeType) {
  const labels = {
    streak_3: '3 أيام متتالية 🔥',
    streak_7: 'أسبوع كامل ⚡',
    streak_30: 'شهر كامل 🏆',
    first_exercise: 'أول تمرين 🧩',
    points_100: '100 نقطة 💯',
    points_500: '500 نقطة 🌟',
    accuracy_90: 'دقة 90% 🎯',
  };
  return labels[badgeType] || badgeType;
}

// ─── middleware يقبل admin أو student ───
const requireAnyAuth = (req, res, next) => {
  const jwt = require('jsonwebtoken');
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'يجب تسجيل الدخول' });
  }

  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type === 'user') {
      req.user = decoded;
    } else {
      req.admin = decoded;
    }
    next();
  } catch {
    return res.status(401).json({ message: 'رمز غير صالح' });
  }
};

// ══════════════════════════════════════════
// POST /api/students/daily-checkin
// تسجيل دخول يومي + نقاط + streaks + شارات
// ══════════════════════════════════════════
router.post('/students/daily-checkin', requireUserAuth, async (req, res) => {
  const userId = req.user.id;

  try {
    // 1) هل سجّل اليوم مسبقاً؟
    const todayCheck = await pool.query(
      'SELECT id, streak_day, points_earned FROM student_daily_login WHERE user_id = $1 AND login_date = CURRENT_DATE',
      [userId]
    );

    if (todayCheck.rows.length > 0) {
      // جلب المجموع الحالي
      const userRes = await pool.query('SELECT points FROM users WHERE id = $1', [userId]);
      return res.json({
        already_checked: true,
        streak: todayCheck.rows[0].streak_day,
        points_earned: todayCheck.rows[0].points_earned,
        total_points: userRes.rows[0]?.points || 0
      });
    }

    // 2) حساب streak — آخر تسجيل دخول
    const lastLogin = await pool.query(
      'SELECT login_date, streak_day FROM student_daily_login WHERE user_id = $1 ORDER BY login_date DESC LIMIT 1',
      [userId]
    );

    let streak = 1;
    if (lastLogin.rows.length > 0) {
      const lastDate = new Date(lastLogin.rows[0].login_date);
      const today = new Date();
      // مقارنة التاريخ فقط (بدون الوقت)
      const diffMs = today.setHours(0, 0, 0, 0) - lastDate.setHours(0, 0, 0, 0);
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        streak = lastLogin.rows[0].streak_day + 1;
      }
      // diffDays > 1 → streak يبدأ من 1
    }

    // 3) حساب النقاط حسب streak
    let pointsEarned = 5; // افتراضي
    if (streak >= 30) {
      pointsEarned = 50;
    } else if (streak >= 7) {
      pointsEarned = 20;
    } else if (streak >= 3) {
      pointsEarned = 10;
    }

    // 4) INSERT سجل الدخول اليومي
    await pool.query(
      `INSERT INTO student_daily_login (user_id, login_date, points_earned, streak_day)
       VALUES ($1, CURRENT_DATE, $2, $3)`,
      [userId, pointsEarned, streak]
    );

    // 5) INSERT سجل النقاط
    await pool.query(
      `INSERT INTO student_points_log (user_id, points, source)
       VALUES ($1, $2, 'daily_login')`,
      [userId, pointsEarned]
    );

    // 6) UPDATE نقاط المستخدم
    const updatedUser = await pool.query(
      'UPDATE users SET points = COALESCE(points, 0) + $1 WHERE id = $2 RETURNING points',
      [pointsEarned, userId]
    );
    const totalPoints = updatedUser.rows[0].points;

    // إشعارات streak milestones
    const streakMilestones = { 3: '🔥 3 أيام متتالية، استمر!', 7: '🔥 أسبوع كامل، أنت رائع!', 30: '🔥 30 يوم متتالي، أسطورة!' };
    if (streakMilestones[streak]) {
      sendNotification(userId, streakMilestones[streak], `حققت ${streak} يوم متتالي من الحضور`, {
        type: 'streak_milestone',
        refType: 'streak'
      });
    }

    // 7) منح شارات streak
    const badgesEarned = [];

    const streakBadges = [
      { threshold: 3, type: 'streak_3' },
      { threshold: 7, type: 'streak_7' },
      { threshold: 30, type: 'streak_30' },
    ];

    for (const badge of streakBadges) {
      if (streak >= badge.threshold) {
        const result = await pool.query(
          `INSERT INTO student_badges (user_id, badge_type)
           VALUES ($1, $2)
           ON CONFLICT (user_id, badge_type) DO NOTHING
           RETURNING badge_type, earned_at`,
          [userId, badge.type]
        );
        if (result.rows.length > 0) {
          badgesEarned.push(result.rows[0]);
        }
      }
    }

    // 8) شارة أول تمرين صحيح
    const firstExercise = await pool.query(
      'SELECT id FROM student_exercise_progress WHERE user_id = $1 AND is_correct = true LIMIT 1',
      [userId]
    );
    if (firstExercise.rows.length > 0) {
      const result = await pool.query(
        `INSERT INTO student_badges (user_id, badge_type)
         VALUES ($1, 'first_exercise')
         ON CONFLICT (user_id, badge_type) DO NOTHING
         RETURNING badge_type, earned_at`,
        [userId]
      );
      if (result.rows.length > 0) {
        badgesEarned.push(result.rows[0]);
      }
    }

    // 9) شارات النقاط
    const pointsBadges = [
      { threshold: 100, type: 'points_100' },
      { threshold: 500, type: 'points_500' },
    ];

    for (const badge of pointsBadges) {
      if (totalPoints >= badge.threshold) {
        const result = await pool.query(
          `INSERT INTO student_badges (user_id, badge_type)
           VALUES ($1, $2)
           ON CONFLICT (user_id, badge_type) DO NOTHING
           RETURNING badge_type, earned_at`,
          [userId, badge.type]
        );
        if (result.rows.length > 0) {
          badgesEarned.push(result.rows[0]);
        }
      }
    }

    // 10) شارة الدقة (accuracy_90)
    const accuracyCheck = await pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE is_correct = true) as correct,
        COUNT(*) as total
       FROM student_exercise_progress
       WHERE user_id = $1`,
      [userId]
    );
    const { correct, total } = accuracyCheck.rows[0];
    if (parseInt(total) >= 10 && (parseInt(correct) / parseInt(total)) >= 0.9) {
      const result = await pool.query(
        `INSERT INTO student_badges (user_id, badge_type)
         VALUES ($1, 'accuracy_90')
         ON CONFLICT (user_id, badge_type) DO NOTHING
         RETURNING badge_type, earned_at`,
        [userId]
      );
      if (result.rows.length > 0) {
        badgesEarned.push(result.rows[0]);
      }
    }

    // إشعارات الشارات الجديدة
    for (const badge of badgesEarned) {
      sendNotification(userId, 'شارة جديدة 🏆', getBadgeLabel(badge.badge_type), {
        type: 'badge_earned',
        refType: 'badge'
      });
    }

    res.json({
      already_checked: false,
      points_earned: pointsEarned,
      streak,
      badges_earned: badgesEarned,
      total_points: totalPoints
    });
  } catch (err) {
    console.error('خطأ في تسجيل الدخول اليومي:', err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// ══════════════════════════════════════════
// GET /api/students/:id/stats
// إحصائيات الطالب الكاملة
// ══════════════════════════════════════════
router.get('/students/:id/stats', requireAnyAuth, async (req, res) => {
  const { id } = req.params;

  // حماية: الطالب يرى بياناته فقط، الأدمن يرى الكل
  if (req.user && req.user.id !== id) {
    return res.status(403).json({ message: 'غير مصرح بالوصول' });
  }

  try {
    // النقاط الإجمالية
    const userRes = await pool.query(
      'SELECT points FROM users WHERE id = $1',
      [id]
    );
    if (userRes.rows.length === 0) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }
    const totalPoints = userRes.rows[0].points || 0;

    // أطول streak
    const longestStreakRes = await pool.query(
      'SELECT COALESCE(MAX(streak_day), 0) as longest FROM student_daily_login WHERE user_id = $1',
      [id]
    );
    const longestStreak = parseInt(longestStreakRes.rows[0].longest);

    // streak الحالي — حساب الأيام المتتالية من اليوم/أمس
    let currentStreak = 0;
    const streakRows = await pool.query(
      'SELECT login_date, streak_day FROM student_daily_login WHERE user_id = $1 ORDER BY login_date DESC LIMIT 1',
      [id]
    );
    if (streakRows.rows.length > 0) {
      const lastDate = new Date(streakRows.rows[0].login_date);
      const today = new Date();
      const diffMs = new Date(today.setHours(0, 0, 0, 0)) - new Date(lastDate.setHours(0, 0, 0, 0));
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays <= 1) {
        currentStreak = streakRows.rows[0].streak_day;
      }
      // diffDays > 1 → streak انقطع
    }

    // إحصائيات التمارين
    const exerciseStats = await pool.query(
      `SELECT
        COUNT(*) as total_exercises,
        COUNT(*) FILTER (WHERE is_correct = true) as correct_answers
       FROM student_exercise_progress
       WHERE user_id = $1`,
      [id]
    );
    const totalExercises = parseInt(exerciseStats.rows[0].total_exercises);
    const correctAnswers = parseInt(exerciseStats.rows[0].correct_answers);
    const accuracyRate = totalExercises > 0
      ? Math.round((correctAnswers / totalExercises) * 100)
      : 0;

    // الشارات
    const badgesRes = await pool.query(
      'SELECT badge_type, earned_at FROM student_badges WHERE user_id = $1 ORDER BY earned_at',
      [id]
    );

    // تفصيل النقاط حسب المصدر
    const breakdownRes = await pool.query(
      `SELECT source, COALESCE(SUM(points), 0) as total
       FROM student_points_log
       WHERE user_id = $1
       GROUP BY source`,
      [id]
    );
    const pointsBreakdown = {};
    breakdownRes.rows.forEach(row => {
      pointsBreakdown[row.source] = parseInt(row.total);
    });

    // نشاط آخر 30 يوم
    const activityRes = await pool.query(
      `SELECT login_date, points_earned, streak_day
       FROM student_daily_login
       WHERE user_id = $1 AND login_date >= CURRENT_DATE - INTERVAL '30 days'
       ORDER BY login_date`,
      [id]
    );

    res.json({
      total_points: totalPoints,
      current_streak: currentStreak,
      longest_streak: longestStreak,
      total_exercises: totalExercises,
      correct_answers: correctAnswers,
      accuracy_rate: accuracyRate,
      badges: badgesRes.rows,
      points_breakdown: pointsBreakdown,
      activity_last_30_days: activityRes.rows
    });
  } catch (err) {
    console.error('خطأ في جلب إحصائيات الطالب:', err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// ══════════════════════════════════════════
// GET /api/students/:id/subject-progress
// تقدم الطالب بكل مادة
// ══════════════════════════════════════════
router.get('/students/:id/subject-progress', requireAnyAuth, async (req, res) => {
  const { id } = req.params;

  // حماية: الطالب يرى بياناته فقط، الأدمن يرى الكل
  if (req.user && req.user.id !== id) {
    return res.status(403).json({ message: 'غير مصرح بالوصول' });
  }

  try {
    const result = await pool.query(`
      SELECT
        s.id AS subject_id,
        s.name AS subject_name,
        COUNT(sep.id) AS total_questions,
        COUNT(sep.id) FILTER (WHERE sep.is_correct = true) AS correct_answers,
        CASE
          WHEN COUNT(sep.id) > 0
          THEN ROUND(COUNT(sep.id) FILTER (WHERE sep.is_correct = true) * 100.0 / COUNT(sep.id))
          ELSE 0
        END AS progress_pct
      FROM student_exercise_progress sep
      JOIN exercises e ON e.id = sep.exercise_id
      JOIN subjects s ON s.id = e.subject_id
      WHERE sep.user_id = $1
      GROUP BY s.id, s.name
      ORDER BY total_questions DESC
    `, [id]);

    res.json(result.rows.map(r => ({
      subject_id: r.subject_id,
      subject_name: r.subject_name,
      total_questions: parseInt(r.total_questions),
      correct_answers: parseInt(r.correct_answers),
      progress_pct: parseInt(r.progress_pct)
    })));
  } catch (err) {
    console.error('خطأ في جلب تقدم المواد:', err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// ══════════════════════════════════════════
// GET /api/leaderboard
// لوحة الترتيب
// ══════════════════════════════════════════
router.get('/leaderboard', requireUserAuth, async (req, res) => {
  const { grade_id, user_id, limit = 10 } = req.query;
  const safeLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 50);

  try {
    let query = `
      SELECT
        u.id,
        u.name,
        u.avatar_url,
        u.points,
        COALESCE(
          (SELECT sdl.streak_day FROM student_daily_login sdl
           WHERE sdl.user_id = u.id
           ORDER BY sdl.login_date DESC LIMIT 1),
          0
        ) as current_streak,
        COALESCE(
          (SELECT COUNT(*) FILTER (WHERE sep.is_correct = true) * 100.0 /
            NULLIF(COUNT(*), 0)
           FROM student_exercise_progress sep
           WHERE sep.user_id = u.id),
          0
        ) as accuracy_rate
      FROM users u
      WHERE u.role = 'student'
        AND u.is_active = true
        AND u.is_banned = false
    `;

    const params = [];
    let paramIndex = 1;

    if (grade_id) {
      query += ` AND u.grade_id = $${paramIndex}`;
      params.push(grade_id);
      paramIndex++;
    }

    query += ` ORDER BY u.points DESC LIMIT $${paramIndex}`;
    params.push(safeLimit);

    const result = await pool.query(query, params);

    // إضافة الترتيب
    const leaderboard = result.rows.map((row, index) => ({
      rank: index + 1,
      id: row.id,
      name: row.name,
      avatar_url: row.avatar_url,
      points: row.points || 0,
      current_streak: parseInt(row.current_streak),
      accuracy_rate: Math.round(parseFloat(row.accuracy_rate) || 0)
    }));

    // حساب ترتيب الطالب الحالي (إذا طُلب)
    let currentUser = null;
    if (user_id) {
      // هل الطالب ضمن القائمة؟
      const inList = leaderboard.find(p => p.id === user_id);
      if (inList) {
        currentUser = { ...inList };
      } else {
        // حساب ترتيبه خارج القائمة
        let rankQuery = `
          SELECT COUNT(*) + 1 AS rank
          FROM users
          WHERE role = 'student' AND is_active = true AND is_banned = false
            AND COALESCE(points, 0) > (SELECT COALESCE(points, 0) FROM users WHERE id = $1)
        `;
        const rankParams = [user_id];
        let rankParamIdx = 2;

        if (grade_id) {
          rankQuery += ` AND grade_id = $${rankParamIdx}`;
          rankParams.push(grade_id);
        }

        const rankRes = await pool.query(rankQuery, rankParams);
        const userRes = await pool.query(`
          SELECT id, name, avatar_url, points,
            COALESCE(
              (SELECT sdl.streak_day FROM student_daily_login sdl WHERE sdl.user_id = u.id ORDER BY sdl.login_date DESC LIMIT 1), 0
            ) as current_streak,
            COALESCE(
              (SELECT COUNT(*) FILTER (WHERE sep.is_correct = true) * 100.0 / NULLIF(COUNT(*), 0)
               FROM student_exercise_progress sep WHERE sep.user_id = u.id), 0
            ) as accuracy_rate
          FROM users u WHERE u.id = $1
        `, [user_id]);

        if (userRes.rows.length > 0) {
          const u = userRes.rows[0];
          currentUser = {
            rank: parseInt(rankRes.rows[0].rank),
            id: u.id,
            name: u.name,
            avatar_url: u.avatar_url,
            points: u.points || 0,
            current_streak: parseInt(u.current_streak),
            accuracy_rate: Math.round(parseFloat(u.accuracy_rate) || 0)
          };
        }
      }
    }

    res.json({ leaderboard, current_user: currentUser });
  } catch (err) {
    console.error('خطأ في جلب لوحة الترتيب:', err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

module.exports = router;
