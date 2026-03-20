const express = require('express');
const { pool } = require('../config/db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// إحصائيات لوحة التحكم
router.get('/', async (req, res) => {
  try {
    const [stages, tracks, grades, subjects, lessons, quizzes, faqs, views, users, communityQuestions, exercises] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM stages'),
      pool.query('SELECT COUNT(*) as count FROM tracks'),
      pool.query('SELECT COUNT(*) as count FROM grades'),
      pool.query('SELECT COUNT(*) as count FROM subjects'),
      pool.query('SELECT COUNT(*) as count FROM lessons'),
      pool.query('SELECT COUNT(*) as count FROM quizzes'),
      pool.query('SELECT COUNT(*) as count FROM faqs'),
      pool.query('SELECT COALESCE(SUM(views), 0) as total FROM lessons'),
      pool.query('SELECT COUNT(*) as count FROM users'),
      pool.query('SELECT COUNT(*) as count FROM community_questions'),
      pool.query('SELECT COUNT(*) as count FROM exercises'),
    ]);

    res.json({
      stages: parseInt(stages.rows[0].count),
      tracks: parseInt(tracks.rows[0].count),
      grades: parseInt(grades.rows[0].count),
      subjects: parseInt(subjects.rows[0].count),
      lessons: parseInt(lessons.rows[0].count),
      quizzes: parseInt(quizzes.rows[0].count),
      faqs: parseInt(faqs.rows[0].count),
      views: parseInt(views.rows[0].total),
      users: parseInt(users.rows[0].count),
      community_questions: parseInt(communityQuestions.rows[0].count),
      exercises: parseInt(exercises.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// إحصائيات متقدمة للوحة التحكم
router.get('/enhanced', async (req, res) => {
  try {
    const [
      newUsersToday, newUsersWeek, activeToday,
      publishedExercises, unpublishedExercises, totalQuestions,
      exerciseAccuracy, hardestExercises, topStudents,
      recentExercises, recentUsers, pendingReports,
      fcmDevices, notifsSentToday,
    ] = await Promise.all([
      // مستخدمين جدد اليوم
      pool.query("SELECT COUNT(*) FROM users WHERE created_at >= CURRENT_DATE"),
      // مستخدمين جدد هذا الأسبوع
      pool.query("SELECT COUNT(*) FROM users WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'"),
      // نشطين اليوم
      pool.query("SELECT COUNT(DISTINCT user_id) FROM student_daily_login WHERE login_date = CURRENT_DATE"),
      // تمارين منشورة
      pool.query("SELECT COUNT(*) FROM exercises WHERE is_published = true"),
      // تمارين غير منشورة
      pool.query("SELECT COUNT(*) FROM exercises WHERE is_published = false"),
      // إجمالي الأسئلة
      pool.query("SELECT COUNT(*) FROM exercise_questions"),
      // نسبة الإجابات الصحيحة الإجمالية
      pool.query(`SELECT
        COUNT(*) FILTER (WHERE is_correct = true) as correct,
        COUNT(*) as total
        FROM student_exercise_progress`),
      // أصعب 5 تمارين (أقل نسبة صحيحة)
      pool.query(`SELECT e.id, e.title, e.type, e.difficulty,
        COUNT(*) FILTER (WHERE sep.is_correct = true) as correct_count,
        COUNT(*) as total_attempts,
        ROUND(COUNT(*) FILTER (WHERE sep.is_correct = true)::numeric / NULLIF(COUNT(*), 0) * 100) as accuracy
        FROM exercises e
        JOIN exercise_questions eq ON eq.exercise_id = e.id
        JOIN student_exercise_progress sep ON sep.question_id = eq.id
        GROUP BY e.id, e.title, e.type, e.difficulty
        HAVING COUNT(*) >= 5
        ORDER BY accuracy ASC NULLS LAST
        LIMIT 5`),
      // أنشط 5 طلاب
      pool.query(`SELECT u.id, u.name, u.points,
        COUNT(DISTINCT sep.exercise_id) as exercises_solved
        FROM users u
        JOIN student_exercise_progress sep ON sep.user_id = u.id AND sep.is_correct = true
        GROUP BY u.id, u.name, u.points
        ORDER BY u.points DESC
        LIMIT 5`),
      // آخر 5 تمارين مضافة
      pool.query(`SELECT id, title, type, difficulty, is_published, created_at
        FROM exercises ORDER BY created_at DESC LIMIT 5`),
      // آخر 5 مستخدمين مسجلين
      pool.query(`SELECT id, name, email, created_at FROM users ORDER BY created_at DESC LIMIT 5`),
      // بلاغات معلّقة
      pool.query("SELECT COUNT(*) FROM question_reports WHERE status = 'pending'"),
      // أجهزة FCM مسجلة
      pool.query("SELECT COUNT(DISTINCT user_id) FROM fcm_tokens"),
      // إشعارات مرسلة اليوم
      pool.query("SELECT COUNT(*) FROM notifications_log WHERE sent_at >= CURRENT_DATE"),
    ]);

    const acc = exerciseAccuracy.rows[0];
    const accuracyPct = acc.total > 0 ? Math.round((acc.correct / acc.total) * 100) : 0;

    res.json({
      users: {
        new_today: parseInt(newUsersToday.rows[0].count),
        new_week: parseInt(newUsersWeek.rows[0].count),
        active_today: parseInt(activeToday.rows[0].count),
      },
      exercises: {
        published: parseInt(publishedExercises.rows[0].count),
        unpublished: parseInt(unpublishedExercises.rows[0].count),
        total_questions: parseInt(totalQuestions.rows[0].count),
        overall_accuracy: accuracyPct,
      },
      hardest_exercises: hardestExercises.rows,
      top_students: topStudents.rows,
      recent_exercises: recentExercises.rows,
      recent_users: recentUsers.rows,
      alerts: {
        pending_reports: parseInt(pendingReports.rows[0].count),
        fcm_devices: parseInt(fcmDevices.rows[0].count),
        notifs_sent_today: parseInt(notifsSentToday.rows[0].count),
      },
    });
  } catch (err) {
    console.error('خطأ في الإحصائيات المتقدمة:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

module.exports = router;
