const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const initDB = async () => {
  // ═══════════════════════════════════════════════════
  // الجداول الأساسية (يجب أن تُنشأ أولاً)
  // ═══════════════════════════════════════════════════

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`ALTER TABLE admins ADD COLUMN IF NOT EXISTS display_name VARCHAR(255)`);
  await pool.query(`ALTER TABLE admins ADD COLUMN IF NOT EXISTS email VARCHAR(255)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS semesters (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // جدول المراحل الدراسية
  await pool.query(`
    CREATE TABLE IF NOT EXISTS stages (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      icon TEXT,
      image_url TEXT,
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE stages ADD COLUMN IF NOT EXISTS description TEXT`);
  await pool.query(`ALTER TABLE stages ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`);
  await pool.query(`ALTER TABLE stages ADD COLUMN IF NOT EXISTS image_url TEXT`);
  await pool.query(`ALTER TABLE stages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`);

  // جدول الصفوف الدراسية
  await pool.query(`
    CREATE TABLE IF NOT EXISTS grades (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      stage_id UUID NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      icon TEXT,
      image_url TEXT,
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE grades ADD COLUMN IF NOT EXISTS description TEXT`);
  await pool.query(`ALTER TABLE grades ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`);
  await pool.query(`ALTER TABLE grades ADD COLUMN IF NOT EXISTS image_url TEXT`);
  await pool.query(`ALTER TABLE grades ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`);

  // جدول المواد الدراسية
  await pool.query(`
    CREATE TABLE IF NOT EXISTS subjects (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      icon TEXT,
      image_url TEXT,
      description TEXT,
      grade_id UUID REFERENCES grades(id) ON DELETE SET NULL,
      sort_order INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE subjects ADD COLUMN IF NOT EXISTS description TEXT`);
  await pool.query(`ALTER TABLE subjects ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`);
  await pool.query(`ALTER TABLE subjects ADD COLUMN IF NOT EXISTS image_url TEXT`);
  await pool.query(`ALTER TABLE subjects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`);
  await pool.query(`ALTER TABLE subjects ADD COLUMN IF NOT EXISTS template_key TEXT`);
  await pool.query(`ALTER TABLE subjects ADD COLUMN IF NOT EXISTS keywords TEXT`);

  // تعبئة template_key للمواد الموجودة من القوالب
  await pool.query(`
    UPDATE subjects SET template_key = name
    WHERE template_key IS NULL
    AND name IN ('رياضيات','لغة عربية','لغة انجليزية','علوم','فيزياء','كيمياء','أحياء','تاريخ','جغرافيا','تربية إسلامية','حاسب آلي','تربية بدنية','تربية فنية','اجتماعيات','المهارات الحياتية والأسرية','الدراسات الإسلامية','التفكير الناقد','المهارات الرقمية')
  `);

  // جدول الدروس
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lessons (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      title TEXT NOT NULL,
      subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      semester INTEGER DEFAULT 0,
      pdf_url TEXT,
      pdf_filename TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // ═══════════════════════════════════════════════════
  // جداول العلاقات والمسارات
  // ═══════════════════════════════════════════════════

  // جدول المسارات الدراسية
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tracks (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      stage_id UUID NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      icon TEXT,
      image_url TEXT,
      sort_order INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // إضافة عمود المسار للصفوف
  await pool.query(`
    ALTER TABLE grades ADD COLUMN IF NOT EXISTS track_id UUID REFERENCES tracks(id) ON DELETE SET NULL
  `);

  // جدول subjects موجود مسبقاً - نتأكد من إضافة جدول العلاقة
  // جدول العلاقة بين المواد والصفوف (many-to-many)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS subject_grades (
      id SERIAL PRIMARY KEY,
      subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      grade_id UUID NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
      UNIQUE(subject_id, grade_id)
    )
  `);

  // نقل البيانات من grade_id في subjects إلى subject_grades (مرة واحدة)
  await pool.query(`
    INSERT INTO subject_grades (subject_id, grade_id)
    SELECT id, grade_id FROM subjects WHERE grade_id IS NOT NULL
    ON CONFLICT DO NOTHING
  `);

  // جدول العلاقة بين المواد والمسارات (many-to-many)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS subject_tracks (
      id SERIAL PRIMARY KEY,
      subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
      UNIQUE(subject_id, track_id)
    )
  `);

  // جدول العلاقة بين الصفوف والمسارات (many-to-many) - صف يحتوي عدة مسارات
  await pool.query(`
    CREATE TABLE IF NOT EXISTS grade_tracks (
      id SERIAL PRIMARY KEY,
      grade_id UUID NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
      track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
      UNIQUE(grade_id, track_id)
    )
  `);

  // تعديل جدول الدروس لدعم الربط بصف أو مسار محدد
  await pool.query(`ALTER TABLE lessons ADD COLUMN IF NOT EXISTS grade_id UUID REFERENCES grades(id) ON DELETE SET NULL`);
  await pool.query(`ALTER TABLE lessons ADD COLUMN IF NOT EXISTS track_id UUID REFERENCES tracks(id) ON DELETE SET NULL`);
  await pool.query(`ALTER TABLE lessons ALTER COLUMN pdf_url DROP NOT NULL`);
  await pool.query(`ALTER TABLE lessons ALTER COLUMN pdf_filename DROP NOT NULL`);

  // تحديث constraint الفصل ليدعم 0 = مشترك للفصلين
  await pool.query(`ALTER TABLE lessons DROP CONSTRAINT IF EXISTS lessons_semester_check`);
  await pool.query(`ALTER TABLE lessons ADD CONSTRAINT lessons_semester_check CHECK (semester = ANY (ARRAY[0, 1, 2]))`);

  // جدول ملفات الدروس (ملفات متعددة لكل درس)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lesson_files (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
      file_url TEXT NOT NULL,
      file_name TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // جدول صور معاينة صفحات PDF (أول 3 صفحات لكل ملف)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS file_previews (
      id SERIAL PRIMARY KEY,
      file_id UUID NOT NULL REFERENCES lesson_files(id) ON DELETE CASCADE,
      page_number INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      width INTEGER DEFAULT 0,
      height INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(file_id, page_number)
    )
  `);

  // إضافة حقل عدد الصفحات لملفات PDF
  await pool.query(`ALTER TABLE lesson_files ADD COLUMN IF NOT EXISTS page_count INTEGER DEFAULT 0`);

  // جدول صور صفحات PDF المحولة (كل صفحة = صورة عالية الجودة + مصغرة)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lesson_pages (
      id SERIAL PRIMARY KEY,
      lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
      file_id UUID REFERENCES lesson_files(id) ON DELETE CASCADE,
      page_number INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      thumb_url TEXT NOT NULL,
      width INTEGER DEFAULT 0,
      height INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(lesson_id, page_number)
    )
  `);
  // حالة التحويل
  await pool.query(`ALTER TABLE lesson_files ADD COLUMN IF NOT EXISTS pages_status TEXT DEFAULT 'pending'`);
  // pending, processing, done, failed
  // إضافة حقل hash للكاش (يتغير فقط لو الملف اتغير)
  await pool.query(`ALTER TABLE lesson_files ADD COLUMN IF NOT EXISTS file_hash TEXT`);

  // إضافة حقول النوع والكلمات المفتاحية للدروس
  await pool.query(`ALTER TABLE lessons ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'حل'`);
  await pool.query(`ALTER TABLE lessons ADD COLUMN IF NOT EXISTS keywords TEXT`);
  // وسوم الدرس (حل كتاب، ملخص، اختبار نهائي، ورقة عمل...)
  await pool.query(`ALTER TABLE lessons ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}'`);
  // حقل updated_at للدروس (للكاش)
  await pool.query(`ALTER TABLE lessons ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`);

  // حقول SEO والصورة المصغرة
  await pool.query(`ALTER TABLE lessons ADD COLUMN IF NOT EXISTS seo_title TEXT`);
  await pool.query(`ALTER TABLE lessons ADD COLUMN IF NOT EXISTS seo_description TEXT`);
  await pool.query(`ALTER TABLE lessons ADD COLUMN IF NOT EXISTS slug TEXT`);
  await pool.query(`ALTER TABLE lessons ADD COLUMN IF NOT EXISTS thumbnail_url TEXT`);

  // جدول العلاقة بين الدروس والصفوف (many-to-many لدعم تعدد الصفوف)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lesson_grades (
      id SERIAL PRIMARY KEY,
      lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
      grade_id UUID NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
      UNIQUE(lesson_id, grade_id)
    )
  `);

  // جدول العلاقة بين الدروس والمسارات (many-to-many)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lesson_tracks (
      id SERIAL PRIMARY KEY,
      lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
      track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
      UNIQUE(lesson_id, track_id)
    )
  `);

  // ترحيل البيانات الموجودة للجداول الجديدة
  await pool.query(`
    INSERT INTO lesson_grades (lesson_id, grade_id)
    SELECT id, grade_id FROM lessons WHERE grade_id IS NOT NULL
    ON CONFLICT DO NOTHING
  `);
  await pool.query(`
    INSERT INTO lesson_tracks (lesson_id, track_id)
    SELECT id, track_id FROM lessons WHERE track_id IS NOT NULL
    ON CONFLICT DO NOTHING
  `);

  // ═══════════════════════════════════════════════════
  // جداول الموقع العام والإعدادات
  // ═══════════════════════════════════════════════════

  // جدول إعدادات الموقع (key-value)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS site_settings (
      id SERIAL PRIMARY KEY,
      key VARCHAR(100) UNIQUE NOT NULL,
      value TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // القيم الافتراضية
  await pool.query(`
    INSERT INTO site_settings (key, value) VALUES
      ('site_name', 'حل المنهج'),
      ('logo_url', NULL),
      ('favicon_url', NULL),
      ('seo_title', 'حل المنهج - حلول المناهج الدراسية السعودية'),
      ('seo_description', 'موقع حل المنهج يقدم حلول الكتب والملخصات والاختبارات لجميع المراحل الدراسية في المملكة العربية السعودية'),
      ('seo_keywords', 'حل كتاب,حلول,مناهج,السعودية,ابتدائي,متوسط,ثانوي'),
      ('primary_color', '#2563eb'),
      ('footer_text', 'جميع الحقوق محفوظة لموقع حل المنهج'),
      ('social_links', '{"twitter":"","youtube":"","telegram":"","whatsapp":""}'),
      ('contact_email', ''),
      ('default_semester', '0'),
      ('privacy_policy', ''),
      ('terms_of_service', ''),
      ('contact_page', '')
    ON CONFLICT (key) DO NOTHING
  `);

  // إعدادات الإعلانات
  await pool.query(`
    INSERT INTO site_settings (key, value) VALUES
      ('ads_enabled', 'false'),
      ('ads_publisher_id', '')
    ON CONFLICT (key) DO NOTHING
  `);

  // جدول المواقع الإعلانية
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ad_slots (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      slot_id VARCHAR(50),
      position VARCHAR(50) NOT NULL UNIQUE,
      format VARCHAR(20) DEFAULT 'auto',
      is_active BOOLEAN DEFAULT true,
      custom_code TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // حقول إضافية للدروس (الموقع العام)
  await pool.query(`ALTER TABLE lessons ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE lessons ADD COLUMN IF NOT EXISTS downloads INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE lessons ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false`);
  await pool.query(`ALTER TABLE lessons ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT true`);
  await pool.query(`ALTER TABLE lessons ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'حل_كتاب'`);

  // Slugs عامة نظيفة (بدون timestamp) للمراحل والصفوف والمواد
  await pool.query(`ALTER TABLE stages ADD COLUMN IF NOT EXISTS public_slug TEXT UNIQUE`);
  await pool.query(`ALTER TABLE grades ADD COLUMN IF NOT EXISTS public_slug TEXT UNIQUE`);
  await pool.query(`ALTER TABLE subjects ADD COLUMN IF NOT EXISTS public_slug TEXT UNIQUE`);
  await pool.query(`ALTER TABLE subjects ADD COLUMN IF NOT EXISTS icon TEXT`);

  // جدول المستخدمين العامين (منفصلين عن الأدمن)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      avatar_url TEXT,
      role VARCHAR(50) DEFAULT 'student',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // مفضلة المستخدمين
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_favorites (
      id SERIAL PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, lesson_id)
    )
  `);

  // الاختبارات
  await pool.query(`
    CREATE TABLE IF NOT EXISTS quizzes (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
      grade_id UUID REFERENCES grades(id) ON DELETE SET NULL,
      semester INTEGER DEFAULT 0,
      questions JSONB NOT NULL DEFAULT '[]',
      duration_minutes INTEGER DEFAULT 30,
      is_published BOOLEAN DEFAULT true,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // أعمدة جديدة لجدول الاختبارات
  await pool.query(`ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS track_id UUID REFERENCES tracks(id) ON DELETE SET NULL`);
  await pool.query(`ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES stages(id) ON DELETE SET NULL`);
  await pool.query(`ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS time_limit INTEGER`);
  await pool.query(`ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS passing_score INTEGER DEFAULT 60`);
  await pool.query(`ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS slug TEXT`);

  // نسخ duration_minutes → time_limit للاختبارات الموجودة
  await pool.query(`UPDATE quizzes SET time_limit = duration_minutes WHERE time_limit IS NULL AND duration_minutes IS NOT NULL`);

  // توليد slug للاختبارات التي لا تملك واحداً
  await pool.query(`UPDATE quizzes SET slug = id::text WHERE slug IS NULL`);

  // ═══════════════════════════════════════════════════
  // جداول الاختبارات المتقدمة
  // ═══════════════════════════════════════════════════

  // أسئلة الاختبارات
  await pool.query(`
    CREATE TABLE IF NOT EXISTS quiz_questions (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'multiple_choice',
      question_text TEXT NOT NULL,
      question_image TEXT,
      explanation TEXT,
      points INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // خيارات الأسئلة
  await pool.query(`
    CREATE TABLE IF NOT EXISTS quiz_options (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      question_id UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
      option_text TEXT NOT NULL,
      option_image TEXT,
      is_correct BOOLEAN DEFAULT false,
      sort_order INTEGER DEFAULT 0
    )
  `);

  // محاولات الاختبارات
  await pool.query(`
    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      session_id TEXT,
      score INTEGER DEFAULT 0,
      total_points INTEGER DEFAULT 0,
      percentage NUMERIC(5,2) DEFAULT 0,
      time_spent INTEGER DEFAULT 0,
      answers JSONB DEFAULT '[]',
      passed BOOLEAN DEFAULT false,
      completed_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // عمود metadata للأسئلة (توصيل/ترتيب)
  await pool.query(`ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT NULL`);

  // ═══════════════════════════════════════════════════
  // ترحيل أسئلة JSONB → جداول منفصلة (idempotent)
  // ═══════════════════════════════════════════════════
  try {
    const quizzesWithJsonb = await pool.query(`
      SELECT id, questions FROM quizzes
      WHERE questions IS NOT NULL
        AND jsonb_array_length(questions) > 0
        AND NOT EXISTS (SELECT 1 FROM quiz_questions qq WHERE qq.quiz_id = quizzes.id)
    `);

    for (const quiz of quizzesWithJsonb.rows) {
      const questions = quiz.questions;
      if (!Array.isArray(questions)) continue;

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const questionText = q.text || q.question || q.question_text || '';
        if (!questionText) continue;

        // إدراج السؤال
        const qResult = await pool.query(
          `INSERT INTO quiz_questions (quiz_id, type, question_text, explanation, points, sort_order)
           VALUES ($1, 'multiple_choice', $2, $3, 1, $4) RETURNING id`,
          [quiz.id, questionText, q.explanation || null, i]
        );
        const questionId = qResult.rows[0].id;

        // تحديد الإجابة الصحيحة
        const correctIdx = q.correctIndex !== undefined ? q.correctIndex : (q.correct !== undefined ? q.correct : 0);

        // إدراج الخيارات
        const options = q.options || [];
        for (let j = 0; j < options.length; j++) {
          const optText = typeof options[j] === 'string' ? options[j] : (options[j].text || options[j].option_text || '');
          if (!optText) continue;
          await pool.query(
            `INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
             VALUES ($1, $2, $3, $4)`,
            [questionId, optText, j === correctIdx, j]
          );
        }
      }
    }
    console.log(`✅ تم ترحيل ${quizzesWithJsonb.rowCount} اختبار من JSONB إلى الجداول الجديدة`);
  } catch (migErr) {
    console.error('⚠️ خطأ في ترحيل الاختبارات (غير حرج):', migErr.message);
  }

  // سؤال وجواب
  await pool.query(`
    CREATE TABLE IF NOT EXISTS faqs (
      id SERIAL PRIMARY KEY,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      grade_id UUID REFERENCES grades(id) ON DELETE SET NULL,
      subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
      semester INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      is_published BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // إضافة الحقول الجديدة للجدول الموجود
  await pool.query(`ALTER TABLE faqs ADD COLUMN IF NOT EXISTS grade_id UUID REFERENCES grades(id) ON DELETE SET NULL`);
  await pool.query(`ALTER TABLE faqs ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL`);
  await pool.query(`ALTER TABLE faqs ADD COLUMN IF NOT EXISTS semester INTEGER DEFAULT 0`);

  // ═══════════════════════════════════════════════════
  // نظام سؤال وجواب التفاعلي (أسئلة المستخدمين)
  // ═══════════════════════════════════════════════════

  // أسئلة المستخدمين (community questions)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS community_questions (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      body TEXT,
      stage_id UUID REFERENCES stages(id) ON DELETE SET NULL,
      grade_id UUID REFERENCES grades(id) ON DELETE SET NULL,
      subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
      semester INTEGER DEFAULT 0,
      views INTEGER DEFAULT 0,
      answers_count INTEGER DEFAULT 0,
      best_answer_id UUID,
      is_closed BOOLEAN DEFAULT false,
      is_published BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // ردود/إجابات المستخدمين
  await pool.query(`
    CREATE TABLE IF NOT EXISTS community_answers (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      question_id UUID NOT NULL REFERENCES community_questions(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      is_best BOOLEAN DEFAULT false,
      upvotes INTEGER DEFAULT 0,
      downvotes INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // تصويت على الإجابات
  await pool.query(`
    CREATE TABLE IF NOT EXISTS answer_votes (
      id SERIAL PRIMARY KEY,
      answer_id UUID NOT NULL REFERENCES community_answers(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      vote_type SMALLINT NOT NULL CHECK (vote_type IN (-1, 1)),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(answer_id, user_id)
    )
  `);

  // ═══════════════════════════════════════════════════
  // تحسينات: صور للأسئلة والإجابات
  // ═══════════════════════════════════════════════════
  await pool.query(`ALTER TABLE community_questions ADD COLUMN IF NOT EXISTS image_url TEXT`);
  await pool.query(`ALTER TABLE community_answers ADD COLUMN IF NOT EXISTS image_url TEXT`);

  // ═══════════════════════════════════════════════════
  // نظام النقاط
  // ═══════════════════════════════════════════════════
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT NOW()`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES stages(id) ON DELETE SET NULL`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS grade_id UUID REFERENCES grades(id) ON DELETE SET NULL`);

  // ═══════════════════════════════════════════════════
  // نظام التمارين التفاعلية
  // ═══════════════════════════════════════════════════

  // جدول التمارين
  await pool.query(`
    CREATE TABLE IF NOT EXISTS exercises (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      type VARCHAR(50) NOT NULL,
      xp_reward INTEGER DEFAULT 10,
      time_limit INTEGER,
      is_published BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // أسئلة التمارين
  await pool.query(`
    CREATE TABLE IF NOT EXISTS exercise_questions (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      exercise_id UUID REFERENCES exercises(id) ON DELETE CASCADE,
      order_index INTEGER DEFAULT 0,
      question_text TEXT,
      question_image TEXT,
      question_data JSONB NOT NULL DEFAULT '{}',
      correct_answer JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // تقدم الطلاب في التمارين
  await pool.query(`
    CREATE TABLE IF NOT EXISTS student_exercise_progress (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      exercise_id UUID REFERENCES exercises(id) ON DELETE CASCADE,
      question_id UUID REFERENCES exercise_questions(id) ON DELETE CASCADE,
      is_correct BOOLEAN DEFAULT false,
      attempts INTEGER DEFAULT 0,
      completed_at TIMESTAMPTZ
    )
  `);

  // أعمدة إضافية للتمارين (المرحلة/الصف/المادة/الصعوبة)
  await pool.query(`ALTER TABLE exercises ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES stages(id) ON DELETE SET NULL`);
  await pool.query(`ALTER TABLE exercises ADD COLUMN IF NOT EXISTS grade_id UUID REFERENCES grades(id) ON DELETE SET NULL`);
  await pool.query(`ALTER TABLE exercises ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL`);
  await pool.query(`ALTER TABLE exercises ADD COLUMN IF NOT EXISTS difficulty VARCHAR(10) DEFAULT 'medium'`);
  await pool.query(`ALTER TABLE exercises ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE exercises ADD COLUMN IF NOT EXISTS xp_reward INTEGER DEFAULT 10`);
  await pool.query(`ALTER TABLE exercises ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false`);

  // Backfill: ربط التمارين القديمة بالمادة عبر الدرس (فقط إذا كان lesson_id موجوداً)
  try {
    const hasLessonId = await pool.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'exercises' AND column_name = 'lesson_id' LIMIT 1
    `);
    if (hasLessonId.rowCount > 0) {
      await pool.query(`
        UPDATE exercises e SET subject_id = l.subject_id
        FROM lessons l WHERE e.lesson_id = l.id AND e.subject_id IS NULL AND l.subject_id IS NOT NULL
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_exercises_lesson_id ON exercises(lesson_id)`);
    }
  } catch (e) { /* lesson_id column may not exist */ }

  // فهارس التمارين
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_exercise_questions_exercise_id ON exercise_questions(exercise_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_student_progress_user_id ON student_exercise_progress(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_student_progress_exercise_id ON student_exercise_progress(exercise_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_exercises_stage ON exercises(stage_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_exercises_grade ON exercises(grade_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_exercises_subject ON exercises(subject_id)`);

  // ═══════════════════════════════════════════════════
  // نظام التحفيز (Gamification)
  // ═══════════════════════════════════════════════════

  // سجل الدخول اليومي
  await pool.query(`
    CREATE TABLE IF NOT EXISTS student_daily_login (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      login_date DATE NOT NULL,
      points_earned INTEGER DEFAULT 5,
      streak_day INTEGER DEFAULT 1,
      UNIQUE(user_id, login_date)
    )
  `);

  // شارات الطلاب
  await pool.query(`
    CREATE TABLE IF NOT EXISTS student_badges (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      badge_type VARCHAR(50) NOT NULL,
      earned_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, badge_type)
    )
  `);

  // سجل النقاط (كل مصدر)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS student_points_log (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      points INTEGER NOT NULL,
      source VARCHAR(50) NOT NULL,
      ref_id UUID,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // فهارس التحفيز
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_daily_login_user_date ON student_daily_login(user_id, login_date)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_points_log_user ON student_points_log(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_badges_user ON student_badges(user_id)`);

  // ═══════════════════════════════════════════════════
  // نظام الإشعارات (Notifications)
  // ═══════════════════════════════════════════════════

  // جدول الإشعارات
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      ref_type VARCHAR(50),
      ref_id UUID,
      is_read BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // رموز أجهزة المستخدمين
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_device_tokens (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      device_token TEXT NOT NULL UNIQUE,
      platform VARCHAR(10) DEFAULT 'ios',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // فهارس الإشعارات
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON user_device_tokens(user_id)`);

  // ═══════════════════════════════════════════════════
  // مسارات التعلم (Learning Paths)
  // ═══════════════════════════════════════════════════

  // مسار تعلم لكل مادة + صف
  await pool.query(`
    CREATE TABLE IF NOT EXISTS learning_paths (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      grade_id UUID NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(subject_id, grade_id)
    )
  `);

  // محطات المسار (عقد)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS learning_path_nodes (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      path_id UUID NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
      exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
      node_type VARCHAR(20) DEFAULT 'exercise',
      order_index INTEGER NOT NULL DEFAULT 0,
      required_xp INTEGER DEFAULT 0,
      unlock_after_node_id UUID REFERENCES learning_path_nodes(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // تقدم الطالب في المسار
  await pool.query(`
    CREATE TABLE IF NOT EXISTS student_path_progress (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      path_id UUID NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
      current_node_id UUID REFERENCES learning_path_nodes(id) ON DELETE SET NULL,
      completed_node_ids UUID[] DEFAULT '{}',
      total_xp_earned INTEGER DEFAULT 0,
      started_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, path_id)
    )
  `);

  // التكرار المتباعد (Spaced Repetition)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS spaced_repetition (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      question_id UUID NOT NULL REFERENCES exercise_questions(id) ON DELETE CASCADE,
      next_review_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      interval_days INTEGER DEFAULT 1,
      correct_streak INTEGER DEFAULT 0,
      total_attempts INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, question_id)
    )
  `);

  // التحديات اليومية
  await pool.query(`
    CREATE TABLE IF NOT EXISTS daily_challenges (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      challenge_date DATE NOT NULL DEFAULT CURRENT_DATE,
      question_ids UUID[] DEFAULT '{}',
      completed_count INTEGER DEFAULT 0,
      is_completed BOOLEAN DEFAULT false,
      xp_earned INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, challenge_date)
    )
  `);

  // فهارس مسارات التعلم
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_learning_paths_subject_grade ON learning_paths(subject_id, grade_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_lp_nodes_path ON learning_path_nodes(path_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_lp_nodes_exercise ON learning_path_nodes(exercise_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_student_path_progress_user ON student_path_progress(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_student_path_progress_path ON student_path_progress(path_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_spaced_rep_user_next ON spaced_repetition(user_id, next_review_at)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_spaced_rep_question ON spaced_repetition(question_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_daily_challenges_user_date ON daily_challenges(user_id, challenge_date)`);
};

module.exports = { pool, initDB };
