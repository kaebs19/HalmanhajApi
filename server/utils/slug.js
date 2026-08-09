// توليد السلاق للدروس — منطق واحد يستعمله مولّد SEO ومسار حفظ الدرس معاً،
// حتى لا يُحفظ درس بلا سلاق فيتعذّر فتحه ويكسر فك الترميز في التطبيقات.

const TYPE_SLUG_MAP = {
  'حل': 'hal',
  'كتاب': 'kitab',
  'تحضير': 'tahdir',
  'تجميع': 'tajmee',
  'فيديو': 'video'
};

function arabicToSlug(text) {
  if (!text) return '';
  return text
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^؀-ۿ\w-]/g, '') // إبقاء العربي والإنجليزي والأرقام
    .toLowerCase();
}

/** يبني السلاق: hal-المادة-الصف-المسار-f1-العنوان */
function buildLessonSlug({ type, subjectName, gradeName, trackName, semester, title }) {
  const typeName = type || 'حل';
  const sem = parseInt(semester);

  const parts = [TYPE_SLUG_MAP[typeName] || arabicToSlug(typeName)];
  if (subjectName) parts.push(arabicToSlug(subjectName));
  if (gradeName) parts.push(arabicToSlug(gradeName));
  if (trackName) parts.push(arabicToSlug(trackName));
  if (sem === 1) parts.push('f1');
  else if (sem === 2) parts.push('f2');
  if (title && title.trim()) parts.push(arabicToSlug(title.trim()));

  return parts.filter(Boolean).join('-');
}

/**
 * يولّد سلاقاً للدرس من بياناته في قاعدة البيانات ويضمن تفرّده.
 * يُستدعى فقط حين لا ترسل اللوحة سلاقاً.
 * @param {object} pool اتصال pg
 * @param {object} lesson { subject_id, grade_id, track_id, semester, type, title }
 * @param {string|null} excludeId معرّف الدرس الحالي عند التعديل
 */
async function generateLessonSlug(pool, lesson, excludeId = null) {
  const { subject_id, grade_id, track_id, semester, type, title } = lesson;

  const [subject, grade, track] = await Promise.all([
    subject_id ? pool.query('SELECT name FROM subjects WHERE id = $1', [subject_id]) : null,
    grade_id ? pool.query('SELECT name FROM grades WHERE id = $1', [grade_id]) : null,
    track_id ? pool.query('SELECT name FROM tracks WHERE id = $1', [track_id]) : null
  ]);

  const base = buildLessonSlug({
    type,
    subjectName: subject?.rows[0]?.name,
    gradeName: grade?.rows[0]?.name,
    trackName: track?.rows[0]?.name,
    semester,
    title
  });

  if (!base) return null;

  // التفرّد — درسان بنفس المادة والصف والعنوان يحصلان على -2 و -3
  let candidate = base;
  for (let i = 2; i < 100; i++) {
    const taken = await pool.query(
      excludeId
        ? 'SELECT 1 FROM lessons WHERE slug = $1 AND id <> $2 LIMIT 1'
        : 'SELECT 1 FROM lessons WHERE slug = $1 LIMIT 1',
      excludeId ? [candidate, excludeId] : [candidate]
    );
    if (taken.rowCount === 0) return candidate;
    candidate = `${base}-${i}`;
  }
  return `${base}-${Date.now()}`;
}

module.exports = { arabicToSlug, buildLessonSlug, generateLessonSlug };
