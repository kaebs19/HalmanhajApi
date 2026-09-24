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
  quizStages: () => ({
    title: 'اختبارات المناهج السعودية',
    description: 'اختبارات وتمارين تفاعلية مجانية لجميع المراحل الدراسية - ابتدائي، متوسط، ثانوي. اختبر معلوماتك وقيّم مستواك في المنهج السعودي.',
  }),
  quizStage: (stage) => ({
    title: `اختبارات ${stage}`,
    description: `اختبارات وتمارين تفاعلية مجانية لجميع صفوف ${stage}. اختبر معلوماتك في المنهج السعودي.`,
  }),
  quizGrade: (grade, stage, subjectsCount, exercisesCount) => ({
    title: `اختبارات ${grade} - ${stage}`,
    description: `اختبارات وتمارين تفاعلية مجانية لطلاب ${grade} ${stage}. ${subjectsCount} مادة و${exercisesCount} تمرين.`,
  }),
  quizSubject: (subject, grade, stage, unitsCount) => ({
    title: `اختبارات ${subject} ${grade} - تمارين تفاعلية`,
    description: `تمارين واختبارات تفاعلية مجانية في ${subject} ${grade} ${stage}. ${unitsCount} وحدة دراسية.`,
  }),
  quizUnit: (unit, subject, grade, exercisesCount) => ({
    title: `${unit} - ${subject}`,
    description: `تمارين تفاعلية في ${unit} - ${subject} ${grade}. ${exercisesCount} تمرين متاح.`,
  }),
  // عناوين الملفات المحفوظة أحياناً مكررة ("حل كتاب X - حل كتاب الطالب X...") فيقصّها قوقل
  fileTitle: (raw) => {
    let t = String(raw || '').replace(/\s+/g, ' ').trim();
    const parts = t.split(/\s+[-–—|]\s+/);
    if (parts.length > 1) {
      const first = parts[0];
      const firstWords = new Set(first.split(' '));
      const rest = parts.slice(1).filter((p) => {
        const w = p.split(' ');
        return w.filter((x) => firstWords.has(x)).length / w.length < 0.6;
      });
      t = [first, ...rest].join(' - ');
    }
    if (t.length > 65) {
      // نقصّ من الوسط ونُبقي الفصل الدراسي في النهاية، وإلا تطابق عنوانا الفصلين
      const sem = (t.match(/\s((?:الفصل|الترم)(?: الدراسي)? (?:الأول|الثاني|الثالث))$/) || [])[1] || '';
      const base = sem ? t.slice(0, -sem.length).trim() : t;
      const room = 65 - (sem ? sem.length + 1 : 0);
      let cut = base.length > room ? base.slice(0, room) : base;
      if (base.length > room) cut = cut.slice(0, cut.lastIndexOf(' '));
      cut = cut.replace(/[\s\-–—|،,]+$/, '').replace(/\s+(و|في|من|على|أو)$/, '');
      t = sem ? `${cut} ${sem}` : cut;
    }
    return t;
  },
};
module.exports = { seoTitles };
