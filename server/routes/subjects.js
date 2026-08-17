const express = require('express');
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');
const authMiddleware = require('../middleware/auth');
const { createUpload } = require('../middleware/upload');

const upload = createUpload('subjects');
const router = express.Router();

router.use(authMiddleware);

function generateSlug(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\u0621-\u064Aa-z0-9-]/g, '')
    .substring(0, 100) + '-' + Date.now();
}

// استعلام لجلب المادة مع الصفوف والمسارات وعدد الدروس
const SUBJECT_QUERY = `
  SELECT s.*,
    (SELECT COUNT(*) FROM lessons WHERE subject_id = s.id) as lessons_count,
    COALESCE(
      (SELECT json_agg(json_build_object('grade_id', g.id, 'grade_name', g.name, 'stage_id', st.id, 'stage_name', st.name))
       FROM subject_grades sg
       JOIN grades g ON sg.grade_id = g.id
       JOIN stages st ON g.stage_id = st.id
       WHERE sg.subject_id = s.id), '[]'
    ) as grades,
    COALESCE(
      (SELECT json_agg(json_build_object('track_id', t.id, 'track_name', t.name, 'stage_id', st2.id, 'stage_name', st2.name, 'icon', t.icon))
       FROM subject_tracks str
       JOIN tracks t ON str.track_id = t.id
       JOIN stages st2 ON t.stage_id = st2.id
       WHERE str.subject_id = s.id), '[]'
    ) as tracks
`;

