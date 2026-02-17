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

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';

// ===== الأمان والضغط =====
if (isProduction) {
  // Trust proxy (لو خلف Nginx)
  app.set('trust proxy', 1);
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ملفات الرفع (uploads) - مع كاش طويل في الإنتاج
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
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
    });
  } catch (err) {
    console.error('❌ خطأ في بدء السيرفر:', err.message);
    process.exit(1);
  }
};

start();
