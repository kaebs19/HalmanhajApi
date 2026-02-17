import { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useSettings } from '../../context/SettingsContext';

const API_BASE = process.env.REACT_APP_API_URL || '/api';

const PAGE_META = {
  privacy: {
    title: 'سياسة الخصوصية',
    icon: (
      <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    emptyMessage: 'لم يتم إضافة سياسة الخصوصية بعد'
  },
  terms: {
    title: 'شروط الاستخدام',
    icon: (
      <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    emptyMessage: 'لم يتم إضافة شروط الاستخدام بعد'
  },
  contact: {
    title: 'اتصل بنا',
    icon: (
      <svg className="w-8 h-8 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    emptyMessage: 'لم يتم إضافة معلومات التواصل بعد'
  },
};

export default function PageView() {
  const location = useLocation();
  const pageKey = location.pathname.replace('/', '');
  const { settings } = useSettings();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const meta = PAGE_META[pageKey];

  useEffect(() => {
    const fetchPage = async () => {
      setLoading(true);
      setError(false);
      try {
        const res = await fetch(`${API_BASE}/public/pages/${pageKey}`);
        if (!res.ok) throw new Error('Not found');
        const data = await res.json();
        setContent(data.content || '');
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    if (meta) {
      fetchPage();
    } else {
      setError(true);
      setLoading(false);
    }
  }, [pageKey, meta]);

  if (!meta) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="text-6xl mb-4">404</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">الصفحة غير موجودة</h1>
        <Link to="/" className="text-blue-600 hover:underline">العودة للرئيسية</Link>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{meta.title} - {settings.site_name || 'حل المنهج'}</title>
        <meta name="description" content={`${meta.title} - ${settings.site_name || 'حل المنهج'}`} />
      </Helmet>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {/* رأس الصفحة */}
        <div className="mb-8 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
            {meta.icon}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
            {meta.title}
          </h1>
          <div className="w-16 h-1 bg-blue-500 rounded-full mx-auto mt-4"></div>
        </div>

        {/* المحتوى */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">&#9888;&#65039;</div>
            <p className="text-gray-600">حدث خطأ في تحميل الصفحة</p>
            <Link to="/" className="text-blue-600 hover:underline mt-4 inline-block">العودة للرئيسية</Link>
          </div>
        ) : content.trim() ? (
          <div
            className="prose prose-lg max-w-none text-gray-700 leading-relaxed
              prose-headings:text-gray-800 prose-headings:font-bold
              prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-gray-200
              prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3
              prose-p:mb-4 prose-p:leading-relaxed
              prose-ul:my-4 prose-ul:list-disc prose-ul:pr-6
              prose-ol:my-4 prose-ol:list-decimal prose-ol:pr-6
              prose-li:mb-2
              prose-a:text-blue-600 prose-a:hover:text-blue-800 prose-a:underline
              prose-strong:text-gray-800
              prose-blockquote:border-r-4 prose-blockquote:border-blue-300 prose-blockquote:bg-blue-50 prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:rounded-lg prose-blockquote:not-italic"
            style={{ direction: 'rtl' }}
            dangerouslySetInnerHTML={{ __html: content }}
          />
        ) : (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <p className="text-gray-500 text-lg">{meta.emptyMessage}</p>
            <Link to="/" className="text-blue-600 hover:underline mt-4 inline-block text-sm">العودة للرئيسية</Link>
          </div>
        )}
      </div>
    </>
  );
}
