const express = require('express');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { pool } = require('../config/db');
const authMiddleware = require('../middleware/auth');
const { createUpload, createCsvUpload, createAiGenerateUpload } = require('../middleware/upload');

const router = express.Router();
router.use(authMiddleware);

const upload = createUpload('quizzes');
const csvUpload = createCsvUpload();
const aiUpload = createAiGenerateUpload();

// ═══════════════════════════════════════
// AI Helpers: تحويل PDF/صور لـ Claude vision
// ═══════════════════════════════════════

// تحميل pdfjs-dist ديناميكياً (ESM)
let pdfjsLibAi = null;
async function getPdfjsForAi() {
  if (!pdfjsLibAi) {
    pdfjsLibAi = await import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return pdfjsLibAi;
}

// تحميل @napi-rs/canvas
let createCanvasAi = null;
function getCanvasForAi() {
  if (!createCanvasAi) {
    const { createCanvas } = require('@napi-rs/canvas');
    createCanvasAi = createCanvas;
  }
  return createCanvasAi;
}

// تحويل PDF إلى مصفوفة صور JPEG buffers
async function convertPdfToImagesForAi(pdfPath, maxPages = 10) {
  const pdfjs = await getPdfjsForAi();
  const pdfBytes = new Uint8Array(fs.readFileSync(pdfPath));
  const loadingTask = pdfjs.getDocument({
    data: pdfBytes,
    useSystemFonts: true,
    disableFontFace: true,
    verbosity: 0
  });
  const pdfDoc = await loadingTask.promise;
  const totalPages = Math.min(pdfDoc.numPages, maxPages);
  const images = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.0 });
    const createCanvas = getCanvasForAi();
    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, viewport.width, viewport.height);
    await page.render({ canvasContext: ctx, viewport }).promise;

    const pngBuffer = canvas.toBuffer('image/png');
    // ضغط بـ sharp → JPEG 80% مع تحديد العرض
    const jpegBuffer = await sharp(pngBuffer)
      .resize(1200, null, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    images.push(jpegBuffer);
  }

  pdfDoc.destroy();
  return images;
}

// تحضير ملف لإرساله لـ Claude كـ content blocks
async function prepareFileForClaude(filePath, mimetype) {
  const contentBlocks = [];

  try {
    if (mimetype === 'application/pdf') {
      const images = await convertPdfToImagesForAi(filePath);
      for (const imgBuffer of images) {
        contentBlocks.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/jpeg',
            data: imgBuffer.toString('base64')
          }
        });
      }
    } else {
      // صورة: resize وتحويل
      const resized = await sharp(filePath)
        .resize(1568, null, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();

      contentBlocks.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg',
          data: resized.toString('base64')
        }
      });
    }
  } finally {
    // حذف الملف المؤقت
    try { fs.unlinkSync(filePath); } catch {}
  }

  return contentBlocks;
}

// تحليل JSON من رد Claude (مع fallback)
function parseClaudeJson(text) {
  // محاولة مباشرة
  try {
    return JSON.parse(text);
  } catch {}

  // fallback: استخراج JSON من markdown code block
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) {
    try {
      return JSON.parse(match[1].trim());
    } catch {}
  }

  // fallback: البحث عن أول { ... } كامل
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      return JSON.parse(braceMatch[0]);
    } catch {}
  }

  return null;
}

// ═══════════════════════════════════════
// Helper: توليد slug من العنوان
// ═══════════════════════════════════════
function generateSlug(title) {
  const base = title
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\u0600-\u06FFa-zA-Z0-9\-]/g, '')
    .substring(0, 80);
  return `${base}-${Date.now().toString(36)}`;
}

