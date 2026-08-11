// صياغة نصوص الدروس بالعربية — يستعملها مولّد الكلمات المفتاحية ومولّد SEO معاً
// حتى تخرج العناوين والأوصاف بصيغة واحدة: "الصف الثاني متوسط" لا "الثاني متوسط".

/** يضيف كلمة "الصف" لاسم الصف إن لم تكن موجودة أصلاً */
function gradeLabel(name) {
  if (!name) return '';
  const clean = String(name).trim();
  if (/^(ال)?صف\s/.test(clean)) return clean;
  return `الصف ${clean}`;
}

/** اسم الفصل الدراسي */
function semesterLabel(semester) {
  const sem = parseInt(semester);
  if (sem === 1) return 'الفصل الأول';
  if (sem === 2) return 'الفصل الثاني';
  return 'الفصلين';
}

/**
 * مرادفات الفصل الدراسي التي يبحث بها الطلاب فعلياً:
 * "الجزء الأول من المقرر"، "المقرر الدراسي الأول"، "الترم الأول"...
 */
function semesterSynonyms(semester) {
  const sem = parseInt(semester);
  if (sem === 1) {
    return ['الفصل الدراسي الأول', 'الجزء الأول من المقرر', 'المقرر الدراسي الأول', 'الترم الأول', 'ف1'];
  }
  if (sem === 2) {
    return ['الفصل الدراسي الثاني', 'الجزء الثاني من المقرر', 'المقرر الدراسي الثاني', 'الترم الثاني', 'ف2'];
  }
  return ['الفصلين', 'المقرر كاملاً'];
}

/** "الجزء الأول من المقرر" — يُستعمل في الأوصاف */
function partLabel(semester) {
  const sem = parseInt(semester);
  if (sem === 1) return 'الجزء الأول من المقرر';
  if (sem === 2) return 'الجزء الثاني من المقرر';
  return 'المقرر كاملاً';
}

/** اختصار اسم المرحلة: "المرحلة الابتدائية" → "ابتدائي" */
function shortStageName(stageName) {
  if (!stageName) return '';
  return String(stageName).replace('المرحلة ', '').replace('ية', 'ي').trim();
}

module.exports = { gradeLabel, semesterLabel, semesterSynonyms, partLabel, shortStageName };
