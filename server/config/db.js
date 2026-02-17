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
};

module.exports = { pool, initDB };
