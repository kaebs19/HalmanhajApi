require('dotenv').config();
const bcrypt = require('bcrypt');
const { pool, initDB } = require('./config/db');

const seed = async () => {
  try {
    await initDB();

    const username = 'admin';
    const password = 'admin123';
    const hash = await bcrypt.hash(password, 10);

    await pool.query(
      'INSERT INTO admins (username, password_hash) VALUES ($1, $2) ON CONFLICT (username) DO NOTHING',
      [username, hash]
    );

    console.log('تم إنشاء الأدمن الافتراضي:');
    console.log(`اسم المستخدم: ${username}`);
    console.log(`كلمة المرور: ${password}`);

    // الفصول الدراسية الافتراضية
    const semesters = ['الفصل الدراسي الأول', 'الفصل الدراسي الثاني'];
    for (const name of semesters) {
      await pool.query(
        `INSERT INTO semesters (name) SELECT $1::text WHERE NOT EXISTS (SELECT 1 FROM semesters WHERE name = $2)`,
        [name, name]
      );
    }
    console.log('تم إنشاء الفصول الدراسية الافتراضية');

    // المراحل الدراسية موجودة مسبقاً في قاعدة البيانات
    console.log('المراحل الدراسية موجودة مسبقاً');

    // المسارات الدراسية للمرحلة الثانوية
    const secondaryStage = await pool.query(
      "SELECT id FROM stages WHERE name = 'المرحلة الثانوية'"
    );

    if (secondaryStage.rowCount > 0) {
      const secondaryId = secondaryStage.rows[0].id;
      const tracks = [
        { name: 'السنة الأولى المشتركة', icon: '📚' },
        { name: 'المسار العام', icon: '🎓' },
        { name: 'المسار الشرعي', icon: '⚖️' },
        { name: 'مسار إدارة الأعمال', icon: '💼' },
        { name: 'مسار علوم الحاسب والهندسة', icon: '💻' },
        { name: 'مسار الصحة والحياة', icon: '🏥' },
        { name: 'التعليم المستمر', icon: '📖' },
        { name: 'التربية الخاصة', icon: '🌟' },
      ];

      for (let i = 0; i < tracks.length; i++) {
        const slug = tracks[i].name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\u0621-\u064Aa-z0-9-]/g, '').substring(0, 100) + '-' + (Date.now() + i);
        await pool.query(
          `INSERT INTO tracks (stage_id, name, slug, icon, sort_order)
           SELECT $1, $2::text, $3, $4, $5
           WHERE NOT EXISTS (SELECT 1 FROM tracks WHERE name = $2 AND stage_id = $1)`,
          [secondaryId, tracks[i].name, slug, tracks[i].icon, i + 1]
        );
      }
      console.log('تم إنشاء المسارات الافتراضية للمرحلة الثانوية');
    }

    await pool.end();
  } catch (err) {
    console.error('خطأ:', err.message);
    process.exit(1);
  }
};

seed();
