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
const { compareAnswer } = require('../utils/compareAnswer');
const { addToSpacedRepetition } = require('../utils/spacedRepetition');

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
        eu.title as unit_title,
        eu.order_index as unit_order,
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
      LEFT JOIN exercise_units eu ON eu.id = e.unit_id
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
// 0.5 تمارين مجمّعة بالوحدات
// ═══════════════════════════════════════
router.get('/grouped', authMiddleware, async (req, res) => {
  try {
    const { subject_id, grade_id } = req.query;
    if (!subject_id) return res.status(400).json({ message: 'subject_id مطلوب' });

    // 1. جلب الوحدات مع تمارينها
    const unitsRes = await pool.query(`
      SELECT u.id, u.title, u.order_index, u.is_active,
        COALESCE(
          json_agg(
            json_build_object(
              'id', e.id, 'title', e.title, 'type', e.type,
              'difficulty', e.difficulty, 'is_published', e.is_published,
              'questions_count', (SELECT COUNT(*) FROM exercise_questions eq WHERE eq.exercise_id = e.id),
              'created_at', e.created_at
            ) ORDER BY e.created_at
          ) FILTER (WHERE e.id IS NOT NULL),
          '[]'::json
        ) as exercises
      FROM exercise_units u
      LEFT JOIN exercises e ON e.unit_id = u.id
      WHERE u.subject_id = $1 AND ($2::uuid IS NULL OR u.grade_id = $2)
      GROUP BY u.id, u.title, u.order_index, u.is_active
      ORDER BY u.order_index
    `, [subject_id, grade_id || null]);

    // 2. جلب التمارين بدون وحدة
    const ungroupedRes = await pool.query(`
      SELECT e.id, e.title, e.type, e.difficulty, e.is_published,
        (SELECT COUNT(*) FROM exercise_questions eq WHERE eq.exercise_id = e.id) as questions_count,
        e.created_at
      FROM exercises e
      WHERE e.unit_id IS NULL AND e.subject_id = $1
        AND ($2::uuid IS NULL OR e.grade_id = $2)
      ORDER BY e.created_at DESC
    `, [subject_id, grade_id || null]);

    res.json({
      units: unitsRes.rows,
      ungrouped: ungroupedRes.rows,
    });
  } catch (err) {
    console.error('GET /exercises/grouped error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// 1. إنشاء تمرين
// ═══════════════════════════════════════
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { lesson_id, title, description, type, xp_reward, time_limit,
            stage_id, grade_id, subject_id, difficulty, sort_order, is_published, auto_publish } = req.body;

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
                              stage_id, grade_id, subject_id, difficulty, sort_order, is_published)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [lesson_id || null, title, description || null, type, xp_reward || 10,
       time_limit || null, stage_id || null, grade_id || null, subject_id,
       diff, sort_order || 0, is_published || auto_publish || false]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /exercises error:', err.message, err.stack);
    res.status(500).json({ message: `خطأ في إنشاء التمرين: ${err.message}` });
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
      title: 'قالب اختيار من متعدد',
      headers: ['question_text', 'option_a', 'option_b', 'option_c', 'option_d', 'correct (a/b/c/d)'],
      sample: [
        ['ما عاصمة المملكة العربية السعودية؟', 'الرياض', 'جدة', 'مكة', 'الدمام', 'a'],
        ['كم عدد أيام الأسبوع؟', '5', '6', '7', '8', 'c'],
      ],
    },
    speed: {
      name: 'قالب_سرعة',
      title: 'قالب تمرين السرعة',
      headers: ['question_text', 'option_a', 'option_b', 'option_c', 'option_d', 'correct (a/b/c/d)'],
      sample: [
        ['2 + 3 = ؟', '4', '5', '6', '7', 'b'],
        ['10 - 4 = ؟', '5', '6', '7', '8', 'b'],
      ],
    },
    true_false: {
      name: 'قالب_صح_وخطأ',
      title: 'قالب صح وخطأ',
      headers: ['question_text', 'correct_answer (true/false)', 'difficulty'],
      sample: [
        ['الشمس تدور حول الأرض', 'false', 'easy'],
        ['الماء يتكون من هيدروجين وأكسجين', 'true', 'easy'],
      ],
    },
    fill_blank: {
      name: 'قالب_إملاء_الفراغ',
      title: 'قالب أكمل الفراغ',
      headers: ['question_text', 'answer', 'difficulty'],
      sample: [
        ['عاصمة مصر هي ___', 'القاهرة', 'easy'],
        ['أكبر كوكب في المجموعة الشمسية هو ___', 'المشتري', 'medium'],
      ],
    },
    read_answer: {
      name: 'قالب_اقرأ_وأجب',
      title: 'قالب اقرأ ثم أجب',
      headers: ['question_text', 'answer', 'difficulty'],
      sample: [
        ['ما الفكرة الرئيسية للنص؟', 'أهمية القراءة', 'medium'],
      ],
    },
    matching: {
      name: 'قالب_مطابقة',
      title: 'قالب صل العمودين',
      headers: ['question_text', 'يسار1', 'يمين1', 'يسار2', 'يمين2', 'يسار3', 'يمين3', 'يسار4', 'يمين4'],
      sample: [
        ['طابق الدول بعواصمها', 'السعودية', 'الرياض', 'مصر', 'القاهرة', 'الأردن', 'عمّان', '', ''],
      ],
    },
    image_match: {
      name: 'قالب_مطابقة_صور',
      title: 'قالب صل الصورة',
      headers: ['question_text', 'يسار1', 'يمين1', 'يسار2', 'يمين2', 'يسار3', 'يمين3'],
      sample: [
        ['طابق الصور بأسمائها', 'قطة', 'Cat', 'كلب', 'Dog', 'طائر', 'Bird'],
      ],
    },
    ordering: {
      name: 'قالب_ترتيب',
      title: 'قالب رتّب الترتيب',
      headers: ['question_text', 'عنصر1', 'عنصر2', 'عنصر3', 'عنصر4', 'عنصر5'],
      sample: [
        ['رتب الأعداد تصاعدياً', '3', '1', '5', '2', '4'],
        ['رتب مراحل دورة الماء', 'التبخر', 'التكثف', 'الهطول', 'الجريان', ''],
      ],
    },
    classify: {
      name: 'قالب_تصنيف',
      title: 'قالب صنّف العناصر',
      headers: ['question_text', 'category_1', 'category_2', 'items (مفصولة بـ |)', 'difficulty'],
      sample: [
        ['صنّف الأطعمة التالية', 'فاكهة', 'خضار', 'تفاح→فاكهة | جزر→خضار | موز→فاكهة | بطاطا→خضار', 'easy'],
        ['صنّف الحيوانات', 'ثدييات', 'طيور', 'قطة→ثدييات | نسر→طيور | كلب→ثدييات', 'medium'],
      ],
    },
  };

  const tmpl = templates[type];
  if (!tmpl) {
    return res.status(400).json({ message: `لا يوجد قالب لنوع التمرين "${type}"` });
  }

  // اسم الورقة حسب النوع (للتوافق مع sheet mapping عند الاستيراد)
  const TEMPLATE_SHEET_NAMES = {
    mcq: 'MCQ', speed: 'MCQ',
    true_false: 'TrueFalse',
    fill_blank: 'FillBlank', read_answer: 'FillBlank',
    classify: 'Classify',
    matching: 'Matching',
    image_match: 'Matching',
    ordering: 'Ordering',
  };

  const wb = XLSX.utils.book_new();
  // صف 1 = عنوان مدمج، صف 2 = headers، صف 3+ = بيانات
  const wsData = [[tmpl.title || tmpl.name], tmpl.headers, ...tmpl.sample];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // دمج أول صف عبر كل الأعمدة (title row)
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: tmpl.headers.length - 1 } }];

  // ضبط عرض الأعمدة
  ws['!cols'] = tmpl.headers.map(() => ({ wch: 25 }));

  XLSX.utils.book_append_sheet(wb, ws, TEMPLATE_SHEET_NAMES[type] || 'أسئلة');

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
// تخطي الأسئلة — Skip Questions
// ═══════════════════════════════════════