// ═══════════════════════════════════════
// جلب جميع الاختبارات
// ═══════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT q.*, s.name as subject_name, g.name as grade_name,
        st.name as stage_name, t.name as track_name,
        (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id = q.id) as questions_count,
        (SELECT COUNT(*) FROM quiz_attempts qa WHERE qa.quiz_id = q.id) as attempts_count
      FROM quizzes q
      LEFT JOIN subjects s ON q.subject_id = s.id
      LEFT JOIN grades g ON q.grade_id = g.id
      LEFT JOIN stages st ON q.stage_id = st.id
      LEFT JOIN tracks t ON q.track_id = t.id
      ORDER BY q.sort_order ASC, q.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('GET /quizzes error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// جلب اختبار واحد مع أسئلته وخياراته
// ═══════════════════════════════════════
router.get('/:id', async (req, res) => {
  try {
    const quizResult = await pool.query(`
      SELECT q.*, s.name as subject_name, g.name as grade_name,
        st.name as stage_name, t.name as track_name
      FROM quizzes q
      LEFT JOIN subjects s ON q.subject_id = s.id
      LEFT JOIN grades g ON q.grade_id = g.id
      LEFT JOIN stages st ON q.stage_id = st.id
      LEFT JOIN tracks t ON q.track_id = t.id
      WHERE q.id = $1
    `, [req.params.id]);

    if (quizResult.rowCount === 0) {
      return res.status(404).json({ message: 'الاختبار غير موجود' });
    }

    const quiz = quizResult.rows[0];

    // جلب الأسئلة مرتبة
    const questionsResult = await pool.query(`
      SELECT * FROM quiz_questions WHERE quiz_id = $1 ORDER BY sort_order ASC, created_at ASC
    `, [quiz.id]);

    // جلب خيارات كل الأسئلة
    const questionIds = questionsResult.rows.map(q => q.id);
    let optionsMap = {};

    if (questionIds.length > 0) {
      const optionsResult = await pool.query(`
        SELECT * FROM quiz_options WHERE question_id = ANY($1) ORDER BY sort_order ASC
      `, [questionIds]);

      for (const opt of optionsResult.rows) {
        if (!optionsMap[opt.question_id]) optionsMap[opt.question_id] = [];
        optionsMap[opt.question_id].push(opt);
      }
    }

    quiz.quiz_questions = questionsResult.rows.map(q => ({
      ...q,
      options: optionsMap[q.id] || []
    }));

    res.json(quiz);
  } catch (err) {
    console.error('GET /quizzes/:id error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// إنشاء اختبار
// ═══════════════════════════════════════
router.post('/', async (req, res) => {
  try {
    const { title, description, subject_id, grade_id, stage_id, track_id, semester, time_limit, passing_score, is_published } = req.body;
    if (!title) {
      return res.status(400).json({ message: 'عنوان الاختبار مطلوب' });
    }

    const slug = generateSlug(title);
    const maxOrder = await pool.query('SELECT COALESCE(MAX(sort_order), 0) + 1 as next FROM quizzes');

    const result = await pool.query(
      `INSERT INTO quizzes (title, description, subject_id, grade_id, stage_id, track_id, semester, time_limit, duration_minutes, passing_score, is_published, slug, sort_order, questions)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, $10, $11, $12, '[]') RETURNING *`,
      [
        title,
        description || null,
        subject_id || null,
        grade_id || null,
        stage_id || null,
        track_id || null,
        semester !== undefined ? parseInt(semester) : 0,
        time_limit || 30,
        passing_score || 60,
        is_published !== false,
        slug,
        maxOrder.rows[0].next
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /quizzes error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// تعديل بيانات الاختبار
// ═══════════════════════════════════════
router.put('/:id', async (req, res) => {
  try {
    const { title, description, subject_id, grade_id, stage_id, track_id, semester, time_limit, passing_score, is_published } = req.body;
    if (!title) {
      return res.status(400).json({ message: 'عنوان الاختبار مطلوب' });
    }

    const result = await pool.query(
      `UPDATE quizzes SET
        title=$1, description=$2, subject_id=$3, grade_id=$4, stage_id=$5, track_id=$6,
        semester=$7, time_limit=$8, duration_minutes=$8, passing_score=$9, is_published=$10, updated_at=NOW()
       WHERE id=$11 RETURNING *`,
      [
        title,
        description || null,
        subject_id || null,
        grade_id || null,
        stage_id || null,
        track_id || null,
        semester !== undefined ? parseInt(semester) : 0,
        time_limit || 30,
        passing_score || 60,
        is_published !== false,
        req.params.id
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'الاختبار غير موجود' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /quizzes error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// حذف اختبار (CASCADE يحذف الأسئلة والخيارات)
// ═══════════════════════════════════════
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM quizzes WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'الاختبار غير موجود' });
    }
    res.json({ message: 'تم حذف الاختبار بنجاح' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// إضافة سؤال مع خياراته
// ═══════════════════════════════════════
router.post('/:id/questions', upload.single('question_image'), async (req, res) => {
  try {
    const quizId = req.params.id;
    const { type, question_text, explanation, points, options, metadata } = req.body;

    if (!question_text) {
      return res.status(400).json({ message: 'نص السؤال مطلوب' });
    }

    // الحصول على أعلى ترتيب
    const maxOrder = await pool.query(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM quiz_questions WHERE quiz_id = $1',
      [quizId]
    );

    const questionImage = req.file ? `/uploads/quizzes/${req.file.filename}` : null;
    const parsedMetadata = metadata ? (typeof metadata === 'string' ? JSON.parse(metadata) : metadata) : null;

    const qResult = await pool.query(
      `INSERT INTO quiz_questions (quiz_id, type, question_text, question_image, explanation, points, sort_order, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        quizId,
        type || 'multiple_choice',
        question_text,
        questionImage,
        explanation || null,
        parseInt(points) || 1,
        maxOrder.rows[0].next,
        parsedMetadata ? JSON.stringify(parsedMetadata) : null
      ]
    );

    const question = qResult.rows[0];

    // إدراج الخيارات (فقط للأنواع التي تستخدم options)
    const parsedOptions = typeof options === 'string' ? JSON.parse(options) : (options || []);
    const insertedOptions = [];

    if (type !== 'matching' && type !== 'ordering') {
      for (let i = 0; i < parsedOptions.length; i++) {
        const opt = parsedOptions[i];
        const optResult = await pool.query(
          `INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [question.id, opt.text || opt.option_text, opt.is_correct === true || opt.is_correct === 'true', i]
        );
        insertedOptions.push(optResult.rows[0]);
      }
    }

    question.options = insertedOptions;
    res.status(201).json(question);
  } catch (err) {
    console.error('POST /quizzes/:id/questions error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// تعديل سؤال وخياراته
// ═══════════════════════════════════════
router.put('/questions/:questionId', upload.single('question_image'), async (req, res) => {
  try {
    const { questionId } = req.params;
    const { type, question_text, explanation, points, options, metadata, remove_image } = req.body;

    if (!question_text) {
      return res.status(400).json({ message: 'نص السؤال مطلوب' });
    }

    let questionImage = undefined;
    if (req.file) {
      questionImage = `/uploads/quizzes/${req.file.filename}`;
    } else if (remove_image === 'true' || remove_image === true) {
      questionImage = null;
    }

    const parsedMetadata = metadata ? (typeof metadata === 'string' ? JSON.parse(metadata) : metadata) : null;

    const updateFields = [
      'type = $1', 'question_text = $2', 'explanation = $3', 'points = $4', 'metadata = $5'
    ];
    const params = [
      type || 'multiple_choice',
      question_text,
      explanation || null,
      parseInt(points) || 1,
      parsedMetadata ? JSON.stringify(parsedMetadata) : null
    ];

    if (questionImage !== undefined) {
      params.push(questionImage);
      updateFields.push(`question_image = $${params.length}`);
    }

    params.push(questionId);
    const qResult = await pool.query(
      `UPDATE quiz_questions SET ${updateFields.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );

    if (qResult.rowCount === 0) {
      return res.status(404).json({ message: 'السؤال غير موجود' });
    }

    const question = qResult.rows[0];

    // حذف الخيارات القديمة وإدراج الجديدة (فقط للأنواع التي تستخدم options)
    const parsedOptions = typeof options === 'string' ? JSON.parse(options) : (options || []);

    await pool.query('DELETE FROM quiz_options WHERE question_id = $1', [questionId]);

    const insertedOptions = [];
    if (type !== 'matching' && type !== 'ordering') {
      for (let i = 0; i < parsedOptions.length; i++) {
        const opt = parsedOptions[i];
        const optResult = await pool.query(
          `INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [questionId, opt.text || opt.option_text, opt.is_correct === true || opt.is_correct === 'true', i]
        );
        insertedOptions.push(optResult.rows[0]);
      }
    }

    question.options = insertedOptions;
    res.json(question);
  } catch (err) {
    console.error('PUT /questions/:questionId error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// حذف سؤال
// ═══════════════════════════════════════
router.delete('/questions/:questionId', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM quiz_questions WHERE id = $1', [req.params.questionId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'السؤال غير موجود' });
    }
    res.json({ message: 'تم حذف السؤال بنجاح' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// إعادة ترتيب الأسئلة
// ═══════════════════════════════════════
router.put('/:id/questions/reorder', async (req, res) => {
  try {
    const { orders } = req.body; // [{ id, sort_order }]
    if (!orders || !Array.isArray(orders)) {
      return res.status(400).json({ message: 'بيانات الترتيب مطلوبة' });
    }

    for (const item of orders) {
      await pool.query(
        'UPDATE quiz_questions SET sort_order = $1 WHERE id = $2 AND quiz_id = $3',
        [item.sort_order, item.id, req.params.id]
      );
    }

    res.json({ message: 'تم تحديث الترتيب' });
  } catch (err) {
    console.error('PUT /quizzes/:id/questions/reorder error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// إدراج عدة أسئلة دفعة واحدة (للCSV والAI)
// ═══════════════════════════════════════
router.post('/:id/questions/batch', async (req, res) => {
  try {
    const quizId = req.params.id;
    const { questions } = req.body;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: 'يجب إرسال مصفوفة أسئلة' });
    }

    // التحقق من وجود الاختبار
    const quizCheck = await pool.query('SELECT id FROM quizzes WHERE id = $1', [quizId]);
    if (quizCheck.rowCount === 0) {
      return res.status(404).json({ message: 'الاختبار غير موجود' });
    }

    // الحصول على أعلى ترتيب حالي
    const maxOrder = await pool.query(
      'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM quiz_questions WHERE quiz_id = $1',
      [quizId]
    );
    let currentOrder = maxOrder.rows[0].max_order + 1;

    const inserted = [];

    for (const q of questions) {
      if (!q.question_text) continue;

      const type = q.type || 'multiple_choice';
      const parsedMetadata = q.metadata ? (typeof q.metadata === 'string' ? JSON.parse(q.metadata) : q.metadata) : null;

      const qResult = await pool.query(
        `INSERT INTO quiz_questions (quiz_id, type, question_text, explanation, points, sort_order, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [
          quizId,
          type,
          q.question_text,
          q.explanation || null,
          parseInt(q.points) || 1,
          currentOrder++,
          parsedMetadata ? JSON.stringify(parsedMetadata) : null
        ]
      );

      const question = qResult.rows[0];
      const options = q.options || [];
      const insertedOptions = [];

      if (type !== 'matching' && type !== 'ordering') {
        for (let i = 0; i < options.length; i++) {
          const opt = options[i];
          const optResult = await pool.query(
            `INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [question.id, opt.text || opt.option_text, opt.is_correct === true || opt.is_correct === 'true', i]
          );
          insertedOptions.push(optResult.rows[0]);
        }
      }

      question.options = insertedOptions;
      inserted.push(question);
    }

    res.status(201).json({ imported: inserted.length, questions: inserted });
  } catch (err) {
    console.error('POST /quizzes/:id/questions/batch error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// Helper: تحليل CSV بسيط
// ═══════════════════════════════════════
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  // تحليل سطر مع دعم الاقتباسات
  function parseLine(line) {
    const fields = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    return fields;
  }

  const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '_'));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });
    row._row = i + 1; // رقم السطر الأصلي
    rows.push(row);
  }
  return { headers, rows };
}

// تحويل سطر CSV إلى سؤال
function csvRowToQuestion(row) {
  const type = (row.type || 'multiple_choice').trim().toLowerCase();
  const errors = [];
  const question = {
    type,
    question_text: row.question_text || '',
    explanation: row.explanation || '',
    points: parseInt(row.points) || 1,
    options: [],
    metadata: null
  };

  if (!question.question_text) {
    errors.push('نص السؤال مطلوب');
    return { question, errors, valid: false };
  }

  if (type === 'multiple_choice') {
    // الخيارات: option1, option2, option3, option4
    const opts = [];
    for (let i = 1; i <= 6; i++) {
      const text = row[`option${i}`];
      if (text) opts.push(text);
    }
    if (opts.length < 2) {
      errors.push('يجب وجود خيارين على الأقل');
      return { question, errors, valid: false };
    }
    const correctIdx = parseInt(row.correct) - 1;
    if (isNaN(correctIdx) || correctIdx < 0 || correctIdx >= opts.length) {
      errors.push('رقم الإجابة الصحيحة غير صالح');
      return { question, errors, valid: false };
    }
    question.options = opts.map((text, i) => ({
      text,
      is_correct: i === correctIdx
    }));
  } else if (type === 'true_false') {
    const correct = parseInt(row.correct);
    if (correct !== 1 && correct !== 2) {
      errors.push('الإجابة الصحيحة يجب أن تكون 1 (صح) أو 2 (خطأ)');
      return { question, errors, valid: false };
    }
    question.options = [
      { text: 'صح', is_correct: correct === 1 },
      { text: 'خطأ', is_correct: correct === 2 }
    ];
  } else if (type === 'fill_blank') {
    const answer = row.correct || row.option1 || '';
    if (!answer) {
      errors.push('الإجابة مطلوبة');
      return { question, errors, valid: false };
    }
    question.options = [{ text: answer, is_correct: true }];
  } else if (type === 'matching') {
    // option1=H2O=ماء, option2=NaCl=ملح
    const pairs = [];
    for (let i = 1; i <= 6; i++) {
      const val = row[`option${i}`];
      if (val && val.includes('=')) {
        const [left, right] = val.split('=').map(s => s.trim());
        if (left && right) pairs.push({ left, right });
      }
    }
    if (pairs.length < 2) {
      errors.push('يجب وجود زوجين على الأقل (صيغة: يسار=يمين)');
      return { question, errors, valid: false };
    }
    question.metadata = { pairs };
  } else if (type === 'ordering') {
    // option1, option2, option3... بالترتيب الصحيح
    const items = [];
    for (let i = 1; i <= 8; i++) {
      const val = row[`option${i}`];
      if (val) items.push(val);
    }
    if (items.length < 2) {
      errors.push('يجب وجود عنصرين على الأقل');
      return { question, errors, valid: false };
    }
    question.metadata = { items };
  } else {
    errors.push(`نوع السؤال غير معروف: ${type}`);
    return { question, errors, valid: false };
  }

  return { question, errors, valid: errors.length === 0 };
}

// ═══════════════════════════════════════
// استيراد أسئلة من CSV
// ═══════════════════════════════════════
router.post('/:id/import-csv', csvUpload.single('file'), async (req, res) => {
  try {
    const quizId = req.params.id;
    const isPreview = req.query.preview === 'true';

    if (!req.file) {
      return res.status(400).json({ message: 'ملف CSV مطلوب' });
    }

    // قراءة الملف
    const csvText = fs.readFileSync(req.file.path, 'utf-8');
    // حذف الملف بعد القراءة
    fs.unlinkSync(req.file.path);

    const { headers, rows } = parseCSV(csvText);

    if (rows.length === 0) {
      return res.status(400).json({ message: 'الملف فارغ' });
    }

    // تحليل كل سطر
    const results = rows.map(row => {
      const { question, errors, valid } = csvRowToQuestion(row);
      return { row: row._row, question, errors, valid };
    });

    if (isPreview) {
      return res.json({
        total: results.length,
        valid: results.filter(r => r.valid).length,
        invalid: results.filter(r => !r.valid).length,
        results
      });
    }

    // حفظ الأسئلة الصالحة
    const validQuestions = results.filter(r => r.valid).map(r => r.question);

    if (validQuestions.length === 0) {
      return res.status(400).json({
        message: 'لا توجد أسئلة صالحة للاستيراد',
        errors: results.filter(r => !r.valid).map(r => ({ row: r.row, errors: r.errors }))
      });
    }

    // الحصول على أعلى ترتيب
    const maxOrder = await pool.query(
      'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM quiz_questions WHERE quiz_id = $1',
      [quizId]
    );
    let currentOrder = maxOrder.rows[0].max_order + 1;

    const imported = [];
    for (const q of validQuestions) {
      const parsedMetadata = q.metadata ? JSON.stringify(q.metadata) : null;

      const qResult = await pool.query(
        `INSERT INTO quiz_questions (quiz_id, type, question_text, explanation, points, sort_order, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [quizId, q.type, q.question_text, q.explanation || null, q.points, currentOrder++, parsedMetadata]
      );

      const question = qResult.rows[0];

      if (q.type !== 'matching' && q.type !== 'ordering') {
        for (let i = 0; i < q.options.length; i++) {
          await pool.query(
            `INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
             VALUES ($1, $2, $3, $4)`,
            [question.id, q.options[i].text, q.options[i].is_correct, i]
          );
        }
      }

      imported.push(question);
    }

    res.status(201).json({
      total: results.length,
      imported: imported.length,
      errors: results.filter(r => !r.valid).map(r => ({ row: r.row, errors: r.errors })),
      questions: imported
    });
  } catch (err) {
    console.error('POST /quizzes/:id/import-csv error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// توليد أسئلة بالذكاء الاصطناعي (Claude API)
// ═══════════════════════════════════════
router.post('/:id/generate', aiUpload.single('file'), async (req, res) => {
  let tempFilePath = null;

  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ message: 'مفتاح Anthropic غير مُعرّف. أضف ANTHROPIC_API_KEY في ملف .env' });
    }

    const { prompt, count = 5, difficulty = 'medium', stage, grade, subject } = req.body;

    // types يأتي كـ JSON string من FormData
    let types;
    try {
      types = req.body.types ? JSON.parse(req.body.types) : ['multiple_choice', 'true_false'];
    } catch {
      types = ['multiple_choice', 'true_false'];
    }

    if (!prompt || prompt.trim().length < 5) {
      return res.status(400).json({ message: 'يجب كتابة وصف الأسئلة المطلوبة (5 أحرف على الأقل)' });
    }

    // حفظ مسار الملف المؤقت لحذفه لاحقاً
    if (req.file) {
      tempFilePath = req.file.path;
    }

    // lazy-load Anthropic SDK
    let Anthropic;
    try {
      Anthropic = require('@anthropic-ai/sdk');
    } catch {
      return res.status(503).json({ message: 'مكتبة @anthropic-ai/sdk غير مثبتة' });
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // بناء وصف الأنواع
    const typeDescriptions = {
      multiple_choice: 'اختيار من متعدد (4 خيارات، واحد صحيح)',
      true_false: 'صح أو خطأ',
      fill_blank: 'إملاء الفراغ (إجابة نصية قصيرة)',
      matching: 'توصيل (أزواج يسار-يمين)',
      ordering: 'ترتيب (عناصر بالترتيب الصحيح)'
    };

    const allowedTypes = types.map(t => `- ${typeDescriptions[t] || t}`).join('\n');

    // بناء سياق إضافي
    const difficultyMap = { easy: 'سهل', medium: 'متوسط', hard: 'صعب' };
    let contextParts = [];
    if (stage) contextParts.push(`المرحلة: ${stage}`);
    if (grade) contextParts.push(`الصف: ${grade}`);
    if (subject) contextParts.push(`المادة: ${subject}`);
    if (difficulty) contextParts.push(`مستوى الصعوبة: ${difficultyMap[difficulty] || difficulty}`);
    const contextStr = contextParts.length > 0 ? `\n\nالسياق التعليمي:\n${contextParts.join('\n')}` : '';

    const systemPrompt = `أنت مُعلّم خبير في إنشاء الاختبارات التعليمية. أنشئ أسئلة اختبار باللغة العربية بصيغة JSON.
${contextStr}

القواعد:
- أنشئ بالضبط ${Math.min(parseInt(count), 20)} سؤال
- استخدم فقط هذه الأنواع:
${allowedTypes}
- كل سؤال يجب أن يكون واضح ودقيق ومناسب للمستوى المطلوب
- وفّر تفسير مختصر لكل سؤال
- إذا تم رفع ملف (صورة أو PDF)، استخرج الأسئلة من محتواه

أرجع JSON فقط (بدون markdown أو نص إضافي) بالصيغة التالية:
{
  "questions": [
    {
      "type": "multiple_choice",
      "question_text": "نص السؤال",
      "explanation": "تفسير الإجابة",
      "points": 1,
      "options": [
        {"text": "الخيار 1", "is_correct": true},
        {"text": "الخيار 2", "is_correct": false},
        {"text": "الخيار 3", "is_correct": false},
        {"text": "الخيار 4", "is_correct": false}
      ]
    },
    {
      "type": "true_false",
      "question_text": "العبارة",
      "explanation": "التفسير",
      "points": 1,
      "options": [
        {"text": "صح", "is_correct": true},
        {"text": "خطأ", "is_correct": false}
      ]
    },
    {
      "type": "fill_blank",
      "question_text": "أكمل: عاصمة مصر هي ___",
      "explanation": "التفسير",
      "points": 1,
      "options": [{"text": "القاهرة", "is_correct": true}]
    },
    {
      "type": "matching",
      "question_text": "صل بين المصطلح والتعريف",
      "explanation": "التفسير",
      "points": 1,
      "metadata": {"pairs": [{"left": "H2O", "right": "ماء"}, {"left": "NaCl", "right": "ملح"}]}
    },
    {
      "type": "ordering",
      "question_text": "رتب الأرقام تصاعدياً",
      "explanation": "التفسير",
      "points": 1,
      "metadata": {"items": ["واحد", "اثنان", "ثلاثة"]}
    }
  ]
}`;

    // بناء محتوى الرسالة
    let userContent = [];

    // إذا يوجد ملف، تحضيره لـ Claude vision
    if (req.file) {
      try {
        const fileBlocks = await prepareFileForClaude(req.file.path, req.file.mimetype);
        userContent.push(...fileBlocks);
        tempFilePath = null; // تم حذفه داخل prepareFileForClaude
      } catch (fileErr) {
        console.error('خطأ في تحضير الملف:', fileErr.message);
        // نكمل بدون الملف
      }
    }

    userContent.push({ type: 'text', text: prompt.trim() });

    // استدعاء Claude API
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }]
    });

    const responseText = message.content[0]?.text;
    if (!responseText) {
      return res.status(500).json({ message: 'لم يتم الحصول على استجابة من الذكاء الاصطناعي' });
    }

    const generated = parseClaudeJson(responseText);
    if (!generated || !generated.questions) {
      console.error('فشل تحليل JSON من Claude:', responseText.substring(0, 500));
      return res.status(500).json({ message: 'خطأ في تحليل استجابة الذكاء الاصطناعي' });
    }

    const questions = generated.questions || [];

    res.json({
      count: questions.length,
      questions,
      usage: {
        input_tokens: message.usage?.input_tokens,
        output_tokens: message.usage?.output_tokens
      }
    });
  } catch (err) {
    console.error('POST /quizzes/:id/generate error:', err.message);
    if (err.status === 401 || err.error?.type === 'authentication_error') {
      return res.status(503).json({ message: 'مفتاح Anthropic غير صالح' });
    }
    if (err.status === 429) {
      return res.status(429).json({ message: 'تم تجاوز حد الاستخدام. حاول مرة أخرى لاحقاً' });
    }
    res.status(500).json({ message: 'خطأ في التوليد بالذكاء الاصطناعي' });
  } finally {
    // حذف الملف المؤقت إذا لم يُحذف بعد
    if (tempFilePath) {
      try { fs.unlinkSync(tempFilePath); } catch {}
    }
  }
});

// ═══════════════════════════════════════
// التحقق من توفر AI
// ═══════════════════════════════════════
router.get('/ai-status', async (req, res) => {
  res.json({ available: !!process.env.ANTHROPIC_API_KEY });
});

module.exports = router;
