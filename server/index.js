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

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// المسارات
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

// تشغيل السيرفر
const start = async () => {
  try {
    await initDB();
    console.log('تم الاتصال بقاعدة البيانات');

    app.listen(PORT, () => {
      console.log(`السيرفر يعمل على http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('خطأ في بدء السيرفر:', err.message);
    process.exit(1);
  }
};

start();
