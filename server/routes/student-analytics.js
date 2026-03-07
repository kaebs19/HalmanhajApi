const express = require('express');
const { pool } = require('../config/db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// ═══════════════════════════════════════════════════════
// GET / — لوحة إحصائيات الطلاب الشاملة
// ═══════════════════════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const [
      totalStudents,
      active7,
      active30,
      avgDailyLogins,
      totalPoints,
      popularBadge,
      dailyActiveUsers,
      exercisesByType,
      pointsBySource,
      accuracyDistribution,
      topExercises,
      accuracyByType,
      accuracyByDifficulty,
      exerciseCompletionRate,
      topStudents,
      badgeDistribution,
    ] = await Promise.all([

      // 1. عدد الطلاب الكلي
      pool.query(`SELECT COUNT(*) as count FROM users WHERE role = 'student'`),

      // 2. نشطون آخر 7 أيام
      pool.query(`
        SELECT COUNT(DISTINCT user_id) as count
        FROM student_daily_login
        WHERE login_date >= CURRENT_DATE - INTERVAL '7 days'
      `),

      // 3. نشطون آخر 30 يوم
      pool.query(`
        SELECT COUNT(DISTINCT user_id) as count
        FROM student_daily_login
        WHERE login_date >= CURRENT_DATE - INTERVAL '30 days'
      `),

      // 4. متوسط الحضور اليومي (آخر 30 يوم)
      pool.query(`
        SELECT COALESCE(ROUND(AVG(daily_count)), 0) as avg_logins
        FROM (
          SELECT login_date, COUNT(*) as daily_count
          FROM student_daily_login
          WHERE login_date >= CURRENT_DATE - INTERVAL '30 days'
          GROUP BY login_date
        ) sub
      `),

      // 5. إجمالي النقاط
      pool.query(`SELECT COALESCE(SUM(points), 0) as total FROM student_points_log`),

      // 6. أكثر شارة حصولاً
      pool.query(`
        SELECT badge_type, COUNT(*) as count
        FROM student_badges
        GROUP BY badge_type
        ORDER BY count DESC
        LIMIT 1
      `),

      // 7. المستخدمون النشطون يومياً (آخر 30 يوم) — للرسم البياني
      pool.query(`
        SELECT d.date::date as date, COALESCE(c.count, 0) as count
        FROM generate_series(
          CURRENT_DATE - INTERVAL '29 days',
          CURRENT_DATE,
          '1 day'
        ) AS d(date)
        LEFT JOIN (
          SELECT login_date, COUNT(DISTINCT user_id) as count
          FROM student_daily_login
          WHERE login_date >= CURRENT_DATE - INTERVAL '29 days'
          GROUP BY login_date
        ) c ON c.login_date = d.date::date
        ORDER BY d.date
      `),

      // 8. الإجابات حسب نوع التمرين
      pool.query(`
        SELECT e.type,
               COUNT(DISTINCT sep.id) as answers_count,
               COUNT(DISTINCT sep.id) FILTER (WHERE sep.is_correct = true) as correct_count
        FROM exercises e
        JOIN student_exercise_progress sep ON sep.exercise_id = e.id
        GROUP BY e.type
        ORDER BY answers_count DESC
      `),

      // 9. النقاط حسب المصدر
      pool.query(`
        SELECT source, COALESCE(SUM(points), 0) as total
        FROM student_points_log
        GROUP BY source
        ORDER BY total DESC
      `),

      // 10. توزيع الدقة (histogram)
      pool.query(`
        SELECT bucket, COUNT(*) as student_count
        FROM (
          SELECT
            CASE
              WHEN accuracy < 10 THEN '0-10'
              WHEN accuracy < 20 THEN '10-20'
              WHEN accuracy < 30 THEN '20-30'
              WHEN accuracy < 40 THEN '30-40'
              WHEN accuracy < 50 THEN '40-50'
              WHEN accuracy < 60 THEN '50-60'
              WHEN accuracy < 70 THEN '60-70'
              WHEN accuracy < 80 THEN '70-80'
              WHEN accuracy < 90 THEN '80-90'
              ELSE '90-100'
            END as bucket
          FROM (
            SELECT user_id,
              ROUND(COUNT(*) FILTER (WHERE is_correct = true) * 100.0 / NULLIF(COUNT(*), 0)) as accuracy
            FROM student_exercise_progress
            GROUP BY user_id
            HAVING COUNT(*) >= 5
          ) sub
        ) sub2
        GROUP BY bucket
        ORDER BY bucket
      `),

      // 11. أكثر 10 تمارين حلاً
      pool.query(`
        SELECT e.id, e.title, e.type, COALESCE(e.difficulty, 'medium') as difficulty,
               COUNT(DISTINCT sep.user_id) as solvers,
               ROUND(COUNT(*) FILTER (WHERE sep.is_correct = true) * 100.0 / NULLIF(COUNT(*), 0)) as accuracy
        FROM exercises e
        JOIN student_exercise_progress sep ON sep.exercise_id = e.id
        GROUP BY e.id, e.title, e.type, e.difficulty
        ORDER BY solvers DESC
        LIMIT 10
      `),

      // 12. الدقة حسب نوع التمرين
      pool.query(`
        SELECT e.type,
               ROUND(COUNT(*) FILTER (WHERE sep.is_correct = true) * 100.0 / NULLIF(COUNT(*), 0)) as accuracy
        FROM exercises e
        JOIN student_exercise_progress sep ON sep.exercise_id = e.id
        GROUP BY e.type
        ORDER BY accuracy DESC
      `),

      // 13. الدقة حسب مستوى الصعوبة
      pool.query(`
        SELECT COALESCE(e.difficulty, 'medium') as difficulty,
               ROUND(COUNT(*) FILTER (WHERE sep.is_correct = true) * 100.0 / NULLIF(COUNT(*), 0)) as accuracy
        FROM exercises e
        JOIN student_exercise_progress sep ON sep.exercise_id = e.id
        GROUP BY e.difficulty
        ORDER BY e.difficulty
      `),

      // 14. نسبة إتمام التمارين
      pool.query(`
        SELECT
          (SELECT COUNT(*) FROM exercises WHERE is_published = true) as total_exercises,
          (SELECT COUNT(DISTINCT exercise_id) FROM student_exercise_progress) as attempted_exercises
      `),

      // 15. أفضل 20 طالب حسب النقاط
      pool.query(`
        SELECT
          u.id, u.name, u.avatar_url, COALESCE(u.points, 0) as points,
          COALESCE(
            (SELECT sdl.streak_day FROM student_daily_login sdl
             WHERE sdl.user_id = u.id ORDER BY sdl.login_date DESC LIMIT 1), 0
          ) as current_streak,
          COALESCE(
            (SELECT COUNT(*) FROM student_badges sb WHERE sb.user_id = u.id), 0
          ) as badges_count,
          COALESCE(
            (SELECT COUNT(DISTINCT exercise_id) FROM student_exercise_progress sep
             WHERE sep.user_id = u.id AND sep.is_correct = true), 0
          ) as exercises_solved,
          COALESCE(
            (SELECT ROUND(COUNT(*) FILTER (WHERE sep2.is_correct = true) * 100.0 /
              NULLIF(COUNT(*), 0))
             FROM student_exercise_progress sep2
             WHERE sep2.user_id = u.id), 0
          ) as accuracy
        FROM users u
        WHERE u.role = 'student'
        ORDER BY u.points DESC NULLS LAST
        LIMIT 20
      `),

      // 16. توزيع الشارات
      pool.query(`
        SELECT badge_type, COUNT(*) as count
        FROM student_badges
        GROUP BY badge_type
        ORDER BY count DESC
      `),
    ]);

    res.json({
      overview: {
        total_students: parseInt(totalStudents.rows[0].count),
        active_7_days: parseInt(active7.rows[0].count),
        active_30_days: parseInt(active30.rows[0].count),
        avg_daily_logins: parseInt(avgDailyLogins.rows[0]?.avg_logins || 0),
        total_points: parseInt(totalPoints.rows[0].total),
        popular_badge: popularBadge.rows[0] || null,
      },
      charts: {
        daily_active_users: dailyActiveUsers.rows,
        exercises_by_type: exercisesByType.rows,
        points_by_source: pointsBySource.rows,
        accuracy_distribution: accuracyDistribution.rows,
      },
      exercise_analytics: {
        top_exercises: topExercises.rows,
        accuracy_by_type: accuracyByType.rows,
        accuracy_by_difficulty: accuracyByDifficulty.rows,
        completion_rate: exerciseCompletionRate.rows[0],
      },
      top_students: topStudents.rows,
      badge_distribution: badgeDistribution.rows,
    });
  } catch (err) {
    console.error('Student analytics error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

module.exports = router;
