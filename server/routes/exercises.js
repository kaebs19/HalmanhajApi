const express = require('express');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { pool } = require('../config/db');
const authMiddleware = require('../middleware/auth');
const { requireUserAuth, optionalUserAuth } = require('../middleware/userAuth');
const { sendPushNotification } = require('../services/pushNotification');
const { createImportUpload } = require('../middleware/upload');

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
// 0. قائمة جميع التمارين (أدمن فقط)
// ═══════════════════════════════════════
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { subject_id, stage_id, grade_id, type, difficulty, is_published } = req.query;

    let query = `
      SELECT e.*,
        l.title as lesson_title,
        COALESCE(e.subject_id, l.subject_id) as resolved_subject_id,
        COALESCE(s_direct.name, s_via_lesson.name) as subject_name,
        st.name as stage_name,
        gr.name as grade_name,
        (SELECT COUNT(*) FROM exercise_questions eq WHERE eq.exercise_id = e.id) as questions_count,
        (SELECT COUNT(DISTINCT user_id) FROM student_exercise_progress sep WHERE sep.exercise_id = e.id AND sep.is_correct = true) as solved_count,
        (SELECT ROUND(
          CASE WHEN COUNT(*) > 0
            THEN (COUNT(*) FILTER (WHERE sep2.is_correct = true) * 100.0 / COUNT(*))
            ELSE 0 END
        ) FROM student_exercise_progress sep2 WHERE sep2.exercise_id = e.id) as avg_accuracy
      FROM exercises e
      LEFT JOIN lessons l ON l.id = e.lesson_id
      LEFT JOIN subjects s_direct ON s_direct.id = e.subject_id
      LEFT JOIN subjects s_via_lesson ON s_via_lesson.id = l.subject_id
      LEFT JOIN stages st ON st.id = e.stage_id
      LEFT JOIN grades gr ON gr.id = e.grade_id
      WHERE 1=1
    `;
    const params = [];
    let paramIdx = 1;

    if (stage_id) {
      query += ` AND e.stage_id = $${paramIdx++}`;
      params.push(stage_id);
    }
    if (grade_id) {
      query += ` AND e.grade_id = $${paramIdx++}`;
      params.push(grade_id);
    }
    if (subject_id) {
      query += ` AND (e.subject_id = $${paramIdx} OR l.subject_id = $${paramIdx})`;
      paramIdx++;
      params.push(subject_id);
    }
    if (type) {
      query += ` AND e.type = $${paramIdx++}`;
      params.push(type);
    }
    if (difficulty) {
      query += ` AND e.difficulty = $${paramIdx++}`;
      params.push(difficulty);
    }
    if (is_published !== undefined) {
      query += ` AND e.is_published = $${paramIdx++}`;
      params.push(is_published === 'true');
    }

    query += ' ORDER BY e.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('GET /exercises error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// 1. إنشاء تمرين
