import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API_BASE, SERVER_URL } from '../../lib/api';
import Breadcrumbs from '../../components/public/Breadcrumbs';
import SEO from '../../components/public/SEO';

export default function GradePage() {
  const { stage, grade } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/public/grades/${grade}`)
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [grade]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <h2 className="text-xl font-bold text-gray-600 mb-2">الصف غير موجود</h2>
        <Link to="/" className="text-blue-600 hover:underline text-sm">العودة للرئيسية</Link>
      </div>
    );
  }

  const stageSlug = data.grade.stage_public_slug || data.grade.stage_slug;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <SEO title={`${data.grade.name} - ${data.grade.stage_name}`} description={`مواد ${data.grade.name} - ${data.grade.stage_name}`} />
      <Breadcrumbs items={[
        { label: data.grade.stage_name, to: `/${stageSlug}` },
        { label: data.grade.name }
      ]} />

      {/* Header */}
      <div className="bg-gradient-to-l from-violet-600 to-purple-700 rounded-2xl p-8 text-white mb-8">
        <h1 className="text-2xl font-bold">{data.grade.name}</h1>
        <p className="text-purple-200 text-sm mt-1">{data.grade.stage_name} - {data.subjects.length} مادة</p>
      </div>

      {/* المواد */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {data.subjects.map(subject => {
          const subjectSlug = subject.public_slug || subject.slug;
          return (
            <Link
              key={subject.id}
              to={`/${stage}/${grade}/${subjectSlug}`}
              className="group bg-white rounded-xl border border-gray-100 p-5 text-center hover:shadow-lg hover:border-blue-100 transition-all duration-300"
            >
              {subject.image_url ? (
                <img src={`${SERVER_URL}${subject.image_url}`} alt={subject.name} className="w-14 h-14 mx-auto mb-3 rounded-xl object-cover" />
              ) : (
                <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100 flex items-center justify-center text-2xl">
                  {subject.icon || '📖'}
                </div>
              )}
              <h3 className="text-sm font-bold text-gray-800 group-hover:text-blue-600 transition-colors">{subject.name}</h3>
            </Link>
          );
        })}
      </div>

      {data.subjects.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <p className="text-sm">لا توجد مواد لهذا الصف حالياً</p>
        </div>
      )}
    </div>
  );
}
