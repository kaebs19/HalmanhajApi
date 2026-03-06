const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const authMiddleware = require('../middleware/auth');
const { requireUserAuth } = require('../middleware/userAuth');
const { sendPushNotification } = require('../services/pushNotification');

const router = express.Router();

// ═══════════════════════════════════════
// Middleware: يقبل admin أو student
// ═══════════════════════════════════════
const requireAnyAuth = (req, res, next) => {
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

// ═══════════════════════════════════════
// Helper: مقارنة إجابة الطالب بالإجابة الصحيحة
// حسب نوع التمرين
// ═══════════════════════════════════════
function compareAnswer(type, userAnswer, correctAnswer) {
  try {
    switch (type) {
      case 'true_false':
        return userAnswer === correctAnswer.value;

      case 'mcq':
        return Number(userAnswer) === Number(correctAnswer.index);

      case 'fill_blank': {
        const userText = String(userAnswer).toLowerCase().trim();
        const correctValues = correctAnswer.values || [correctAnswer.value || ''];
        return correctValues.some(v => String(v).toLowerCase().trim() === userText);
      }

      case 'matching': {
        // مقارنة أزواج التوصيل (ترتيب غير مهم)
        const userPairs = Array.isArray(userAnswer) ? [...userAnswer] : [];
        const correctPairs = Array.isArray(correctAnswer.pairs) ? [...correctAnswer.pairs] : [];
        if (userPairs.length !== correctPairs.length) return false;
        const sortFn = (a, b) => JSON.stringify(a) < JSON.stringify(b) ? -1 : 1;
        userPairs.sort(sortFn);
        correctPairs.sort(sortFn);
        return JSON.stringify(userPairs) === JSON.stringify(correctPairs);
      }

      case 'ordering': {
        // مقارنة الترتيب (نفس الترتيب بالضبط)
        const userOrder = Array.isArray(userAnswer) ? userAnswer : [];
        const correctOrder = Array.isArray(correctAnswer.items) ? correctAnswer.items : [];
        if (userOrder.length !== correctOrder.length) return false;
        return userOrder.every((item, i) => String(item) === String(correctOrder[i]));
      }

      case 'classify': {
        // مقارنة التصنيف (ترتيب العناصر داخل كل فئة غير مهم)
        const userGroups = typeof userAnswer === 'object' ? userAnswer : {};
        const correctGroups = typeof correctAnswer.groups === 'object' ? correctAnswer.groups : {};
        const userKeys = Object.keys(userGroups).sort();
        const correctKeys = Object.keys(correctGroups).sort();
        if (JSON.stringify(userKeys) !== JSON.stringify(correctKeys)) return false;
        return correctKeys.every(key => {
          const userItems = Array.isArray(userGroups[key]) ? [...userGroups[key]].sort() : [];
          const correctItems = Array.isArray(correctGroups[key]) ? [...correctGroups[key]].sort() : [];
          return JSON.stringify(userItems) === JSON.stringify(correctItems);
        });
      }

      case 'image_match': {
        // مقارنة أزواج صور (ترتيب غير مهم)
        const userMatchPairs = Array.isArray(userAnswer) ? [...userAnswer] : [];
        const correctMatchPairs = Array.isArray(correctAnswer.pairs) ? [...correctAnswer.pairs] : [];
        if (userMatchPairs.length !== correctMatchPairs.length) return false;
        const sortPairs = (a, b) => JSON.stringify(a) < JSON.stringify(b) ? -1 : 1;
        userMatchPairs.sort(sortPairs);
        correctMatchPairs.sort(sortPairs);
        return JSON.stringify(userMatchPairs) === JSON.stringify(correctMatchPairs);
      }

      case 'speed':
        // سرعة: نفس منطق mcq
        return Number(userAnswer) === Number(correctAnswer.index);

      case 'read_answer':
        // اقرأ وأجب: نفس منطق fill_blank
        return String(userAnswer).toLowerCase().trim() === String(correctAnswer.value || '').toLowerCase().trim();

      default:
        // مقارنة عامة
        return JSON.stringify(userAnswer) === JSON.stringify(correctAnswer.value);
    }
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════
//                    مسارات الأدمن
// ═══════════════════════════════════════════════════════

// ═══════════════════════════════════════
// 1. إنشاء تمرين
// ═══════════════════════════════════════
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { lesson_id, title, description, type, xp_reward, time_limit } = req.body;

    if (!lesson_id || !title || !type) {
      return res.status(400).json({ message: 'معرف الدرس والعنوان والنوع مطلوبة' });
    }

    // التحقق من وجود الدرس
    const lessonCheck = await pool.query('SELECT id FROM lessons WHERE id = $1', [lesson_id]);
    if (lessonCheck.rowCount === 0) {
      return res.status(404).json({ message: 'الدرس غير موجود' });
    }

    const validTypes = ['true_false', 'mcq', 'fill_blank', 'matching', 'ordering', 'classify', 'speed', 'read_answer', 'image_match'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: 'نوع التمرين غير صالح' });
    }

    const result = await pool.query(
      `INSERT INTO exercises (lesson_id, title, description, type, xp_reward, time_limit)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [lesson_id, title, description || null, type, xp_reward || 10, time_limit || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /exercises error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// 2. تعديل تمرين
// ═══════════════════════════════════════
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { title, description, xp_reward, time_limit, is_published } = req.body;

    if (!title) {
      return res.status(400).json({ message: 'عنوان التمرين مطلوب' });
    }

    const result = await pool.query(
      `UPDATE exercises SET
        title = $1, description = $2, xp_reward = $3, time_limit = $4, is_published = $5, updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [
        title,
        description || null,
        xp_reward || 10,
        time_limit || null,
        is_published !== undefined ? is_published : false,
        req.params.id
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'التمرين غير موجود' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /exercises/:id error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// 3. حذف تمرين (CASCADE يحذف الأسئلة والتقدم)
// ═══════════════════════════════════════
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM exercises WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'التمرين غير موجود' });
    }
    res.json({ message: 'تم حذف التمرين بنجاح' });
  } catch (err) {
    console.error('DELETE /exercises/:id error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// 4. إضافة سؤال لتمرين
// ═══════════════════════════════════════
router.post('/:id/questions', authMiddleware, async (req, res) => {
  try {
    const exerciseId = req.params.id;
    const { question_text, question_image, question_data, correct_answer, order_index } = req.body;

    // التحقق من وجود التمرين
    const exerciseCheck = await pool.query('SELECT id FROM exercises WHERE id = $1', [exerciseId]);
    if (exerciseCheck.rowCount === 0) {
      return res.status(404).json({ message: 'التمرين غير موجود' });
    }

    // حساب order_index تلقائياً إذا لم يُرسل
    let finalOrderIndex = order_index;
    if (finalOrderIndex === undefined || finalOrderIndex === null) {
      const maxOrder = await pool.query(
        'SELECT COALESCE(MAX(order_index), -1) + 1 as next FROM exercise_questions WHERE exercise_id = $1',
        [exerciseId]
      );
      finalOrderIndex = maxOrder.rows[0].next;
    }

    const parsedData = typeof question_data === 'string' ? JSON.parse(question_data) : (question_data || {});
    const parsedAnswer = typeof correct_answer === 'string' ? JSON.parse(correct_answer) : (correct_answer || {});

    const result = await pool.query(
      `INSERT INTO exercise_questions (exercise_id, question_text, question_image, question_data, correct_answer, order_index)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        exerciseId,
        question_text || null,
        question_image || null,
        JSON.stringify(parsedData),
        JSON.stringify(parsedAnswer),
        finalOrderIndex
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /exercises/:id/questions error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// 5. تعديل سؤال
// ═══════════════════════════════════════
router.put('/:id/questions/:qid', authMiddleware, async (req, res) => {
  try {
    const { question_text, question_image, question_data, correct_answer, order_index } = req.body;

    const parsedData = typeof question_data === 'string' ? JSON.parse(question_data) : (question_data || {});
    const parsedAnswer = typeof correct_answer === 'string' ? JSON.parse(correct_answer) : (correct_answer || {});

    const result = await pool.query(
      `UPDATE exercise_questions SET
        question_text = $1, question_image = $2, question_data = $3, correct_answer = $4, order_index = $5
       WHERE id = $6 AND exercise_id = $7 RETURNING *`,
      [
        question_text || null,
        question_image || null,
        JSON.stringify(parsedData),
        JSON.stringify(parsedAnswer),
        order_index || 0,
        req.params.qid,
        req.params.id
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'السؤال غير موجود' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /exercises/:id/questions/:qid error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// 6. حذف سؤال
// ═══════════════════════════════════════
router.delete('/:id/questions/:qid', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM exercise_questions WHERE id = $1 AND exercise_id = $2',
      [req.params.qid, req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'السؤال غير موجود' });
    }

    res.json({ message: 'تم حذف السؤال بنجاح' });
  } catch (err) {
    console.error('DELETE /exercises/:id/questions/:qid error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// 7. تبديل حالة النشر
// ═══════════════════════════════════════
router.patch('/:id/publish', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE exercises SET is_published = NOT is_published, updated_at = NOW()
       WHERE id = $1 RETURNING is_published`,
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'التمرين غير موجود' });
    }

    res.json({ is_published: result.rows[0].is_published });
  } catch (err) {
    console.error('PATCH /exercises/:id/publish error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════════════════════
//             مسارات الطلاب / العامة
// ═══════════════════════════════════════════════════════

// ═══════════════════════════════════════
// 8. جلب تمارين درس معين
// ═══════════════════════════════════════
router.get('/lesson/:lessonId', requireAnyAuth, async (req, res) => {
  try {
    const { lessonId } = req.params;
    const isAdmin = !!req.admin;

    let query = `
      SELECT e.*,
        (SELECT COUNT(*) FROM exercise_questions eq WHERE eq.exercise_id = e.id) as questions_count
      FROM exercises e
      WHERE e.lesson_id = $1
    `;

    // الطالب يرى المنشورة فقط
    if (!isAdmin) {
      query += ' AND e.is_published = true';
    }

    query += ' ORDER BY e.created_at ASC';

    const result = await pool.query(query, [lessonId]);
    res.json(result.rows);
  } catch (err) {
    console.error('GET /exercises/lesson/:lessonId error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// 9. جلب تمرين واحد مع أسئلته
// ═══════════════════════════════════════
router.get('/:id', requireAnyAuth, async (req, res) => {
  try {
    const isAdmin = !!req.admin;

    let exerciseQuery = 'SELECT * FROM exercises WHERE id = $1';
    if (!isAdmin) {
      exerciseQuery += ' AND is_published = true';
    }

    const exerciseResult = await pool.query(exerciseQuery, [req.params.id]);
    if (exerciseResult.rowCount === 0) {
      return res.status(404).json({ message: 'التمرين غير موجود' });
    }

    const exercise = exerciseResult.rows[0];

    // جلب الأسئلة مرتبة
    const questionsResult = await pool.query(
      'SELECT * FROM exercise_questions WHERE exercise_id = $1 ORDER BY order_index ASC',
      [exercise.id]
    );

    // الطالب: حذف correct_answer من الأسئلة
    if (!isAdmin) {
      exercise.questions = questionsResult.rows.map(q => {
        const { correct_answer, ...rest } = q;
        return rest;
      });
    } else {
      exercise.questions = questionsResult.rows;
    }

    res.json(exercise);
  } catch (err) {
    console.error('GET /exercises/:id error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// 10. إرسال إجابة (طالب فقط)
// ═══════════════════════════════════════
router.post('/:id/answer', requireUserAuth, async (req, res) => {
  try {
    const exerciseId = req.params.id;
    const userId = req.user.id;
    const { question_id, answer } = req.body;

    if (!question_id || answer === undefined) {
      return res.status(400).json({ message: 'معرف السؤال والإجابة مطلوبة' });
    }

    // جلب التمرين
    const exerciseResult = await pool.query(
      'SELECT type, xp_reward FROM exercises WHERE id = $1 AND is_published = true',
      [exerciseId]
    );
    if (exerciseResult.rowCount === 0) {
      return res.status(404).json({ message: 'التمرين غير موجود' });
    }
    const exercise = exerciseResult.rows[0];

    // جلب السؤال مع الإجابة الصحيحة
    const questionResult = await pool.query(
      'SELECT correct_answer FROM exercise_questions WHERE id = $1 AND exercise_id = $2',
      [question_id, exerciseId]
    );
    if (questionResult.rowCount === 0) {
      return res.status(404).json({ message: 'السؤال غير موجود' });
    }

    const correctAnswer = questionResult.rows[0].correct_answer;
    const isCorrect = compareAnswer(exercise.type, answer, correctAnswer);

    // البحث عن سجل سابق
    const existingProgress = await pool.query(
      'SELECT id, attempts, is_correct FROM student_exercise_progress WHERE user_id = $1 AND exercise_id = $2 AND question_id = $3',
      [userId, exerciseId, question_id]
    );

    let attempts = 1;
    let xpGained = 0;

    if (existingProgress.rowCount === 0) {
      // أول محاولة — إنشاء سجل جديد
      await pool.query(
        `INSERT INTO student_exercise_progress (user_id, exercise_id, question_id, is_correct, attempts, completed_at)
         VALUES ($1, $2, $3, $4, 1, $5)`,
        [userId, exerciseId, question_id, isCorrect, isCorrect ? new Date() : null]
      );

      // إذا صحيحة من أول محاولة → إضافة XP
      if (isCorrect) {
        xpGained = exercise.xp_reward;
        await pool.query(
          'UPDATE users SET points = COALESCE(points, 0) + $1 WHERE id = $2',
          [xpGained, userId]
        );

        // إشعار نقاط جديدة
        sendPushNotification(userId, {
          type: 'xp_earned',
          title: 'نقاط جديدة! 🧩',
          body: `حصلت على ${xpGained} نقطة`,
          refType: 'exercise',
          refId: exerciseId
        });
      }
    } else {
      // محاولة سابقة موجودة
      const prev = existingProgress.rows[0];
      attempts = prev.attempts + 1;

      await pool.query(
        `UPDATE student_exercise_progress SET
          is_correct = $1, attempts = $2, completed_at = $3
         WHERE id = $4`,
        [
          isCorrect || prev.is_correct,
          attempts,
          isCorrect && !prev.is_correct ? new Date() : (prev.is_correct ? prev.completed_at : null),
          prev.id
        ]
      );

      // لا نضيف XP إذا كانت محاولة سابقة (XP فقط على أول إجابة صحيحة)
    }

    res.json({
      correct: isCorrect,
      xp_gained: xpGained,
      attempts
    });
  } catch (err) {
    console.error('POST /exercises/:id/answer error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// 11. جلب تقدم طالب في تمرين
// ═══════════════════════════════════════
router.get('/:id/progress/:userId', requireAnyAuth, async (req, res) => {
  try {
    const { id: exerciseId, userId } = req.params;
    const isAdmin = !!req.admin;

    // الطالب يشوف بياناته فقط
    if (!isAdmin && req.user && req.user.id !== userId) {
      return res.status(403).json({ message: 'غير مصرح بعرض بيانات مستخدم آخر' });
    }

    const result = await pool.query(
      `SELECT question_id, is_correct, attempts, completed_at
       FROM student_exercise_progress
       WHERE exercise_id = $1 AND user_id = $2`,
      [exerciseId, userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('GET /exercises/:id/progress/:userId error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

module.exports = router;
