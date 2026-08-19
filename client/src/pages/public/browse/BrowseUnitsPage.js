import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API_BASE, SERVER_URL } from '../../../lib/api';
import Breadcrumbs from '../../../components/public/Breadcrumbs';
import SEO from '../../../components/public/SEO';
import AdUnit from '../../../components/public/AdUnit';

export default function BrowseUnitsPage() {
  const { stageSlug, gradeSlug, subjectSlug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/public/browse/units?stage_slug=${encodeURIComponent(stageSlug)}&grade_slug=${encodeURIComponent(gradeSlug)}&subject_slug=${encodeURIComponent(subjectSlug)}`)
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [stageSlug, gradeSlug, subjectSlug]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!data || !data.units) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        {/* صفحة غير موجودة: تُستثنى من الأرشفة (كانت تُرجع 200 فتُحسب soft 404) */}
        <SEO title="الصفحة غير موجودة" noIndex />
        <h2 className="text-xl font-bold text-gray-600 mb-2">الصفحة غير موجودة</h2>
        <Link to="/اختبارات" className="text-emerald-600 hover:underline text-sm">العودة للاختبارات</Link>
      </div>
    );
  }

  const stageName = data.stage?.name || stageSlug;
  const gradeName = data.grade?.name || gradeSlug;
  const subjectName = data.subject?.name || subjectSlug;

  // Helper: generate unit slug from title
  const unitSlug = (title) => title.replace(/\s+/g, '-').replace(/:/g, '');

  // إحصائيات
  const totalExercises = data.units.reduce((sum, u) => sum + (parseInt(u.exercises_count) || 0), 0);
  const totalQuestions = data.units.reduce((sum, u) => sum + (parseInt(u.questions_count) || 0), 0);

  // JSON-LD structured data
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: `تمارين ${subjectName} - ${gradeName}`,
    description: `تمارين تفاعلية مجانية في ${subjectName} للصف ${gradeName} - ${stageName}`,
    provider: {
      '@type': 'Organization',
      name: 'حل المنهج',
      url: 'https://halmanhaj.com'
    },
    hasCourseInstance: data.units.map(unit => ({
      '@type': 'CourseInstance',
      name: unit.title,
      courseWorkload: `${unit.exercises_count || 0} تمرين`
    }))
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <SEO
        title={`تمارين ${subjectName} - ${gradeName}`}
        description={`تمارين تفاعلية مجانية في ${subjectName} للصف ${gradeName} ${stageName}. ${data.units.length} وحدة دراسية.`}
        structuredData={structuredData}
      />
      <Breadcrumbs items={[
        { label: 'اختبارات', to: '/اختبارات' },
        { label: stageName, to: `/اختبارات/${stageSlug}` },
        { label: gradeName, to: `/اختبارات/${stageSlug}/${gradeSlug}` },
        { label: subjectName }
      ]} />

      {/* Header محسّن */}
      <div className="bg-gradient-to-l from-emerald-600 to-teal-700 rounded-2xl p-6 sm:p-8 text-white mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <span className="text-3xl">{data.subject_icon || '📘'}</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold">تمارين {subjectName}</h1>
            <p className="text-emerald-200 text-sm mt-1">{gradeName} — {stageName}</p>
          </div>
        </div>

        {/* إحصائيات مفصّلة */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 mt-4 pt-4 border-t border-white/20">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center">
              <span className="text-sm">📂</span>
            </div>
            <div>
              <span className="text-white text-sm font-bold">{data.units.length}</span>
              <span className="text-emerald-200 text-xs mr-1">وحدة</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center">
              <span className="text-sm">📝</span>
            </div>
            <div>
              <span className="text-white text-sm font-bold">{totalExercises}</span>
              <span className="text-emerald-200 text-xs mr-1">تمرين</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center">
              <span className="text-sm">❓</span>
            </div>
            <div>
              <span className="text-white text-sm font-bold">{totalQuestions}</span>
              <span className="text-emerald-200 text-xs mr-1">سؤال</span>
            </div>
          </div>
        </div>
      </div>

      <AdUnit position="tests_between_cards" className="mb-6" />

      {data.units.length === 0 ? (
        <div className="text-center py-16">
          <span className="text-5xl block mb-4">📭</span>
          <h3 className="text-lg font-bold text-gray-700 mb-2">لا توجد وحدات بها تمارين</h3>
          <p className="text-sm text-gray-500">ستتوفر تمارين جديدة قريباً</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.units.map((unit, idx) => {
            const exerciseCount = parseInt(unit.exercises_count) || 0;
            const questionCount = parseInt(unit.questions_count) || 0;
            const hasExercises = exerciseCount > 0;

            return (
              <Link
                key={unit.id}
                to={`/اختبارات/${stageSlug}/${gradeSlug}/${subjectSlug}/${unitSlug(unit.title)}`}
                state={{ unitId: unit.id }}
                className={`group block bg-white rounded-xl border p-4 sm:p-5 transition-all duration-300 ${hasExercises ? 'border-gray-100 hover:shadow-lg hover:border-emerald-200' : 'border-gray-50 opacity-60'}`}
              >
                <div className="flex items-center gap-4">
                  {/* رقم الوحدة */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${hasExercises ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm' : 'bg-gray-100 text-gray-400'}`}>
                    <span className="text-lg font-bold">{idx + 1}</span>
                  </div>

                  {/* معلومات الوحدة */}
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-base font-bold transition-colors ${hasExercises ? 'text-gray-800 group-hover:text-emerald-600' : 'text-gray-500'}`}>{unit.title}</h3>
                    <div className="flex items-center gap-3 mt-1.5">
                      {hasExercises ? (
                        <>
                          <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-medium">
                            <span>📝</span> {exerciseCount} تمرين
                          </span>
                          {questionCount > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                              <span>❓</span> {questionCount} سؤال
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-gray-400">لا تمارين بعد</span>
                      )}
                    </div>
                  </div>

                  {/* زر البدء */}
                  {hasExercises && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="hidden sm:inline-block text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition-all">
                        عرض التمارين
                      </span>
                      <svg className="w-5 h-5 text-gray-300 group-hover:text-emerald-500 transition-colors sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* معلومات إضافية */}
      <div className="mt-8 bg-gray-50 rounded-xl p-5 border border-gray-100">
        <div className="flex items-start gap-3">
          <span className="text-lg">💡</span>
          <div>
            <h4 className="text-sm font-bold text-gray-700 mb-1">كيف تستفيد من التمارين؟</h4>
            <p className="text-xs text-gray-500 leading-relaxed">
              حل التمارين يساعدك على فهم المادة بشكل أفضل. ابدأ بالوحدات الأولى وتدرّج في الصعوبة. يمكنك إعادة التمرين أكثر من مرة لتحسين نتيجتك.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
