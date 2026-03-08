const { pool } = require('../config/db');

// ═══════════════════════════════════════
// خوارزمية الفترات: 1 → 2 → 4 → 8 → 16 → 30 يوم
// ═══════════════════════════════════════
const INTERVAL_STEPS = [1, 2, 4, 8, 16, 30];

function getNextInterval(currentInterval, isCorrect) {
  if (!isCorrect) return 1;
  const idx = INTERVAL_STEPS.indexOf(currentInterval);
  if (idx === -1 || idx >= INTERVAL_STEPS.length - 1) return 30;
  return INTERVAL_STEPS[idx + 1];
}

// ═══════════════════════════════════════
// إضافة/إعادة تعيين سؤال في التكرار المتباعد
// تُستدعى عند إجابة الطالب بشكل خاطئ
// ═══════════════════════════════════════
async function addToSpacedRepetition(userId, questionId) {
  await pool.query(`
    INSERT INTO spaced_repetition (user_id, question_id, next_review_at, interval_days, correct_streak, total_attempts)
    VALUES ($1, $2, NOW() + INTERVAL '1 day', 1, 0, 0)
    ON CONFLICT (user_id, question_id) DO UPDATE SET
      next_review_at = NOW() + INTERVAL '1 day',
      interval_days = 1,
      correct_streak = 0,
      updated_at = NOW()
  `, [userId, questionId]);
}

module.exports = { addToSpacedRepetition, getNextInterval, INTERVAL_STEPS };
