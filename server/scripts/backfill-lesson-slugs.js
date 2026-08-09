// تعبئة السلاق للدروس التي حُفظت بلا سلاق.
// الاستخدام: node scripts/backfill-lesson-slugs.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { pool } = require('../config/db');
const { generateLessonSlug } = require('../utils/slug');

(async () => {
  const { rows } = await pool.query(
    `SELECT id, subject_id, grade_id, track_id, semester, type, title
     FROM lessons WHERE slug IS NULL OR trim(slug) = ''`
  );
  console.log(`دروس بلا سلاق: ${rows.length}`);

  for (const lesson of rows) {
    const slug = await generateLessonSlug(pool, lesson, lesson.id);
    if (!slug) {
      console.log(`  ✗ تعذّر التوليد: ${lesson.title}`);
      continue;
    }
    await pool.query('UPDATE lessons SET slug = $1 WHERE id = $2', [slug, lesson.id]);
    console.log(`  ✓ ${lesson.title}\n    → ${slug}`);
  }

  await pool.end();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
