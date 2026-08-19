import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API_BASE, SERVER_URL } from '../../../lib/api';
import Breadcrumbs from '../../../components/public/Breadcrumbs';
import SEO from '../../../components/public/SEO';
import AdUnit from '../../../components/public/AdUnit';

const TYPE_ICONS = {
  mcq: '🔤', true_false: '✅', fill_blank: '✏️', matching: '🔗',
  ordering: '🔢', classify: '📂', speed: '⚡', read_answer: '📖', image_match: '🖼️',
  word_build: '🔤', letter_pos: '🔠'
};
const TYPE_LABELS = {
  mcq: 'اختيار من متعدد', true_false: 'صح وخطأ', fill_blank: 'أكمل الفراغ',
  matching: 'توصيل', ordering: 'ترتيب', classify: 'تصنيف',
  speed: 'سرعة', read_answer: 'اقرأ وأجب', image_match: 'مطابقة صور',
  word_build: 'تركيب كلمة', letter_pos: 'موضع الحرف'
};
const DIFF_LABELS = { easy: 'سهل', medium: 'متوسط', hard: 'صعب' };
const DIFF_COLORS = {
  easy: 'bg-green-100 text-green-700',
  medium: 'bg-amber-100 text-amber-700',
  hard: 'bg-red-100 text-red-700'
};

