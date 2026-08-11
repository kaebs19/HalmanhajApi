// صياغة نصوص الدروس بالعربية — عنوان تلقائي، أوصاف جاهزة، مرادفات الفصل الدراسي.
// نفس منطق server/utils/lessonText.js حتى تتطابق صياغة اللوحة مع ما يولّده السيرفر.

/** يضيف كلمة "الصف" لاسم الصف إن لم تكن موجودة: "الثاني متوسط" → "الصف الثاني متوسط" */
export function gradeLabel(name) {
  if (!name) return '';
  const clean = String(name).trim();
  if (/^(ال)?صف\s/.test(clean)) return clean;
  return `الصف ${clean}`;
}

export const SEMESTER_LABELS = {
  1: 'الفصل الأول',
  2: 'الفصل الثاني',
  0: '',
};

/** "الجزء الأول من المقرر" */
export function partLabel(semester) {
  const sem = parseInt(semester);
  if (sem === 1) return 'الجزء الأول من المقرر';
  if (sem === 2) return 'الجزء الثاني من المقرر';
  return 'المقرر كاملاً';
}

/** مرادفات الفصل التي يبحث بها الطلاب — تُقترح ككلمات مفتاحية إضافية */
export function semesterSynonyms(semester) {
  const sem = parseInt(semester);
  if (sem === 1) {
    return ['الفصل الدراسي الأول', 'الجزء الأول من المقرر', 'المقرر الدراسي الأول', 'الترم الأول', 'ف1'];
  }
  if (sem === 2) {
    return ['الفصل الدراسي الثاني', 'الجزء الثاني من المقرر', 'المقرر الدراسي الثاني', 'الترم الثاني', 'ف2'];
  }
  return ['المقرر كاملاً'];
}

/**
 * أوصاف جاهزة احترافية حسب نوع الدرس والمادة والصف/المسار والفصل.
 * @param {string} audience اسم الصف أو المسار بصيغته النهائية ("الصف الثاني متوسط")
 * @returns {string[]} قائمة نصوص جاهزة للاختيار منها
 */
export function descriptionTemplates({ type = 'حل', subjectName = '', audience = '', semester = 1 }) {
  const subject = subjectName || 'المادة';
  const grade = audience ? ` ${audience}` : '';
  const sem = parseInt(semester);
  const semName = SEMESTER_LABELS[sem] || '';
  const semText = semName ? ` ${semName}` : '';
  const part = sem === 0 ? '' : ` ${partLabel(sem)}`;

  const byType = {
    'حل': [
      `حل تمارين كتاب ${subject}${grade}${part}`,
      `حل كتاب الطالب ${subject}${grade}${semText} كاملاً مع الإجابات النموذجية لجميع الوحدات والدروس`,
      `إجابات نموذجية لجميع أسئلة وتمارين كتاب ${subject}${grade}${semText}، مرتبة حسب صفحات الكتاب`,
      `حل أسئلة كتاب النشاط ${subject}${grade}${semText} بشرح مبسط وخطوات واضحة`,
      `ملف حلول شامل لمادة ${subject}${grade}${part}، جاهز للتصفح المباشر أو التحميل PDF`,
    ],
    'كتاب': [
      `كتاب ${subject}${grade}${part}`,
      `تحميل كتاب ${subject}${grade}${semText} PDF — النسخة الرسمية المعتمدة من وزارة التعليم`,
      `كتاب الطالب لمادة ${subject}${grade}${semText} بجودة عالية وتصفح مباشر بدون تحميل`,
      `كتاب النشاط لمادة ${subject}${grade}${semText} كاملاً بصيغة PDF`,
    ],
    'تحضير': [
      `تحضير مادة ${subject}${grade}${part}`,
      `تحضير شامل لجميع دروس ${subject}${grade}${semText} بالأهداف والوسائل وأساليب التقويم`,
      `تحضير مادة ${subject}${grade}${semText} وفق منهج الوزارة، جاهز للطباعة`,
      `توزيع منهج ${subject}${grade}${semText} مع خطة الدروس الأسبوعية`,
    ],
    'تجميع': [
      `تجميعات أسئلة ${subject}${grade}${part}`,
      `تجميع أسئلة اختبارات ${subject}${grade}${semText} مع الإجابات النموذجية`,
      `نماذج اختبارات سابقة لمادة ${subject}${grade}${semText} تغطي جميع دروس المقرر`,
      `بنك أسئلة مراجعة نهائية لمادة ${subject}${grade}${semText}`,
    ],
    'فيديو': [
      `شرح مادة ${subject}${grade}${part}`,
      `شرح فيديو مبسط لدروس ${subject}${grade}${semText} خطوة بخطوة مع أمثلة محلولة`,
      `سلسلة دروس مصورة لمادة ${subject}${grade}${semText} لجميع وحدات المقرر`,
    ],
  };

  const list = byType[type] || [`${type} ${subject}${grade}${semText}`];
  // إضافة صيغة عامة تصلح لأي نوع
  return [...new Set([...list, `ملف ${subject}${grade}${semText} — تصفح مباشر أو تحميل PDF من موقع حل المنهج`])];
}
