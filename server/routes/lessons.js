const express = require('express');
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');
const authMiddleware = require('../middleware/auth');
const { createLessonUpload } = require('../middleware/upload');
const { startBackgroundConversion, reconvertFile } = require('../services/pdfConverter');

const upload = createLessonUpload('lessons');
const router = express.Router();

router.use(authMiddleware);

function getFileType(mimetype) {
  if (mimetype === 'application/pdf') return 'pdf';
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  return 'document';
}

// توليد الكلمات المفتاحية ذكياً
function generateKeywords(subjectName, gradeNames, trackNames, semesterName, typeName, title) {
  const keywords = new Set();

  // حسب النوع + المادة
  if (typeName === 'حل') {
    keywords.add(`حل كتاب ${subjectName}`);
    keywords.add(`حلول ${subjectName}`);
    keywords.add(`كتاب ${subjectName} محلول`);
  } else if (typeName === 'كتاب') {
    keywords.add(`كتاب ${subjectName}`);
  } else if (typeName === 'تحضير') {
    keywords.add(`تحضير ${subjectName}`);
    keywords.add(`تحضير مادة ${subjectName}`);
  } else if (typeName === 'تجميع') {
    keywords.add(`تجميع ${subjectName}`);
    keywords.add(`تجميعات ${subjectName}`);
  } else if (typeName === 'فيديو') {
    keywords.add(`شرح ${subjectName}`);
    keywords.add(`فيديو ${subjectName}`);
  }

  keywords.add(subjectName);

  // لكل صف
  for (const grade of gradeNames) {
    keywords.add(`${subjectName} ${grade.name}`);
    keywords.add(grade.name);
    keywords.add(`${typeName} ${subjectName} ${grade.name}`);
    if (grade.stage_name) {
      // استخراج اسم المرحلة المختصر (الابتدائية → ابتدائي)
      const shortStage = grade.stage_name.replace('المرحلة ', '').replace('ية', 'ي');
      keywords.add(`${grade.name} ${shortStage}`);
      keywords.add(`${subjectName} ${grade.name} ${shortStage}`);
    }
    if (typeName === 'حل') {
      keywords.add(`حل ${subjectName} ${grade.name}`);
    }
  }

  // لكل مسار
  for (const trackName of trackNames) {
    keywords.add(`${subjectName} ${trackName}`);
    keywords.add(`${typeName} ${subjectName} ${trackName}`);
  }

  // الفصل الدراسي
  if (semesterName !== 'الفصلين') {
    keywords.add(`${typeName} ${subjectName} ${semesterName}`);
    keywords.add(`${subjectName} ${semesterName}`);
    for (const grade of gradeNames) {
      keywords.add(`${typeName} ${subjectName} ${grade.name} ${semesterName}`);
    }
  }

  // العنوان
  if (title && title.trim()) {
    keywords.add(title.trim());
  }

  return [...keywords];
}

