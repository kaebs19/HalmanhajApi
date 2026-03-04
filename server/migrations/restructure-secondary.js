/**
 * سكربت هجرة: إعادة هيكلة المرحلة الثانوية
 *
 * يُنشئ 3 صفوف (أول، ثاني، ثالث) ويربطها بالمسارات عبر grade_tracks.
 * يُنسخ ربط المواد والدروس من السنة الأولى المشتركة إلى الصف الأول.
 *
 * التشغيل: node server/migrations/restructure-secondary.js
 * آمن: لا يحذف أي بيانات — إضافة فقط.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    console.log('=== بدء هجرة المرحلة الثانوية ===\n');

    // 1. إنشاء جدول grade_tracks لو ما موجود
    await client.query(`
      CREATE TABLE IF NOT EXISTS grade_tracks (
        id SERIAL PRIMARY KEY,
        grade_id UUID NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
        track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
        UNIQUE(grade_id, track_id)
      )
    `);
    console.log('✓ جدول grade_tracks جاهز');

    // 2. جلب المرحلة الثانوية
    const stageRes = await client.query(
      "SELECT id FROM stages WHERE name LIKE '%ثانو%' LIMIT 1"
    );
    if (stageRes.rowCount === 0) {
      throw new Error('المرحلة الثانوية غير موجودة في قاعدة البيانات');
    }
    const stageId = stageRes.rows[0].id;
    console.log(`✓ المرحلة الثانوية: ${stageId}`);

    // 3. جلب المسارات
    const tracksRes = await client.query(
      'SELECT id, name FROM tracks WHERE stage_id = $1 ORDER BY sort_order',
      [stageId]
    );
    console.log(`✓ عدد المسارات: ${tracksRes.rowCount}`);
    tracksRes.rows.forEach(t => console.log(`  - ${t.name} (${t.id})`));

    // تحديد مسار السنة الأولى المشتركة
    const mushtaraka = tracksRes.rows.find(t => t.name.includes('المشتركة') || t.name.includes('الأولى'));
    if (!mushtaraka) {
      throw new Error('مسار "السنة الأولى المشتركة" غير موجود');
    }
    const otherTracks = tracksRes.rows.filter(t => t.id !== mushtaraka.id);
    console.log(`\n✓ السنة الأولى المشتركة: ${mushtaraka.id}`);
    console.log(`✓ المسارات الأخرى: ${otherTracks.length}`);

    // 4. التحقق من عدم وجود صفوف مسبقاً
    const existingGrades = await client.query(
      'SELECT id, name FROM grades WHERE stage_id = $1',
      [stageId]
    );
    if (existingGrades.rowCount > 0) {
      console.log('\n⚠ يوجد صفوف مسبقاً للثانوية:');
      existingGrades.rows.forEach(g => console.log(`  - ${g.name} (${g.id})`));
      throw new Error('الصفوف موجودة بالفعل. الهجرة تمت مسبقاً أو تحتاج مراجعة يدوية.');
    }

    // 5. إنشاء 3 صفوف
    const ts = Date.now();
    const gradesInsert = await client.query(`
      INSERT INTO grades (name, slug, stage_id, sort_order, public_slug, is_active)
      VALUES
        ('الصف الأول الثانوي', $2, $1, 1, 'الصف-الاول-الثانوي', true),
        ('الصف الثاني الثانوي', $3, $1, 2, 'الصف-الثاني-الثانوي', true),
        ('الصف الثالث الثانوي', $4, $1, 3, 'الصف-الثالث-الثانوي', true)
      RETURNING id, name
    `, [stageId, `first-secondary-${ts}`, `second-secondary-${ts + 1}`, `third-secondary-${ts + 2}`]);

    const grade1 = gradesInsert.rows[0];
    const grade2 = gradesInsert.rows[1];
    const grade3 = gradesInsert.rows[2];
    console.log(`\n✓ تم إنشاء الصفوف:`);
    console.log(`  - ${grade1.name} (${grade1.id})`);
    console.log(`  - ${grade2.name} (${grade2.id})`);
    console.log(`  - ${grade3.name} (${grade3.id})`);

    // 6. ربط المسارات بالصفوف عبر grade_tracks
    // الصف الأول → السنة الأولى المشتركة فقط
    await client.query(
      'INSERT INTO grade_tracks (grade_id, track_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [grade1.id, mushtaraka.id]
    );

    // الصف الثاني → 7 مسارات
    for (const track of otherTracks) {
      await client.query(
        'INSERT INTO grade_tracks (grade_id, track_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [grade2.id, track.id]
      );
    }

    // الصف الثالث → نفس 7 مسارات
    for (const track of otherTracks) {
      await client.query(
        'INSERT INTO grade_tracks (grade_id, track_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [grade3.id, track.id]
      );
    }

    const gtCount = await client.query('SELECT COUNT(*) FROM grade_tracks');
    console.log(`✓ ربط المسارات بالصفوف: ${gtCount.rows[0].count} سجل في grade_tracks`);

    // 7. نسخ ربط المواد من السنة المشتركة إلى الصف الأول
    const subjectsMigrated = await client.query(`
      INSERT INTO subject_grades (subject_id, grade_id)
      SELECT st.subject_id, $1
      FROM subject_tracks st
      WHERE st.track_id = $2
      ON CONFLICT DO NOTHING
    `, [grade1.id, mushtaraka.id]);
    console.log(`✓ نسخ ربط المواد للصف الأول: ${subjectsMigrated.rowCount} مادة`);

    // 8. نسخ ربط الدروس من السنة المشتركة إلى الصف الأول
    const lessonsMigrated = await client.query(`
      INSERT INTO lesson_grades (lesson_id, grade_id)
      SELECT lt.lesson_id, $1
      FROM lesson_tracks lt
      WHERE lt.track_id = $2
      ON CONFLICT DO NOTHING
    `, [grade1.id, mushtaraka.id]);
    console.log(`✓ نسخ ربط الدروس للصف الأول: ${lessonsMigrated.rowCount} درس`);

    await client.query('COMMIT');

    // تقرير نهائي
    console.log('\n=== تقرير الهجرة ===');
    console.log(`الصفوف المُنشأة: 3`);
    console.log(`ربط grade_tracks: ${gtCount.rows[0].count}`);
    console.log(`مواد منسوخة للصف الأول: ${subjectsMigrated.rowCount}`);
    console.log(`دروس منسوخة للصف الأول: ${lessonsMigrated.rowCount}`);
    console.log('\n✅ الهجرة اكتملت بنجاح!');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ فشلت الهجرة:', err.message);
    console.error('تم التراجع عن كل التغييرات.');
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
