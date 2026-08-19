import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API_BASE, SERVER_URL } from '../../../lib/api';
import Breadcrumbs from '../../../components/public/Breadcrumbs';
import SEO from '../../../components/public/SEO';
import AdUnit from '../../../components/public/AdUnit';

export default function BrowseGradesPage() {
  const { stageSlug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/public/browse/grades?stage_slug=${encodeURIComponent(stageSlug)}`)
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [stageSlug]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!data || !data.grades) {
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <SEO
        title={`اختبارات ${stageName}`}
        description={`اختبارات وتمارين تفاعلية مجانية لجميع صفوف ${stageName}. اختبر معلوماتك في المنهج السعودي.`}
      />
      <Breadcrumbs items={[
        { label: 'اختبارات', to: '/اختبارات' },
        { label: stageName }
      ]} />

      {/* Header */}
      <div className="bg-gradient-to-l from-emerald-600 to-teal-700 rounded-2xl p-8 text-white mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <span className="text-3xl">{data.stage_icon || '📚'}</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold">اختبارات {stageName}</h1>
            <p className="text-emerald-200 text-sm mt-1">{data.grades.length} صف دراسي</p>
          </div>
        </div>
      </div>

      <AdUnit position="tests_after_header" className="mb-6" />

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {data.grades.map(grade => (
          <Link
            key={grade.id}
            to={`/اختبارات/${stageSlug}/${grade.public_slug || grade.slug}`}
            className="group bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg hover:border-emerald-100 transition-all duration-300"
          >
            {grade.image_url ? (
              <div className="h-28 overflow-hidden">
                <img
                  src={`${SERVER_URL}${grade.image_url}`}
                  alt={grade.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
            ) : (
              <div className="h-28 bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center group-hover:from-emerald-100 group-hover:to-teal-200 transition-colors">
                <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            )}
            <div className="p-3 text-center">
              <h3 className="text-sm font-bold text-gray-800 group-hover:text-emerald-600 transition-colors">{grade.name}</h3>
            </div>
          </Link>
        ))}
      </div>

      <AdUnit position="tests_between_cards" className="mt-6" />
    </div>
  );
}
