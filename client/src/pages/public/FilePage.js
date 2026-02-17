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
  const [, setPagesLoading] = useState(false);

  // جلب بيانات الدرس
  useEffect(() => {
    setLoading(true);
    setPagesData(null);
    fetch(`${API_BASE}/public/files/${slug}`)
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [slug]);

  // جلب صفحات PDF كصور
  useEffect(() => {
    if (!data?.lesson) return;

    const hasPdf = data.lesson.files?.some(f => f.file_type === 'pdf');
    if (!hasPdf) return;

    setPagesLoading(true);
    fetch(`${API_BASE}/public/files/${slug}/pages`)
      .then(res => res.ok ? res.json() : null)
      .then(result => {
        setPagesData(result);

        // إذا كان التحويل قيد التنفيذ، نعيد المحاولة كل 5 ثواني
        if (result && (result.status === 'processing' || result.status === 'pending')) {
          const interval = setInterval(() => {
            fetch(`${API_BASE}/public/files/${slug}/pages`)
              .then(res => res.ok ? res.json() : null)
              .then(newResult => {
                if (newResult) {
                  setPagesData(newResult);
                  if (newResult.status === 'done' || newResult.status === 'failed') {
                    clearInterval(interval);
                  }
                }
              })
              .catch(() => {});
          }, 5000);

          // تنظيف بعد دقيقتين كحد أقصى
          setTimeout(() => clearInterval(interval), 120000);
          return () => clearInterval(interval);
        }
      })
      .catch(() => setPagesData(null))
      .finally(() => setPagesLoading(false));
  }, [data, slug]);

  const handleDownload = (fileUrl, fileName) => {
    if (data?.lesson?.id) {
      fetch(`${API_BASE}/public/files/${data.lesson.id}/download`, { method: 'POST' }).catch(() => {});
    }
    window.open(`${SERVER_URL}${fileUrl}`, '_blank');
  };

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

  // Build breadcrumbs
  const breadcrumbs = [];
  if (lesson.grades?.length > 0) {
    const g = lesson.grades[0];
    breadcrumbs.push({ label: g.stage_name, to: `/${g.slug}` });
    breadcrumbs.push({ label: g.name, to: `/${g.slug}` });
  }
  breadcrumbs.push({ label: lesson.subject_name, to: '#' });
  breadcrumbs.push({ label: lesson.title });

  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const fileTypeIcon = (type) => {
    switch (type) {
      case 'pdf': return { bg: 'bg-red-50', text: 'text-red-500', label: 'PDF' };
      case 'image': return { bg: 'bg-green-50', text: 'text-green-500', label: 'صورة' };
      case 'video': return { bg: 'bg-purple-50', text: 'text-purple-500', label: 'فيديو' };
      default: return { bg: 'bg-gray-50', text: 'text-gray-500', label: 'ملف' };
    }
  };

  // التحقق من وجود صور محولة
  const hasConvertedPages = pagesData && pagesData.pages && pagesData.pages.length > 0;
  const pdfFile = files.find(f => f.file_type === 'pdf');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <SEO title={lesson.title} description={`${lesson.title} - ${lesson.subject_name}`} />
      <Breadcrumbs items={breadcrumbs} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* المحتوى الرئيسي */}
        <div className="lg:col-span-2">
          {/* Header */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
            <div className="flex items-start gap-4">
              {lesson.thumbnail_url ? (
                <img src={`${SERVER_URL}${lesson.thumbnail_url}`} alt="" className="w-24 h-20 rounded-xl object-cover flex-shrink-0" />
              ) : (
                <div className="w-24 h-20 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-10 h-10 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md font-medium">{lesson.type}</span>
                  <span className="text-xs text-gray-400">{lesson.subject_name}</span>
                </div>
                <h1 className="text-xl font-bold text-gray-800 leading-relaxed">{lesson.title}</h1>
                <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                  <span>{lesson.views || 0} مشاهدة</span>
                  <span>{lesson.downloads || 0} تحميل</span>
                  <span>{new Date(lesson.created_at).toLocaleDateString('ar-SA')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* الملفات */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">الملفات ({files.length})</h2>
            <div className="space-y-3">
              {files.map((file) => {
                const ft = fileTypeIcon(file.file_type);
                return (
                  <div key={file.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-4">
                    <div className={`w-10 h-10 rounded-lg ${ft.bg} flex items-center justify-center flex-shrink-0`}>
                      <span className={`text-xs font-bold ${ft.text}`}>{ft.label}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">{file.original_name || file.file_name}</p>
                      <p className="text-xs text-gray-400">{formatSize(file.file_size)}</p>
                    </div>
                    <button
                      onClick={() => handleDownload(file.file_url, file.file_name)}
                      className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors flex-shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      تحميل
                    </button>
                  </div>
                );
              })}
            </div>

            {/* ═══ مستعرض الكتاب الاحترافي ═══ */}
            {pdfFile && (
              <div className="mt-6">
                <h3 className="text-sm font-bold text-gray-600 mb-3">معاينة</h3>
                <div className="h-[700px] lg:h-[850px]">
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
                    /* Fallback: iframe للـ PDF مباشرة */
                    <iframe
                      src={`${SERVER_URL}${pdfFile.file_url}`}
                      className="w-full h-full rounded-xl border-0"
                      title="معاينة PDF"
                    />
                  )}
                </div>
              </div>
            )}

            {/* PDF القديم (من حقل pdf_url) */}
            {!pdfFile && lesson.pdf_url && (
              <div className="mt-6">
                <h3 className="text-sm font-bold text-gray-600 mb-3">معاينة</h3>
                <div className="h-[700px] lg:h-[800px]">
                  <iframe
                    src={`${SERVER_URL}${lesson.pdf_url}`}
                    className="w-full h-full rounded-xl border-0"
                    title="معاينة PDF"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* الشريط الجانبي */}
        <div>
          {/* معلومات */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
            <h3 className="text-sm font-bold text-gray-700 mb-3">تفاصيل</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">المادة</span>
                <span className="text-gray-700 font-medium">{lesson.subject_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">النوع</span>
                <span className="text-gray-700">{lesson.type}</span>
              </div>
              {lesson.grades?.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-400">الصف</span>
                  <span className="text-gray-700">{lesson.grades.map(g => g.name).join('، ')}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-400">الملفات</span>
                <span className="text-gray-700">{files.length}</span>
              </div>
              {pagesData?.total_pages > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-400">عدد الصفحات</span>
                  <span className="text-gray-700">{pagesData.total_pages}</span>
                </div>
              )}
            </div>
          </div>

          {/* محتوى مشابه */}
          {related?.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h3 className="text-sm font-bold text-gray-700 mb-3">محتوى مشابه</h3>
              <div className="space-y-3">
                {related.map(item => (
                  <Link
                    key={item.id}
                    to={`/files/${item.slug}`}
                    className="group flex items-center gap-3 hover:bg-gray-50 rounded-lg p-2 -mx-2 transition-colors"
                  >
                    {item.thumbnail_url ? (
                      <img src={`${SERVER_URL}${item.thumbnail_url}`} alt="" className="w-12 h-10 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-700 group-hover:text-blue-600 truncate">{item.title}</p>
                      <p className="text-[10px] text-gray-400">{item.views || 0} مشاهدة</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
