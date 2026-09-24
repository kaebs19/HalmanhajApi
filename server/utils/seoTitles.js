/**
 * صيغ عناوين وأوصاف صفحات المراحل والصفوف والمواد.
 * نسخة مطابقة في client/src/lib/seoTitles.js تستخدمها صفحات React —
 * أي تعديل هنا يجب نقله هناك، وإلا اختلف ما يراه قوقل قبل وبعد التشغيل.
 */
const list = (names = [], max = 6) => names.filter(Boolean).slice(0, max).join('، ');

const seoTitles = {
  stage: (stage, gradeNames = []) => ({
    title: `حلول ${stage} – جميع الصفوف والمواد`,
    description: `حل كتب ${stage} لجميع الصفوف${gradeNames.length ? ` (${list(gradeNames)})` : ''}: حل كتاب الطالب والنشاط، ملخصات، أوراق عمل واختبارات وفق المنهج السعودي.`,
  }),
  grade: (grade, stage, subjectNames = []) => ({
    title: `حل كتب ${grade}${stage ? ` - ${stage}` : ''}`,
    description: `حلول جميع مواد ${grade}${stage ? ` ${stage}` : ''}${subjectNames.length ? `: ${list(subjectNames)}` : ''}. حل كتاب الطالب والنشاط، ملخصات واختبارات للفصول الدراسية.`,
  }),
  subject: (subject, grade, stage) => ({
    title: `حل كتاب ${subject}${grade ? ` ${grade}` : ''}${stage ? ` - ${stage}` : ''}`,
    description: `حل كتاب ${subject}${grade ? ` ${grade}` : ''}${stage ? ` ${stage}` : ''}: حلول كتاب الطالب والنشاط، ملخصات، أوراق عمل واختبارات لجميع الدروس والوحدات.`,
  }),
};
module.exports = { seoTitles };
