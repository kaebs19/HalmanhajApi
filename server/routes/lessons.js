const express = require('express');
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');
const authMiddleware = require('../middleware/auth');
const { createLessonUpload } = require('../middleware/upload');

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

// إنشاء درس جديد مع ملفات
router.post('/', upload.array('files', 10), async (req, res) => {
  try {
    const { subject_id, grade_id, track_id, title, description, semester, type, keywords,
            seo_title, seo_description, slug, thumbnail_url, category, is_published, is_featured } = req.body;

    // دعم المصفوفات (من النموذج الجديد)
    const gradeIds = req.body.grade_ids ? JSON.parse(req.body.grade_ids) : [];
    const trackIds = req.body.track_ids ? JSON.parse(req.body.track_ids) : [];

    if (!subject_id || !title) {
      return res.status(400).json({ message: 'معرف المادة وعنوان الدرس مطلوبان' });
    }

    const maxOrder = await pool.query(
      'SELECT COALESCE(MAX(sort_order), 0) + 1 as next FROM lessons WHERE subject_id = $1',
      [subject_id]
    );

    // التوافق: grade_id القديم أو أول عنصر من المصفوفة
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
    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        await pool.query(
          `INSERT INTO lesson_files (lesson_id, file_url, file_name, original_name, file_type, mime_type, file_size, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            lessonId,
            `/uploads/lessons/${file.filename}`,
            file.filename,
            file.originalname,
            getFileType(file.mimetype),
            file.mimetype,
            file.size,
            i + 1
          ]
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

    res.status(201).json(lesson.rows[0]);
  } catch (err) {
    console.error('POST /lessons error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
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

// إضافة ملفات لدرس موجود
router.post('/:id/files', upload.array('files', 10), async (req, res) => {
  try {
    const existing = await pool.query('SELECT * FROM lessons WHERE id = $1', [req.params.id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ message: 'الدرس غير موجود' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'لم يتم إرفاق ملفات' });
    }

    const maxOrder = await pool.query(
      'SELECT COALESCE(MAX(sort_order), 0) as max FROM lesson_files WHERE lesson_id = $1',
      [req.params.id]
    );
    let nextOrder = maxOrder.rows[0].max + 1;

    for (const file of req.files) {
      await pool.query(
        `INSERT INTO lesson_files (lesson_id, file_url, file_name, original_name, file_type, mime_type, file_size, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          req.params.id,
          `/uploads/lessons/${file.filename}`,
          file.filename,
          file.originalname,
          getFileType(file.mimetype),
          file.mimetype,
          file.size,
          nextOrder++
        ]
      );
    }

    // إرجاع الملفات المحدثة
    const files = await pool.query(
      'SELECT * FROM lesson_files WHERE lesson_id = $1 ORDER BY sort_order ASC',
      [req.params.id]
    );
    res.status(201).json(files.rows);
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

    await pool.query('DELETE FROM lessons WHERE id = $1', [req.params.id]);
    res.json({ message: 'تم حذف الدرس بنجاح' });
  } catch (err) {
    console.error('DELETE /lessons/:id error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

module.exports = router;
