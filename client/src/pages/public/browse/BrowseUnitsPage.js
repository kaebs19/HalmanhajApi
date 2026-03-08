import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API_BASE } from '../../../lib/api';
import Breadcrumbs from '../../../components/public/Breadcrumbs';
import SEO from '../../../components/public/SEO';

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
        <h2 className="text-xl font-bold text-gray-600 mb-2">الصفحة غير موجودة</h2>
        <Link to="/اختبارات" className="text-emerald-600 hover:underline text-sm">العودة للاختبارات</Link>
      </div>
    );
  }

  const { stage_name, grade_name, subject_name } = data;

  // Helper: generate unit slug from title
  const unitSlug = (title) => title.replace(/\s+/g, '-').replace(/:/g, '');

  // JSON-LD structured data
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: `تمارين ${subject_name} - ${grade_name}`,
    description: `تمارين تفاعلية مجانية في ${subject_name} للصف ${grade_name} - ${stage_name}`,
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
        title={`تمارين ${subject_name} - ${grade_name}`}
        description={`تمارين تفاعلية مجانية في ${subject_name} للصف ${grade_name} ${stage_name}. ${data.units.length} وحدة دراسية.`}
        structuredData={structuredData}
      />
      <Breadcrumbs items={[
        { label: 'اختبارات', to: '/اختبارات' },
        { label: stage_name, to: `/اختبارات/${stageSlug}` },
        { label: grade_name, to: `/اختبارات/${stageSlug}/${gradeSlug}` },
        { label: subject_name }
      ]} />

      {/* Header */}
      <div className="bg-gradient-to-l from-emerald-600 to-teal-700 rounded-2xl p-8 text-white mb-8">
        <div className="flex items-center gap-4">
          <span className="text-4xl">{data.subject_icon || '📘'}</span>
          <div>
            <h1 className="text-2xl font-bold">تمارين {subject_name}</h1>
            <p className="text-emerald-200 text-sm mt-1">{grade_name} — {stage_name}</p>
            <p className="text-emerald-300 text-xs mt-0.5">{data.units.length} وحدة دراسية</p>
          </div>
        </div>
      </div>

      {data.units.length === 0 ? (
        <div className="text-center py-16">
          <span className="text-5xl block mb-4">📭</span>
          <h3 className="text-lg font-bold text-gray-700 mb-2">لا توجد وحدات بها تمارين</h3>
          <p className="text-sm text-gray-500">ستتوفر تمارين جديدة قريباً</p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.units.map((unit, idx) => (
            <Link
              key={unit.id}
              to={`/اختبارات/${stageSlug}/${gradeSlug}/${subjectSlug}/${unitSlug(unit.title)}`}
              state={{ unitId: unit.id }}
              className="group block bg-white rounded-xl border border-gray-100 p-5 hover:shadow-lg hover:border-emerald-100 transition-all duration-300"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center flex-shrink-0 group-hover:from-emerald-100 group-hover:to-teal-200 transition-colors">
                  <span className="text-lg font-bold text-emerald-600">{idx + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-gray-800 group-hover:text-emerald-600 transition-colors">{unit.title}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    {parseInt(unit.exercises_count) > 0 && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <span>📝</span> {unit.exercises_count} تمرين
                      </span>
                    )}
                    {parseInt(unit.questions_count) > 0 && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <span>❓</span> {unit.questions_count} سؤال
                      </span>
                    )}
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-300 group-hover:text-emerald-500 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
