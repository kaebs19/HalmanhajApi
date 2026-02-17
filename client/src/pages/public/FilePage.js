import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API_BASE, SERVER_URL } from '../../lib/api';
import Breadcrumbs from '../../components/public/Breadcrumbs';
import SEO from '../../components/public/SEO';
import BookViewer from '../../components/public/BookViewer';

export default function FilePage() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pagesData, setPagesData] = useState(null);

  // جلب بيانات الدرس
  useEffect(() => {
    setLoading(true);
    setPagesData(null);
    fetch(`${API_BASE}/public/files/${slug}`)
      .then(res => { if (!res.ok) throw new Error(); return res.json(); })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [slug]);

  // جلب صفحات PDF كصور
  useEffect(() => {
    if (!data?.lesson) return;
    const hasPdf = data.lesson.files?.some(f => f.file_type === 'pdf');
    if (!hasPdf) return;

    fetch(`${API_BASE}/public/files/${slug}/pages`)
      .then(res => res.ok ? res.json() : null)
      .then(result => {
        setPagesData(result);
        if (result && (result.status === 'processing' || result.status === 'pending')) {
          const interval = setInterval(() => {
            fetch(`${API_BASE}/public/files/${slug}/pages`)
              .then(res => res.ok ? res.json() : null)
              .then(newResult => {
                if (newResult) {
                  setPagesData(newResult);
                  if (newResult.status === 'done' || newResult.status === 'failed') clearInterval(interval);
                }
              }).catch(() => {});
          }, 5000);
          setTimeout(() => clearInterval(interval), 120000);
          return () => clearInterval(interval);
        }
      })
      .catch(() => setPagesData(null));
  }, [data, slug]);

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
        <h2 className="text-xl font-bold text-gray-600 mb-2">الملف غير موجود</h2>
        <Link to="/" className="text-blue-600 hover:underline text-sm">العودة للرئيسية</Link>
      </div>
    );
  }

  const { lesson, related } = data;
  const files = lesson.files || [];
  const pdfFile = files.find(f => f.file_type === 'pdf');
  const hasConvertedPages = pagesData && pagesData.pages && pagesData.pages.length > 0;

  // Breadcrumbs
  const breadcrumbs = [];
  if (lesson.grades?.length > 0) {
    const g = lesson.grades[0];
    if (g.stage_name) breadcrumbs.push({ label: g.stage_name, to: `/${g.public_slug || g.slug}` });
    breadcrumbs.push({ label: g.name, to: `/${g.public_slug || g.slug}` });
  }
  if (lesson.subject_name) breadcrumbs.push({ label: lesson.subject_name, to: lesson.subject_public_slug ? `/${lesson.subject_public_slug}` : '#' });
  breadcrumbs.push({ label: lesson.title });

  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
      <SEO title={lesson.title} description={lesson.description || `${lesson.title} - ${lesson.subject_name}`} />
      <Breadcrumbs items={breadcrumbs} />

      {/* ═══════ هيدر الكتاب (compact) ═══════ */}
      <div className="mb-4">
        {/* السطر الأول: صورة + عنوان */}
        <div className="flex items-start gap-3 mb-2.5">
          {lesson.thumbnail_url ? (
            <img src={`${SERVER_URL}${lesson.thumbnail_url}`} alt=""
              className="w-14 h-[72px] sm:w-16 sm:h-20 rounded-lg object-cover flex-shrink-0 shadow-sm" />
          ) : (
            <div className="w-14 h-[72px] sm:w-16 sm:h-20 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-7 h-7 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-base sm:text-xl font-bold text-gray-800 leading-snug line-clamp-2">{lesson.title}</h1>

            {/* الوصف */}
            {lesson.description && (
              <p className="text-xs sm:text-sm text-gray-500 mt-1 line-clamp-2 leading-relaxed">{lesson.description}</p>
            )}
          </div>
        </div>

        {/* السطر الثاني: tags + معلومات + زر تحميل صغير */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* المادة */}
          {lesson.subject_name && (
            <span className="text-[10px] sm:text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
              {lesson.subject_name}
            </span>
          )}
          {/* النوع */}
          <span className="text-[10px] sm:text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            {lesson.type}
          </span>
          {/* الصف */}
          {lesson.grades?.length > 0 && (
            <span className="text-[10px] sm:text-xs bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full">
              {lesson.grades[0].name}
            </span>
          )}
          {/* عدد الصفحات */}
          {pagesData?.total_pages > 0 && (
            <span className="text-[10px] sm:text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">
              {pagesData.total_pages} صفحة
            </span>
          )}

          {/* فاصل */}
          <span className="flex-1"></span>

          {/* مشاهدات + تحميلات */}
          <div className="flex items-center gap-3 text-[10px] sm:text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              {lesson.views || 0}
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {lesson.downloads || 0}
            </span>
            {/* حجم الملف */}
            {pdfFile && pdfFile.file_size > 0 && (
              <span className="text-gray-300">{formatSize(pdfFile.file_size)}</span>
            )}
          </div>
        </div>
      </div>

      {/* ═══════ مستعرض الكتاب ═══════ */}
      {pdfFile && (
        <div className="h-[80vh] sm:h-[80vh] mb-6 border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          {hasConvertedPages ? (
            <BookViewer
              pages={pagesData.pages}
              totalPages={pagesData.total_pages}
              status={pagesData.status}
              pdfUrl={pagesData.pdf_url}
              fileName={pagesData.file_name}
              serverUrl={SERVER_URL}
            />
          ) : pagesData && (pagesData.status === 'processing' || pagesData.status === 'pending') ? (
            <BookViewer
              pages={[]}
              totalPages={pagesData.total_pages}
              status={pagesData.status}
              pdfUrl={pagesData.pdf_url}
              fileName={pagesData.file_name}
              serverUrl={SERVER_URL}
            />
          ) : (
            <iframe
              src={`${SERVER_URL}${pdfFile.file_url}`}
              className="w-full h-full border-0"
              title="معاينة PDF"
            />
          )}
        </div>
      )}

      {/* PDF القديم */}
      {!pdfFile && lesson.pdf_url && (
        <div className="h-[80vh] mb-6 border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <iframe src={`${SERVER_URL}${lesson.pdf_url}`} className="w-full h-full border-0" title="معاينة PDF" />
        </div>
      )}

      {/* ═══════ كتب مشابهة ═══════ */}
      {related?.length > 0 && (
        <div className="mt-2">
          <h2 className="text-sm sm:text-base font-bold text-gray-700 mb-3">كتب مشابهة</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 sm:gap-3">
            {related.map(item => (
              <Link key={item.id} to={`/files/${item.slug}`}
                className="group bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md hover:border-blue-100 transition-all">
                {item.thumbnail_url ? (
                  <img src={`${SERVER_URL}${item.thumbnail_url}`} alt={item.title}
                    className="w-full h-28 sm:h-32 object-cover" />
                ) : (
                  <div className="w-full h-28 sm:h-32 bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
                    <svg className="w-8 h-8 text-blue-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                )}
                <div className="p-2.5">
                  <p className="text-[11px] sm:text-xs font-bold text-gray-700 group-hover:text-blue-600 line-clamp-2 leading-relaxed">
                    {item.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 text-[9px] sm:text-[10px] text-gray-400">
                    <span>{item.subject_name}</span>
                    <span>{item.views || 0} مشاهدة</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
