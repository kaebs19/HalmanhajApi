const express = require('express');
const { pool } = require('../config/db');
const { optionalUserAuth } = require('../middleware/userAuth');

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
              'track_id', g.track_id, 'track_name', t.name,
              'tracks', COALESCE(
                (SELECT json_agg(json_build_object('id', t2.id, 'name', t2.name, 'slug', t2.slug, 'icon', t2.icon, 'image_url', t2.image_url)
                 ORDER BY t2.sort_order)
                FROM grade_tracks gt JOIN tracks t2 ON gt.track_id = t2.id
                WHERE gt.grade_id = g.id AND t2.is_active = true), '[]'
              )
            ) ORDER BY g.sort_order
          )
          FROM grades g
          LEFT JOIN tracks t ON g.track_id = t.id
          WHERE g.stage_id = s.id AND g.is_active = true
        ), '[]') as grades,
        COALESCE(
          (SELECT json_agg(
            json_build_object('id', t.id, 'name', t.name, 'slug', t.slug, 'icon', t.icon, 'image_url', t.image_url)
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
            'subjects_count', (SELECT COUNT(*) FROM subject_grades sg WHERE sg.grade_id = g.id),
            'tracks_count', (SELECT COUNT(*) FROM grade_tracks gt WHERE gt.grade_id = g.id)
          ) ORDER BY g.sort_order ASC)
          FROM grades g WHERE g.stage_id = s.id AND g.is_active = true), '[]'
        ) as grades,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', t.id, 'name', t.name, 'slug', t.slug, 'icon', t.icon, 'image_url', t.image_url,
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
      LIMIT 24
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
      SELECT q.id, q.title, q.description, q.duration_minutes, q.slug, q.time_limit, q.passing_score,
        s.name as subject_name, s.icon as subject_icon,
        g.name as grade_name,
        (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id = q.id) as questions_count
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

    // الصفوف في هذه المرحلة (مع المسارات المرتبطة عبر grade_tracks)
    const gradesResult = await pool.query(`
      SELECT g.id, g.name, g.slug, g.public_slug, g.image_url,
        g.track_id, t.name as track_name
      FROM grades g
      LEFT JOIN tracks t ON g.track_id = t.id
      WHERE g.stage_id = $1 AND g.is_active = true
      ORDER BY g.sort_order ASC
    `, [stageData.id]);

    // إضافة المسارات لكل صف عبر grade_tracks
    const grades = await Promise.all(gradesResult.rows.map(async (grade) => {
      const gt = await pool.query(`
        SELECT t.id, t.name, t.slug, t.icon, t.image_url
        FROM grade_tracks gt JOIN tracks t ON gt.track_id = t.id
        WHERE gt.grade_id = $1 AND t.is_active = true
        ORDER BY t.sort_order ASC
      `, [grade.id]);
      return { ...grade, tracks: gt.rows };
    }));

    // المسارات في هذه المرحلة
    const tracks = await pool.query(`
      SELECT id, name, slug, icon, image_url
      FROM tracks WHERE stage_id = $1 AND is_active = true
      ORDER BY sort_order ASC
    `, [stageData.id]);

    res.json({
      stage: stageData,
      grades: grades,
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

      // التحقق من وجود مسارات مرتبطة بهذا الصف عبر grade_tracks
      const gradeTracks = await pool.query(`
        SELECT t.id, t.name, t.slug, t.icon, t.image_url,
          (SELECT COUNT(*) FROM subject_tracks st2 WHERE st2.track_id = t.id) as subjects_count
        FROM grade_tracks gt
        JOIN tracks t ON gt.track_id = t.id
        WHERE gt.grade_id = $1 AND t.is_active = true
        ORDER BY t.sort_order ASC
      `, [gradeData.id]);

      if (gradeTracks.rowCount > 1) {
        // صف له عدة مسارات (مثل الصف الثاني/الثالث) → إرجاع المسارات
        return res.json({
          grade: gradeData,
          tracks: gradeTracks.rows,
          subjects: []
        });
      }

      if (gradeTracks.rowCount === 1) {
        // صف له مسار واحد (مثل الصف الأول → السنة المشتركة) → إرجاع مواد المسار مباشرة
        const singleTrackId = gradeTracks.rows[0].id;
        const subjects = await pool.query(`
          SELECT s.id, s.name, s.slug, s.public_slug, s.icon, s.image_url,
            (SELECT COUNT(*) FROM lessons l WHERE l.subject_id = s.id AND l.is_published = true
              ${semester && semester !== '0' ? `AND (l.semester = ${parseInt(semester)} OR l.semester = 0)` : ''}
            ) as lessons_count
          FROM subjects s
          JOIN subject_tracks st ON s.id = st.subject_id
          WHERE st.track_id = $1
          ORDER BY s.sort_order ASC
        `, [singleTrackId]);

        return res.json({
          grade: gradeData,
          subjects: subjects.rows
        });
      }

      // صف بدون مسارات (ابتدائي/متوسط) → السلوك الحالي
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
    const { subject_id, grade_id, stage_id, semester } = req.query;
    let query = `
      SELECT q.id, q.title, q.description, q.duration_minutes, q.slug,
        q.time_limit, q.passing_score, q.semester, q.created_at,
        s.name as subject_name, s.icon as subject_icon,
        g.name as grade_name,
        st.name as stage_name,
        (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id = q.id) as questions_count,
        (SELECT COUNT(*) FROM quiz_attempts qa WHERE qa.quiz_id = q.id) as attempts_count
      FROM quizzes q
      LEFT JOIN subjects s ON q.subject_id = s.id
      LEFT JOIN grades g ON q.grade_id = g.id
      LEFT JOIN stages st ON q.stage_id = st.id
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
    if (stage_id) {
      query += ` AND q.stage_id = $${params.length + 1}`;
      params.push(stage_id);
    }
    if (semester && semester !== '0') {
      query += ` AND q.semester = $${params.length + 1}`;
      params.push(parseInt(semester));
    }

    query += ' ORDER BY q.sort_order ASC, q.created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('خطأ في الاختبارات:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// اختبار واحد بالـ slug (بدون is_correct!)
router.get('/quizzes/:slug', async (req, res) => {
  try {
    // محاولة البحث بالـ slug أولاً، ثم بالـ id
    let result = await pool.query(`
      SELECT q.id, q.title, q.description, q.slug, q.time_limit, q.passing_score,
        q.duration_minutes, q.semester, q.created_at,
        q.subject_id, q.grade_id, q.stage_id,
        s.name as subject_name, s.icon as subject_icon,
        g.name as grade_name, st.name as stage_name
      FROM quizzes q
      LEFT JOIN subjects s ON q.subject_id = s.id
      LEFT JOIN grades g ON q.grade_id = g.id
      LEFT JOIN stages st ON q.stage_id = st.id
      WHERE q.slug = $1 AND q.is_published = true
    `, [req.params.slug]);

    // fallback: البحث بالـ ID للتوافقية
    if (result.rowCount === 0) {
      result = await pool.query(`
        SELECT q.id, q.title, q.description, q.slug, q.time_limit, q.passing_score,
          q.duration_minutes, q.semester, q.created_at,
          q.subject_id, q.grade_id, q.stage_id,
          s.name as subject_name, s.icon as subject_icon,
          g.name as grade_name, st.name as stage_name
        FROM quizzes q
        LEFT JOIN subjects s ON q.subject_id = s.id
        LEFT JOIN grades g ON q.grade_id = g.id
        LEFT JOIN stages st ON q.stage_id = st.id
        WHERE q.id::text = $1 AND q.is_published = true
      `, [req.params.slug]);
    }

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'الاختبار غير موجود' });
    }

    const quiz = result.rows[0];

    // جلب الأسئلة (بدون is_correct!) مع metadata
    const questionsResult = await pool.query(`
      SELECT id, type, question_text, question_image, points, sort_order, metadata
      FROM quiz_questions WHERE quiz_id = $1 ORDER BY sort_order ASC
    `, [quiz.id]);

    // جلب الخيارات (بدون is_correct!)
    const questionIds = questionsResult.rows.map(q => q.id);
    let optionsMap = {};

    if (questionIds.length > 0) {
      const optionsResult = await pool.query(`
        SELECT id, question_id, option_text, option_image, sort_order
        FROM quiz_options WHERE question_id = ANY($1) ORDER BY sort_order ASC
      `, [questionIds]);

      for (const opt of optionsResult.rows) {
        if (!optionsMap[opt.question_id]) optionsMap[opt.question_id] = [];
        optionsMap[opt.question_id].push(opt);
      }
    }

    // خلط مصفوفة (Fisher-Yates)
    function shuffle(arr) {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }

    quiz.questions_count = questionsResult.rows.length;
    quiz.questions = questionsResult.rows.map(q => {
      const base = {
        id: q.id,
        type: q.type,
        question_text: q.question_text,
        question_image: q.question_image,
        points: q.points,
        sort_order: q.sort_order,
        options: optionsMap[q.id] || []
      };

      // توصيل: إرسال العناصر اليسرى بالترتيب واليمنى مخلوطة
      if (q.type === 'matching' && q.metadata?.pairs) {
        base.left_items = q.metadata.pairs.map(p => p.left);
        base.right_items = shuffle(q.metadata.pairs.map(p => p.right));
      }

      // ترتيب: إرسال العناصر مخلوطة
      if (q.type === 'ordering' && q.metadata?.items) {
        base.items = shuffle(q.metadata.items);
      }

      return base;
    });

    res.json(quiz);
  } catch (err) {
    console.error('خطأ في الاختبار:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// تسليم إجابات الاختبار
router.post('/quizzes/:id/submit', optionalUserAuth, async (req, res) => {
  try {
    const quizId = req.params.id;
    const { answers, time_spent } = req.body;
    // answers = { [questionId]: selectedOptionId_or_text }

    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({ message: 'الإجابات مطلوبة' });
    }

    // جلب بيانات الاختبار
    const quizResult = await pool.query(
      'SELECT id, passing_score FROM quizzes WHERE id = $1',
      [quizId]
    );
    if (quizResult.rowCount === 0) {
      return res.status(404).json({ message: 'الاختبار غير موجود' });
    }
    const quiz = quizResult.rows[0];

    // جلب الأسئلة مع خياراتها (مع is_correct) + metadata
    const questionsResult = await pool.query(`
      SELECT qq.id, qq.type, qq.question_text, qq.explanation, qq.points, qq.metadata,
        COALESCE(json_agg(json_build_object(
          'id', qo.id, 'option_text', qo.option_text, 'is_correct', qo.is_correct
        ) ORDER BY qo.sort_order) FILTER (WHERE qo.id IS NOT NULL), '[]') as options
      FROM quiz_questions qq
      LEFT JOIN quiz_options qo ON qo.question_id = qq.id
      WHERE qq.quiz_id = $1
      GROUP BY qq.id, qq.type, qq.question_text, qq.explanation, qq.points, qq.metadata, qq.sort_order
      ORDER BY qq.sort_order ASC
    `, [quizId]);

    let score = 0;
    let totalPoints = 0;
    const correctAnswers = {};
    const answerDetails = [];

    for (const question of questionsResult.rows) {
      totalPoints += question.points;
      const userAnswer = answers[question.id];

      if (question.type === 'matching') {
        // توصيل: إجابة المستخدم = { "H2O": "ماء", "NaCl": "ملح" }
        const pairs = question.metadata?.pairs || [];
        let correctCount = 0;
        const pairResults = {};

        for (const pair of pairs) {
          const userMatch = userAnswer?.[pair.left];
          const pairCorrect = userMatch === pair.right;
          if (pairCorrect) correctCount++;
          pairResults[pair.left] = {
            user: userMatch || '',
            correct: pair.right,
            is_correct: pairCorrect
          };
        }

        const isCorrect = correctCount === pairs.length;
        if (isCorrect) score += question.points;

        correctAnswers[question.id] = {
          pairs: pairs,
          pair_results: pairResults,
          correct_count: correctCount,
          total_pairs: pairs.length,
          user_answer: userAnswer,
          is_correct: isCorrect,
          explanation: question.explanation
        };

        answerDetails.push({
          question_id: question.id,
          answer: userAnswer,
          is_correct: isCorrect,
          points: isCorrect ? question.points : 0
        });

      } else if (question.type === 'ordering') {
        // ترتيب: إجابة المستخدم = ["الأول", "الثاني", "الثالث"]
        const correctOrder = question.metadata?.items || [];
        const isCorrect = JSON.stringify(userAnswer) === JSON.stringify(correctOrder);

        if (isCorrect) score += question.points;

        correctAnswers[question.id] = {
          correct_order: correctOrder,
          user_order: userAnswer || [],
          is_correct: isCorrect,
          explanation: question.explanation
        };

        answerDetails.push({
          question_id: question.id,
          answer: userAnswer,
          is_correct: isCorrect,
          points: isCorrect ? question.points : 0
        });

      } else if (question.type === 'fill_blank') {
        // إملاء الفراغ: مقارنة نصية
        const correctOption = question.options?.find(o => o.is_correct);
        const correctText = correctOption?.option_text?.trim().toLowerCase() || '';
        const userText = (userAnswer || '').trim().toLowerCase();
        const isCorrect = correctText === userText;

        if (isCorrect) score += question.points;

        correctAnswers[question.id] = {
          correct_text: correctOption?.option_text,
          user_answer: userAnswer,
          is_correct: isCorrect,
          explanation: question.explanation
        };

        answerDetails.push({
          question_id: question.id,
          answer: userAnswer,
          is_correct: isCorrect,
          points: isCorrect ? question.points : 0
        });
      } else {
        // اختيار متعدد / صح وخطأ
        const correctOption = question.options?.find(o => o.is_correct);
        const isCorrect = correctOption && userAnswer === correctOption.id;

        if (isCorrect) score += question.points;

        correctAnswers[question.id] = {
          correct_option_id: correctOption?.id,
          correct_text: correctOption?.option_text,
          user_answer: userAnswer,
          is_correct: !!isCorrect,
          explanation: question.explanation
        };

        answerDetails.push({
          question_id: question.id,
          answer: userAnswer,
          is_correct: !!isCorrect,
          points: isCorrect ? question.points : 0
        });
      }
    }

    const percentage = totalPoints > 0 ? Math.round((score / totalPoints) * 100 * 100) / 100 : 0;
    const passed = percentage >= (quiz.passing_score || 60);

    // حفظ المحاولة
    const userId = req.user?.id || null;
    const sessionId = !userId ? (req.headers['x-session-id'] || `anon-${Date.now()}`) : null;

    await pool.query(
      `INSERT INTO quiz_attempts (quiz_id, user_id, session_id, score, total_points, percentage, time_spent, answers, passed)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [quizId, userId, sessionId, score, totalPoints, percentage, time_spent || 0, JSON.stringify(answerDetails), passed]
    );

    res.json({
      score,
      total_points: totalPoints,
      percentage,
      passed,
      passing_score: quiz.passing_score || 60,
      correct_answers: correctAnswers
    });
  } catch (err) {
    console.error('خطأ في تسليم الاختبار:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// جدول المتصدرين
router.get('/quizzes/:id/leaderboard', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT qa.id, qa.score, qa.total_points, qa.percentage, qa.time_spent,
        qa.passed, qa.completed_at,
        u.name as user_name, u.avatar_url as user_avatar
      FROM quiz_attempts qa
      LEFT JOIN users u ON qa.user_id = u.id
      WHERE qa.quiz_id = $1
      ORDER BY qa.percentage DESC, qa.time_spent ASC
      LIMIT 20
    `, [req.params.id]);

    res.json(result.rows);
  } catch (err) {
    console.error('خطأ في المتصدرين:', err);
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

    // جلب كل المراحل والصفوف والمواد والدروس والوحدات
    const [stages, grades, subjects, lessons, exerciseUnits] = await Promise.all([
      pool.query(`SELECT slug, public_slug, updated_at FROM stages WHERE is_active = true ORDER BY sort_order`),
      pool.query(`SELECT slug, public_slug, updated_at FROM grades ORDER BY sort_order`),
      pool.query(`SELECT slug, public_slug, updated_at FROM subjects ORDER BY sort_order`),
      pool.query(`SELECT slug, updated_at FROM lessons WHERE is_published = true ORDER BY created_at DESC LIMIT 5000`),
      pool.query(`
        SELECT u.title, u.created_at,
          s.slug as stage_slug, s.public_slug as stage_public_slug,
          g.slug as grade_slug, g.public_slug as grade_public_slug,
          sub.slug as subject_slug, sub.public_slug as subject_public_slug
        FROM exercise_units u
        JOIN subjects sub ON u.subject_id = sub.id
        JOIN grades g ON u.grade_id = g.id
        JOIN stages s ON g.stage_id = s.id
        WHERE u.is_active = true
        ORDER BY u.created_at DESC
        LIMIT 2000
      `),
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

    // صفحة التمارين الرئيسية
    xml += `
  <url>
    <loc>${baseUrl}/${encodeURI('اختبارات')}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>`;

    // وحدات التمارين
    exerciseUnits.rows.forEach(u => {
      const stageSlug = u.stage_public_slug || u.stage_slug;
      const gradeSlug = u.grade_public_slug || u.grade_slug;
      const subjectSlug = u.subject_public_slug || u.subject_slug;
      const unitSlug = u.title.replace(/\s+/g, '-').replace(/:/g, '');
      xml += `
  <url>
    <loc>${baseUrl}/${encodeURI('اختبارات')}/${encodeURIComponent(stageSlug)}/${encodeURIComponent(gradeSlug)}/${encodeURIComponent(subjectSlug)}/${encodeURIComponent(unitSlug)}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>`;
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

// ═══════════════════════════════════════
// متصفح التمارين العام (بدون auth)
// ═══════════════════════════════════════

// 1. المراحل
router.get('/browse/stages', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.id, s.name, s.slug, s.public_slug, s.icon, s.image_url,
        (SELECT COUNT(*) FROM grades g WHERE g.stage_id = s.id AND g.is_active = true)::int as grades_count
      FROM stages s WHERE s.is_active = true ORDER BY s.sort_order
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('browse/stages error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// 2. الصفوف لمرحلة
router.get('/browse/grades', async (req, res) => {
  try {
    const { stage_slug } = req.query;
    if (!stage_slug) return res.status(400).json({ message: 'stage_slug مطلوب' });

    const result = await pool.query(`
      SELECT g.id, g.name, g.slug, g.public_slug, g.image_url,
        s.name as stage_name, s.slug as stage_slug, s.public_slug as stage_public_slug, s.icon as stage_icon
      FROM grades g
      JOIN stages s ON g.stage_id = s.id
      WHERE (s.public_slug = $1 OR s.slug = $1) AND g.is_active = true AND s.is_active = true
      ORDER BY g.sort_order
    `, [stage_slug]);

    res.json({
      stage: result.rows[0] ? { name: result.rows[0].stage_name, slug: result.rows[0].stage_slug, public_slug: result.rows[0].stage_public_slug } : null,
      stage_icon: result.rows[0]?.stage_icon || null,
      grades: result.rows.map(r => ({ id: r.id, name: r.name, slug: r.slug, public_slug: r.public_slug, image_url: r.image_url })),
    });
  } catch (err) {
    console.error('browse/grades error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// 3. المواد لصف
router.get('/browse/subjects', async (req, res) => {
  try {
    const { stage_slug, grade_slug } = req.query;
    if (!stage_slug || !grade_slug) return res.status(400).json({ message: 'stage_slug و grade_slug مطلوبان' });

    // جلب معلومات المرحلة والصف
    const meta = await pool.query(`
      SELECT g.id as grade_id, g.name as grade_name, g.slug as grade_slug, g.public_slug as grade_public_slug,
        s.name as stage_name, s.slug as stage_slug, s.public_slug as stage_public_slug
      FROM grades g JOIN stages s ON g.stage_id = s.id
      WHERE (s.public_slug = $1 OR s.slug = $1) AND (g.public_slug = $2 OR g.slug = $2)
      LIMIT 1
    `, [stage_slug, grade_slug]);

    if (meta.rowCount === 0) return res.status(404).json({ message: 'غير موجود' });
    const { grade_id } = meta.rows[0];

    const result = await pool.query(`
      SELECT DISTINCT sub.id, sub.name, sub.slug, sub.public_slug, sub.icon, sub.image_url,
        (SELECT COUNT(*) FROM exercise_units eu WHERE eu.subject_id = sub.id AND eu.grade_id = $1)::int as units_count,
        (SELECT COUNT(*) FROM exercises e WHERE e.subject_id = sub.id AND e.grade_id = $1 AND e.is_published = true)::int as exercises_count
      FROM subjects sub
      JOIN subject_grades sg ON sg.subject_id = sub.id
      WHERE sg.grade_id = $1
      ORDER BY sub.name
    `, [grade_id]);

    res.json({
      stage: { name: meta.rows[0].stage_name, slug: meta.rows[0].stage_slug, public_slug: meta.rows[0].stage_public_slug },
      grade: { name: meta.rows[0].grade_name, slug: meta.rows[0].grade_slug, public_slug: meta.rows[0].grade_public_slug },
      subjects: result.rows,
    });
  } catch (err) {
    console.error('browse/subjects error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// 3.5 محتوى الصف الكامل (مواد + وحدات + تمارين)
router.get('/browse/grade-content', async (req, res) => {
  try {
    const { stage_slug, grade_slug } = req.query;
    if (!stage_slug || !grade_slug) return res.status(400).json({ message: 'stage_slug و grade_slug مطلوبان' });

    // جلب metadata
    const meta = await pool.query(`
      SELECT g.id as grade_id, g.name as grade_name, g.slug as grade_slug, g.public_slug as grade_public_slug, g.image_url as grade_image,
        s.name as stage_name, s.slug as stage_slug, s.public_slug as stage_public_slug, s.icon as stage_icon
      FROM grades g JOIN stages s ON g.stage_id = s.id
      WHERE (s.public_slug = $1 OR s.slug = $1) AND (g.public_slug = $2 OR g.slug = $2)
      LIMIT 1
    `, [stage_slug, grade_slug]);

    if (meta.rowCount === 0) return res.status(404).json({ message: 'غير موجود' });
    const m = meta.rows[0];

    // جلب المواد مع الوحدات والتمارين
    const subjects = await pool.query(`
      SELECT DISTINCT sub.id, sub.name, sub.slug, sub.public_slug, sub.icon, sub.image_url,
        (SELECT COUNT(*) FROM exercises e WHERE e.subject_id = sub.id AND e.grade_id = $1 AND e.is_published = true)::int as exercises_count
      FROM subjects sub
      JOIN subject_grades sg ON sg.subject_id = sub.id
      WHERE sg.grade_id = $1
      ORDER BY sub.name
    `, [m.grade_id]);

    // جلب الوحدات لكل المواد دفعة واحدة
    const units = await pool.query(`
      SELECT u.id, u.title, u.order_index, u.subject_id,
        (SELECT COUNT(*) FROM exercises e WHERE e.unit_id = u.id AND e.is_published = true)::int as exercises_count,
        (SELECT COUNT(*) FROM exercise_questions eq JOIN exercises e ON eq.exercise_id = e.id WHERE e.unit_id = u.id AND e.is_published = true)::int as questions_count
      FROM exercise_units u
      WHERE u.grade_id = $1 AND u.is_active = true
      ORDER BY u.order_index
    `, [m.grade_id]);

    // جلب التمارين لكل الوحدات دفعة واحدة
    const unitIds = units.rows.map(u => u.id);
    let exercises = [];
    if (unitIds.length > 0) {
      const exResult = await pool.query(`
        SELECT e.id, e.title, e.type, e.difficulty, e.unit_id,
          (SELECT COUNT(*) FROM exercise_questions eq WHERE eq.exercise_id = e.id)::int as questions_count
        FROM exercises e
        WHERE e.unit_id = ANY($1) AND e.is_published = true
        ORDER BY e.created_at
      `, [unitIds]);
      exercises = exResult.rows;
    }

    // تجميع البيانات
    const subjectsWithUnits = subjects.rows.map(sub => ({
      ...sub,
      units: units.rows
        .filter(u => u.subject_id === sub.id)
        .map(u => ({
          ...u,
          exercises: exercises.filter(e => e.unit_id === u.id)
        }))
    }));

    // فلترة المواد التي بها تمارين فعلاً
    const activeSubjects = subjectsWithUnits.filter(s => s.exercises_count > 0 || s.units.some(u => u.exercises_count > 0));

    res.json({
      stage_name: m.stage_name,
      stage_slug: m.stage_slug,
      stage_icon: m.stage_icon,
      grade_name: m.grade_name,
      grade_slug: m.grade_slug,
      grade_image: m.grade_image,
      subjects: activeSubjects,
      total_exercises: activeSubjects.reduce((sum, s) => sum + s.exercises_count, 0),
      total_subjects: activeSubjects.length,
    });
  } catch (err) {
    console.error('browse/grade-content error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// 4. الوحدات لمادة
router.get('/browse/units', async (req, res) => {
  try {
    const { stage_slug, grade_slug, subject_slug } = req.query;
    if (!stage_slug || !grade_slug || !subject_slug) return res.status(400).json({ message: 'كل الـ slugs مطلوبة' });

    // جلب metadata
    const meta = await pool.query(`
      SELECT g.id as grade_id, g.name as grade_name, g.slug as grade_slug, g.public_slug as grade_public_slug,
        s.name as stage_name, s.slug as stage_slug, s.public_slug as stage_public_slug,
        sub.id as subject_id, sub.name as subject_name, sub.slug as subject_slug, sub.public_slug as subject_public_slug, sub.icon as subject_icon, sub.image_url as subject_image
      FROM grades g
      JOIN stages s ON g.stage_id = s.id
      JOIN subject_grades sg ON sg.grade_id = g.id
      JOIN subjects sub ON sg.subject_id = sub.id
      WHERE (s.public_slug = $1 OR s.slug = $1)
        AND (g.public_slug = $2 OR g.slug = $2)
        AND (sub.public_slug = $3 OR sub.slug = $3)
      LIMIT 1
    `, [stage_slug, grade_slug, subject_slug]);

    if (meta.rowCount === 0) return res.status(404).json({ message: 'غير موجود' });
    const m = meta.rows[0];

    const result = await pool.query(`
      SELECT u.id, u.title, u.order_index,
        (SELECT COUNT(*) FROM exercises e WHERE e.unit_id = u.id AND e.is_published = true)::int as exercises_count,
        (SELECT COUNT(*) FROM exercise_questions eq JOIN exercises e ON eq.exercise_id = e.id WHERE e.unit_id = u.id AND e.is_published = true)::int as questions_count
      FROM exercise_units u
      WHERE u.subject_id = $1 AND u.grade_id = $2 AND u.is_active = true
      ORDER BY u.order_index
    `, [m.subject_id, m.grade_id]);

    res.json({
      stage: { name: m.stage_name, slug: m.stage_slug, public_slug: m.stage_public_slug },
      grade: { name: m.grade_name, slug: m.grade_slug, public_slug: m.grade_public_slug },
      subject: { name: m.subject_name, slug: m.subject_slug, public_slug: m.subject_public_slug },
      subject_icon: m.subject_icon,
      subject_image: m.subject_image,
      stage_name: m.stage_name,
      grade_name: m.grade_name,
      subject_name: m.subject_name,
      units: result.rows,
    });
  } catch (err) {
    console.error('browse/units error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// 5. تمارين وحدة
router.get('/browse/exercises', async (req, res) => {
  try {
    const { unit_id } = req.query;
    if (!unit_id) return res.status(400).json({ message: 'unit_id مطلوب' });

    // معلومات الوحدة
    const unitMeta = await pool.query(`
      SELECT u.id, u.title, u.order_index,
        sub.name as subject_name, sub.slug as subject_slug, sub.public_slug as subject_public_slug,
        g.name as grade_name, g.slug as grade_slug, g.public_slug as grade_public_slug,
        s.name as stage_name, s.slug as stage_slug, s.public_slug as stage_public_slug
      FROM exercise_units u
      JOIN subjects sub ON u.subject_id = sub.id
      JOIN grades g ON u.grade_id = g.id
      JOIN stages s ON g.stage_id = s.id
      WHERE u.id = $1
    `, [unit_id]);

    if (unitMeta.rowCount === 0) return res.status(404).json({ message: 'الوحدة غير موجودة' });

    const exercises = await pool.query(`
      SELECT e.id, e.title, e.type, e.difficulty,
        (SELECT COUNT(*) FROM exercise_questions eq WHERE eq.exercise_id = e.id)::int as questions_count
      FROM exercises e
      WHERE e.unit_id = $1 AND e.is_published = true
      ORDER BY e.created_at
    `, [unit_id]);

    const m = unitMeta.rows[0];
    res.json({
      unit: { id: m.id, title: m.title },
      stage: { name: m.stage_name, slug: m.stage_slug, public_slug: m.stage_public_slug },
      grade: { name: m.grade_name, slug: m.grade_slug, public_slug: m.grade_public_slug },
      subject: { name: m.subject_name, slug: m.subject_slug, public_slug: m.subject_public_slug },
      exercises: exercises.rows,
    });
  } catch (err) {
    console.error('browse/exercises error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// 6. تشغيل تمرين (ضيف — بدون auth)
router.get('/browse/exercise/:id/play', async (req, res) => {
  try {
    const { id } = req.params;
    const exRes = await pool.query(`SELECT id, title, type, difficulty, xp_reward, time_limit FROM exercises WHERE id = $1 AND is_published = true`, [id]);
    if (exRes.rowCount === 0) return res.status(404).json({ message: 'التمرين غير موجود' });

    const qRes = await pool.query(`
      SELECT id, question_text, question_image, question_data, order_index
      FROM exercise_questions WHERE exercise_id = $1 ORDER BY order_index
    `, [id]);

    res.json({
      ...exRes.rows[0],
      questions: qRes.rows.map(q => ({
        id: q.id,
        question_text: q.question_text,
        question_image: q.question_image,
        question_data: q.question_data,
        order_index: q.order_index,
      })),
    });
  } catch (err) {
    console.error('browse/exercise play error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// 7. فحص إجابة (ضيف — بدون حفظ)
router.post('/browse/exercise/:id/check', async (req, res) => {
  try {
    const { question_id, answer } = req.body;
    if (!question_id) return res.status(400).json({ message: 'question_id مطلوب' });

    const qRes = await pool.query(`SELECT correct_answer FROM exercise_questions WHERE id = $1`, [question_id]);
    if (qRes.rowCount === 0) return res.status(404).json({ message: 'السؤال غير موجود' });

    const correctAnswer = qRes.rows[0].correct_answer;
    let isCorrect = false;

    if (typeof correctAnswer === 'object' && correctAnswer !== null) {
      if (correctAnswer.answer !== undefined) {
        isCorrect = String(answer).trim().toLowerCase() === String(correctAnswer.answer).trim().toLowerCase();
      } else if (correctAnswer.correct !== undefined) {
        isCorrect = String(answer).trim().toLowerCase() === String(correctAnswer.correct).trim().toLowerCase();
      } else {
        isCorrect = JSON.stringify(answer) === JSON.stringify(correctAnswer);
      }
    } else {
      isCorrect = String(answer).trim().toLowerCase() === String(correctAnswer).trim().toLowerCase();
    }

    res.json({ correct: isCorrect, correct_answer: correctAnswer });
  } catch (err) {
    console.error('browse/exercise check error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

module.exports = router;
