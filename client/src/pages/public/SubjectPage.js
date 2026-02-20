import { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { API_BASE, SERVER_URL } from '../../lib/api';
import { useSemester } from '../../context/SemesterContext';
import Breadcrumbs from '../../components/public/Breadcrumbs';
import SEO from '../../components/public/SEO';
import AdUnit from '../../components/public/AdUnit';
import { SkeletonCard } from '../../components/ui/Skeleton';

const TYPE_COLORS = {
  'حل': 'bg-blue-500 text-white',
  'كتاب': 'bg-emerald-500 text-white',
  'تحضير': 'bg-amber-500 text-white',
  'تجميع': 'bg-purple-500 text-white',
  'فيديو': 'bg-red-500 text-white',
  'اختبار': 'bg-rose-600 text-white',
  'ملخص': 'bg-green-600 text-white',
  'شرح': 'bg-violet-500 text-white',
  'ورقة_عمل': 'bg-orange-500 text-white',
};

export default function SubjectPage() {
  const { stage, grade, subject } = useParams();
  const { selectedSemester } = useSemester();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const page = parseInt(searchParams.get('page') || '1');

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedSemester !== '0') params.set('semester', selectedSemester);
    params.set('page', String(page));
    params.set('limit', '20');

    fetch(`${API_BASE}/public/subjects/${subject}?${params}`)
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [subject, selectedSemester, page]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* skeleton header */}
        <div className="flex gap-2 mb-4">
          <div className="h-3 bg-gray-200 animate-pulse rounded w-16" />
          <div className="h-3 bg-gray-200 animate-pulse rounded w-12" />
          <div className="h-3 bg-gray-200 animate-pulse rounded w-20" />
        </div>
        <div className="h-24 bg-gray-200 animate-pulse rounded-2xl mb-6" />
        {/* skeleton lessons grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <h2 className="text-xl font-bold text-gray-600 mb-2">المادة غير موجودة</h2>
        <Link to="/" className="text-blue-600 hover:underline text-sm">العودة للرئيسية</Link>
      </div>
    );
  }

  const breadcrumbs = [];
  if (data.subject.grades?.length > 0) {
    const firstGrade = data.subject.grades[0];
    breadcrumbs.push({ label: firstGrade.stage_name, to: `/${stage}` });
    breadcrumbs.push({ label: firstGrade.name, to: `/${stage}/${grade}` });
  } else if (data.subject.tracks?.length > 0) {
    const firstTrack = data.subject.tracks[0];
    breadcrumbs.push({ label: firstTrack.stage_name, to: `/${stage}` });
    breadcrumbs.push({ label: firstTrack.name, to: `/${stage}/${grade}` });
  }
  breadcrumbs.push({ label: data.subject.name });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <SEO title={data.subject.name} description={`ملفات ودروس مادة ${data.subject.name}`} />
      <Breadcrumbs items={breadcrumbs} />

      {/* Header */}
      <div className="bg-gradient-to-l from-amber-500 to-orange-600 rounded-2xl p-8 text-white mb-8">
        <div className="flex items-center gap-4">
          {data.subject.icon && <span className="text-4xl">{data.subject.icon}</span>}
          <div>
            <h1 className="text-2xl font-bold">{data.subject.name}</h1>
            <p className="text-amber-100 text-sm mt-1">
              {data.pagination.total} ملف
              {data.subject.grades?.length > 0 && ` - ${data.subject.grades.map(g => g.name).join('، ')}`}
            </p>
          </div>
        </div>
      </div>

      <AdUnit position="subject_after_header" className="mb-6" />

      {/* الملفات/الدروس */}
      {data.lessons.length > 0 ? (
        <div className="space-y-3">
          {data.lessons.map((lesson, index) => (
            <div key={lesson.id}>
              {index > 0 && index % 5 === 0 && <AdUnit position="subject_between_lessons" className="my-3" />}
              <Link
                to={`/files/${lesson.slug}`}
                className="group flex items-center gap-4 bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md hover:border-blue-100 transition-all"
              >
                {/* Thumbnail */}
                {lesson.thumbnail_url ? (
                  <img src={`${SERVER_URL}${lesson.thumbnail_url}`} alt="" className="w-20 h-16 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="w-20 h-16 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                    <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                )}

                {/* المعلومات */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-gray-800 group-hover:text-blue-600 transition-colors truncate">
                    {lesson.title}
                  </h3>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                    <span className={`px-2 py-0.5 rounded-md font-medium ${TYPE_COLORS[lesson.type] || 'bg-gray-500 text-white'}`}>{lesson.type}</span>
                    {lesson.category && <span>{lesson.category.replace('_', ' ')}</span>}
                    <span>{lesson.views || 0} مشاهدة</span>
                    <span>{lesson.downloads || 0} تحميل</span>
                  </div>
                </div>

                {/* السهم */}
                <svg className="w-5 h-5 text-gray-300 group-hover:text-blue-500 flex-shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">لا توجد ملفات لهذه المادة حالياً</p>
        </div>
      )}

      {/* Pagination */}
      {data.pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          {Array.from({ length: data.pagination.pages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => setSearchParams({ page: String(p) })}
              className={`w-9 h-9 rounded-lg text-sm transition-all ${p === page ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
