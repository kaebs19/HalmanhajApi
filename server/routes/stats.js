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

// بحث شامل في لوحة التحكم
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.json({ exercises: [], units: [], subjects: [], lessons: [] });
    }
    const term = `%${q.trim()}%`;

    const [exercises, units, subjects, lessons] = await Promise.all([
      pool.query(
        `SELECT e.id, e.title, e.type, e.is_published, e.difficulty,
          (SELECT COUNT(*) FROM exercise_questions eq WHERE eq.exercise_id = e.id) as questions_count,
          s.name as subject_name, eu.title as unit_title
        FROM exercises e
        LEFT JOIN subjects s ON s.id = e.subject_id
        LEFT JOIN exercise_units eu ON eu.id = e.unit_id
        WHERE e.title ILIKE $1
        ORDER BY e.updated_at DESC LIMIT 10`,
        [term]
      ),
      pool.query(
        `SELECT eu.id, eu.title, eu.order_index, s.name as subject_name,
          (SELECT COUNT(*) FROM exercises ex WHERE ex.unit_id = eu.id) as exercise_count
        FROM exercise_units eu
        LEFT JOIN subjects s ON s.id = eu.subject_id
        WHERE eu.title ILIKE $1
        ORDER BY eu.order_index LIMIT 10`,
        [term]
      ),
      pool.query(
        `SELECT id, name, icon FROM subjects WHERE name ILIKE $1 LIMIT 5`,
        [term]
      ),
      pool.query(
        `SELECT l.id, l.title, s.name as subject_name
        FROM lessons l
        LEFT JOIN subjects s ON s.id = l.subject_id
        WHERE l.title ILIKE $1
        ORDER BY l.updated_at DESC LIMIT 5`,
        [term]
      ),
    ]);

    res.json({
      exercises: exercises.rows,
      units: units.rows,
      subjects: subjects.rows,
      lessons: lessons.rows,
    });
  } catch (err) {
    console.error('GET /stats/search error:', err);
    res.status(500).json({ message: 'خطأ في البحث' });
  }
});

