import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE } from '../../../lib/api';
import Breadcrumbs from '../../../components/public/Breadcrumbs';
import SEO from '../../../components/public/SEO';

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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <SEO
        title="تمارين المناهج السعودية"
        description="تمارين تفاعلية مجانية لجميع المراحل الدراسية - ابتدائي، متوسط، ثانوي. تدرّب على المنهج السعودي بدون تسجيل."
        keywords="تمارين، اختبارات، المناهج السعودية، ابتدائي، متوسط، ثانوي"
      />
      <Breadcrumbs items={[{ label: 'اختبارات' }]} />

      {/* Header */}
      <div className="bg-gradient-to-l from-emerald-600 to-teal-700 rounded-2xl p-8 text-white mb-8">
        <div className="flex items-center gap-4">
          <span className="text-4xl">📝</span>
          <div>
            <h1 className="text-2xl font-bold">تمارين تفاعلية</h1>
            <p className="text-emerald-200 text-sm mt-1">اختر المرحلة الدراسية وابدأ التدريب مجاناً</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-8 animate-pulse">
              <div className="w-16 h-16 bg-gray-200 rounded-2xl mx-auto mb-4" />
              <div className="h-5 bg-gray-200 rounded w-3/4 mx-auto mb-2" />
              <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto" />
            </div>
          ))}
        </div>
      ) : stages.length === 0 ? (
        <div className="text-center py-20">
          <span className="text-5xl block mb-4">📭</span>
          <h3 className="text-lg font-bold text-gray-700 mb-2">لا توجد مراحل متاحة حالياً</h3>
          <Link to="/" className="text-blue-600 hover:underline text-sm">العودة للرئيسية</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {stages.map(stage => (
            <Link
              key={stage.id}
              to={`/اختبارات/${stage.public_slug || stage.slug}`}
              className="group bg-white rounded-2xl border border-gray-100 p-8 text-center hover:shadow-xl hover:border-emerald-200 transition-all duration-300"
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center group-hover:from-emerald-100 group-hover:to-teal-200 transition-colors">
                <span className="text-3xl">{stage.icon || '📚'}</span>
              </div>
              <h2 className="text-lg font-bold text-gray-800 group-hover:text-emerald-600 transition-colors mb-1">
                {stage.name}
              </h2>
              <p className="text-sm text-gray-400">{stage.grades_count} صف دراسي</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