// ═══════════════════════════════════════
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { lesson_id, title, description, type, xp_reward, time_limit,
            stage_id, grade_id, subject_id, difficulty, sort_order } = req.body;

    if (!subject_id || !title || !type) {
      return res.status(400).json({ message: 'المادة والعنوان والنوع مطلوبة' });
    }

    const validTypes = ['true_false', 'mcq', 'fill_blank', 'matching', 'ordering', 'classify', 'speed', 'read_answer', 'image_match'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: 'نوع التمرين غير صالح' });
    }

    const validDifficulties = ['easy', 'medium', 'hard'];
    const diff = difficulty && validDifficulties.includes(difficulty) ? difficulty : 'medium';

    // التحقق من وجود المادة
    const subjectCheck = await pool.query('SELECT id FROM subjects WHERE id = $1', [subject_id]);
    if (subjectCheck.rowCount === 0) {
      return res.status(404).json({ message: 'المادة غير موجودة' });
    }

    // التحقق من وجود الدرس إذا أُرسل
    if (lesson_id) {
      const lessonCheck = await pool.query('SELECT id FROM lessons WHERE id = $1', [lesson_id]);
      if (lessonCheck.rowCount === 0) {
        return res.status(404).json({ message: 'الدرس غير موجود' });
      }
    }

    const result = await pool.query(
      `INSERT INTO exercises (lesson_id, title, description, type, xp_reward, time_limit,
                              stage_id, grade_id, subject_id, difficulty, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [lesson_id || null, title, description || null, type, xp_reward || 10,
       time_limit || null, stage_id || null, grade_id || null, subject_id,
       diff, sort_order || 0]
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
    const { title, description, xp_reward, time_limit, is_published,
            stage_id, grade_id, subject_id, lesson_id, difficulty, sort_order } = req.body;

    if (!title) {
      return res.status(400).json({ message: 'عنوان التمرين مطلوب' });
    }

    const validDifficulties = ['easy', 'medium', 'hard'];
    const diff = difficulty && validDifficulties.includes(difficulty) ? difficulty : undefined;

    const result = await pool.query(
      `UPDATE exercises SET
        title = $1, description = $2, xp_reward = $3, time_limit = $4,
        is_published = $5, stage_id = $6, grade_id = $7, subject_id = $8,
        lesson_id = $9, difficulty = COALESCE($10, difficulty),
        sort_order = COALESCE($11, sort_order), updated_at = NOW()
       WHERE id = $12 RETURNING *`,
      [
        title, description || null, xp_reward || 10, time_limit || null,
        is_published !== undefined ? is_published : false,
        stage_id || null, grade_id || null, subject_id || null,
        lesson_id || null, diff, sort_order !== undefined ? sort_order : null,
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

// ═══════════════════════════════════════
// 7.5 نسخ تمرين (duplicate)
// ═══════════════════════════════════════
router.post('/:id/duplicate', authMiddleware, async (req, res) => {
  try {
    const sourceId = req.params.id;

    const exerciseResult = await pool.query('SELECT * FROM exercises WHERE id = $1', [sourceId]);
    if (exerciseResult.rowCount === 0) {
      return res.status(404).json({ message: 'التمرين غير موجود' });
    }
    const source = exerciseResult.rows[0];

    // إنشاء نسخة غير منشورة
    const newExercise = await pool.query(
      `INSERT INTO exercises (lesson_id, title, description, type, xp_reward, time_limit,
                              stage_id, grade_id, subject_id, difficulty, sort_order, is_published)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, false) RETURNING *`,
      [source.lesson_id, source.title + ' (نسخة)', source.description, source.type,
       source.xp_reward, source.time_limit, source.stage_id, source.grade_id,
       source.subject_id, source.difficulty, source.sort_order]
    );
    const newId = newExercise.rows[0].id;

    // نسخ جميع الأسئلة
    const questions = await pool.query(
      'SELECT * FROM exercise_questions WHERE exercise_id = $1 ORDER BY order_index',
      [sourceId]
    );
    for (const q of questions.rows) {
      await pool.query(
        `INSERT INTO exercise_questions (exercise_id, question_text, question_image,
                                         question_data, correct_answer, order_index)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [newId, q.question_text, q.question_image,
         JSON.stringify(q.question_data), JSON.stringify(q.correct_answer), q.order_index]
      );
    }

    const result = await pool.query(
      `SELECT e.*,
        (SELECT COUNT(*) FROM exercise_questions eq WHERE eq.exercise_id = e.id) as questions_count
       FROM exercises e WHERE e.id = $1`,
      [newId]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /exercises/:id/duplicate error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// 7.6 تحميل قالب استيراد أسئلة
// ═══════════════════════════════════════
router.get('/import-template/:type', authMiddleware, (req, res) => {
  const type = req.params.type;

  const templates = {
    mcq: {
      name: 'قالب_اختيار_من_متعدد',
      headers: ['نص السؤال', 'خيار1', 'خيار2', 'خيار3', 'خيار4', 'الإجابة الصحيحة'],
      sample: [
        ['ما عاصمة المملكة العربية السعودية؟', 'الرياض', 'جدة', 'مكة', 'الدمام', '1'],
        ['كم عدد أيام الأسبوع؟', '5', '6', '7', '8', '3'],
      ],
    },
    speed: {
      name: 'قالب_سرعة',
      headers: ['نص السؤال', 'خيار1', 'خيار2', 'خيار3', 'خيار4', 'الإجابة الصحيحة'],
      sample: [
        ['2 + 3 = ؟', '4', '5', '6', '7', '2'],
        ['10 - 4 = ؟', '5', '6', '7', '8', '2'],
      ],
    },
    true_false: {
      name: 'قالب_صح_وخطأ',
      headers: ['نص السؤال', 'الإجابة'],
      sample: [
        ['الشمس تدور حول الأرض', 'خطأ'],
        ['الماء يتكون من هيدروجين وأكسجين', 'صح'],
      ],
    },
    fill_blank: {
      name: 'قالب_إملاء_الفراغ',
      headers: ['نص السؤال', 'الإجابات'],
      sample: [
        ['عاصمة مصر هي ___', 'القاهرة'],
        ['أكبر كوكب في المجموعة الشمسية هو ___', 'المشتري,جوبيتر'],
      ],
    },
    read_answer: {
      name: 'قالب_اقرأ_وأجب',
      headers: ['نص السؤال', 'الإجابات'],
      sample: [
        ['ما الفكرة الرئيسية للنص؟', 'أهمية القراءة'],
      ],
    },
    matching: {
      name: 'قالب_مطابقة',
      headers: ['نص السؤال', 'يسار1', 'يمين1', 'يسار2', 'يمين2', 'يسار3', 'يمين3', 'يسار4', 'يمين4'],
      sample: [
        ['طابق الدول بعواصمها', 'السعودية', 'الرياض', 'مصر', 'القاهرة', 'الأردن', 'عمّان', '', ''],
      ],
    },
    image_match: {
      name: 'قالب_مطابقة_صور',
      headers: ['نص السؤال', 'يسار1', 'يمين1', 'يسار2', 'يمين2', 'يسار3', 'يمين3'],
      sample: [
        ['طابق الصور بأسمائها', 'قطة', 'Cat', 'كلب', 'Dog', 'طائر', 'Bird'],
      ],
    },
    ordering: {
      name: 'قالب_ترتيب',
      headers: ['نص السؤال', 'عنصر1', 'عنصر2', 'عنصر3', 'عنصر4', 'عنصر5'],
      sample: [
        ['رتب الأعداد تصاعدياً', '3', '1', '5', '2', '4'],
        ['رتب مراحل دورة الماء', 'التبخر', 'التكثف', 'الهطول', 'الجريان', ''],
      ],
    },
  };

  const tmpl = templates[type];
  if (!tmpl) {
    return res.status(400).json({ message: `لا يوجد قالب لنوع التمرين "${type}"` });
  }

  const wb = XLSX.utils.book_new();
  const wsData = [tmpl.headers, ...tmpl.sample];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // ضبط عرض الأعمدة
  ws['!cols'] = tmpl.headers.map(() => ({ wch: 25 }));

  XLSX.utils.book_append_sheet(wb, ws, 'أسئلة');

  // ─── إرسال الملف ───
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${tmpl.name}.xlsx"`);
  res.send(buffer);
});

// ═══════════════════════════════════════════════════════
//             مسارات الطلاب / العامة
// ═══════════════════════════════════════════════════════

// ═══════════════════════════════════════
// 7.7 قائمة التمارين للطلاب
// ═══════════════════════════════════════
router.get('/student/list', optionalUserAuth, async (req, res) => {
  try {
    const { grade_id, subject_id, difficulty, type, stage_id } = req.query;
    const userId = req.user?.id || null;

    let query = `
      SELECT e.id, e.title, e.description, e.type, e.difficulty, e.xp_reward, e.time_limit,
        e.stage_id, e.grade_id, e.subject_id, e.created_at,
        (SELECT COUNT(*) FROM exercise_questions eq WHERE eq.exercise_id = e.id) as questions_count,
        COALESCE(s.name, '') as subject_name,
        COALESCE(s.icon, '') as subject_icon,
        COALESCE(st.name, '') as stage_name,
        COALESCE(gr.name, '') as grade_name
    `;

    // إذا الطالب مسجل: أضف تقدمه
    if (userId) {
      query += `,
        (SELECT COUNT(*) FROM student_exercise_progress sep
         WHERE sep.exercise_id = e.id AND sep.user_id = '${userId}' AND sep.is_correct = true) as solved_count,
        (SELECT COUNT(*) FROM student_exercise_progress sep
         WHERE sep.exercise_id = e.id AND sep.user_id = '${userId}') as attempted_count
      `;
    }

    query += `
      FROM exercises e
      LEFT JOIN subjects s ON s.id = e.subject_id
      LEFT JOIN stages st ON st.id = e.stage_id
      LEFT JOIN grades gr ON gr.id = e.grade_id
      WHERE e.is_published = true
    `;

    const params = [];
    let paramIdx = 1;

    if (grade_id) {
      query += ` AND e.grade_id = $${paramIdx++}`;
      params.push(grade_id);
    }
    if (stage_id) {
      query += ` AND e.stage_id = $${paramIdx++}`;
      params.push(stage_id);
    }
    if (subject_id) {
      query += ` AND e.subject_id = $${paramIdx++}`;
      params.push(subject_id);
    }
    if (difficulty) {
      query += ` AND e.difficulty = $${paramIdx++}`;
      params.push(difficulty);
    }
    if (type) {
      query += ` AND e.type = $${paramIdx++}`;
      params.push(type);
    }

    query += ' ORDER BY e.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('GET /exercises/student/list error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

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

    let exerciseQuery = `
      SELECT e.*,
        l.title as lesson_title,
        COALESCE(s_direct.name, s_via_lesson.name) as subject_name,
        st.name as stage_name,
        gr.name as grade_name
      FROM exercises e
      LEFT JOIN lessons l ON l.id = e.lesson_id
      LEFT JOIN subjects s_direct ON s_direct.id = e.subject_id
      LEFT JOIN subjects s_via_lesson ON s_via_lesson.id = l.subject_id
      LEFT JOIN stages st ON st.id = e.stage_id
      LEFT JOIN grades gr ON gr.id = e.grade_id
      WHERE e.id = $1
    `;
    if (!isAdmin) {
      exerciseQuery += ' AND e.is_published = true';
    }

    const exerciseResult = await pool.query(exerciseQuery, [req.params.id]);
    if (exerciseResult.rowCount === 0) {
      return res.status(404).json({ message: 'التمرين غير موجود' });
    }

    const exercise = { ...exerciseResult.rows[0] };

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

    const response = { correct: isCorrect, xp_gained: xpGained, attempts };
    // عند الخطأ: أرسل الإجابة الصحيحة لعرضها للطالب
    if (!isCorrect) response.correct_answer = correctAnswer;
    res.json(response);
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

// ═══════════════════════════════════════════════════════
//    استيراد أسئلة من ملف (Excel / JSON)
// ═══════════════════════════════════════════════════════

const importUpload = createImportUpload();

// ───────── مساعدات تحويل صفوف Excel إلى question_data + correct_answer ─────────

function parseRowMCQ(row) {
  const text = (row['نص السؤال'] || row['question_text'] || '').trim();
  if (!text) return null;
  const options = [];
  for (let i = 1; i <= 6; i++) {
    const opt = (row[`خيار${i}`] || row[`option${i}`] || '').toString().trim();
    if (opt) options.push(opt);
  }
  if (options.length < 2) return { error: `السؤال "${text.slice(0, 30)}..." يحتاج على الأقل خيارين` };
  let correctIdx = parseInt(row['الإجابة الصحيحة'] || row['correct'] || '1') - 1;
  if (correctIdx < 0 || correctIdx >= options.length) correctIdx = 0;
  return {
    question_text: text,
    question_data: { options },
    correct_answer: { index: correctIdx },
  };
}

function parseRowTrueFalse(row) {
  const text = (row['نص السؤال'] || row['question_text'] || '').trim();
  if (!text) return null;
  const ans = (row['الإجابة'] || row['correct'] || '').toString().trim().toLowerCase();
  const isTrue = ['true', 'صح', 'صحيح', '1', 'نعم'].includes(ans);
  return {
    question_text: text,
    question_data: {},
    correct_answer: { value: isTrue },
  };
}

function parseRowFillBlank(row) {
  const text = (row['نص السؤال'] || row['question_text'] || '').trim();
  if (!text) return null;
  const answersRaw = (row['الإجابات'] || row['answers'] || row['الإجابة'] || row['correct'] || '').toString().trim();
  const values = answersRaw.split(/[,،|]/).map(v => v.trim()).filter(Boolean);
  if (values.length === 0) return { error: `السؤال "${text.slice(0, 30)}..." يحتاج إجابة واحدة على الأقل` };
  return {
    question_text: text,
    question_data: {},
    correct_answer: { values },
  };
}

function parseRowMatching(row) {
  const text = (row['نص السؤال'] || row['question_text'] || '').trim();
  const pairs = [];
  for (let i = 1; i <= 8; i++) {
    const left = (row[`يسار${i}`] || row[`left${i}`] || '').toString().trim();
    const right = (row[`يمين${i}`] || row[`right${i}`] || '').toString().trim();
    if (left && right) pairs.push({ left, right });
  }
  if (pairs.length < 2) return null;
  return {
    question_text: text || 'طابق العناصر التالية',
    question_data: { pairs: pairs.map(p => ({ left: p.left, right: p.right })) },
    correct_answer: { pairs: pairs.map(p => ({ left: p.left, right: p.right })) },
  };
}

function parseRowOrdering(row) {
  const text = (row['نص السؤال'] || row['question_text'] || '').trim();
  const items = [];
  for (let i = 1; i <= 10; i++) {
    const item = (row[`عنصر${i}`] || row[`item${i}`] || '').toString().trim();
    if (item) items.push(item);
  }
  if (items.length < 2) return null;
  return {
    question_text: text || 'رتب العناصر التالية',
    question_data: { items: [...items].sort(() => Math.random() - 0.5) },
    correct_answer: { items },
  };
}

const ROW_PARSERS = {
  mcq: parseRowMCQ,
  speed: parseRowMCQ,
  true_false: parseRowTrueFalse,
  fill_blank: parseRowFillBlank,
  read_answer: parseRowFillBlank,
  matching: parseRowMatching,
  image_match: parseRowMatching,
  ordering: parseRowOrdering,
};

// ───────── POST /:id/import — استيراد أسئلة ─────────

router.post('/:id/import', authMiddleware, importUpload.single('file'), async (req, res) => {
  let filePath = null;
  try {
    const exerciseId = req.params.id;

    // التحقق من وجود التمرين
    const exerciseCheck = await pool.query('SELECT id, type FROM exercises WHERE id = $1', [exerciseId]);
    if (exerciseCheck.rowCount === 0) {
      return res.status(404).json({ message: 'التمرين غير موجود' });
    }
    const exerciseType = exerciseCheck.rows[0].type;

    if (!req.file) {
      return res.status(400).json({ message: 'لم يتم رفع أي ملف' });
    }
    filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();

    let rows = [];

    // ─── قراءة الملف ───
    if (ext === '.json') {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      rows = Array.isArray(parsed) ? parsed : (parsed.questions || []);
    } else if (['.xlsx', '.xls'].includes(ext)) {
      const wb = XLSX.readFile(filePath);
      const sheetName = wb.SheetNames[0];
      rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
    } else {
      return res.status(400).json({ message: 'صيغة الملف غير مدعومة. استخدم xlsx أو json' });
    }

    if (!rows.length) {
      return res.status(400).json({ message: 'الملف فارغ أو لا يحتوي على بيانات' });
    }

    const parser = ROW_PARSERS[exerciseType];
    if (!parser) {
      return res.status(400).json({ message: `نوع التمرين "${exerciseType}" لا يدعم الاستيراد حالياً` });
    }

    // ─── جلب أعلى order_index حالي ───
    const maxOrderRes = await pool.query(
      'SELECT COALESCE(MAX(order_index), -1) as max_idx FROM exercise_questions WHERE exercise_id = $1',
      [exerciseId]
    );
    let nextOrder = maxOrderRes.rows[0].max_idx + 1;

    const results = { imported: 0, skipped: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2; // +2 because row 1 is header
      try {
        const parsed = parser(rows[i]);
        if (!parsed) {
          results.skipped++;
          continue;
        }
        if (parsed.error) {
          results.errors.push({ row: rowNum, message: parsed.error });
          continue;
        }

        await pool.query(
          `INSERT INTO exercise_questions (exercise_id, question_text, question_data, correct_answer, order_index)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            exerciseId,
            parsed.question_text,
            JSON.stringify(parsed.question_data),
            JSON.stringify(parsed.correct_answer),
            nextOrder++,
          ]
        );
        results.imported++;
      } catch (rowErr) {
        results.errors.push({ row: rowNum, message: rowErr.message });
      }
    }

    // حذف الملف بعد الانتهاء
    try { fs.unlinkSync(filePath); } catch {}

    res.json({
      message: `تم استيراد ${results.imported} سؤال بنجاح`,
      ...results,
      total: rows.length,
    });
  } catch (err) {
    if (filePath) try { fs.unlinkSync(filePath); } catch {}
    console.error('POST /exercises/:id/import error:', err.message);
    res.status(500).json({ message: 'خطأ في معالجة الملف: ' + err.message });
  }
});

module.exports = router;
