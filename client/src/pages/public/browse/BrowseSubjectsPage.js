import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API_BASE } from '../../../lib/api';
import Breadcrumbs from '../../../components/public/Breadcrumbs';
import SEO from '../../../components/public/SEO';

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
        title={`تمارين ${grade_name} - ${stage_name}`}
        description={`تمارين تفاعلية مجانية لطلاب ${grade_name} ${stage_name}. اختر المادة وابدأ التدريب.`}
      />
      <Breadcrumbs items={[
        { label: 'اختبارات', to: '/اختبارات' },
        { label: stage_name, to: `/اختبارات/${stageSlug}` },
        { label: grade_name }
      ]} />

      {/* Header */}
      <div className="bg-gradient-to-l from-emerald-600 to-teal-700 rounded-2xl p-8 text-white mb-8">
        <div className="flex items-center gap-4">
          <span className="text-4xl">📖</span>
          <div>
            <h1 className="text-2xl font-bold">تمارين {grade_name}</h1>
            <p className="text-emerald-200 text-sm mt-1">{stage_name} — {data.subjects.length} مادة</p>
          </div>
        </div>
      </div>

      {data.subjects.length === 0 ? (
        <div className="text-center py-16">
          <span className="text-5xl block mb-4">📭</span>
          <h3 className="text-lg font-bold text-gray-700 mb-2">لا توجد مواد بها تمارين</h3>
          <p className="text-sm text-gray-500">ستتوفر تمارين جديدة قريباً</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {data.subjects.map(subject => (
            <Link
              key={subject.id}
              to={`/اختبارات/${stageSlug}/${gradeSlug}/${subject.public_slug || subject.slug}`}
              className="group bg-white rounded-xl border border-gray-100 p-5 text-center hover:shadow-lg hover:border-emerald-100 transition-all duration-300"
            >
              <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center group-hover:from-emerald-100 group-hover:to-teal-200 transition-colors">
                <span className="text-2xl">{subject.icon || '📘'}</span>
              </div>
              <h3 className="text-sm font-bold text-gray-800 group-hover:text-emerald-600 transition-colors">{subject.name}</h3>
              <div className="flex items-center justify-center gap-2 mt-2">
                {parseInt(subject.units_count) > 0 && (
                  <span className="text-xs text-gray-400">{subject.units_count} وحدة</span>
                )}
                {parseInt(subject.exercises_count) > 0 && (
                  <>
                    {parseInt(subject.units_count) > 0 && <span className="text-gray-300">•</span>}
                    <span className="text-xs text-emerald-500 font-medium">{subject.exercises_count} تمرين</span>
                  </>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