// GET /skips/today — عدد التخطيات المتبقية اليوم
router.get('/skips/today', requireUserAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      'SELECT skips_used, skips_from_ads FROM student_skips WHERE user_id = $1 AND skip_date = CURRENT_DATE',
      [userId]
    );
    const row = result.rows[0] || { skips_used: 0, skips_from_ads: 0 };
    const remaining = Math.max(0, 3 - row.skips_used + row.skips_from_ads);
    res.json({ skips_remaining: remaining, skips_from_ads: row.skips_from_ads });
  } catch (err) {
    console.error('GET /exercises/skips/today error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// POST /skips/use — استخدام تخطي
router.post('/skips/use', requireUserAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(`
      INSERT INTO student_skips (user_id, skip_date, skips_used)
      VALUES ($1, CURRENT_DATE, 1)
      ON CONFLICT (user_id, skip_date)
      DO UPDATE SET skips_used = student_skips.skips_used + 1
      RETURNING skips_used, skips_from_ads
    `, [userId]);
    const row = result.rows[0];
    const remaining = Math.max(0, 3 - row.skips_used + row.skips_from_ads);
    res.json({ success: true, skips_remaining: remaining });
  } catch (err) {
    console.error('POST /exercises/skips/use error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// POST /skips/add-from-ad — تخطي إضافي من مشاهدة إعلان
router.post('/skips/add-from-ad', requireUserAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(`
      INSERT INTO student_skips (user_id, skip_date, skips_from_ads)
      VALUES ($1, CURRENT_DATE, 1)
      ON CONFLICT (user_id, skip_date)
      DO UPDATE SET skips_from_ads = student_skips.skips_from_ads + 1
      RETURNING skips_used, skips_from_ads
    `, [userId]);
    const row = result.rows[0];
    const remaining = Math.max(0, 3 - row.skips_used + row.skips_from_ads);
    res.json({ success: true, skips_remaining: remaining });
  } catch (err) {
    console.error('POST /exercises/skips/add-from-ad error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// بلاغات الأسئلة — Question Reports
// ═══════════════════════════════════════

// POST /questions/:questionId/report — إبلاغ عن سؤال (طالب)
router.post('/questions/:questionId/report', requireUserAuth, async (req, res) => {
  try {
    const { questionId } = req.params;
    const userId = req.user.id;
    const { reason, details } = req.body;

    if (!reason) {
      return res.status(400).json({ message: 'سبب البلاغ مطلوب' });
    }
    const validReasons = ['wrong_answer', 'spelling_error', 'unclear', 'other'];
    if (!validReasons.includes(reason)) {
      return res.status(400).json({ message: 'سبب غير صالح' });
    }

    await pool.query(
      'INSERT INTO question_reports (question_id, user_id, reason, details) VALUES ($1, $2, $3, $4)',
      [questionId, userId, reason, details || null]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('POST /exercises/questions/:id/report error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// GET /admin/question-reports — قائمة البلاغات (أدمن)
router.get('/admin/question-reports', authMiddleware, async (req, res) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT qr.id, qr.reason, qr.details, qr.status, qr.created_at,
        eq.question_text, eq.exercise_id,
        e.title as exercise_title,
        u.name as reporter_name, u.email as reporter_email
      FROM question_reports qr
      LEFT JOIN exercise_questions eq ON eq.id = qr.question_id
      LEFT JOIN exercises e ON e.id = eq.exercise_id
      LEFT JOIN users u ON u.id = qr.user_id
    `;
    const params = [];
    if (status) {
      query += ' WHERE qr.status = $1';
      params.push(status);
    }
    query += ' ORDER BY qr.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('GET /exercises/admin/question-reports error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// PATCH /admin/question-reports/:id — تحديث حالة البلاغ (أدمن)
router.patch('/admin/question-reports/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['pending', 'reviewed', 'resolved'].includes(status)) {
      return res.status(400).json({ message: 'حالة غير صالحة' });
    }

    const result = await pool.query(
      'UPDATE question_reports SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'البلاغ غير موجود' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('PATCH /exercises/admin/question-reports/:id error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// GET /admin/question-reports/count — عدد البلاغات المعلقة (أدمن)
router.get('/admin/question-reports/count', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT status, COUNT(*)::int as count FROM question_reports GROUP BY status"
    );
    const counts = { pending: 0, reviewed: 0, resolved: 0 };
    result.rows.forEach(r => { counts[r.status] = r.count; });
    res.json(counts);
  } catch (err) {
    console.error('GET /exercises/admin/question-reports/count error:', err.message);
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
    if (!isCorrect) {
      response.correct_answer = correctAnswer;
      // إضافة السؤال للتكرار المتباعد
      try {
        await addToSpacedRepetition(userId, question_id);
      } catch (srErr) {
        console.error('spaced rep error:', srErr.message);
      }
    }
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

// مطابقة مرنة لأسماء الأعمدة (يدعم أعمدة مثل "question_text (استخدم ___ للفراغ)")
function getCol(row, ...names) {
  // 1. محاولة مطابقة مباشرة
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== null) return row[name].toString().trim();
  }
  // 2. محاولة مطابقة بـ startsWith
  const keys = Object.keys(row);
  for (const name of names) {
    const found = keys.find(k => k.startsWith(name));
    if (found && row[found] !== undefined && row[found] !== null) return row[found].toString().trim();
  }
  return '';
}

function getQuestionText(row) {
  return getCol(row, 'question_text', 'نص السؤال');
}

function isHeaderRow(text) {
  return !text || text === 'question_text' || text === 'نص السؤال' || text.startsWith('question_text');
}

function parseRowMCQ(row) {
  const text = getQuestionText(row);
  if (isHeaderRow(text)) return null;

  const options = [];
  // أولاً: option_a / option_b / option_c / option_d
  ['a', 'b', 'c', 'd'].forEach(letter => {
    const opt = getCol(row, `option_${letter}`);
    if (opt) options.push(opt);
  });
  // fallback: الأعمدة العربية القديمة
  if (options.length === 0) {
    for (let i = 1; i <= 6; i++) {
      const opt = getCol(row, `خيار${i}`, `option${i}`);
      if (opt) options.push(opt);
    }
  }
  if (options.length < 2) return { error: `السؤال "${text.slice(0, 30)}..." يحتاج على الأقل خيارين` };

  const correctRaw = getCol(row, 'correct (a/b/c/d)', 'correct', 'الإجابة الصحيحة') || '1';
  const letterMap = { a: 0, b: 1, c: 2, d: 3, e: 4, f: 5 };
  let correctIdx = letterMap[correctRaw.toLowerCase()] ?? (parseInt(correctRaw) - 1);
  if (isNaN(correctIdx) || correctIdx < 0 || correctIdx >= options.length) correctIdx = 0;

  return {
    question_text: text,
    question_data: { options },
    correct_answer: { index: correctIdx },
  };
}

function parseRowTrueFalse(row) {
  const text = getQuestionText(row);
  if (isHeaderRow(text)) return null;

  const ans = (getCol(row, 'correct_answer (true/false)', 'correct_answer', 'correct', 'الإجابة') || '').toLowerCase();
  const isTrue = ['true', 'صح', 'صحيح', '1', 'نعم'].includes(ans);

  return {
    question_text: text,
    question_data: {},
    correct_answer: { value: isTrue },
  };
}

function parseRowFillBlank(row) {
  const text = getQuestionText(row);
  if (isHeaderRow(text)) return null;

  const answersRaw = getCol(row, 'answer', 'answers', 'الإجابات', 'الإجابة', 'correct');
  const values = answersRaw.split(/[,،|]/).map(v => v.trim()).filter(Boolean);
  if (values.length === 0) return { error: `السؤال "${text.slice(0, 30)}..." يحتاج إجابة واحدة على الأقل` };

  return {
    question_text: text,
    question_data: {},
    correct_answer: { values },
  };
}

function parseRowMatching(row) {
  const text = getQuestionText(row);
  if (isHeaderRow(text)) return null;

  const pairs = [];

  // الطريقة 1: أعمدة pairs_left / pairs_right (مفصولة بـ |)
  const leftRaw = getCol(row, 'pairs_left', 'يسار');
  const rightRaw = getCol(row, 'pairs_right', 'يمين');
  if (leftRaw && rightRaw) {
    const lefts = leftRaw.split(/\s*\|\s*/).map(s => s.trim()).filter(Boolean);
    const rights = rightRaw.split(/\s*\|\s*/).map(s => s.trim()).filter(Boolean);
    const len = Math.min(lefts.length, rights.length);
    for (let i = 0; i < len; i++) {
      pairs.push({ left: lefts[i], right: rights[i] });
    }
  }

  // الطريقة 2: أعمدة left1/right1, left2/right2 (fallback)
  if (pairs.length === 0) {
    for (let i = 1; i <= 8; i++) {
      const left = getCol(row, `يسار${i}`, `left${i}`);
      const right = getCol(row, `يمين${i}`, `right${i}`);
      if (left && right) pairs.push({ left, right });
    }
  }

  if (pairs.length < 2) return null;
  return {
    question_text: text || 'طابق العناصر التالية',
    question_data: { pairs: pairs.map(p => ({ left: p.left, right: p.right })) },
    correct_answer: { pairs: pairs.map(p => ({ left: p.left, right: p.right })) },
  };
}

function parseRowOrdering(row) {
  const text = getQuestionText(row);
  if (isHeaderRow(text)) return null;

  const items = [];

  // الطريقة 1: عمود واحد مفصول بـ | (items_in_correct_order)
  const itemsRaw = getCol(row, 'items_in_correct_order', 'items', 'العناصر');
  if (itemsRaw) {
    const split = itemsRaw.split(/\s*\|\s*/).map(s => s.trim()).filter(Boolean);
    items.push(...split);
  }

  // الطريقة 2: أعمدة item1, item2, ... (fallback)
  if (items.length === 0) {
    for (let i = 1; i <= 10; i++) {
      const item = getCol(row, `عنصر${i}`, `item${i}`);
      if (item) items.push(item);
    }
  }

  if (items.length < 2) return null;
  return {
    question_text: text || 'رتب العناصر التالية',
    question_data: { items: [...items].sort(() => Math.random() - 0.5) },
    correct_answer: { items },
  };
}

function parseRowClassify(row) {
  const text = getQuestionText(row);
  if (isHeaderRow(text)) return null;

  // قراءة الفئات (حتى 6)
  const categories = [];
  for (let i = 1; i <= 6; i++) {
    const cat = getCol(row, `category_${i}`, `فئة${i}`);
    if (cat) categories.push(cat);
  }
  if (categories.length < 2) return { error: 'يجب وجود فئتين على الأقل' };

  const itemsRaw = getCol(row, 'items', 'العناصر');
  const groups = {};
  categories.forEach(c => { groups[c] = []; });

  // تقسيم بـ " | " أو "|"
  const entries = itemsRaw.split(/\s*\|\s*/).map(s => s.trim()).filter(Boolean);
  for (const entry of entries) {
    const parts = entry.split('→').map(s => s.trim());
    if (parts.length === 2 && parts[0] && parts[1]) {
      const [item, cat] = parts;
      if (groups[cat] !== undefined) {
        groups[cat].push(item);
      }
    }
  }

  const allItems = Object.values(groups).flat();
  if (allItems.length < 2) return { error: 'يجب وجود عنصرين على الأقل مع فئاتهم' };

  return {
    question_text: text || 'صنّف العناصر التالية',
    question_data: { categories, items: [...allItems].sort(() => Math.random() - 0.5) },
    correct_answer: { groups },
  };
}

function parseRowWordBuild(row) {
  const text = getQuestionText(row);
  if (isHeaderRow(text)) return null;

  const tilesRaw = getCol(row, 'tiles', 'الحروف', 'المقاطع');
  const tiles = tilesRaw.split(/[,،]/).map(t => t.trim()).filter(Boolean);
  if (tiles.length < 2) return { error: `السؤال "${(text || '').slice(0, 30)}..." يحتاج مقطعين على الأقل` };

  const hint = getCol(row, 'hint_emoji', 'hint', 'تلميح');
  const answer = getCol(row, 'correct_answer', 'الإجابة', 'answer');
  const buildType = getCol(row, 'build_type', 'النوع') || 'word';

  return {
    question_text: text,
    question_data: { build_type: buildType, tiles, hint, display_hint: !!hint },
    correct_answer: { answer: answer || tiles.join(buildType === 'sentence' ? ' ' : '') }
  };
}

function parseRowLetterPos(row) {
  const text = getQuestionText(row);
  if (isHeaderRow(text)) return null;

  const letter = getCol(row, 'letter', 'الحرف');
  const word = getCol(row, 'word', 'الكلمة');
  if (!letter || !word) return { error: 'يجب تحديد الحرف والكلمة' };

  const position = (getCol(row, 'correct_position', 'الموضع', 'position') || 'initial').toLowerCase();
  const FORMS = { initial: letter + 'ـ', middle: 'ـ' + letter + 'ـ', final: 'ـ' + letter, standalone: letter };
  const form = FORMS[position] || letter;
  const options = [letter + 'ـ', 'ـ' + letter + 'ـ', 'ـ' + letter, letter];
  const wordWithBlank = word.replace(new RegExp(letter), '___');

  return {
    question_text: text || `اختر شكل حرف ${letter} في كلمة ${word}`,
    question_data: { letter, word, word_with_blank: wordWithBlank, options },
    correct_answer: { position, form }
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
  classify: parseRowClassify,
  word_build: parseRowWordBuild,
  letter_pos: parseRowLetterPos,
};

// ───────── POST /import-all — استيراد ذكي: ملف واحد → عدة تمارين ─────────

router.post('/import-all', authMiddleware, importUpload.single('file'), async (req, res) => {
  let filePath = null;
  try {
    const { subject_id, grade_id, stage_id } = req.body;

    if (!subject_id) {
      return res.status(400).json({ message: 'المادة مطلوبة' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'لم يتم رفع أي ملف' });
    }
    filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();

    if (!['.xlsx', '.xls'].includes(ext)) {
      return res.status(400).json({ message: 'الاستيراد الذكي يدعم ملفات Excel فقط (.xlsx)' });
    }

    const wb = XLSX.readFile(filePath);

    // ── قراءة ورقة المعلومات (metadata) ──
    let unitNumber = null;
    let unitTitle = null;

    if (wb.SheetNames.includes('معلومات')) {
      const metaSheet = wb.Sheets['معلومات'];
      const metaRows = XLSX.utils.sheet_to_json(metaSheet, { header: 1 });
      for (const row of metaRows) {
        if (!row || row.length < 2) continue;
        const label = String(row[0] || '').trim();
        const value = String(row[1] || '').trim();
        if (label === 'الوحدة') unitNumber = value;
        if (label === 'عنوان الوحدة') unitTitle = value;
      }
      console.log('import-all: metadata — unitNumber:', unitNumber, ', unitTitle:', unitTitle);
    }

    // بناء عنوان الوحدة الكامل
    const fullUnitTitle = unitNumber && unitTitle
      ? `${unitNumber}: ${unitTitle}`
      : unitTitle || null;

    // إنشاء/جلب الوحدة من قاعدة البيانات
    let dbUnitId = null;
    console.log('import-all: unit creation check — fullUnitTitle:', fullUnitTitle, ', subject_id:', subject_id, ', grade_id:', grade_id);
    if (fullUnitTitle && subject_id) {
      const existing = await pool.query(
        `SELECT id FROM exercise_units WHERE subject_id=$1 AND grade_id IS NOT DISTINCT FROM $2 AND title=$3`,
        [subject_id, grade_id || null, fullUnitTitle]
      );
      if (existing.rowCount > 0) {
        dbUnitId = existing.rows[0].id;
        console.log('import-all: using existing unit:', dbUnitId);
      } else {
        const newUnit = await pool.query(
          `INSERT INTO exercise_units (subject_id, grade_id, title, order_index)
           VALUES ($1, $2, $3,
             (SELECT COALESCE(MAX(order_index)+1, 1) FROM exercise_units WHERE subject_id=$1 AND grade_id IS NOT DISTINCT FROM $2))
           RETURNING id`,
          [subject_id, grade_id || null, fullUnitTitle]
        );
        dbUnitId = newUnit.rows[0].id;
        console.log('import-all: created new unit:', dbUnitId);
      }
    }

    const REVERSE_SHEET_MAP = {
      MCQ: 'mcq', TrueFalse: 'true_false', FillBlank: 'fill_blank',
      Classify: 'classify', Matching: 'matching', Ordering: 'ordering',
      WordBuild: 'word_build', LetterPos: 'letter_pos',
    };
    const TYPE_LABELS = {
      mcq: 'اختيار من متعدد', true_false: 'صح أم خطأ', fill_blank: 'أكمل الفراغ',
      classify: 'تصنيف', matching: 'مطابقة', ordering: 'ترتيب',
      word_build: 'تركيب كلمة', letter_pos: 'موضع الحرف',
    };

    const results = [];
    const skipped_sheets = [];
    let total_questions = 0;

    console.log('import-all: sheets found:', wb.SheetNames);

    for (const sheetName of wb.SheetNames) {
      // تخطي ورقة المعلومات — تمت قراءتها مسبقاً
      if (sheetName === 'معلومات') continue;

      const exerciseType = REVERSE_SHEET_MAP[sheetName];

      if (!exerciseType) {
        console.log(`import-all: skipping sheet "${sheetName}" — not in known sheets map`);
        skipped_sheets.push(sheetName);
        continue;
      }

      const parser = ROW_PARSERS[exerciseType];
      if (!parser) {
        console.log(`import-all: skipping sheet "${sheetName}" — no parser for type "${exerciseType}"`);
        skipped_sheets.push(sheetName);
        continue;
      }

      // قراءة الصفوف (تخطي صف العنوان)
      let rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { range: 1 });
      if (rows.length === 0) {
        rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
      }
      if (rows.length === 0) {
        console.log(`import-all: skipping sheet "${sheetName}" — 0 rows`);
        skipped_sheets.push(sheetName);
        continue;
      }

      console.log(`import-all: processing sheet "${sheetName}" → type "${exerciseType}", ${rows.length} rows, columns:`, Object.keys(rows[0]));

      const sheetResult = { type: exerciseType, title: '', questions: 0, errors: 0, errorDetails: [] };

      try {
        // 1. إنشاء التمرين
        let autoTitle;
        if (fullUnitTitle) {
          autoTitle = `${fullUnitTitle} — ${TYPE_LABELS[exerciseType] || exerciseType}`;
        } else {
          const today = new Date().toLocaleDateString('ar-SA');
          autoTitle = `${TYPE_LABELS[exerciseType] || exerciseType} - ${today}`;
        }

        console.log(`import-all: INSERT exercise — type: ${exerciseType}, title: "${autoTitle}", dbUnitId: ${dbUnitId}`);
        const exRes = await pool.query(
          `INSERT INTO exercises (lesson_id, title, description, type, xp_reward, time_limit,
                                  stage_id, grade_id, subject_id, difficulty, sort_order, is_published, unit_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
          [null, autoTitle, null, exerciseType, 10, null, stage_id || null, grade_id || null, subject_id, 'medium', 0, true, dbUnitId]
        );
        const exerciseId = exRes.rows[0].id;
        sheetResult.title = autoTitle;
        sheetResult.exercise_id = exerciseId;

        // 2. parse + insert
        let nextOrder = 0;
        for (let i = 0; i < rows.length; i++) {
          try {
            const parsed = parser(rows[i]);
            if (!parsed) continue;
            if (parsed.error) {
              sheetResult.errors++;
              sheetResult.errorDetails.push({ row: i + 3, message: parsed.error });
              continue;
            }
            // إضافة وسم الدرس إذا وُجد العمود
            const lessonTag = getCol(rows[i], 'الدرس', 'lesson');
            const questionData = lessonTag
              ? { ...parsed.question_data, lesson_tag: lessonTag }
              : parsed.question_data;

            await pool.query(
              `INSERT INTO exercise_questions (exercise_id, question_text, question_data, correct_answer, order_index)
               VALUES ($1, $2, $3, $4, $5)`,
              [exerciseId, parsed.question_text, JSON.stringify(questionData), JSON.stringify(parsed.correct_answer), nextOrder++]
            );
            sheetResult.questions++;
          } catch (rowErr) {
            sheetResult.errors++;
            sheetResult.errorDetails.push({ row: i + 3, message: rowErr.message });
          }
        }

        total_questions += sheetResult.questions;

        console.log(`import-all: sheet "${sheetName}" → ${sheetResult.questions} imported, ${sheetResult.errors} errors`);

        // حذف التمرين الفارغ
        if (sheetResult.questions === 0) {
          console.log(`import-all: deleting empty exercise for sheet "${sheetName}", first row was:`, JSON.stringify(rows[0]));
          await pool.query('DELETE FROM exercises WHERE id = $1', [exerciseId]);
          sheetResult.exercise_id = null;
          skipped_sheets.push(sheetName);
        } else {
          results.push(sheetResult);
        }
      } catch (sheetErr) {
        console.error(`import-all: sheet "${sheetName}" failed:`, sheetErr.message);
        skipped_sheets.push(sheetName);
      }
    }

    try { fs.unlinkSync(filePath); } catch {}

    res.json({
      success: true,
      results,
      total_exercises: results.length,
      total_questions,
      skipped_sheets,
      unit_id: dbUnitId || null,
      unit_title: fullUnitTitle || null,
    });
  } catch (err) {
    if (filePath) try { fs.unlinkSync(filePath); } catch {}
    console.error('POST /exercises/import-all error:', err.message);
    res.status(500).json({ message: 'خطأ في معالجة الملف: ' + err.message });
  }
});

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
    let detectedType = null;

    // ─── قراءة الملف ───
    if (ext === '.json') {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      rows = Array.isArray(parsed) ? parsed : (parsed.questions || []);
    } else if (['.xlsx', '.xls'].includes(ext)) {
      const wb = XLSX.readFile(filePath);

      // ── Auto-detect: اختيار الورقة الصحيحة ──
      const IMPORT_SHEET_NAMES = {
        mcq: 'MCQ', speed: 'MCQ',
        true_false: 'TrueFalse',
        fill_blank: 'FillBlank', read_answer: 'FillBlank',
        classify: 'Classify',
        matching: 'Matching',
        image_match: 'Matching',
        ordering: 'Ordering',
        word_build: 'WordBuild',
        letter_pos: 'LetterPos',
      };
      const REVERSE_SHEET_MAP = { MCQ: 'mcq', TrueFalse: 'true_false', FillBlank: 'fill_blank', Classify: 'classify', Matching: 'matching', Ordering: 'ordering', WordBuild: 'word_build', LetterPos: 'letter_pos' };

      let sheetName = null;

      // 1. محاولة إيجاد الورقة المطابقة لنوع التمرين
      const preferredSheet = IMPORT_SHEET_NAMES[exerciseType];
      if (preferredSheet && wb.SheetNames.includes(preferredSheet)) {
        sheetName = preferredSheet;
      }

      // 2. إذا لم تُوجد → auto-detect من الورقات الموجودة
      if (!sheetName) {
        for (const sn of wb.SheetNames) {
          if (REVERSE_SHEET_MAP[sn]) {
            sheetName = sn;
            detectedType = REVERSE_SHEET_MAP[sn];
            console.log(`Auto-detected sheet "${sn}" → type "${detectedType}" (exercise type was "${exerciseType}")`);
            break;
          }
        }
      }

      // 3. fallback: أول ورقة
      if (!sheetName) sheetName = wb.SheetNames[0];

      // ── تخطي صف العنوان المدمج (row 1 = title, row 2 = headers, data from row 3) ──
      rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { range: 1 });

      // إذا range:1 أرجع 0 صفوف، جرّب بدون تخطي (ملف بدون title row)
      if (rows.length === 0) {
        rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
      }
    } else {
      return res.status(400).json({ message: 'صيغة الملف غير مدعومة. استخدم xlsx أو json' });
    }

    if (!rows.length) {
      return res.status(400).json({ message: 'الملف فارغ أو لا يحتوي على بيانات' });
    }

    // استخدام النوع المكتشف أو الأصلي
    const finalType = detectedType || exerciseType;
    const parser = ROW_PARSERS[finalType];
    if (!parser) {
      return res.status(400).json({ message: `نوع التمرين "${finalType}" لا يدعم الاستيراد حالياً` });
    }

    // ─── جلب أعلى order_index حالي ───
    const maxOrderRes = await pool.query(
      'SELECT COALESCE(MAX(order_index), -1) as max_idx FROM exercise_questions WHERE exercise_id = $1',
      [exerciseId]
    );
    let nextOrder = maxOrderRes.rows[0].max_idx + 1;

    const results = { imported: 0, skipped: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 3; // +3 لأن row 1 = title, row 2 = headers
      try {
        const parsed = parser(rows[i]);
        if (!parsed) {
          results.skipped++;
          continue;
        }
        if (parsed.error) {
          // log أول صف فاشل للتصحيح
          if (results.errors.length === 0) {
            console.log('First failing row data:', JSON.stringify(rows[i]));
          }
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

// ═══════════════════════════════════════
// ترتيب الوحدات (batch reorder)
// ═══════════════════════════════════════
router.put('/units/reorder', authMiddleware, async (req, res) => {
  try {
    const { orders } = req.body; // [{ id, order_index }]
    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return res.status(400).json({ message: 'يجب إرسال مصفوفة orders' });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const item of orders) {
        await client.query(
          'UPDATE exercise_units SET order_index = $1 WHERE id = $2',
          [item.order_index, item.id]
        );
      }
      await client.query('COMMIT');
      res.json({ success: true, message: 'تم ترتيب الوحدات' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('PUT /units/reorder error:', err);
    res.status(500).json({ message: 'خطأ في ترتيب الوحدات' });
  }
});

module.exports = router;