// جلب دروس مادة محددة لصف أو مسار
router.get('/', async (req, res) => {
  try {
    const { subject_id, grade_id, track_id, semester, shared_only } = req.query;

    if (!subject_id) {
      return res.status(400).json({ message: 'معرف المادة مطلوب' });
    }

    let query = `
      SELECT l.*,
        COALESCE(
          (SELECT json_agg(
            json_build_object(
              'id', lf.id, 'file_url', lf.file_url, 'file_name', lf.file_name,
              'original_name', lf.original_name, 'file_type', lf.file_type,
              'mime_type', lf.mime_type, 'file_size', lf.file_size, 'sort_order', lf.sort_order
            ) ORDER BY lf.sort_order ASC
          ) FROM lesson_files lf WHERE lf.lesson_id = l.id), '[]'
        ) as files
      FROM lessons l
      WHERE l.subject_id = $1 AND l.is_active = true
    `;
    const params = [subject_id];
    let paramIndex = 2;

    if (shared_only === 'true') {
      // جلب الدروس المشتركة فقط (بدون صف أو مسار)
      query += ` AND l.id NOT IN (SELECT lesson_id FROM lesson_grades) AND l.id NOT IN (SELECT lesson_id FROM lesson_tracks)`;
    } else {
      if (grade_id) {
        // البحث في جدول العلاقات أو في الحقل المباشر
        query += ` AND (l.id IN (SELECT lesson_id FROM lesson_grades WHERE grade_id = $${paramIndex}) OR l.grade_id = $${paramIndex} OR (l.grade_id IS NULL AND l.id NOT IN (SELECT lesson_id FROM lesson_grades)))`;
        params.push(grade_id);
        paramIndex++;
      }
      if (track_id) {
        query += ` AND (l.id IN (SELECT lesson_id FROM lesson_tracks WHERE track_id = $${paramIndex}) OR l.track_id = $${paramIndex} OR (l.track_id IS NULL AND l.id NOT IN (SELECT lesson_id FROM lesson_tracks)))`;
        params.push(track_id);
        paramIndex++;
      }
      if (semester) {
        const sem = parseInt(semester);
        query += ` AND (l.semester = $${paramIndex} OR l.semester = 0)`;
        params.push(sem);
        paramIndex++;
      }
    }

    query += ' ORDER BY l.sort_order ASC, l.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('GET /lessons error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// توليد الكلمات المفتاحية
router.post('/generate-keywords', async (req, res) => {
  try {
    const { subject_id, grade_ids, track_ids, semester, type, title } = req.body;

    if (!subject_id) {
      return res.status(400).json({ message: 'معرف المادة مطلوب' });
    }

    const subjectResult = await pool.query('SELECT name FROM subjects WHERE id = $1', [subject_id]);
    if (subjectResult.rowCount === 0) {
      return res.status(404).json({ message: 'المادة غير موجودة' });
    }
    const subjectName = subjectResult.rows[0].name;

    let gradeNames = [];
    if (grade_ids && grade_ids.length > 0) {
      const gradesResult = await pool.query(
        'SELECT g.name, s.name as stage_name FROM grades g JOIN stages s ON g.stage_id = s.id WHERE g.id = ANY($1::uuid[])',
        [grade_ids]
      );
      gradeNames = gradesResult.rows;
    }

    let trackNames = [];
    if (track_ids && track_ids.length > 0) {
      const tracksResult = await pool.query(
        'SELECT name FROM tracks WHERE id = ANY($1::uuid[])',
        [track_ids]
      );
      trackNames = tracksResult.rows.map(t => t.name);
    }

    const sem = parseInt(semester);
    const semesterName = sem === 1 ? 'الفصل الأول' : sem === 2 ? 'الفصل الثاني' : 'الفصلين';
    const typeName = type || 'حل';

    const keywords = generateKeywords(subjectName, gradeNames, trackNames, semesterName, typeName, title);

    res.json({ keywords: keywords.join(', ') });
  } catch (err) {
    console.error('POST /lessons/generate-keywords error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// جلب درس واحد مع ملفاته
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT l.*,
        COALESCE(
          (SELECT json_agg(
            json_build_object(
              'id', lf.id, 'file_url', lf.file_url, 'file_name', lf.file_name,
              'original_name', lf.original_name, 'file_type', lf.file_type,
              'mime_type', lf.mime_type, 'file_size', lf.file_size, 'sort_order', lf.sort_order
            ) ORDER BY lf.sort_order ASC
          ) FROM lesson_files lf WHERE lf.lesson_id = l.id), '[]'
        ) as files
      FROM lessons l
      WHERE l.id = $1
    `, [req.params.id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'الدرس غير موجود' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('GET /lessons/:id error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// دالة مشتركة: إنشاء درس مع ملفات (تدعم multer و tus)
async function createLessonWithFiles(req, res, filesData) {
  try {
    const { subject_id, grade_id, track_id, title, description, semester, type, keywords,
            seo_title, seo_description, slug, thumbnail_url, category, is_published, is_featured } = req.body;

    const gradeIds = req.body.grade_ids ? JSON.parse(req.body.grade_ids) : [];
    const trackIds = req.body.track_ids ? JSON.parse(req.body.track_ids) : [];

    if (!subject_id || !title) {
      return res.status(400).json({ message: 'معرف المادة وعنوان الدرس مطلوبان' });
    }

    const maxOrder = await pool.query(
      'SELECT COALESCE(MAX(sort_order), 0) + 1 as next FROM lessons WHERE subject_id = $1',
      [subject_id]
    );

    const primaryGradeId = gradeIds.length > 0 ? gradeIds[0] : (grade_id || null);
    const primaryTrackId = trackIds.length > 0 ? trackIds[0] : (track_id || null);

    const result = await pool.query(
      `INSERT INTO lessons (subject_id, grade_id, track_id, title, description, semester, sort_order, type, keywords, seo_title, seo_description, slug, thumbnail_url, category, is_published, is_featured)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *`,
      [
        subject_id,
        primaryGradeId,
        primaryTrackId,
        title,
        description || null,
        semester !== undefined && semester !== null && semester !== '' ? parseInt(semester) : 1,
        maxOrder.rows[0].next,
        type || 'حل',
        keywords || null,
        seo_title || null,
        seo_description || null,
        slug || null,
        thumbnail_url || null,
        category || 'حل_كتاب',
        is_published === 'false' ? false : true,
        is_featured === 'true' ? true : false
      ]
    );

    const lessonId = result.rows[0].id;

    // إدخال العلاقات في lesson_grades
    const allGradeIds = [...new Set([...gradeIds, ...(grade_id ? [grade_id] : [])])];
    for (const gId of allGradeIds) {
      await pool.query(
        'INSERT INTO lesson_grades (lesson_id, grade_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [lessonId, gId]
      );
    }

    // إدخال العلاقات في lesson_tracks
    const allTrackIds = [...new Set([...trackIds, ...(track_id ? [track_id] : [])])];
    for (const tId of allTrackIds) {
      await pool.query(
        'INSERT INTO lesson_tracks (lesson_id, track_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [lessonId, tId]
      );
    }

    // إضافة الملفات المرفقة
    if (filesData && filesData.length > 0) {
      for (let i = 0; i < filesData.length; i++) {
        const f = filesData[i];
        await pool.query(
          `INSERT INTO lesson_files (lesson_id, file_url, file_name, original_name, file_type, mime_type, file_size, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [lessonId, f.file_url, f.file_name, f.original_name, f.file_type, f.mime_type, f.file_size, i + 1]
        );
      }
    }

    // إرجاع الدرس مع ملفاته
    const lesson = await pool.query(`
      SELECT l.*,
        COALESCE(
          (SELECT json_agg(
            json_build_object(
              'id', lf.id, 'file_url', lf.file_url, 'file_name', lf.file_name,
              'original_name', lf.original_name, 'file_type', lf.file_type,
              'mime_type', lf.mime_type, 'file_size', lf.file_size, 'sort_order', lf.sort_order
            ) ORDER BY lf.sort_order ASC
          ) FROM lesson_files lf WHERE lf.lesson_id = l.id), '[]'
        ) as files
      FROM lessons l WHERE l.id = $1
    `, [lessonId]);

    // ═══ بدء تحويل PDF لصور في الخلفية ═══
    if (filesData && filesData.length > 0) {
      for (const f of filesData) {
        if (f.mime_type === 'application/pdf') {
          const fileRecord = await pool.query(
            'SELECT id FROM lesson_files WHERE lesson_id = $1 AND file_name = $2',
            [lessonId, f.file_name]
          );
          if (fileRecord.rowCount > 0) {
            const pdfPath = path.join(__dirname, '../uploads/lessons', f.file_name);
            startBackgroundConversion(lessonId, fileRecord.rows[0].id, pdfPath);
          }
        }
      }
    }

    // تنظيف ملفات tus المؤقتة
    if (filesData) {
      for (const f of filesData) {
        const tusInfoPath = path.join(__dirname, '../uploads/lessons', f.file_name + '.json');
        fs.unlink(tusInfoPath, () => {});
        const tusCompletedPath = path.join(__dirname, '../uploads/lessons/.tus-completed', f.file_name + '.json');
        fs.unlink(tusCompletedPath, () => {});
      }
    }

    res.status(201).json({
      ...lesson.rows[0],
      message: 'تم رفع الدرس بنجاح! جاري تحويل ملفات PDF لصور...'
    });
  } catch (err) {
    console.error('POST /lessons error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
}

// إنشاء درس جديد مع ملفات (يدعم multer و tus)
router.post('/', upload.array('files', 10), async (req, res) => {
  // وضع multer: ملفات مرفقة مباشرة
  if (req.files && req.files.length > 0) {
    const filesData = req.files.map(file => ({
      file_url: `/uploads/lessons/${file.filename}`,
      file_name: file.filename,
      original_name: file.originalname,
      file_type: getFileType(file.mimetype),
      mime_type: file.mimetype,
      file_size: file.size
    }));
    return createLessonWithFiles(req, res, filesData);
  }

  // وضع tus: ملفات رُفعت مسبقاً عبر بروتوكول tus
  if (req.body.tus_files) {
    try {
      const tusFiles = typeof req.body.tus_files === 'string'
        ? JSON.parse(req.body.tus_files)
        : req.body.tus_files;

      const filesData = [];
      for (const tf of tusFiles) {
        const filePath = path.join(__dirname, '../uploads/lessons', tf.file_name);
        if (!fs.existsSync(filePath)) {
          return res.status(400).json({ message: `الملف ${tf.original_name} غير موجود. قد تحتاج لإعادة الرفع.` });
        }
        const stat = fs.statSync(filePath);
        filesData.push({
          file_url: `/uploads/lessons/${tf.file_name}`,
          file_name: tf.file_name,
          original_name: tf.original_name,
          file_type: getFileType(tf.mime_type),
          mime_type: tf.mime_type,
          file_size: stat.size
        });
      }
      return createLessonWithFiles(req, res, filesData);
    } catch (err) {
      console.error('POST /lessons tus_files parse error:', err.message);
      return res.status(400).json({ message: 'خطأ في بيانات الملفات' });
    }
  }

  // بدون ملفات
  return createLessonWithFiles(req, res, []);
});

// تعديل بيانات الدرس
router.put('/:id', async (req, res) => {
  try {
    const { title, description, semester, type, keywords,
            seo_title, seo_description, slug, thumbnail_url, category, is_published, is_featured } = req.body;

    if (!title) {
      return res.status(400).json({ message: 'عنوان الدرس مطلوب' });
    }

    const existing = await pool.query('SELECT * FROM lessons WHERE id = $1', [req.params.id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ message: 'الدرس غير موجود' });
    }

    const semVal = semester !== undefined && semester !== null && semester !== '' ? parseInt(semester) : existing.rows[0].semester;
    const typeVal = type || existing.rows[0].type;
    const keywordsVal = keywords !== undefined ? keywords : existing.rows[0].keywords;
    const seoTitleVal = seo_title !== undefined ? seo_title : existing.rows[0].seo_title;
    const seoDescVal = seo_description !== undefined ? seo_description : existing.rows[0].seo_description;
    const slugVal = slug !== undefined ? slug : existing.rows[0].slug;
    const thumbVal = thumbnail_url !== undefined ? thumbnail_url : existing.rows[0].thumbnail_url;
    const categoryVal = category !== undefined ? category : existing.rows[0].category;
    const publishedVal = is_published !== undefined ? (is_published === false || is_published === 'false' ? false : true) : existing.rows[0].is_published;
    const featuredVal = is_featured !== undefined ? (is_featured === true || is_featured === 'true' ? true : false) : existing.rows[0].is_featured;

    await pool.query(
      'UPDATE lessons SET title = $1, description = $2, semester = $3, type = $4, keywords = $5, seo_title = $6, seo_description = $7, slug = $8, thumbnail_url = $9, category = $10, is_published = $11, is_featured = $12 WHERE id = $13',
      [title, description || null, semVal, typeVal, keywordsVal, seoTitleVal || null, seoDescVal || null, slugVal || null, thumbVal || null, categoryVal, publishedVal, featuredVal, req.params.id]
    );

    // إرجاع الدرس محدث
    const lesson = await pool.query(`
      SELECT l.*,
        COALESCE(
          (SELECT json_agg(
            json_build_object(
              'id', lf.id, 'file_url', lf.file_url, 'file_name', lf.file_name,
              'original_name', lf.original_name, 'file_type', lf.file_type,
              'mime_type', lf.mime_type, 'file_size', lf.file_size, 'sort_order', lf.sort_order
            ) ORDER BY lf.sort_order ASC
          ) FROM lesson_files lf WHERE lf.lesson_id = l.id), '[]'
        ) as files
      FROM lessons l WHERE l.id = $1
    `, [req.params.id]);

    res.json(lesson.rows[0]);
  } catch (err) {
    console.error('PUT /lessons/:id error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// دالة مشتركة: إضافة ملفات لدرس موجود
async function addFilesToLesson(req, res, lessonId, filesData) {
  try {
    const maxOrder = await pool.query(
      'SELECT COALESCE(MAX(sort_order), 0) as max FROM lesson_files WHERE lesson_id = $1',
      [lessonId]
    );
    let nextOrder = maxOrder.rows[0].max + 1;

    for (const f of filesData) {
      await pool.query(
        `INSERT INTO lesson_files (lesson_id, file_url, file_name, original_name, file_type, mime_type, file_size, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [lessonId, f.file_url, f.file_name, f.original_name, f.file_type, f.mime_type, f.file_size, nextOrder++]
      );
    }

    // ═══ بدء تحويل PDF لصور في الخلفية ═══
    for (const f of filesData) {
      if (f.mime_type === 'application/pdf') {
        const fileRecord = await pool.query(
          'SELECT id FROM lesson_files WHERE lesson_id = $1 AND file_name = $2',
          [lessonId, f.file_name]
        );
        if (fileRecord.rowCount > 0) {
          const pdfPath = path.join(__dirname, '../uploads/lessons', f.file_name);
          startBackgroundConversion(lessonId, fileRecord.rows[0].id, pdfPath);
        }
      }
    }

    // تنظيف ملفات tus المؤقتة
    for (const f of filesData) {
      const tusInfoPath = path.join(__dirname, '../uploads/lessons', f.file_name + '.json');
      fs.unlink(tusInfoPath, () => {});
      const tusCompletedPath = path.join(__dirname, '../uploads/lessons/.tus-completed', f.file_name + '.json');
      fs.unlink(tusCompletedPath, () => {});
    }

    const files = await pool.query(
      'SELECT * FROM lesson_files WHERE lesson_id = $1 ORDER BY sort_order ASC',
      [lessonId]
    );
    res.status(201).json({
      files: files.rows,
      message: 'تم رفع الملفات بنجاح! جاري تحويل ملفات PDF لصور...'
    });
  } catch (err) {
    console.error('POST /lessons/:id/files error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
}

// إضافة ملفات لدرس موجود (يدعم multer و tus)
router.post('/:id/files', upload.array('files', 10), async (req, res) => {
  try {
    const existing = await pool.query('SELECT * FROM lessons WHERE id = $1', [req.params.id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ message: 'الدرس غير موجود' });
    }

    // وضع multer
    if (req.files && req.files.length > 0) {
      const filesData = req.files.map(file => ({
        file_url: `/uploads/lessons/${file.filename}`,
        file_name: file.filename,
        original_name: file.originalname,
        file_type: getFileType(file.mimetype),
        mime_type: file.mimetype,
        file_size: file.size
      }));
      return addFilesToLesson(req, res, req.params.id, filesData);
    }

    // وضع tus
    if (req.body.tus_files) {
      const tusFiles = typeof req.body.tus_files === 'string'
        ? JSON.parse(req.body.tus_files)
        : req.body.tus_files;

      const filesData = [];
      for (const tf of tusFiles) {
        const filePath = path.join(__dirname, '../uploads/lessons', tf.file_name);
        if (!fs.existsSync(filePath)) {
          return res.status(400).json({ message: `الملف ${tf.original_name} غير موجود. قد تحتاج لإعادة الرفع.` });
        }
        const stat = fs.statSync(filePath);
        filesData.push({
          file_url: `/uploads/lessons/${tf.file_name}`,
          file_name: tf.file_name,
          original_name: tf.original_name,
          file_type: getFileType(tf.mime_type),
          mime_type: tf.mime_type,
          file_size: stat.size
        });
      }
      return addFilesToLesson(req, res, req.params.id, filesData);
    }

    return res.status(400).json({ message: 'لم يتم إرفاق ملفات' });
  } catch (err) {
    console.error('POST /lessons/:id/files error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// حذف ملف من درس
router.delete('/:id/files/:fileId', async (req, res) => {
  try {
    const file = await pool.query(
      'SELECT * FROM lesson_files WHERE id = $1 AND lesson_id = $2',
      [req.params.fileId, req.params.id]
    );

    if (file.rowCount === 0) {
      return res.status(404).json({ message: 'الملف غير موجود' });
    }

    // حذف الملف الفعلي
    const filePath = path.join(__dirname, '..', file.rows[0].file_url);
    fs.unlink(filePath, () => {});

    await pool.query('DELETE FROM lesson_files WHERE id = $1', [req.params.fileId]);

    res.json({ message: 'تم حذف الملف بنجاح' });
  } catch (err) {
    console.error('DELETE /lessons/:id/files/:fileId error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// إعادة ترتيب الدروس
router.put('/reorder/batch', async (req, res) => {
  try {
    const { orders } = req.body;
    if (!orders || !Array.isArray(orders)) {
      return res.status(400).json({ message: 'بيانات الترتيب مطلوبة' });
    }

    for (const item of orders) {
      await pool.query(
        'UPDATE lessons SET sort_order = $1 WHERE id = $2',
        [item.sort_order, item.id]
      );
    }

    res.json({ message: 'تم تحديث الترتيب بنجاح' });
  } catch (err) {
    console.error('PUT /lessons/reorder error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// حالة تحويل صفحات PDF
router.get('/:id/pages-status', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT lf.id, lf.file_name, lf.pages_status, lf.page_count,
        (SELECT COUNT(*) FROM lesson_pages lp WHERE lp.file_id = lf.id) as converted_pages
      FROM lesson_files lf
      WHERE lf.lesson_id = $1 AND lf.file_type = 'pdf'
    `, [req.params.id]);

    res.json(result.rows);
  } catch (err) {
    console.error('GET pages-status error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// إعادة تحويل ملف PDF لصور
router.post('/:id/reconvert/:fileId', async (req, res) => {
  try {
    const result = await reconvertFile(req.params.fileId);
    res.json({
      message: `تم تحويل ${result.convertedPages} من ${result.totalPages} صفحة`,
      ...result
    });
  } catch (err) {
    console.error('POST reconvert error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// حذف درس وجميع ملفاته
router.delete('/:id', async (req, res) => {
  try {
    const existing = await pool.query('SELECT * FROM lessons WHERE id = $1', [req.params.id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ message: 'الدرس غير موجود' });
    }

    // حذف الملفات الفعلية
    const files = await pool.query('SELECT * FROM lesson_files WHERE lesson_id = $1', [req.params.id]);
    for (const file of files.rows) {
      const filePath = path.join(__dirname, '..', file.file_url);
      fs.unlink(filePath, () => {});
    }

    // حذف صور الصفحات المحولة
    const pagesDir = path.join(__dirname, '../uploads/pages', req.params.id);
    if (fs.existsSync(pagesDir)) {
      fs.rmSync(pagesDir, { recursive: true, force: true });
    }

    await pool.query('DELETE FROM lessons WHERE id = $1', [req.params.id]);
    res.json({ message: 'تم حذف الدرس بنجاح' });
  } catch (err) {
    console.error('DELETE /lessons/:id error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

module.exports = router;
