import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API_BASE, SERVER_URL } from '../../../lib/api';
import Breadcrumbs from '../../../components/public/Breadcrumbs';
import SEO from '../../../components/public/SEO';
import AdUnit from '../../../components/public/AdUnit';

export default function BrowseSubjectsPage() {
  const { stageSlug, gradeSlug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/public/browse/subjects?stage_slug=${encodeURIComponent(stageSlug)}&grade_slug=${encodeURIComponent(gradeSlug)}`)
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [stageSlug, gradeSlug]);

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
        <h2 className="text-xl font-bold text-gray-600 mb-2">الصفحة غير موجودة</h2>
        <Link to="/اختبارات" className="text-emerald-600 hover:underline text-sm">العودة للاختبارات</Link>
      </div>
    );
  }

  const { stage_name, grade_name } = data;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <SEO
        title={`اختبارات ${grade_name} - ${stage_name}`}
        description={`اختبارات وتمارين تفاعلية مجانية لطلاب ${grade_name} ${stage_name}. اختر المادة واختبر معلوماتك.`}
      />
      <Breadcrumbs items={[
        { label: 'اختبارات', to: '/اختبارات' },
        { label: stage_name, to: `/اختبارات/${stageSlug}` },
        { label: grade_name }
      ]} />

      {/* Header */}
      <div className="bg-gradient-to-l from-emerald-600 to-teal-700 rounded-2xl p-8 text-white mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold">اختبارات {grade_name}</h1>
            <p className="text-emerald-200 text-sm mt-1">{stage_name} — {data.subjects.length} مادة</p>
          </div>
        </div>
      </div>

      <AdUnit position="tests_after_header" className="mb-6" />

      {data.subjects.length === 0 ? (
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
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {data.subjects.map(subject => (
              <Link
                key={subject.id}
                to={`/اختبارات/${stageSlug}/${gradeSlug}/${subject.public_slug || subject.slug}`}
                className="group bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg hover:border-emerald-100 transition-all duration-300"
              >
                {subject.image_url ? (
                  <div className="h-28 overflow-hidden">
                    <img
                      src={`${SERVER_URL}${subject.image_url}`}
                      alt={subject.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                ) : (
                  <div className="h-28 bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center group-hover:from-emerald-100 group-hover:to-teal-200 transition-colors">
                    <span className="text-3xl">{subject.icon || '📘'}</span>
                  </div>
                )}
                <div className="p-3 text-center">
                  <h3 className="text-sm font-bold text-gray-800 group-hover:text-emerald-600 transition-colors">{subject.name}</h3>
                  <div className="flex items-center justify-center gap-2 mt-1.5">
                    {parseInt(subject.units_count) > 0 && (
                      <span className="text-xs text-gray-400">{subject.units_count} وحدة</span>
                    )}
                    {parseInt(subject.exercises_count) > 0 && (
                      <>
                        {parseInt(subject.units_count) > 0 && <span className="text-gray-300">·</span>}
                        <span className="text-xs text-emerald-500 font-medium">{subject.exercises_count} تمرين</span>
                      </>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <AdUnit position="tests_between_cards" className="mt-6" />
        </>
      )}
    </div>
  );
}
