// ═══════════════════════════════════════
// مقارنة إجابة الطالب بالإجابة الصحيحة
// حسب نوع التمرين
// ═══════════════════════════════════════
function compareAnswer(type, userAnswer, correctAnswer) {
  try {
    switch (type) {
      case 'true_false':
        return userAnswer === correctAnswer.value;

      case 'mcq':
        return Number(userAnswer) === Number(correctAnswer.index);

      case 'fill_blank': {
        const userText = String(userAnswer).toLowerCase().trim();
        const correctValues = correctAnswer.values || [correctAnswer.value || ''];
        return correctValues.some(v => String(v).toLowerCase().trim() === userText);
      }

      case 'matching': {
        // مقارنة أزواج التوصيل (ترتيب غير مهم)
        const userPairs = Array.isArray(userAnswer) ? [...userAnswer] : [];
        const correctPairs = Array.isArray(correctAnswer.pairs) ? [...correctAnswer.pairs] : [];
        if (userPairs.length !== correctPairs.length) return false;
        const sortFn = (a, b) => JSON.stringify(a) < JSON.stringify(b) ? -1 : 1;
        userPairs.sort(sortFn);
        correctPairs.sort(sortFn);
        return JSON.stringify(userPairs) === JSON.stringify(correctPairs);
      }

      case 'ordering': {
        // مقارنة الترتيب (نفس الترتيب بالضبط)
        const userOrder = Array.isArray(userAnswer) ? userAnswer : [];
        const correctOrder = Array.isArray(correctAnswer.items) ? correctAnswer.items : [];
        if (userOrder.length !== correctOrder.length) return false;
        return userOrder.every((item, i) => String(item) === String(correctOrder[i]));
      }

      case 'classify': {
        // مقارنة التصنيف (ترتيب العناصر داخل كل فئة غير مهم)
        const userGroups = typeof userAnswer === 'object' ? userAnswer : {};
        const correctGroups = typeof correctAnswer.groups === 'object' ? correctAnswer.groups : {};
        const userKeys = Object.keys(userGroups).sort();
        const correctKeys = Object.keys(correctGroups).sort();
        if (JSON.stringify(userKeys) !== JSON.stringify(correctKeys)) return false;
        return correctKeys.every(key => {
          const userItems = Array.isArray(userGroups[key]) ? [...userGroups[key]].sort() : [];
          const correctItems = Array.isArray(correctGroups[key]) ? [...correctGroups[key]].sort() : [];
          return JSON.stringify(userItems) === JSON.stringify(correctItems);
        });
      }

      case 'image_match': {
        // مقارنة أزواج صور (ترتيب غير مهم)
        const userMatchPairs = Array.isArray(userAnswer) ? [...userAnswer] : [];
        const correctMatchPairs = Array.isArray(correctAnswer.pairs) ? [...correctAnswer.pairs] : [];
        if (userMatchPairs.length !== correctMatchPairs.length) return false;
        const sortPairs = (a, b) => JSON.stringify(a) < JSON.stringify(b) ? -1 : 1;
        userMatchPairs.sort(sortPairs);
        correctMatchPairs.sort(sortPairs);
        return JSON.stringify(userMatchPairs) === JSON.stringify(correctMatchPairs);
      }

      case 'speed':
        // سرعة: نفس منطق mcq
        return Number(userAnswer) === Number(correctAnswer.index);

      case 'read_answer':
        // اقرأ وأجب: نفس منطق fill_blank
        return String(userAnswer).toLowerCase().trim() === String(correctAnswer.value || '').toLowerCase().trim();

      case 'word_build': {
        // مقارنة بدون تشكيل
        const stripDiacritics = s => String(s).replace(/[\u0610-\u061A\u064B-\u065F\u0670]/g, '').trim();
        return stripDiacritics(userAnswer) === stripDiacritics(correctAnswer.answer || '');
      }

      case 'letter_pos': {
        return String(userAnswer).trim() === String(correctAnswer.form || '').trim();
      }

      default:
        // مقارنة عامة
        return JSON.stringify(userAnswer) === JSON.stringify(correctAnswer.value);
    }
  } catch {
    return false;
  }
}

module.exports = { compareAnswer };
