const express = require('express');
const { pool } = require('../config/db');
const { requireUserAuth } = require('../middleware/userAuth');
const { compareAnswer } = require('../utils/compareAnswer');
const { getNextInterval } = require('../utils/spacedRepetition');

const router = express.Router();


// ═══════════════════════════════════════════════════════
//              مسارات التكرار المتباعد
// ═══════════════════════════════════════════════════════

// 1. جلب الأسئلة المستحقة للمراجعة
router.get('/due', requireUserAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(`
      SELECT sr.id, sr.question_id, sr.interval_days, sr.correct_streak, sr.total_attempts,
        sr.next_review_at,
        eq.question_text, eq.question_data,
        e.id as exercise_id, e.title as exercise_title, e.type as exercise_type
      FROM spaced_repetition sr
      JOIN exercise_questions eq ON eq.id = sr.question_id
      JOIN exercises e ON e.id = eq.exercise_id
      WHERE sr.user_id = $1 AND sr.next_review_at <= NOW()
      ORDER BY sr.next_review_at
      LIMIT 10
    `, [userId]);

    // إزالة الإجابة الصحيحة من question_data
    const questions = result.rows.map(row => {
      const data = row.question_data || {};
      const { correct_answer, ...safeData } = data;
      return { ...row, question_data: safeData };
    });

    res.json({
      due_count: questions.length,
      questions,
    });
  } catch (err) {
    console.error('GET /review/due error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// 2. إجابة سؤال مراجعة
router.post('/answer', requireUserAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { question_id, answer } = req.body;

    if (!question_id || answer === undefined) {
      return res.status(400).json({ message: 'معرف السؤال والإجابة مطلوبان' });
    }

    // جلب سجل التكرار المتباعد
    const srResult = await pool.query(
      'SELECT * FROM spaced_repetition WHERE user_id = $1 AND question_id = $2',
      [userId, question_id]
    );
    if (srResult.rowCount === 0) {
      return res.status(404).json({ message: 'السؤال غير موجود في المراجعة' });
    }
    const sr = srResult.rows[0];

    // جلب السؤال والإجابة الصحيحة
    const questionResult = await pool.query(`
      SELECT eq.question_data, e.type
      FROM exercise_questions eq
      JOIN exercises e ON e.id = eq.exercise_id
      WHERE eq.id = $1
    `, [question_id]);

    if (questionResult.rowCount === 0) {
      return res.status(404).json({ message: 'السؤال غير موجود' });
    }

    const { question_data, type } = questionResult.rows[0];
    const correctAnswer = question_data?.correct_answer;

    // مقارنة الإجابة
    const isCorrect = compareAnswer(type, answer, correctAnswer);

    // حساب الفترة الجديدة
    const newInterval = getNextInterval(sr.interval_days, isCorrect);
    const newStreak = isCorrect ? sr.correct_streak + 1 : 0;

    // تحديث سجل التكرار المتباعد
    await pool.query(`
      UPDATE spaced_repetition SET
        next_review_at = NOW() + ($1 || ' days')::INTERVAL,
        interval_days = $1,
        correct_streak = $2,
        total_attempts = total_attempts + 1,
        updated_at = NOW()
      WHERE user_id = $3 AND question_id = $4
    `, [newInterval, newStreak, userId, question_id]);

    // بناء الرد
    const response = {
      correct: isCorrect,
      new_interval_days: newInterval,
      correct_streak: newStreak,
      total_attempts: sr.total_attempts + 1,
    };

    // إذا كانت الإجابة خاطئة، أرسل الإجابة الصحيحة
    if (!isCorrect) {
      response.correct_answer = correctAnswer;
    }

    // إذا وصل الطالب لنهاية الفترات (30 يوم) → يمكن اعتباره متقناً
    if (isCorrect && newInterval >= 30) {
      response.mastered = true;
      response.message = 'أحسنت! لقد أتقنت هذا السؤال 🎉';
    }

    res.json(response);
  } catch (err) {
    console.error('POST /review/answer error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// 3. إحصائيات المراجعة
router.get('/stats', requireUserAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(`
      SELECT
        COUNT(*) as total_questions,
        COUNT(*) FILTER (WHERE next_review_at <= NOW()) as due_now,
        COUNT(*) FILTER (WHERE interval_days >= 30) as mastered,
        COUNT(*) FILTER (WHERE correct_streak = 0) as struggling,
        COALESCE(SUM(total_attempts), 0) as total_attempts
      FROM spaced_repetition
      WHERE user_id = $1
    `, [userId]);

    const stats = result.rows[0];

    res.json({
      total_questions: parseInt(stats.total_questions),
      due_now: parseInt(stats.due_now),
      mastered: parseInt(stats.mastered),
      struggling: parseInt(stats.struggling),
      total_attempts: parseInt(stats.total_attempts),
    });
  } catch (err) {
    console.error('GET /review/stats error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});


module.exports = router;
