import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { API_BASE, SERVER_URL } from '../../lib/api';
import { useSemester } from '../../context/SemesterContext';
import SEO from '../../components/public/SEO';

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedSemester } = useSemester();
  const query = searchParams.get('q') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [localQuery, setLocalQuery] = useState(query);

  useEffect(() => {
    if (!query) return;
    setLoading(true);
    const params = new URLSearchParams({ q: query, page: String(page), limit: '20' });
    if (selectedSemester !== '0') params.set('semester', selectedSemester);

    fetch(`${API_BASE}/public/search?${params}`)
      .then(res => res.json())
      .then(data => {
        setResults(data.results || []);
        setTotal(data.total || 0);
        setTotalPages(data.pagination?.pages || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [query, selectedSemester, page]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (localQuery.trim()) {
      setSearchParams({ q: localQuery.trim() });
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <SEO title="بحث" noIndex />
      {/* Search Box */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="relative">
          <input
            type="text"
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            placeholder="ابحث عن حلول، ملخصات، اختبارات..."
            className="w-full bg-white border border-gray-200 rounded-2xl px-6 py-4 pr-12 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 shadow-sm"
            autoFocus
          />
          <button type="submit" className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </div>
      </form>

      {/* النتائج */}
      {query && (
        <p className="text-sm text-gray-500 mb-4">
          {loading ? 'جاري البحث...' : `${total} نتيجة للبحث عن "${query}"`}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="space-y-3">
          {results.map(lesson => (
            <Link
              key={lesson.id}
              to={`/files/${lesson.slug}`}
              className="group flex items-center gap-4 bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md hover:border-blue-100 transition-all"
            >
              {lesson.thumbnail_url ? (
                <img src={`${SERVER_URL}${lesson.thumbnail_url}`} alt="" className="w-20 h-16 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <div className="w-20 h-16 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                  <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md">{lesson.type}</span>
                  <span className="text-xs text-gray-400">{lesson.subject_name}</span>
                </div>
                <h3 className="text-sm font-bold text-gray-800 group-hover:text-blue-600 transition-colors truncate">
                  {lesson.title}
                </h3>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                  <span>{lesson.views || 0} مشاهدة</span>
                  <span>{lesson.downloads || 0} تحميل</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {!loading && query && results.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-sm">لا توجد نتائج</p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => setSearchParams({ q: query, page: String(p) })}
              className={`w-9 h-9 rounded-lg text-sm transition-all ${p === page ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
