/**
 * سكريبت إصلاح ترميز الإيموجي المخزنة بشكل خاطئ في قاعدة البيانات
 *
 * المشكلة: إيموجي 4-byte (U+1Fxxx) تحولت لأحرف Private Use Area (U+Fxxx)
 * عند الاستيراد من Excel — فقدت البايت الأول.
 * مثال: 🌸 (U+1F338) → U+F338 (مربع □)
 *        🐝 (U+1F41D) → U+F41D (مربع □)
 *
 * الحل: إضافة 0x10000 لكل حرف في نطاق PUA (U+F000-U+F8FF)
 *
 * الاستخدام:
 *   node scripts/fix-encoding.js          # تشخيص فقط (عرض المشاكل)
 *   node scripts/fix-encoding.js --fix    # تطبيق الإصلاح
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  client_encoding: 'UTF8',
});

// نطاق Private Use Area الذي يحتوي إيموجي مقطوعة
const PUA_REGEX = /[\uF000-\uF8FF]/g;

// إصلاح الإيموجي: إضافة 0x10000 للحصول على الكود الصحيح
function fixPuaEmoji(text) {
  return text.replace(PUA_REGEX, (ch) => {
    const original = ch.codePointAt(0);
    const fixed = original + 0x10000; // U+Fxxx → U+1Fxxx
    return String.fromCodePoint(fixed);
  });
}

let totalFixed = 0;

async function fixColumn(tableName, idCol, textCol, isJsonb = false) {
  console.log(`\n📋 فحص ${tableName}.${textCol}...`);

  const castSuffix = isJsonb ? '::text' : '';
  const result = await pool.query(`
    SELECT ${idCol}, ${textCol}${castSuffix} as raw_text
    FROM ${tableName}
    WHERE ${textCol}${castSuffix} ~ '[\uF000-\uF8FF]'
  `);

  console.log(`   وُجد ${result.rowCount} سجل بإيموجي مقطوعة (PUA)`);

  const applyFix = process.argv.includes('--fix');

  for (const row of result.rows) {
    const original = row.raw_text;
    const fixed = fixPuaEmoji(original);

    // عرض الأحرف المتأثرة
    const puaChars = [...original].filter(c => c.codePointAt(0) >= 0xF000 && c.codePointAt(0) <= 0xF8FF);
    const fixedChars = puaChars.map(c => {
      const code = c.codePointAt(0);
      const newCode = code + 0x10000;
      return `U+${code.toString(16).toUpperCase()} → U+${newCode.toString(16).toUpperCase()} ${String.fromCodePoint(newCode)}`;
    });

    console.log(`\n   ID: ${row[idCol]}`);
    console.log(`   الإيموجي: ${fixedChars.join(', ')}`);
    console.log(`   قبل: "${original.substring(0, 80)}..."`);
    console.log(`   بعد: "${fixed.substring(0, 80)}..."`);

    if (applyFix && fixed !== original) {
      if (isJsonb) {
        try {
          const fixedJson = JSON.parse(fixed);
          await pool.query(`UPDATE ${tableName} SET ${textCol} = $1 WHERE ${idCol} = $2`, [JSON.stringify(fixedJson), row[idCol]]);
          console.log('   ✅ تم التحديث');
          totalFixed++;
        } catch (e) {
          console.log('   ⚠️  JSON غير صالح بعد الإصلاح — تم تخطيه');
        }
      } else {
        await pool.query(`UPDATE ${tableName} SET ${textCol} = $1 WHERE ${idCol} = $2`, [fixed, row[idCol]]);
        console.log('   ✅ تم التحديث');
        totalFixed++;
      }
    }
  }

  return result.rowCount;
}

async function main() {
  const applyFix = process.argv.includes('--fix');

  console.log(applyFix ? '🔧 وضع الإصلاح — سيتم تعديل البيانات' : '🔍 وضع التشخيص فقط — لن يتم تعديل شيء');
  console.log('═'.repeat(60));

  const counts = [];

  // 1. question_text
  counts.push(await fixColumn('exercise_questions', 'id', 'question_text'));

  // 2. question_data (JSONB)
  counts.push(await fixColumn('exercise_questions', 'id', 'question_data', true));

  // 3. correct_answer (JSONB)
  counts.push(await fixColumn('exercise_questions', 'id', 'correct_answer', true));

  // 4. عناوين التمارين
  counts.push(await fixColumn('exercises', 'id', 'title'));

  console.log('\n' + '═'.repeat(60));
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) {
    console.log('✅ لم يُعثر على أي إيموجي مقطوعة — البيانات نظيفة!');
  } else if (applyFix) {
    console.log(`✅ تم إصلاح ${totalFixed} سجل من أصل ${total}`);
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