export default function BrowseSubjectsPage() {
  const { stageSlug, gradeSlug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedSubjects, setExpandedSubjects] = useState({});
  const [expandedUnits, setExpandedUnits] = useState({});

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/public/browse/grade-content?stage_slug=${encodeURIComponent(stageSlug)}&grade_slug=${encodeURIComponent(gradeSlug)}`)
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(result => {
        setData(result);
        // توسيع أول مادة تلقائياً
        if (result.subjects?.length > 0) {
          const first = {};
          first[result.subjects[0].id] = true;
          setExpandedSubjects(first);
          // وتوسيع أول وحدة فيها
          if (result.subjects[0].units?.length > 0) {
            const firstUnit = {};
            firstUnit[result.subjects[0].units[0].id] = true;
            setExpandedUnits(firstUnit);
          }
        }
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [stageSlug, gradeSlug]);

  const toggleSubject = (subjectId) => {
    setExpandedSubjects(prev => ({ ...prev, [subjectId]: !prev[subjectId] }));
  };

  const toggleUnit = (unitId) => {
    setExpandedUnits(prev => ({ ...prev, [unitId]: !prev[unitId] }));
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

  if (!data || !data.subjects) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        {/* صفحة غير موجودة: تُستثنى من الأرشفة (كانت تُرجع 200 فتُحسب soft 404) */}
        <SEO title="الصفحة غير موجودة" noIndex />
        <h2 className="text-xl font-bold text-gray-600 mb-2">الصفحة غير موجودة</h2>
        <Link to="/اختبارات" className="text-emerald-600 hover:underline text-sm">العودة للاختبارات</Link>
      </div>
    );
  }

  const { stage_name, grade_name, subjects, total_exercises, total_subjects } = data;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <SEO
        title={`اختبارات ${grade_name} - ${stage_name}`}
        description={`اختبارات وتمارين تفاعلية مجانية لطلاب ${grade_name} ${stage_name}. ${total_subjects} مادة و${total_exercises} تمرين.`}
      />
      <Breadcrumbs items={[
        { label: 'اختبارات', to: '/اختبارات' },
        { label: stage_name, to: `/اختبارات/${stageSlug}` },
        { label: grade_name }
      ]} />

      {/* Header */}
      <div className="bg-gradient-to-l from-emerald-600 to-teal-700 rounded-2xl p-6 sm:p-8 text-white mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold">اختبارات {grade_name}</h1>
            <p className="text-emerald-200 text-sm mt-1">{stage_name}</p>
          </div>
        </div>
        {/* إحصائيات سريعة */}
        <div className="flex items-center gap-6 mt-4 pt-4 border-t border-white/20">
          <div className="flex items-center gap-2">
            <span className="text-emerald-200 text-sm">📚</span>
            <span className="text-white text-sm font-medium">{total_subjects} مادة</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-emerald-200 text-sm">📝</span>
            <span className="text-white text-sm font-medium">{total_exercises} تمرين</span>
          </div>
        </div>
      </div>

      <AdUnit position="tests_after_header" className="mb-6" />

      {!subjects || subjects.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-gray-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-gray-700 mb-2">لا توجد مواد بها اختبارات</h3>
          <p className="text-sm text-gray-500">ستتوفر اختبارات جديدة قريباً</p>
        </div>
      ) : (
        <div className="space-y-4">
          {subjects.map((subject, sIdx) => {
            const isExpanded = expandedSubjects[subject.id];
            return (
              <div key={subject.id}>
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                  {/* رأس المادة */}
                  <button
                    onClick={() => toggleSubject(subject.id)}
                    className="w-full flex items-center gap-4 p-4 sm:p-5 hover:bg-gray-50 transition-colors text-right"
                  >
                    {/* أيقونة/صورة المادة */}
                    {subject.image_url ? (
                      <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 border border-gray-100">
                        <img
                          src={`${SERVER_URL}${subject.image_url}`}
                          alt={subject.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-2xl">{subject.icon || '📘'}</span>
                      </div>
                    )}

                    {/* معلومات المادة */}
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg font-bold text-gray-800">{subject.name}</h2>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-400">{subject.units?.length || 0} وحدة</span>
                        <span className="text-gray-300">·</span>
                        <span className="text-xs text-emerald-600 font-medium">{subject.exercises_count} تمرين</span>
                      </div>
                    </div>

                    {/* سهم التوسيع */}
                    <svg
                      className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* محتوى المادة (الوحدات) */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50/50">
                      {!subject.units || subject.units.length === 0 ? (
                        <div className="p-6 text-center text-sm text-gray-400">لا توجد وحدات بها تمارين</div>
                      ) : (
                        <div className="p-3 sm:p-4 space-y-2">
                          {subject.units.map((unit, uIdx) => {
                            const isUnitExpanded = expandedUnits[unit.id];
                            const hasExercises = unit.exercises && unit.exercises.length > 0;

                            return (
                              <div key={unit.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                                {/* رأس الوحدة */}
                                <button
                                  onClick={() => hasExercises && toggleUnit(unit.id)}
                                  className={`w-full flex items-center gap-3 p-3 sm:p-4 text-right ${hasExercises ? 'hover:bg-gray-50 cursor-pointer' : 'opacity-60 cursor-default'} transition-colors`}
                                >
                                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold ${hasExercises ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                                    {uIdx + 1}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-bold text-gray-800 truncate">{unit.title}</h3>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      {unit.exercises_count > 0 && (
                                        <span className="text-xs text-emerald-500">{unit.exercises_count} تمرين</span>
                                      )}
                                      {unit.questions_count > 0 && (
                                        <>
                                          <span className="text-gray-300">·</span>
                                          <span className="text-xs text-gray-400">{unit.questions_count} سؤال</span>
                                        </>
                                      )}
                                      {!hasExercises && (
                                        <span className="text-xs text-gray-400">لا تمارين بعد</span>
                                      )}
                                    </div>
                                  </div>
                                  {hasExercises && (
                                    <svg
                                      className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${isUnitExpanded ? 'rotate-180' : ''}`}
                                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                    </svg>
                                  )}
                                </button>

                                {/* التمارين */}
                                {isUnitExpanded && hasExercises && (
                                  <div className="border-t border-gray-50 bg-emerald-50/30 p-3 space-y-2">
                                    {unit.exercises.map(ex => (
                                      <Link
                                        key={ex.id}
                                        to={`/اختبارات/حل/${ex.id}`}
                                        className="group flex items-center gap-3 bg-white rounded-lg border border-gray-100 p-3 hover:border-emerald-200 hover:shadow-sm transition-all"
                                      >
                                        <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center text-base flex-shrink-0 group-hover:bg-emerald-100 transition-colors">
                                          {TYPE_ICONS[ex.type] || '🧩'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <h4 className="text-sm font-bold text-gray-700 group-hover:text-emerald-600 transition-colors truncate">{ex.title}</h4>
                                          <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[11px] text-gray-400">{TYPE_LABELS[ex.type] || ex.type}</span>
                                            <span className="text-gray-300">·</span>
                                            <span className="text-[11px] text-gray-400">{ex.questions_count} سؤال</span>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${DIFF_COLORS[ex.difficulty] || DIFF_COLORS.medium}`}>
                                            {DIFF_LABELS[ex.difficulty] || 'متوسط'}
                                          </span>
                                          <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center group-hover:bg-emerald-700 transition-colors">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                            </svg>
                                          </div>
                                        </div>
                                      </Link>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* إعلان بين المواد */}
                {sIdx === Math.floor(subjects.length / 2) - 1 && subjects.length > 2 && (
                  <AdUnit position="tests_between_cards" className="my-4" />
                )}
              </div>
            );
          })}

          <AdUnit position="tests_between_cards" className="mt-6" />
        </div>
      )}
    </div>
  );
}
