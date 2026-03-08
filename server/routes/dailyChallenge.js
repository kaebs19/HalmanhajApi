const express = require('express');
const { pool } = require('../config/db');
const { requireUserAuth } = require('../middleware/userAuth');
const { compareAnswer } = require('../utils/compareAnswer');
const { addToSpacedRepetition } = require('../utils/spacedRepetition');

const router = express.Router();

const DAILY_QUESTIONS_COUNT = 5;
const DAILY_CHALLENGE_XP = 20;


// ═══════════════════════════════════════════════════════
//                  التحدي اليومي
// ═══════════════════════════════════════════════════════

// 1. جلب أو إنشاء تحدي اليوم
router.get('/', requireUserAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    // جلب grade_id من ملف الطالب
    const userResult = await pool.query('SELECT grade_id FROM users WHERE id = $1', [userId]);
    const gradeId = userResult.rows[0]?.grade_id;
    if (!gradeId) {
      return res.status(400).json({ message: 'لم يتم تحديد صفك الدراسي' });
    }

    // تحقق: هل يوجد تحدي اليوم؟
    let challengeResult = await pool.query(
      'SELECT * FROM daily_challenges WHERE user_id = $1 AND challenge_date = CURRENT_DATE',
      [userId]
    );

    let challenge;

    if (challengeResult.rowCount > 0) {
      // تحدي موجود — جلبه مع الأسئلة
      challenge = challengeResult.rows[0];
    } else {
      // إنشاء تحدي جديد — اختيار 5 أسئلة عشوائية من تمارين منشورة حسب الصف
      const questionsResult = await pool.query(`
        SELECT eq.id
        FROM exercise_questions eq
        JOIN exercises e ON e.id = eq.exercise_id
        WHERE e.is_published = true AND e.grade_id = $1
        ORDER BY RANDOM()
        LIMIT $2
      `, [gradeId, DAILY_QUESTIONS_COUNT]);

      const questionIds = questionsResult.rows.map(r => r.id);

      if (questionIds.length === 0) {
        return res.json({
          challenge: null,
          questions: [],
          message: 'لا توجد أسئلة متاحة لصفك الدراسي',
        });
      }

      // إنشاء التحدي
      const insertResult = await pool.query(`
        INSERT INTO daily_challenges (user_id, challenge_date, question_ids)
        VALUES ($1, CURRENT_DATE, $2)
        ON CONFLICT (user_id, challenge_date) DO NOTHING
        RETURNING *
      `, [userId, questionIds]);

      if (insertResult.rowCount > 0) {
        challenge = insertResult.rows[0];
      } else {
        // Race condition — جلب التحدي الموجود
        challengeResult = await pool.query(
          'SELECT * FROM daily_challenges WHERE user_id = $1 AND challenge_date = CURRENT_DATE',
          [userId]
        );
        challenge = challengeResult.rows[0];
      }
    }

    // جلب بيانات الأسئلة (بدون الإجابة الصحيحة)
    const questionIds = challenge.question_ids || [];
    let questions = [];

    if (questionIds.length > 0) {
      const questionsResult = await pool.query(`
        SELECT eq.id, eq.question_text, eq.question_data,
          e.type as exercise_type, e.title as exercise_title
        FROM exercise_questions eq
        JOIN exercises e ON e.id = eq.exercise_id
        WHERE eq.id = ANY($1)
      `, [questionIds]);

      // إزالة الإجابة الصحيحة
      questions = questionsResult.rows.map(row => {
        const data = row.question_data || {};
        const { correct_answer, ...safeData } = data;
        return { ...row, question_data: safeData };
      });

      // ترتيب حسب الترتيب الأصلي في question_ids
      const orderMap = {};
      questionIds.forEach((id, idx) => { orderMap[id] = idx; });
      questions.sort((a, b) => (orderMap[a.id] ?? 999) - (orderMap[b.id] ?? 999));
    }

    res.json({
      challenge: {
        id: challenge.id,
        challenge_date: challenge.challenge_date,
        completed_count: challenge.completed_count,
        is_completed: challenge.is_completed,
        xp_earned: challenge.xp_earned,
        total_questions: questionIds.length,
      },
      questions,
    });
  } catch (err) {
    console.error('GET /daily-challenge error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// 2. إجابة سؤال من التحدي اليومي
router.post('/answer', requireUserAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { question_id, answer } = req.body;

    if (!question_id || answer === undefined) {
      return res.status(400).json({ message: 'معرف السؤال والإجابة مطلوبان' });
    }

    // جلب تحدي اليوم
    const challengeResult = await pool.query(
      'SELECT * FROM daily_challenges WHERE user_id = $1 AND challenge_date = CURRENT_DATE',
      [userId]
    );
    if (challengeResult.rowCount === 0) {
      return res.status(400).json({ message: 'لا يوجد تحدي لهذا اليوم' });
    }
    const challenge = challengeResult.rows[0];

    if (challenge.is_completed) {
      return res.status(400).json({ message: 'التحدي مكتمل بالفعل' });
    }

    // تحقق أن السؤال ضمن أسئلة التحدي
    const questionIds = challenge.question_ids || [];
    if (!questionIds.includes(question_id)) {
      return res.status(400).json({ message: 'هذا السؤال ليس ضمن تحدي اليوم' });
    }

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

    // إذا صحيحة: تحديث completed_count
    let completedCount = challenge.completed_count;
    let isCompleted = challenge.is_completed;
    let xpEarned = challenge.xp_earned;

    if (isCorrect) {
      completedCount += 1;

      // هل أكمل التحدي؟
      if (completedCount >= DAILY_QUESTIONS_COUNT) {
        isCompleted = true;
        xpEarned = DAILY_CHALLENGE_XP;

        // إضافة XP للطالب
        await pool.query(
          'UPDATE users SET xp = COALESCE(xp, 0) + $1 WHERE id = $2',
          [DAILY_CHALLENGE_XP, userId]
        );

        // تسجيل في points_log
        try {
          await pool.query(`
            INSERT INTO student_points_log (user_id, points, reason)
            VALUES ($1, $2, $3)
          `, [userId, DAILY_CHALLENGE_XP, 'إكمال التحدي اليومي']);
        } catch (logErr) {
          console.error('points_log error:', logErr.message);
        }
      }

      // تحديث التحدي
      await pool.query(`
        UPDATE daily_challenges SET
          completed_count = $1,
          is_completed = $2,
          xp_earned = $3
        WHERE id = $4
      `, [completedCount, isCompleted, xpEarned, challenge.id]);
    } else {
      // إضافة للتكرار المتباعد عند الخطأ
      try {
        await addToSpacedRepetition(userId, question_id);
      } catch (srErr) {
        console.error('spaced rep error:', srErr.message);
      }
    }

    // بناء الرد
    const response = {
      correct: isCorrect,
      completed_count: completedCount,
      total_questions: DAILY_QUESTIONS_COUNT,
      is_completed: isCompleted,
    };

    if (!isCorrect) {
      response.correct_answer = correctAnswer;
    }

    if (isCompleted && completedCount === DAILY_QUESTIONS_COUNT) {
      response.xp_earned = DAILY_CHALLENGE_XP;
      response.message = 'أحسنت! أكملت تحدي اليوم 🎉';
    }

    res.json(response);
  } catch (err) {
    console.error('POST /daily-challenge/answer error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});


module.exports = router;
