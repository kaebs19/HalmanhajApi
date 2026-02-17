const express = require('express');
const { pool } = require('../config/db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// إحصائيات لوحة التحكم
router.get('/', async (req, res) => {
  try {
    const [stages, tracks, grades, subjects, lessons, quizzes, faqs, views, users, communityQuestions] = await Promise.all([
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
    });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

module.exports = router;
