/**
 * سكريبت إصلاح ترميز النصوص المخزنة بشكل خاطئ في قاعدة البيانات
 * يبحث عن أحرف CJK (صينية/يابانية/كورية) في نصوص الأسئلة ويحاول إصلاحها
 *
 * الاستخدام:
 *   node scripts/fix-encoding.js          # تشخيص فقط (عرض المشاكل)
 *   node scripts/fix-encoding.js --fix    # تطبيق الإصلاح
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  client_encoding: 'UTF8',
});

// نطاق أحرف CJK التي لا يجب أن تكون موجودة في محتوى عربي/إنجليزي
const CJK_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf\u{20000}-\u{2a6df}\u{2a700}-\u{2b73f}]/u;

async function main() {
  const applyFix = process.argv.includes('--fix');

  console.log(applyFix ? '🔧 وضع الإصلاح — سيتم تعديل البيانات' : '🔍 وضع التشخيص فقط — لن يتم تعديل شيء');
  console.log('═'.repeat(60));

  // 1. فحص exercise_questions — question_text
  console.log('\n📋 فحص نصوص الأسئلة (exercise_questions.question_text)...');
  const qtResult = await pool.query(`
    SELECT id, exercise_id, question_text
    FROM exercise_questions
    WHERE question_text ~ '[\\x{4e00}-\\x{9fff}]'
  `);
  console.log(`   وُجد ${qtResult.rowCount} سؤال بأحرف CJK في question_text`);

  for (const row of qtResult.rows) {
    const original = row.question_text;
    // إزالة أحرف CJK + أحرف التحكم الناتجة عن ترميز خاطئ
    const fixed = original.replace(/[\u4e00-\u9fff\u3400-\u4dbf\u{20000}-\u{2a6df}\u0080-\u009f]/gu, '').replace(/\s{2,}/g, ' ').trim();

    console.log(`\n   ID: ${row.id}`);
    console.log(`   الأصلي: "${original.substring(0, 100)}"`);
    console.log(`   المُصلح: "${fixed.substring(0, 100)}"`);

    if (applyFix && fixed !== original) {
      await pool.query('UPDATE exercise_questions SET question_text = $1 WHERE id = $2', [fixed, row.id]);
      console.log('   ✅ تم التحديث');
    }
  }

  // 2. فحص exercise_questions — question_data (JSONB)
  console.log('\n📋 فحص بيانات الأسئلة (exercise_questions.question_data)...');
  const qdResult = await pool.query(`
    SELECT id, exercise_id, question_data::text as qd_text
    FROM exercise_questions
    WHERE question_data::text ~ '[\\x{4e00}-\\x{9fff}]'
  `);
  console.log(`   وُجد ${qdResult.rowCount} سؤال بأحرف CJK في question_data`);

  for (const row of qdResult.rows) {
    const original = row.qd_text;
    const fixed = original.replace(/[\u4e00-\u9fff\u3400-\u4dbf\u{20000}-\u{2a6df}\u0080-\u009f]/gu, '').replace(/\s{2,}/g, ' ');

    console.log(`\n   ID: ${row.id}`);
    console.log(`   الأصلي: "${original.substring(0, 150)}"`);
    console.log(`   المُصلح: "${fixed.substring(0, 150)}"`);

    if (applyFix && fixed !== original) {
      try {
        const fixedJson = JSON.parse(fixed);
        await pool.query('UPDATE exercise_questions SET question_data = $1 WHERE id = $2', [JSON.stringify(fixedJson), row.id]);
        console.log('   ✅ تم التحديث');
      } catch (e) {
        console.log('   ⚠️  JSON غير صالح بعد الإصلاح — تم تخطيه');
      }
    }
  }

  // 3. فحص correct_answer (JSONB)
  console.log('\n📋 فحص الإجابات الصحيحة (exercise_questions.correct_answer)...');
  const caResult = await pool.query(`
    SELECT id, correct_answer::text as ca_text
    FROM exercise_questions
    WHERE correct_answer::text ~ '[\\x{4e00}-\\x{9fff}]'
  `);
  console.log(`   وُجد ${caResult.rowCount} سؤال بأحرف CJK في correct_answer`);

  for (const row of caResult.rows) {
    const original = row.ca_text;
    const fixed = original.replace(/[\u4e00-\u9fff\u3400-\u4dbf\u{20000}-\u{2a6df}\u0080-\u009f]/gu, '').replace(/\s{2,}/g, ' ');

    console.log(`\n   ID: ${row.id}`);
    console.log(`   الأصلي: "${original.substring(0, 150)}"`);
    console.log(`   المُصلح: "${fixed.substring(0, 150)}"`);

    if (applyFix && fixed !== original) {
      try {
        const fixedJson = JSON.parse(fixed);
        await pool.query('UPDATE exercise_questions SET correct_answer = $1 WHERE id = $2', [JSON.stringify(fixedJson), row.id]);
        console.log('   ✅ تم التحديث');
      } catch (e) {
        console.log('   ⚠️  JSON غير صالح بعد الإصلاح — تم تخطيه');
      }
    }
  }

  // 4. فحص عناوين التمارين
  console.log('\n📋 فحص عناوين التمارين (exercises.title)...');
  const etResult = await pool.query(`
    SELECT id, title FROM exercises WHERE title ~ '[\\x{4e00}-\\x{9fff}]'
  `);
  console.log(`   وُجد ${etResult.rowCount} تمرين بأحرف CJK في العنوان`);

  for (const row of etResult.rows) {
    const original = row.title;
    const fixed = original.replace(/[\u4e00-\u9fff\u3400-\u4dbf\u{20000}-\u{2a6df}\u0080-\u009f]/gu, '').replace(/\s{2,}/g, ' ').trim();

    console.log(`\n   ID: ${row.id}`);
    console.log(`   الأصلي: "${original}"`);
    console.log(`   المُصلح: "${fixed}"`);

    if (applyFix && fixed !== original) {
      await pool.query('UPDATE exercises SET title = $1 WHERE id = $2', [fixed, row.id]);
      console.log('   ✅ تم التحديث');
    }
  }

  console.log('\n═'.repeat(60));
  const total = qtResult.rowCount + qdResult.rowCount + caResult.rowCount + etResult.rowCount;
  if (total === 0) {
    console.log('✅ لم يُعثر على أي أحرف CJK — البيانات نظيفة!');
  } else if (applyFix) {
    console.log(`✅ تم إصلاح ${total} سجل`);
  } else {
    console.log(`⚠️  وُجد ${total} سجل يحتاج إصلاح`);
    console.log('   أعد تشغيل السكريبت مع --fix لتطبيق الإصلاح:');
    console.log('   node scripts/fix-encoding.js --fix');
  }

  await pool.end();
}

main().catch(err => {
  console.error('❌ خطأ:', err.message);
  process.exit(1);
});
