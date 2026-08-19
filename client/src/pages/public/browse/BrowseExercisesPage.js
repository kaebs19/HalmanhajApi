import { useState, useEffect } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { API_BASE } from '../../../lib/api';
import Breadcrumbs from '../../../components/public/Breadcrumbs';
import SEO from '../../../components/public/SEO';
import AdUnit from '../../../components/public/AdUnit';

const TYPE_LABELS = {
  mcq: 'اختيار من متعدد', true_false: 'صح وخطأ', fill_blank: 'أكمل الفراغ',
  matching: 'توصيل', ordering: 'ترتيب', classify: 'تصنيف',
  speed: 'سرعة', read_answer: 'اقرأ وأجب', image_match: 'مطابقة صور',
  word_build: 'تركيب كلمة', letter_pos: 'موضع الحرف',
  numeric_input: 'إدخال رقمي', text_input: 'إدخال نصي'
};
const TYPE_ICONS = {
  mcq: '🔤', true_false: '✅', fill_blank: '✏️', matching: '🔗',
  ordering: '🔢', classify: '📂', speed: '⚡', read_answer: '📖', image_match: '🖼️',
  word_build: '🔤', letter_pos: '🔠', numeric_input: '🔢', text_input: '✍️'
};
const DIFF_LABELS = { easy: 'سهل', medium: 'متوسط', hard: 'صعب' };
const DIFF_COLORS = {
  easy: 'bg-green-100 text-green-700',
  medium: 'bg-amber-100 text-amber-700',
  hard: 'bg-red-100 text-red-700'
};

export default function BrowseExercisesPage() {
  const { stageSlug, gradeSlug, subjectSlug, unitSlug } = useParams();
  const location = useLocation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // unit_id يُمرر عبر state من الصفحة السابقة أو يُجلب من API
  const unitIdFromState = location.state?.unitId;

  useEffect(() => {
    setLoading(true);

    if (unitIdFromState) {
      // لدينا unit_id مباشرة
      fetchExercises(unitIdFromState);
    } else {
      // نحتاج جلب units أولاً للعثور على unit_id من الـ slug
      fetch(`${API_BASE}/public/browse/units?stage_slug=${encodeURIComponent(stageSlug)}&grade_slug=${encodeURIComponent(gradeSlug)}&subject_slug=${encodeURIComponent(subjectSlug)}`)
        .then(res => {
          if (!res.ok) throw new Error();
          return res.json();
        })
        .then(unitsData => {
          // البحث عن الوحدة بالـ slug
          const matchedUnit = unitsData.units?.find(u => {
            const slug = u.title.replace(/\s+/g, '-').replace(/:/g, '');
            return slug === unitSlug;
          });
          if (matchedUnit) {
            fetchExercises(matchedUnit.id, unitsData);
          } else {
            setData(null);
            setLoading(false);
          }
        })
        .catch(() => {
          setData(null);
          setLoading(false);
        });
    }
  }, [stageSlug, gradeSlug, subjectSlug, unitSlug, unitIdFromState]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchExercises = (unitId, existingMeta) => {
    fetch(`${API_BASE}/public/browse/exercises?unit_id=${unitId}`)
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(exData => {
        setData({
          ...exData,
          stage_name: existingMeta?.stage_name || exData.stage_name,
          grade_name: existingMeta?.grade_name || exData.grade_name,
          subject_name: existingMeta?.subject_name || exData.subject_name,
        });
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        {/* صفحة غير موجودة: تُستثنى من الأرشفة (كانت تُرجع 200 فتُحسب soft 404) */}
        <SEO title="الوحدة غير موجودة" noIndex />
        <h2 className="text-xl font-bold text-gray-600 mb-2">الوحدة غير موجودة</h2>
        <Link to="/اختبارات" className="text-emerald-600 hover:underline text-sm">العودة للاختبارات</Link>
      </div>
    );
  }

  const { stage_name, grade_name, subject_name, unit_title, exercises } = data;
  const displayTitle = unit_title || unitSlug?.replace(/-/g, ' ') || 'الوحدة';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <SEO
        title={`${displayTitle} - ${subject_name || ''}`}
        description={`تمارين تفاعلية في ${displayTitle} - ${subject_name} ${grade_name}. ${exercises?.length || 0} تمرين متاح.`}
      />
      <Breadcrumbs items={[
        { label: 'اختبارات', to: '/اختبارات' },
        { label: stage_name, to: `/اختبارات/${stageSlug}` },
        { label: grade_name, to: `/اختبارات/${stageSlug}/${gradeSlug}` },
        { label: subject_name, to: `/اختبارات/${stageSlug}/${gradeSlug}/${subjectSlug}` },
        { label: displayTitle }
      ]} />

      {/* Header */}
      <div className="bg-gradient-to-l from-emerald-600 to-teal-700 rounded-2xl p-8 text-white mb-8">
        <div className="flex items-center gap-4">
          <span className="text-4xl">📝</span>
          <div>
            <h1 className="text-2xl font-bold">{displayTitle}</h1>
            <p className="text-emerald-200 text-sm mt-1">{subject_name} — {grade_name}</p>
            <p className="text-emerald-300 text-xs mt-0.5">{exercises?.length || 0} تمرين</p>
          </div>
        </div>
      </div>

      <AdUnit position="tests_between_cards" className="mb-6" />

      {!exercises || exercises.length === 0 ? (
        <div className="text-center py-16">
          <span className="text-5xl block mb-4">📭</span>
          <h3 className="text-lg font-bold text-gray-700 mb-2">لا توجد تمارين في هذه الوحدة</h3>
          <p className="text-sm text-gray-500">ستتوفر تمارين جديدة قريباً</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {exercises.map(ex => (
            <div
              key={ex.id}
              className="bg-white rounded-xl border border-gray-200 hover:shadow-md hover:border-emerald-200 transition-all"
            >
              <div className="p-5">
                {/* Header */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-lg flex-shrink-0">
                    {TYPE_ICONS[ex.type] || '🧩'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-800 text-sm leading-tight truncate">{ex.title}</h3>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${DIFF_COLORS[ex.difficulty] || DIFF_COLORS.medium}`}>
                    {DIFF_LABELS[ex.difficulty] || 'متوسط'}
                  </span>
                </div>

                {/* Meta */}
                <div className="flex items-center gap-3 text-xs text-gray-500 mb-4">
                  <span>{TYPE_ICONS[ex.type]} {TYPE_LABELS[ex.type]}</span>
                  <span className="text-gray-300">|</span>
                  <span>{ex.questions_count} سؤال</span>
                </div>

                {/* CTA */}
                <Link
                  to={`/اختبارات/حل/${ex.id}`}
                  className="block w-full text-center py-2.5 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                >
                  🚀 ابدأ التمرين
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