// تنبيهات ذكية + فحص جودة المحتوى
router.get('/alerts', async (req, res) => {
  try {
    const [
      exercisesNoQuestions, emptyUnits, subjectsNoExercises,
      singleQuestionExercises, publishedNoQuestions,
      pendingReports, lowAccuracy,
    ] = await Promise.all([
      // تمارين بدون أسئلة
      pool.query(`SELECT e.id, e.title, e.type, s.name as subject_name
        FROM exercises e LEFT JOIN subjects s ON s.id = e.subject_id
        LEFT JOIN exercise_questions eq ON eq.exercise_id = e.id
        WHERE eq.id IS NULL ORDER BY e.created_at DESC LIMIT 20`),
      // وحدات فارغة
      pool.query(`SELECT eu.id, eu.title, s.name as subject_name
        FROM exercise_units eu LEFT JOIN subjects s ON s.id = eu.subject_id
        LEFT JOIN exercises ex ON ex.unit_id = eu.id
        WHERE ex.id IS NULL LIMIT 10`),
      // مواد بدون تمارين
      pool.query(`SELECT s.id, s.name, s.icon
        FROM subjects s LEFT JOIN exercises e ON e.subject_id = s.id
        WHERE e.id IS NULL LIMIT 10`),
      // تمارين بسؤال واحد فقط
      pool.query(`SELECT e.id, e.title, e.type, s.name as subject_name
        FROM exercises e LEFT JOIN subjects s ON s.id = e.subject_id
        JOIN (SELECT exercise_id, COUNT(*) as cnt FROM exercise_questions GROUP BY exercise_id HAVING COUNT(*) = 1) q ON q.exercise_id = e.id
        WHERE e.is_published = true LIMIT 10`),
      // تمارين منشورة بدون أسئلة
      pool.query(`SELECT e.id, e.title FROM exercises e
        LEFT JOIN exercise_questions eq ON eq.exercise_id = e.id
        WHERE e.is_published = true AND eq.id IS NULL LIMIT 10`),
      // بلاغات معلقة
      pool.query("SELECT COUNT(*) FROM question_reports WHERE status = 'pending'"),
      // تمارين بنسبة صحيحة أقل من 20%
      pool.query(`SELECT e.id, e.title, e.type,
        ROUND(COUNT(*) FILTER (WHERE sep.is_correct = true)::numeric / NULLIF(COUNT(*), 0) * 100) as accuracy
        FROM exercises e
        JOIN exercise_questions eq ON eq.exercise_id = e.id
        JOIN student_exercise_progress sep ON sep.question_id = eq.id
        GROUP BY e.id, e.title, e.type
        HAVING COUNT(*) >= 10 AND COUNT(*) FILTER (WHERE sep.is_correct = true)::numeric / NULLIF(COUNT(*), 0) * 100 < 20
        ORDER BY accuracy LIMIT 5`),
    ]);

    res.json({
      exercises_no_questions: exercisesNoQuestions.rows,
      empty_units: emptyUnits.rows,
      subjects_no_exercises: subjectsNoExercises.rows,
      single_question_exercises: singleQuestionExercises.rows,
      published_no_questions: publishedNoQuestions.rows,
      pending_reports: parseInt(pendingReports.rows[0].count),
      low_accuracy_exercises: lowAccuracy.rows,
    });
  } catch (err) {
    console.error('GET /stats/alerts error:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// إحصائيات أسبوعية مع مقارنة
router.get('/weekly', async (req, res) => {
  try {
    const [
      thisWeekUsers, lastWeekUsers,
      thisWeekActive, lastWeekActive,
      thisWeekExercises, lastWeekExercises,
      thisWeekAttempts, lastWeekAttempts,
      dailyActivity,
    ] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM users WHERE created_at >= date_trunc('week', CURRENT_DATE)"),
      pool.query("SELECT COUNT(*) FROM users WHERE created_at >= date_trunc('week', CURRENT_DATE) - INTERVAL '7 days' AND created_at < date_trunc('week', CURRENT_DATE)"),
      pool.query("SELECT COUNT(DISTINCT user_id) FROM student_daily_login WHERE login_date >= date_trunc('week', CURRENT_DATE)"),
      pool.query("SELECT COUNT(DISTINCT user_id) FROM student_daily_login WHERE login_date >= date_trunc('week', CURRENT_DATE) - INTERVAL '7 days' AND login_date < date_trunc('week', CURRENT_DATE)"),
      pool.query("SELECT COUNT(*) FROM exercises WHERE created_at >= date_trunc('week', CURRENT_DATE)"),
      pool.query("SELECT COUNT(*) FROM exercises WHERE created_at >= date_trunc('week', CURRENT_DATE) - INTERVAL '7 days' AND created_at < date_trunc('week', CURRENT_DATE)"),
      pool.query("SELECT COUNT(*) FROM student_exercise_progress WHERE completed_at >= date_trunc('week', CURRENT_DATE)"),
      pool.query("SELECT COUNT(*) FROM student_exercise_progress WHERE completed_at >= date_trunc('week', CURRENT_DATE) - INTERVAL '7 days' AND completed_at < date_trunc('week', CURRENT_DATE)"),
      // نشاط يومي لآخر 14 يوم
      pool.query(`SELECT login_date::text as date, COUNT(DISTINCT user_id) as active_users
        FROM student_daily_login
        WHERE login_date >= CURRENT_DATE - INTERVAL '14 days'
        GROUP BY login_date ORDER BY login_date`),
    ]);

    const p = (r) => parseInt(r.rows[0].count);
    const change = (curr, prev) => prev > 0 ? Math.round(((curr - prev) / prev) * 100) : curr > 0 ? 100 : 0;

    res.json({
      this_week: {
        new_users: p(thisWeekUsers),
        active_users: p(thisWeekActive),
        new_exercises: p(thisWeekExercises),
        attempts: p(thisWeekAttempts),
      },
      last_week: {
        new_users: p(lastWeekUsers),
        active_users: p(lastWeekActive),
        new_exercises: p(lastWeekExercises),
        attempts: p(lastWeekAttempts),
      },
      changes: {
        new_users: change(p(thisWeekUsers), p(lastWeekUsers)),
        active_users: change(p(thisWeekActive), p(lastWeekActive)),
        new_exercises: change(p(thisWeekExercises), p(lastWeekExercises)),
        attempts: change(p(thisWeekAttempts), p(lastWeekAttempts)),
      },
      daily_activity: dailyActivity.rows,
    });
  } catch (err) {
    console.error('GET /stats/weekly error:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

module.exports = router;
