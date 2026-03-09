import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE, SERVER_URL } from '../../../lib/api';
import Breadcrumbs from '../../../components/public/Breadcrumbs';
import SEO from '../../../components/public/SEO';
import AdUnit from '../../../components/public/AdUnit';

export default function BrowseStagesPage() {
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/public/browse/stages`)
      .then(res => res.json())
      .then(data => setStages(Array.isArray(data) ? data : []))
      .catch(() => setStages([]))
      .finally(() => setLoading(false));
  }, []);

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'اختبارات المناهج السعودية',
    description: 'اختبارات وتمارين تفاعلية مجانية لجميع المراحل الدراسية في المنهج السعودي',
    itemListElement: stages.map((stage, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: stage.name,
      url: `https://halmanhaj.com/اختبارات/${stage.public_slug || stage.slug}`
    }))
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <SEO
        title="اختبارات المناهج السعودية"
        description="اختبارات وتمارين تفاعلية مجانية لجميع المراحل الدراسية - ابتدائي، متوسط، ثانوي. اختبر معلوماتك وقيّم مستواك في المنهج السعودي."
        keywords="اختبارات، تمارين، المناهج السعودية، ابتدائي، متوسط، ثانوي، اختبر نفسك"
        structuredData={structuredData}
      />
      <Breadcrumbs items={[{ label: 'اختبارات' }]} />

      {/* Header */}
      <div className="bg-gradient-to-l from-emerald-600 to-teal-700 rounded-2xl p-8 text-white mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold">اختبارات المناهج السعودية</h1>
            <p className="text-emerald-200 text-sm mt-1">اختر المرحلة الدراسية واختبر معلوماتك مجاناً</p>
          </div>
        </div>
      </div>

      <AdUnit position="tests_after_header" className="mb-6" />

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-8 animate-pulse">
              <div className="w-20 h-20 bg-gray-200 rounded-2xl mx-auto mb-4" />
              <div className="h-5 bg-gray-200 rounded w-3/4 mx-auto mb-2" />
              <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto" />
            </div>
          ))}
        </div>
      ) : stages.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-gray-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-gray-700 mb-2">لا توجد مراحل متاحة حالياً</h3>
          <Link to="/" className="text-blue-600 hover:underline text-sm">العودة للرئيسية</Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {stages.map(stage => (
              <Link
                key={stage.id}
                to={`/اختبارات/${stage.public_slug || stage.slug}`}
                className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl hover:border-emerald-200 transition-all duration-300"
              >
                {/* صورة المرحلة */}
                {stage.image_url ? (
                  <div className="h-40 overflow-hidden">
                    <img
                      src={`${SERVER_URL}${stage.image_url}`}
                      alt={stage.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                ) : (
                  <div className="h-40 bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center group-hover:from-emerald-100 group-hover:to-teal-200 transition-colors">
                    <span className="text-5xl">{stage.icon || '📚'}</span>
                  </div>
                )}
                <div className="p-5 text-center">
                  <h2 className="text-lg font-bold text-gray-800 group-hover:text-emerald-600 transition-colors mb-1">
                    {stage.name}
                  </h2>
                  <p className="text-sm text-gray-400">{stage.grades_count} صف دراسي</p>
                  <div className="mt-3">
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-4 py-1.5 rounded-full group-hover:bg-emerald-600 group-hover:text-white transition-all">
                      عرض الاختبارات
                    </span>
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
