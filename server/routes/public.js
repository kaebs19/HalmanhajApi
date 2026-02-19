const express = require('express');
const { pool } = require('../config/db');

const router = express.Router();

// ═══════════════════════════════════════
// بيانات التنقل (الهيدر)
// ═══════════════════════════════════════
router.get('/navigation', async (req, res) => {
  try {
    const stages = await pool.query(`
      SELECT s.id, s.name, s.slug, s.public_slug, s.icon, s.image_url,
        COALESCE(
          (SELECT json_agg(
            json_build_object(
              'id', g.id, 'name', g.name, 'slug', g.slug, 'public_slug', g.public_slug,
              'track_id', g.track_id, 'track_name', t.name
            ) ORDER BY g.sort_order
          )
          FROM grades g
          LEFT JOIN tracks t ON g.track_id = t.id
          WHERE g.stage_id = s.id
        ), '[]') as grades,
        COALESCE(
          (SELECT json_agg(
            json_build_object('id', t.id, 'name', t.name, 'slug', t.slug, 'icon', t.icon)
            ORDER BY t.sort_order
          )
          FROM tracks t WHERE t.stage_id = s.id AND t.is_active = true
        ), '[]') as tracks
      FROM stages s
      WHERE s.is_active = true
      ORDER BY s.sort_order ASC
    `);

    const semesters = await pool.query('SELECT id, name FROM semesters ORDER BY id ASC');

    // كاش 5 دقائق - بيانات التنقل لا تتغير كثيراً
    res.set('Cache-Control', 'public, max-age=300');
    res.json({
      stages: stages.rows,
      semesters: semesters.rows
    });
  } catch (err) {
    console.error('خطأ في جلب التنقل:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// الصفحة الرئيسية
// ═══════════════════════════════════════
router.get('/home', async (req, res) => {
  try {
    // المراحل الدراسية مع الصفوف والمسارات
    const stages = await pool.query(`
      SELECT s.id, s.name, s.slug, s.public_slug, s.icon, s.image_url, s.description,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', g.id, 'name', g.name, 'slug', COALESCE(g.public_slug, g.slug), 'icon', g.image_url,
            'subjects_count', (SELECT COUNT(*) FROM subject_grades sg WHERE sg.grade_id = g.id)
          ) ORDER BY g.sort_order ASC)
          FROM grades g WHERE g.stage_id = s.id AND g.is_active = true), '[]'
        ) as grades,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', t.id, 'name', t.name, 'slug', t.slug, 'icon', t.icon,
            'subjects_count', (SELECT COUNT(*) FROM subject_tracks st2 WHERE st2.track_id = t.id)
          ) ORDER BY t.sort_order ASC)
          FROM tracks t WHERE t.stage_id = s.id AND t.is_active = true), '[]'
        ) as tracks
      FROM stages s WHERE s.is_active = true
      ORDER BY s.sort_order ASC
    `);

    // الدروس المميزة
    const featured = await pool.query(`
      SELECT l.id, l.title, l.slug, l.thumbnail_url, l.type, l.views, l.downloads,
        l.created_at, s.name as subject_name, s.icon as subject_icon
      FROM lessons l
      JOIN subjects s ON l.subject_id = s.id
      WHERE l.is_featured = true AND l.is_published = true
      ORDER BY l.created_at DESC
      LIMIT 8
    `);

    // أحدث الدروس
    const latest = await pool.query(`
      SELECT l.id, l.title, l.slug, l.thumbnail_url, l.type, l.views, l.downloads,
        l.created_at, s.name as subject_name, s.icon as subject_icon
      FROM lessons l
      JOIN subjects s ON l.subject_id = s.id
      WHERE l.is_published = true
      ORDER BY l.created_at DESC
      LIMIT 12
    `);

    // إحصائيات عامة
    const statsResult = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM lessons WHERE is_published = true) as lessons_count,
        (SELECT COUNT(*) FROM subjects) as subjects_count,
        (SELECT COUNT(*) FROM grades) as grades_count,
        (SELECT COALESCE(SUM(views), 0) FROM lessons) as total_views
    `);

    // أحدث الاختبارات المنشورة
    const quizzesResult = await pool.query(`
      SELECT q.id, q.title, q.description, q.duration_minutes,
        s.name as subject_name, s.icon as subject_icon,
        g.name as grade_name,
        jsonb_array_length(q.questions) as questions_count
      FROM quizzes q
      LEFT JOIN subjects s ON q.subject_id = s.id
      LEFT JOIN grades g ON q.grade_id = g.id
      WHERE q.is_published = true
      ORDER BY q.created_at DESC
      LIMIT 6
    `);

    // كاش 3 دقائق - الرئيسية تتحدث باستمرار لكن ليس كل ثانية
    res.set('Cache-Control', 'public, max-age=180');
    res.json({
      stages: stages.rows,
      featured: featured.rows,
      latest: latest.rows,
      stats: statsResult.rows[0],
      quizzes: quizzesResult.rows
    });
  } catch (err) {
    console.error('خطأ في الصفحة الرئيسية:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// صفحة المرحلة الدراسية
// ═══════════════════════════════════════
router.get('/stages/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const stage = await pool.query(
      'SELECT * FROM stages WHERE (public_slug = $1 OR slug = $1) AND is_active = true',
      [slug]
    );
    if (stage.rowCount === 0) {
      return res.status(404).json({ message: 'المرحلة غير موجودة' });
    }

    const stageData = stage.rows[0];

    // الصفوف في هذه المرحلة
    const grades = await pool.query(`
      SELECT g.id, g.name, g.slug, g.public_slug, g.image_url,
        g.track_id, t.name as track_name
      FROM grades g
      LEFT JOIN tracks t ON g.track_id = t.id
      WHERE g.stage_id = $1
      ORDER BY g.sort_order ASC
    `, [stageData.id]);

    // المسارات في هذه المرحلة
    const tracks = await pool.query(`
      SELECT id, name, slug, icon
      FROM tracks WHERE stage_id = $1 AND is_active = true
      ORDER BY sort_order ASC
    `, [stageData.id]);

    res.json({
      stage: stageData,
      grades: grades.rows,
      tracks: tracks.rows
    });
  } catch (err) {
    console.error('خطأ في صفحة المرحلة:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// صفحة الصف الدراسي (أو المسار)
// ═══════════════════════════════════════
router.get('/grades/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    // البحث أولاً في الصفوف
    const grade = await pool.query(`
      SELECT g.*, s.name as stage_name, s.slug as stage_slug, s.public_slug as stage_public_slug
      FROM grades g
      JOIN stages s ON g.stage_id = s.id
      WHERE (g.public_slug = $1 OR g.slug = $1 OR g.id::text = $1)
    `, [slug]);

    if (grade.rowCount > 0) {
      const gradeData = grade.rows[0];
      const { semester } = req.query;

      // المواد المرتبطة بهذا الصف مع عدد الدروس
      let subjectsQuery = `
        SELECT s.id, s.name, s.slug, s.public_slug, s.icon, s.image_url,
          (SELECT COUNT(*) FROM lessons l WHERE l.subject_id = s.id AND l.is_published = true
            ${semester && semester !== '0' ? `AND (l.semester = ${parseInt(semester)} OR l.semester = 0)` : ''}
          ) as lessons_count
        FROM subjects s
        JOIN subject_grades sg ON s.id = sg.subject_id
        WHERE sg.grade_id = $1
        ORDER BY s.sort_order ASC
      `;
      const subjects = await pool.query(subjectsQuery, [gradeData.id]);

      return res.json({
        grade: gradeData,
        subjects: subjects.rows
      });
    }

    // إذا لم يوجد صف، نبحث في المسارات (مثل الثانوية)
    const track = await pool.query(`
      SELECT t.*, s.name as stage_name, s.slug as stage_slug, s.public_slug as stage_public_slug
      FROM tracks t
      JOIN stages s ON t.stage_id = s.id
      WHERE (t.slug = $1 OR t.id::text = $1) AND t.is_active = true
    `, [slug]);

    if (track.rowCount === 0) {
      return res.status(404).json({ message: 'الصف أو المسار غير موجود' });
    }

    const trackData = track.rows[0];
    const { semester } = req.query;

    // المواد المرتبطة بهذا المسار مع عدد الدروس
    const subjects = await pool.query(`
      SELECT s.id, s.name, s.slug, s.public_slug, s.icon, s.image_url,
        (SELECT COUNT(*) FROM lessons l WHERE l.subject_id = s.id AND l.is_published = true
          ${semester && semester !== '0' ? `AND (l.semester = ${parseInt(semester)} OR l.semester = 0)` : ''}
        ) as lessons_count
      FROM subjects s
      JOIN subject_tracks st ON s.id = st.subject_id
      WHERE st.track_id = $1
      ORDER BY s.sort_order ASC
    `, [trackData.id]);

    // نرجع بنفس الهيكل (grade) لتوافق مع GradePage
    return res.json({
      grade: {
        id: trackData.id,
        name: trackData.name,
        slug: trackData.slug,
        stage_name: trackData.stage_name,
        stage_slug: trackData.stage_slug,
        stage_public_slug: trackData.stage_public_slug,
        is_track: true
      },
      subjects: subjects.rows
    });
  } catch (err) {
    console.error('خطأ في صفحة الصف/المسار:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// صفحة المادة الدراسية
// ═══════════════════════════════════════
router.get('/subjects/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const { semester, grade_id, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const subject = await pool.query(`
      SELECT s.*,
        COALESCE(
          (SELECT json_agg(json_build_object('id', g.id, 'name', g.name, 'slug', g.slug, 'public_slug', g.public_slug, 'stage_name', st.name))
           FROM subject_grades sg JOIN grades g ON sg.grade_id = g.id JOIN stages st ON g.stage_id = st.id
           WHERE sg.subject_id = s.id), '[]'
        ) as grades,
        COALESCE(
          (SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'slug', t.slug, 'stage_name', st2.name))
           FROM subject_tracks stt JOIN tracks t ON stt.track_id = t.id JOIN stages st2 ON t.stage_id = st2.id
           WHERE stt.subject_id = s.id), '[]'
        ) as tracks
      FROM subjects s
      WHERE (s.public_slug = $1 OR s.slug = $1)
    `, [slug]);

    if (subject.rowCount === 0) {
      return res.status(404).json({ message: 'المادة غير موجودة' });
    }

    const subjectData = subject.rows[0];

    // الدروس/الملفات المرتبطة
    let lessonsQuery = `
      SELECT l.id, l.title, l.slug, l.thumbnail_url, l.type, l.views, l.downloads,
        l.semester, l.category, l.tags, l.created_at,
        COALESCE(
          (SELECT json_agg(json_build_object('id', lf.id, 'file_name', lf.file_name, 'file_type', lf.file_type, 'file_size', lf.file_size, 'page_count', lf.page_count))
           FROM lesson_files lf WHERE lf.lesson_id = l.id), '[]'
        ) as files,
        COALESCE((SELECT SUM(lf2.file_size) FROM lesson_files lf2 WHERE lf2.lesson_id = l.id), 0) as total_files_size,
        (SELECT COUNT(*) FROM lesson_files lf3 WHERE lf3.lesson_id = l.id) as files_count
      FROM lessons l
      WHERE l.subject_id = $1 AND l.is_published = true
    `;
    const params = [subjectData.id];

    if (semester && semester !== '0') {
      lessonsQuery += ` AND (l.semester = $${params.length + 1} OR l.semester = 0)`;
      params.push(parseInt(semester));
    }

    if (grade_id) {
      lessonsQuery += ` AND l.id IN (SELECT lesson_id FROM lesson_grades WHERE grade_id = $${params.length + 1})`;
      params.push(grade_id);
    }

    // Count total
    const countQuery = lessonsQuery.replace(/SELECT .* FROM/, 'SELECT COUNT(*) as total FROM');
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    lessonsQuery += ` ORDER BY l.sort_order ASC, l.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), offset);

    const lessons = await pool.query(lessonsQuery, params);

    res.json({
      subject: subjectData,
      lessons: lessons.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('خطأ في صفحة المادة:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// صفحة الملف/الدرس الفردي
// ═══════════════════════════════════════
router.get('/files/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    const lesson = await pool.query(`
      SELECT l.*,
        s.name as subject_name, s.slug as subject_slug, s.public_slug as subject_public_slug, s.icon as subject_icon,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', lf.id, 'file_url', lf.file_url, 'file_name', lf.file_name, 'original_name', lf.original_name,
            'file_type', lf.file_type, 'mime_type', lf.mime_type, 'file_size', lf.file_size,
            'page_count', lf.page_count,
            'has_preview', EXISTS(SELECT 1 FROM file_previews fp WHERE fp.file_id = lf.id)
          ) ORDER BY lf.sort_order)
          FROM lesson_files lf WHERE lf.lesson_id = l.id), '[]'
        ) as files,
        COALESCE((SELECT SUM(lf2.file_size) FROM lesson_files lf2 WHERE lf2.lesson_id = l.id), 0) as total_files_size,
        COALESCE(
          (SELECT json_agg(json_build_object('id', g.id, 'name', g.name, 'slug', g.slug, 'public_slug', g.public_slug, 'stage_name', st.name))
           FROM lesson_grades lg JOIN grades g ON lg.grade_id = g.id JOIN stages st ON g.stage_id = st.id
           WHERE lg.lesson_id = l.id), '[]'
        ) as grades,
        COALESCE(
          (SELECT json_agg(json_build_object('id', t.id, 'name', t.name))
           FROM lesson_tracks lt JOIN tracks t ON lt.track_id = t.id
           WHERE lt.lesson_id = l.id), '[]'
        ) as tracks
      FROM lessons l
      JOIN subjects s ON l.subject_id = s.id
      WHERE l.slug = $1 AND l.is_published = true
    `, [slug]);

    if (lesson.rowCount === 0) {
      return res.status(404).json({ message: 'الملف غير موجود' });
    }

    // زيادة عدد المشاهدات
    await pool.query('UPDATE lessons SET views = views + 1 WHERE id = $1', [lesson.rows[0].id]);

    // دروس مشابهة
    const related = await pool.query(`
      SELECT l.id, l.title, l.slug, l.thumbnail_url, l.type, l.views,
        s.name as subject_name
      FROM lessons l
      JOIN subjects s ON l.subject_id = s.id
      WHERE l.subject_id = $1 AND l.id != $2 AND l.is_published = true
      ORDER BY l.created_at DESC
      LIMIT 6
    `, [lesson.rows[0].subject_id, lesson.rows[0].id]);

    // التنقل بين الدروس (السابق والتالي في نفس المادة)
    const lessonData = lesson.rows[0];
    const navigation = {};

    const nextLesson = await pool.query(`
      SELECT id, title, slug, thumbnail_url, type
      FROM lessons
      WHERE subject_id = $1 AND is_published = true AND id != $2
        AND (sort_order > $3 OR (sort_order = $3 AND created_at > $4))
      ORDER BY sort_order ASC, created_at ASC
      LIMIT 1
    `, [lessonData.subject_id, lessonData.id, lessonData.sort_order || 0, lessonData.created_at]);

    const prevLesson = await pool.query(`
      SELECT id, title, slug, thumbnail_url, type
      FROM lessons
      WHERE subject_id = $1 AND is_published = true AND id != $2
        AND (sort_order < $3 OR (sort_order = $3 AND created_at < $4))
      ORDER BY sort_order DESC, created_at DESC
      LIMIT 1
    `, [lessonData.subject_id, lessonData.id, lessonData.sort_order || 0, lessonData.created_at]);

    if (nextLesson.rowCount > 0) navigation.next = nextLesson.rows[0];
    if (prevLesson.rowCount > 0) navigation.previous = prevLesson.rows[0];

    res.json({
      lesson: { ...lessonData, views: lessonData.views + 1 },
      navigation,
      related: related.rows
    });
  } catch (err) {
    console.error('خطأ في صفحة الملف:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// صفحات PDF كصور (النظام الجديد)
// ═══════════════════════════════════════
router.get('/files/:slug/pages', async (req, res) => {
  try {
    const { slug } = req.params;

    // جلب الدرس بالـ slug
    const lesson = await pool.query(
      'SELECT id FROM lessons WHERE slug = $1 AND is_published = true',
      [slug]
    );
    if (lesson.rowCount === 0) return res.status(404).json({ message: 'الدرس غير موجود' });

    const lessonId = lesson.rows[0].id;

    // جلب معلومات ملف PDF وحالة التحويل
    const pdfFile = await pool.query(`
      SELECT id, file_name, original_name, file_size, page_count, pages_status, file_url
      FROM lesson_files
      WHERE lesson_id = $1 AND file_type = 'pdf'
      ORDER BY sort_order ASC
      LIMIT 1
    `, [lessonId]);

    if (pdfFile.rowCount === 0) {
      return res.json({ lesson_id: lessonId, status: 'no_pdf', pages: [] });
    }

    const fileData = pdfFile.rows[0];

    // جلب الصفحات المحولة
    const pages = await pool.query(`
      SELECT page_number, image_url, thumb_url, width, height
      FROM lesson_pages
      WHERE lesson_id = $1
      ORDER BY page_number ASC
    `, [lessonId]);

    res.set('Cache-Control', 'public, max-age=3600');
    res.json({
      lesson_id: lessonId,
      status: fileData.pages_status || 'pending',
      total_pages: fileData.page_count || 0,
      pdf_url: fileData.file_url,
      file_name: fileData.original_name || fileData.file_name,
      file_size: fileData.file_size,
      pages: pages.rows
    });
  } catch (err) {
    console.error('خطأ في جلب صفحات PDF:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// معاينة صفحات PDF (النظام القديم - للتوافق)
// ═══════════════════════════════════════
router.get('/files/:slug/previews', async (req, res) => {
  try {
    const { slug } = req.params;

    const lesson = await pool.query(
      'SELECT id FROM lessons WHERE slug = $1 AND is_published = true',
      [slug]
    );
    if (lesson.rowCount === 0) return res.status(404).json({ message: 'الدرس غير موجود' });

    const files = await pool.query(`
      SELECT lf.id, lf.file_name, lf.original_name, lf.file_size, lf.page_count,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'page', fp.page_number, 'url', fp.image_url, 'width', fp.width, 'height', fp.height
          ) ORDER BY fp.page_number)
          FROM file_previews fp WHERE fp.file_id = lf.id), '[]'
        ) as previews
      FROM lesson_files lf
      WHERE lf.lesson_id = $1 AND lf.file_type = 'pdf'
      ORDER BY lf.sort_order
    `, [lesson.rows[0].id]);

    res.set('Cache-Control', 'public, max-age=3600');
    res.json({
      lesson_id: lesson.rows[0].id,
      files: files.rows
    });
  } catch (err) {
    console.error('خطأ في معاينة الصفحات:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// تسجيل تحميل
// ═══════════════════════════════════════
router.post('/files/:id/download', async (req, res) => {
  try {
    await pool.query('UPDATE lessons SET downloads = downloads + 1 WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// البحث
// ═══════════════════════════════════════
router.get('/search', async (req, res) => {
  try {
    const { q, semester, stage_id, grade_id, type, page = 1, limit = 20 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.json({ results: [], total: 0 });
    }

    const searchTerm = `%${q.trim()}%`;
    let query = `
      SELECT l.id, l.title, l.slug, l.thumbnail_url, l.type, l.views, l.downloads,
        l.semester, l.created_at,
        s.name as subject_name, s.icon as subject_icon
      FROM lessons l
      JOIN subjects s ON l.subject_id = s.id
      WHERE l.is_published = true
        AND (l.title ILIKE $1 OR l.keywords ILIKE $1 OR s.name ILIKE $1)
    `;
    const params = [searchTerm];

    if (semester && semester !== '0') {
      query += ` AND (l.semester = $${params.length + 1} OR l.semester = 0)`;
      params.push(parseInt(semester));
    }

    if (stage_id) {
      query += ` AND l.id IN (
        SELECT lg2.lesson_id FROM lesson_grades lg2
        JOIN grades g2 ON lg2.grade_id = g2.id
        WHERE g2.stage_id = $${params.length + 1}
      )`;
      params.push(stage_id);
    }

    if (grade_id) {
      query += ` AND l.id IN (SELECT lesson_id FROM lesson_grades WHERE grade_id = $${params.length + 1})`;
      params.push(grade_id);
    }

    if (type) {
      query += ` AND l.type = $${params.length + 1}`;
      params.push(type);
    }

    // Count
    const countQuery = query.replace(/SELECT .* FROM/, 'SELECT COUNT(*) as total FROM');
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += ` ORDER BY l.views DESC, l.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), offset);

    const results = await pool.query(query, params);

    res.json({
      results: results.rows,
      total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('خطأ في البحث:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// الاختبارات العامة
// ═══════════════════════════════════════
router.get('/quizzes', async (req, res) => {
  try {
    const { subject_id, grade_id } = req.query;
    let query = `
      SELECT q.id, q.title, q.description, q.duration_minutes,
        q.semester, q.created_at,
        s.name as subject_name, g.name as grade_name,
        jsonb_array_length(q.questions) as questions_count
      FROM quizzes q
      LEFT JOIN subjects s ON q.subject_id = s.id
      LEFT JOIN grades g ON q.grade_id = g.id
      WHERE q.is_published = true
    `;
    const params = [];

    if (subject_id) {
      query += ` AND q.subject_id = $${params.length + 1}`;
      params.push(subject_id);
    }
    if (grade_id) {
      query += ` AND q.grade_id = $${params.length + 1}`;
      params.push(grade_id);
    }

    query += ' ORDER BY q.sort_order ASC, q.created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('خطأ في الاختبارات:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// اختبار واحد مع الأسئلة
router.get('/quizzes/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT q.*, s.name as subject_name, g.name as grade_name
      FROM quizzes q
      LEFT JOIN subjects s ON q.subject_id = s.id
      LEFT JOIN grades g ON q.grade_id = g.id
      WHERE q.id = $1 AND q.is_published = true
    `, [req.params.id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'الاختبار غير موجود' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('خطأ في الاختبار:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// سؤال وجواب
// ═══════════════════════════════════════
router.get('/faqs', async (req, res) => {
  try {
    const { grade_id, subject_id, semester } = req.query;

    let query = `
      SELECT f.id, f.question, f.answer, f.semester,
        f.grade_id, f.subject_id,
        g.name as grade_name,
        s.name as subject_name,
        st.name as stage_name
      FROM faqs f
      LEFT JOIN grades g ON f.grade_id = g.id
      LEFT JOIN subjects s ON f.subject_id = s.id
      LEFT JOIN stages st ON g.stage_id = st.id
      WHERE f.is_published = true
    `;
    const params = [];

    if (grade_id) {
      query += ` AND f.grade_id = $${params.length + 1}`;
      params.push(grade_id);
    }

    if (subject_id) {
      query += ` AND f.subject_id = $${params.length + 1}`;
      params.push(subject_id);
    }

    if (semester && semester !== '0') {
      query += ` AND (f.semester = $${params.length + 1} OR f.semester = 0)`;
      params.push(parseInt(semester));
    }

    query += ' ORDER BY f.sort_order ASC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('خطأ في سؤال وجواب:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// التحقق من التحديثات (للكاش في التطبيق)
// ═══════════════════════════════════════
router.get('/check-updates', async (req, res) => {
  try {
    const { since } = req.query;

    if (!since) {
      return res.json({
        has_updates: true,
        message: 'أول استخدام - يجب تحميل جميع البيانات'
      });
    }

    const sinceDate = new Date(since);

    // التحقق من تحديثات المراحل/الصفوف
    const stagesUpdate = await pool.query(
      'SELECT COUNT(*) as count FROM stages WHERE created_at > $1 OR updated_at > $1',
      [sinceDate]
    );

    // التحقق من تحديثات المواد
    const subjectsUpdate = await pool.query(
      'SELECT COUNT(*) as count FROM subjects WHERE created_at > $1',
      [sinceDate]
    );

    // التحقق من تحديثات الدروس
    const lessonsUpdate = await pool.query(
      'SELECT COUNT(*) as count FROM lessons WHERE created_at > $1 OR updated_at > $1',
      [sinceDate]
    );

    // التحقق من تحديثات الإعدادات
    const settingsUpdate = await pool.query(
      'SELECT COUNT(*) as count FROM site_settings WHERE updated_at > $1',
      [sinceDate]
    );

    // آخر تحديث
    const lastUpdate = await pool.query(`
      SELECT GREATEST(
        (SELECT MAX(GREATEST(created_at, COALESCE(updated_at, created_at))) FROM lessons),
        (SELECT MAX(created_at) FROM subjects),
        (SELECT MAX(COALESCE(updated_at, created_at)) FROM stages),
        (SELECT MAX(updated_at) FROM site_settings)
      ) as last_update
    `);

    const hasUpdates = parseInt(stagesUpdate.rows[0].count) > 0 ||
                       parseInt(subjectsUpdate.rows[0].count) > 0 ||
                       parseInt(lessonsUpdate.rows[0].count) > 0 ||
                       parseInt(settingsUpdate.rows[0].count) > 0;

    res.set('Cache-Control', 'no-cache');
    res.json({
      has_updates: hasUpdates,
      updated_stages: parseInt(stagesUpdate.rows[0].count) > 0,
      updated_subjects: parseInt(subjectsUpdate.rows[0].count) > 0,
      updated_lessons: parseInt(lessonsUpdate.rows[0].count) > 0,
      updated_settings: parseInt(settingsUpdate.rows[0].count) > 0,
      new_lessons_count: parseInt(lessonsUpdate.rows[0].count),
      last_update: lastUpdate.rows[0]?.last_update || null
    });
  } catch (err) {
    console.error('خطأ في التحقق من التحديثات:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// الصفحات العامة (سياسة الخصوصية، شروط الاستخدام، اتصل بنا)
// ═══════════════════════════════════════
router.get('/pages/:pageKey', async (req, res) => {
  try {
    const { pageKey } = req.params;

    // تحويل slug إلى key في قاعدة البيانات
    const keyMap = {
      'privacy': 'privacy_policy',
      'terms': 'terms_of_service',
      'contact': 'contact_page',
    };

    const dbKey = keyMap[pageKey];
    if (!dbKey) {
      return res.status(404).json({ message: 'الصفحة غير موجودة' });
    }

    const result = await pool.query(
      'SELECT value, updated_at FROM site_settings WHERE key = $1',
      [dbKey]
    );

    if (result.rowCount === 0) {
      return res.json({ content: '', updated_at: null });
    }

    // كاش 10 دقائق
    res.set('Cache-Control', 'public, max-age=600');
    res.json({
      key: pageKey,
      content: result.rows[0].value || '',
      updated_at: result.rows[0].updated_at
    });
  } catch (err) {
    console.error('خطأ في جلب الصفحة:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// جلب جميع الصفحات العامة دفعة واحدة
router.get('/pages', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT key, value, updated_at FROM site_settings
       WHERE key IN ('privacy_policy', 'terms_of_service', 'contact_page')`
    );

    const pages = {};
    result.rows.forEach(row => {
      const slugMap = {
        'privacy_policy': 'privacy',
        'terms_of_service': 'terms',
        'contact_page': 'contact'
      };
      pages[slugMap[row.key] || row.key] = {
        content: row.value || '',
        updated_at: row.updated_at
      };
    });

    res.set('Cache-Control', 'public, max-age=600');
    res.json(pages);
  } catch (err) {
    console.error('خطأ في جلب الصفحات:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// Sitemap XML ديناميكي
// ═══════════════════════════════════════
router.get('/sitemap.xml', async (req, res) => {
  try {
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    // جلب كل المراحل والصفوف والمواد والدروس
    const [stages, grades, subjects, lessons] = await Promise.all([
      pool.query(`SELECT slug, public_slug, updated_at FROM stages WHERE is_active = true ORDER BY sort_order`),
      pool.query(`SELECT slug, public_slug, updated_at FROM grades ORDER BY sort_order`),
      pool.query(`SELECT slug, public_slug, updated_at FROM subjects ORDER BY sort_order`),
      pool.query(`SELECT slug, updated_at FROM lessons WHERE is_published = true ORDER BY created_at DESC LIMIT 5000`),
    ]);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/privacy</loc>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>${baseUrl}/terms</loc>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>${baseUrl}/contact</loc>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>`;

    // المراحل
    stages.rows.forEach(s => {
      const slug = s.public_slug || s.slug;
      xml += `
  <url>
    <loc>${baseUrl}/${slug}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
    });

    // الصفوف
    grades.rows.forEach(g => {
      const slug = g.public_slug || g.slug;
      xml += `
  <url>
    <loc>${baseUrl}/${slug}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
    });

    // المواد
    subjects.rows.forEach(s => {
      const slug = s.public_slug || s.slug;
      xml += `
  <url>
    <loc>${baseUrl}/${slug}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`;
    });

    // الدروس
    lessons.rows.forEach(l => {
      if (l.slug) {
        const lastmod = l.updated_at ? new Date(l.updated_at).toISOString().split('T')[0] : '';
        xml += `
  <url>
    <loc>${baseUrl}/files/${l.slug}</loc>${lastmod ? `
    <lastmod>${lastmod}</lastmod>` : ''}
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>`;
      }
    });

    xml += `
</urlset>`;

    res.set('Content-Type', 'application/xml');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(xml);
  } catch (err) {
    console.error('خطأ في إنشاء sitemap:', err);
    res.status(500).send('Error generating sitemap');
  }
});

module.exports = router;