// جلب جميع المواد مع دعم الفلتر والترتيب
router.get('/', async (req, res) => {
  try {
    const { grade_id, track_id, stage_id, sort } = req.query;
    const params = [];
    const conditions = [];

    // الفلاتر تتجمع بـ AND حتى يمكن طلب "مواد صف معين داخل مسار معين"
    if (grade_id) {
      params.push(grade_id);
      conditions.push(`s.id IN (SELECT subject_id FROM subject_grades WHERE grade_id = $${params.length})`);
    }

    if (track_id) {
      params.push(track_id);
      conditions.push(`s.id IN (SELECT subject_id FROM subject_tracks WHERE track_id = $${params.length})`);
    }

    if (stage_id && !grade_id && !track_id) {
      // فلتر حسب المرحلة: المواد المرتبطة بصفوف في هذه المرحلة أو مسارات في هذه المرحلة
      params.push(stage_id);
      conditions.push(`(s.id IN (
          SELECT sg.subject_id FROM subject_grades sg
          JOIN grades g ON sg.grade_id = g.id
          WHERE g.stage_id = $${params.length}
        ) OR s.id IN (
          SELECT st.subject_id FROM subject_tracks st
          JOIN tracks t ON st.track_id = t.id
          WHERE t.stage_id = $${params.length}
        ))`);
    }

    let query = `${SUBJECT_QUERY} FROM subjects s`;
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    // ترتيب
    if (sort === 'name') {
      query += ' ORDER BY s.name ASC';
    } else if (sort === 'newest') {
      query += ' ORDER BY s.created_at DESC';
    } else if (sort === 'oldest') {
      query += ' ORDER BY s.created_at ASC';
    } else {
      query += ' ORDER BY s.sort_order ASC, s.created_at DESC';
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('GET /subjects error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// إضافة مادة جديدة
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { name, grade_ids, track_ids, icon, template_key, description, keywords } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'اسم المادة مطلوب' });
    }

    const parsedGradeIds = grade_ids ? JSON.parse(grade_ids) : [];
    const parsedTrackIds = track_ids ? JSON.parse(track_ids) : [];

    // كل مادة تخص صفاً واحداً — لكل صف مادة مستقلة بدروسها
    if (parsedGradeIds.length > 1) {
      return res.status(400).json({
        message: 'كل مادة تخص صفاً واحداً فقط. لإضافتها لصف آخر أنشئ مادة مستقلة له.'
      });
    }

    const firstGradeId = parsedGradeIds.length > 0 ? parsedGradeIds[0] : null;

    const slug = generateSlug(name);
    const image_url = req.file ? `/uploads/subjects/${req.file.filename}` : null;
    const maxOrder = await pool.query(
      'SELECT COALESCE(MAX(sort_order), 0) + 1 as next FROM subjects'
    );

    const result = await pool.query(
      `INSERT INTO subjects (name, slug, grade_id, image_url, icon, sort_order, template_key, description, keywords)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [name, slug, firstGradeId, image_url, icon || null, maxOrder.rows[0].next,
       template_key || null, description || null, keywords || null]
    );

    const subjectId = result.rows[0].id;

    // ربط المادة بالصفوف
    for (const gradeId of parsedGradeIds) {
      await pool.query(
        'INSERT INTO subject_grades (subject_id, grade_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [subjectId, gradeId]
      );
    }

    // ربط المادة بالمسارات
    for (const trackId of parsedTrackIds) {
      await pool.query(
        'INSERT INTO subject_tracks (subject_id, track_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [subjectId, trackId]
      );
    }

    // إرجاع المادة
    const subject = await pool.query(
      `${SUBJECT_QUERY} FROM subjects s WHERE s.id = $1`,
      [subjectId]
    );
    res.status(201).json(subject.rows[0]);
  } catch (err) {
    console.error('POST /subjects error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// تعديل مادة
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const {
      name, grade_ids, track_ids, icon, description, keywords,
      template_key, sort_order, is_active, remove_image
    } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'اسم المادة مطلوب' });
    }

    const existing = await pool.query('SELECT * FROM subjects WHERE id = $1', [req.params.id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ message: 'المادة غير موجودة' });
    }

    const prev = existing.rows[0];
    const removeImage = remove_image === 'true' || remove_image === true;

    let image_url = prev.image_url;
    // الصورة والأيقونة يستبعد أحدهما الآخر
    if (req.file) {
      image_url = `/uploads/subjects/${req.file.filename}`;
    } else if (removeImage || (icon && icon !== prev.icon)) {
      image_url = null;
    }

    // حذف الملف القديم من القرص إذا لم يعد مستخدماً
    if (prev.image_url && prev.image_url !== image_url) {
      fs.unlink(path.join(__dirname, '..', prev.image_url), () => {});
    }

    let finalIcon = icon !== undefined ? (icon || null) : prev.icon;
    if (req.file) finalIcon = null;

    const parsedGradeIds = grade_ids !== undefined ? JSON.parse(grade_ids) : null;
    const parsedTrackIds = track_ids !== undefined ? JSON.parse(track_ids) : null;

    // كل مادة تخص صفاً واحداً — لكل صف مادة مستقلة بدروسها
    if (parsedGradeIds && parsedGradeIds.length > 1) {
      return res.status(400).json({
        message: 'كل مادة تخص صفاً واحداً فقط. لإضافتها لصف آخر أنشئ مادة مستقلة له.'
      });
    }

    // grade_id يبقى مطابقاً لجدول subject_grades حتى لا تتعارض البيانات
    const firstGradeId = parsedGradeIds !== null
      ? (parsedGradeIds.length > 0 ? parsedGradeIds[0] : null)
      : prev.grade_id;

    const finalDescription = description !== undefined ? (description || null) : prev.description;
    const finalKeywords = keywords !== undefined ? (keywords || null) : prev.keywords;
    const finalTemplateKey = template_key !== undefined ? (template_key || null) : prev.template_key;
    const finalSortOrder = sort_order !== undefined && sort_order !== '' ? parseInt(sort_order, 10) : prev.sort_order;
    const finalIsActive = is_active !== undefined ? (is_active === 'true' || is_active === true) : prev.is_active;

    await pool.query(
      `UPDATE subjects SET name = $1, image_url = $2, grade_id = $3, icon = $4, description = $5,
         keywords = $6, template_key = $7, sort_order = $8, is_active = $9, updated_at = NOW()
       WHERE id = $10`,
      [name, image_url, firstGradeId, finalIcon, finalDescription, finalKeywords,
       finalTemplateKey, finalSortOrder, finalIsActive, req.params.id]
    );

    // تحديث ربط الصفوف
    if (parsedGradeIds !== null) {
      await pool.query('DELETE FROM subject_grades WHERE subject_id = $1', [req.params.id]);
      for (const gradeId of parsedGradeIds) {
        await pool.query(
          'INSERT INTO subject_grades (subject_id, grade_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [req.params.id, gradeId]
        );
      }
    }

    // تحديث ربط المسارات
    if (parsedTrackIds !== null) {
      await pool.query('DELETE FROM subject_tracks WHERE subject_id = $1', [req.params.id]);
      for (const trackId of parsedTrackIds) {
        await pool.query(
          'INSERT INTO subject_tracks (subject_id, track_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [req.params.id, trackId]
        );
      }
    }

    // إرجاع المادة
    const subject = await pool.query(
      `${SUBJECT_QUERY} FROM subjects s WHERE s.id = $1`,
      [req.params.id]
    );
    res.json(subject.rows[0]);
  } catch (err) {
    console.error('PUT /subjects error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// تحديث ترتيب المواد
router.put('/reorder/batch', async (req, res) => {
  try {
    const { orders } = req.body;
    if (!orders || !Array.isArray(orders)) {
      return res.status(400).json({ message: 'بيانات الترتيب مطلوبة' });
    }

    for (const item of orders) {
      await pool.query(
        'UPDATE subjects SET sort_order = $1, updated_at = NOW() WHERE id = $2',
        [item.sort_order, item.id]
      );
    }

    res.json({ message: 'تم تحديث الترتيب بنجاح' });
  } catch (err) {
    console.error('PUT /subjects/reorder error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ربط مادة موجودة بصفوف/مسارات إضافية
router.post('/:id/link-grades', async (req, res) => {
  try {
    const { grade_ids, track_ids } = req.body;
    const subjectId = req.params.id;

    const existing = await pool.query('SELECT * FROM subjects WHERE id = $1', [subjectId]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ message: 'المادة غير موجودة' });
    }

    const parsedGradeIds = grade_ids || [];
    const parsedTrackIds = track_ids || [];

    if (parsedGradeIds.length === 0 && parsedTrackIds.length === 0) {
      return res.status(400).json({ message: 'يجب تحديد صف أو مسار واحد على الأقل' });
    }

    // التحقق من عدم تكرار الربط بالصفوف
    const existingGrades = await pool.query(
      'SELECT grade_id FROM subject_grades WHERE subject_id = $1 AND grade_id = ANY($2::uuid[])',
      [subjectId, parsedGradeIds]
    );
    if (existingGrades.rows.length > 0) {
      const dupIds = existingGrades.rows.map(r => r.grade_id);
      const gradeNames = await pool.query('SELECT name FROM grades WHERE id = ANY($1::uuid[])', [dupIds]);
      const names = gradeNames.rows.map(r => r.name).join('، ');
      return res.status(400).json({ message: `هذه المادة مضافة مسبقاً للصفوف: ${names}` });
    }

    // ربط بالصفوف الجديدة
    for (const gradeId of parsedGradeIds) {
      await pool.query(
        'INSERT INTO subject_grades (subject_id, grade_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [subjectId, gradeId]
      );
    }

    // ربط بالمسارات الجديدة
    for (const trackId of parsedTrackIds) {
      await pool.query(
        'INSERT INTO subject_tracks (subject_id, track_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [subjectId, trackId]
      );
    }

    // إرجاع المادة محدثة
    const subject = await pool.query(
      `${SUBJECT_QUERY} FROM subjects s WHERE s.id = $1`,
      [subjectId]
    );
    res.json(subject.rows[0]);
  } catch (err) {
    console.error('POST /subjects/:id/link-grades error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// نسخ مادة لصفوف أخرى (مع/بدون دروس)
router.post('/:id/copy', async (req, res) => {
  try {
    const sourceSubjectId = req.params.id;
    const { grade_ids, track_ids, copy_lessons } = req.body;

    // 1. جلب المادة المصدر
    const source = await pool.query('SELECT * FROM subjects WHERE id = $1', [sourceSubjectId]);
    if (source.rowCount === 0) {
      return res.status(404).json({ message: 'المادة غير موجودة' });
    }
    const src = source.rows[0];

    const parsedGradeIds = grade_ids ? JSON.parse(grade_ids) : [];
    const parsedTrackIds = track_ids ? JSON.parse(track_ids) : [];

    if (parsedGradeIds.length === 0 && parsedTrackIds.length === 0) {
      return res.status(400).json({ message: 'يجب تحديد صف أو مسار واحد على الأقل' });
    }

    // نسخة مستقلة لكل صف — كل صف له دروسه الخاصة
    const targetGrades = parsedGradeIds.length > 0 ? parsedGradeIds : [null];
    const createdIds = [];

    for (const targetGradeId of targetGrades) {
      // مسارات هذا الصف فقط (إن كان الصف مرتبطاً بمسارات)
      let gradeTrackIds = parsedTrackIds;
      if (targetGradeId && parsedTrackIds.length > 0) {
        const allowed = await pool.query(
          'SELECT track_id FROM grade_tracks WHERE grade_id = $1 AND track_id = ANY($2::uuid[])',
          [targetGradeId, parsedTrackIds]
        );
        const allowedIds = allowed.rows.map(r => r.track_id);
        if (allowedIds.length > 0) gradeTrackIds = allowedIds;
      }

      const slug = generateSlug(src.name);
      const maxOrder = await pool.query('SELECT COALESCE(MAX(sort_order), 0) + 1 as next FROM subjects');

      const newSubject = await pool.query(
        `INSERT INTO subjects (name, slug, grade_id, image_url, icon, sort_order, template_key, description, keywords)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [src.name, slug, targetGradeId, src.image_url, src.icon, maxOrder.rows[0].next,
         src.template_key, src.description, src.keywords]
      );
      const newSubjectId = newSubject.rows[0].id;
      createdIds.push(newSubjectId);

      if (targetGradeId) {
        await pool.query(
          'INSERT INTO subject_grades (subject_id, grade_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [newSubjectId, targetGradeId]
        );
      }
      for (const trackId of gradeTrackIds) {
        await pool.query(
          'INSERT INTO subject_tracks (subject_id, track_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [newSubjectId, trackId]
        );
      }

      // نسخ الدروس إذا طُلب
      if (copy_lessons === 'true' || copy_lessons === true) {
        const lessons = await pool.query(
          'SELECT * FROM lessons WHERE subject_id = $1 ORDER BY sort_order',
          [sourceSubjectId]
        );

        for (const lesson of lessons.rows) {
          const lessonSlug = lesson.slug
            ? lesson.slug + '-copy-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6)
            : null;
          const newLesson = await pool.query(
            `INSERT INTO lessons (subject_id, grade_id, track_id, title, description, semester, sort_order, type, keywords, seo_title, seo_description, slug, thumbnail_url, category, is_published, is_featured)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *`,
            [
              newSubjectId, targetGradeId,
              gradeTrackIds.length > 0 ? gradeTrackIds[0] : null,
              lesson.title, lesson.description, lesson.semester, lesson.sort_order,
              lesson.type, lesson.keywords, lesson.seo_title, lesson.seo_description,
              lessonSlug, lesson.thumbnail_url, lesson.category,
              lesson.is_published, lesson.is_featured
            ]
          );
          const newLessonId = newLesson.rows[0].id;

          if (targetGradeId) {
            await pool.query(
              'INSERT INTO lesson_grades (lesson_id, grade_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
              [newLessonId, targetGradeId]
            );
          }
          for (const trackId of gradeTrackIds) {
            await pool.query(
              'INSERT INTO lesson_tracks (lesson_id, track_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
              [newLessonId, trackId]
            );
          }

          // نسخ ملفات الدرس (المرجعية فقط — نفس الملفات الفعلية)
          const files = await pool.query(
            'SELECT * FROM lesson_files WHERE lesson_id = $1 ORDER BY sort_order',
            [lesson.id]
          );
          for (const file of files.rows) {
            await pool.query(
              `INSERT INTO lesson_files (lesson_id, file_url, file_name, original_name, file_type, mime_type, file_size, sort_order)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [newLessonId, file.file_url, file.file_name, file.original_name, file.file_type, file.mime_type, file.file_size, file.sort_order]
            );
          }
        }
      }
    }

    // إرجاع المواد الجديدة مع البيانات الكاملة
    const subjects = await pool.query(
      `${SUBJECT_QUERY} FROM subjects s WHERE s.id = ANY($1::uuid[]) ORDER BY s.sort_order`,
      [createdIds]
    );
    res.status(201).json(subjects.rows);
  } catch (err) {
    console.error('POST /subjects/:id/copy error:', err.message);
    res.status(500).json({ message: 'خطأ في نسخ المادة' });
  }
});

// حذف مادة
router.delete('/:id', async (req, res) => {
  try {
    const existing = await pool.query('SELECT * FROM subjects WHERE id = $1', [req.params.id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ message: 'المادة غير موجودة' });
    }

    if (existing.rows[0].image_url) {
      const filePath = path.join(__dirname, '..', existing.rows[0].image_url);
      fs.unlink(filePath, () => {});
    }

    await pool.query('DELETE FROM subjects WHERE id = $1', [req.params.id]);
    res.json({ message: 'تم حذف المادة بنجاح' });
  } catch (err) {
    console.error('DELETE /subjects error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

module.exports = router;
