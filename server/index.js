require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const { initDB } = require('./config/db');
const authRoutes = require('./routes/auth');
const semesterRoutes = require('./routes/semesters');
const stageRoutes = require('./routes/stages');
const gradeRoutes = require('./routes/grades');
const trackRoutes = require('./routes/tracks');
const subjectRoutes = require('./routes/subjects');
const lessonRoutes = require('./routes/lessons');
const exercisesRoutes = require('./routes/exercises');
const statsRoutes = require('./routes/stats');
const pdfToolsRoutes = require('./routes/pdf-tools');
const toolsRoutes = require('./routes/tools');
const settingsRoutes = require('./routes/settings');
const quizzesRoutes = require('./routes/quizzes');
const faqsRoutes = require('./routes/faqs');
const publicRoutes = require('./routes/public');
const userAuthRoutes = require('./routes/user-auth');
const communityRoutes = require('./routes/community');
const adminCommunityRoutes = require('./routes/admin-community');
const adminUsersRoutes = require('./routes/admin-users');
const adsRoutes = require('./routes/ads');
const gamificationRoutes = require('./routes/gamification');
const notificationsRoutes = require('./routes/notifications');
const studentAnalyticsRoutes = require('./routes/student-analytics');
const learningPathRoutes = require('./routes/learningPath');
const spacedRepetitionRoutes = require('./routes/spacedRepetition');
const dailyChallengeRoutes = require('./routes/dailyChallenge');
const pushNotificationRoutes = require('./routes/push-notifications');

const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';

// ===== الأمان والضغط =====
if (isProduction) {
  // Trust proxy (لو خلف Nginx)
  app.set('trust proxy', 1);
}

// ضغط gzip/brotli لجميع الاستجابات
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

app.use(cors({
  origin: [
    'https://www.halmanhaj.com',
    'https://halmanhaj.com',
    'https://dashboard.halmanhaj.com',
    'http://localhost:3000',
  ],
}));

// ===== tus resumable upload server =====
const tusServer = require('./middleware/tusServer');
app.all('/api/tus', (req, res) => tusServer.handle(req, res));
app.all('/api/tus/{*tusPath}', (req, res) => tusServer.handle(req, res));

app.use(express.json({ limit: '10mb' }));

// ملفات الرفع (uploads) - مع تصغير تلقائي وكاش طويل
const imageResize = require('./middleware/imageResize');
app.use('/uploads', imageResize, express.static(path.join(__dirname, 'uploads'), {
  maxAge: isProduction ? '7d' : 0,
  etag: true,
}));

// ===== مسارات API =====
app.use('/api/auth', authRoutes);
app.use('/api/semesters', semesterRoutes);
app.use('/api/stages', stageRoutes);
app.use('/api/grades', gradeRoutes);
app.use('/api/tracks', trackRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/exercises', exercisesRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/pdf-tools', pdfToolsRoutes);
app.use('/api/tools', toolsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/quizzes', quizzesRoutes);
app.use('/api/faqs', faqsRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/user', userAuthRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/admin/community', adminCommunityRoutes);
app.use('/api/admin/users', adminUsersRoutes);
app.use('/api/ads', adsRoutes);
app.use('/api', gamificationRoutes);
app.use('/api', notificationsRoutes);
app.use('/api/student-analytics', studentAnalyticsRoutes);
app.use('/api/learning-paths', learningPathRoutes);
app.use('/api/review', spacedRepetitionRoutes);
app.use('/api/daily-challenge', dailyChallengeRoutes);
app.use('/api/push', pushNotificationRoutes);

// ===== نقطة دخول API =====
app.get('/api', (req, res) => {
  res.json({
    status: 'ok',
    name: 'Halmanhaj API',
    version: '1.0.0',
    endpoints: {
      home: '/api/public/home',
      stages: '/api/public/stages',
      search: '/api/public/search?q=',
      quizzes: '/api/quizzes',
    }
  });
});

// ===== خدمة React Build في الإنتاج =====
if (isProduction) {
  const clientBuildPath = path.join(__dirname, '..', 'client', 'build');

  // ملفات static مع كاش طويل (JS, CSS, images)
  app.use('/static', express.static(path.join(clientBuildPath, 'static'), {
    maxAge: '1y',
    immutable: true,
  }));

  // باقي ملفات build (favicon, manifest, etc)
  app.use(express.static(clientBuildPath, {
    maxAge: '1d',
    index: false, // لا نستخدم index التلقائي
  }));

  // robots.txt
  app.get('/robots.txt', (req, res) => {
    res.type('text/plain').send(
`User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Sitemap: https://www.halmanhaj.com/sitemap.xml`
    );
  });

  // أي مسار غير API يرجع index.html (SPA routing)
  // نستخدم middleware بدل app.get('*') لتوافق Express 5
  app.use((req, res, next) => {
    if (
      req.method === 'GET' &&
      !req.path.startsWith('/api/') &&
      !req.path.startsWith('/uploads/') &&
      !req.path.endsWith('.xml')
    ) {
      res.sendFile(path.join(clientBuildPath, 'index.html'));
    } else {
      next();
    }
  });
}

// ===== معالجة أخطاء Multer =====
app.use((err, req, res, next) => {
  const multer = require('multer');
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'حجم الملف كبير جداً' });
    }
    return res.status(400).json({ message: `خطأ في رفع الملف: ${err.message}` });
  }
  if (err.message === 'نوع الملف غير مدعوم' || err.message?.includes('نوع الملف غير مدعوم')) {
    return res.status(400).json({ message: err.message });
  }
  next(err);
});

// ===== Health Check =====
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    uptime: Math.floor(process.uptime()) + 's'
  });
});

// ===== تشغيل السيرفر =====
const start = async () => {
  try {
    await initDB();
    console.log('✅ تم الاتصال بقاعدة البيانات');

    app.listen(PORT, () => {
      console.log(`🚀 السيرفر يعمل على http://localhost:${PORT}`);
      console.log(`📌 البيئة: ${process.env.NODE_ENV || 'development'}`);
      if (isProduction) {
        console.log('🌐 يخدم React Build من client/build/');
      }

      // تنظيف ملفات tus اليتيمة
      const { cleanupOrphanedTusFiles } = require('./services/tusCleanup');
      cleanupOrphanedTusFiles();
      setInterval(cleanupOrphanedTusFiles, 6 * 60 * 60 * 1000);

      // تشغيل Cron Jobs للإشعارات
      require('./services/cronJobs');
    });
  } catch (err) {
    console.error('❌ خطأ في بدء السيرفر:', err.message);
    process.exit(1);
  }
};

start();
