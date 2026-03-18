import { useState, useRef, useCallback, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// إعداد worker من CDN
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PdfViewer({ fileUrl, fileName }) {
  const [numPages, setNumPages] = useState(null);
  const [scale, setScale] = useState(1.0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [loadedPages, setLoadedPages] = useState(new Set());
  const [showToc, setShowToc] = useState(false);
  const [outline, setOutline] = useState([]);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const pageRefs = useRef({});

  // حساب عرض الحاوية
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth - 32);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [isFullScreen]);

  // عند تحميل المستند
  const onDocumentLoadSuccess = useCallback(async (pdf) => {
    setNumPages(pdf.numPages);
    setPdfDoc(pdf);
    // تحميل أول 3 صفحات مباشرة
    setLoadedPages(new Set([1, 2, 3]));

    // جلب الفهرس
    try {
      const ol = await pdf.getOutline();
      if (ol && ol.length > 0) {
        setOutline(ol);
      }
    } catch {
      // لا يوجد فهرس
    }
  }, []);

  // Lazy loading - تحميل الصفحات عند التمرير
  useEffect(() => {
    if (!numPages || !viewerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageNum = parseInt(entry.target.dataset.page);
            if (pageNum && !loadedPages.has(pageNum)) {
              setLoadedPages(prev => new Set([...prev, pageNum]));
            }
          }
        });
      },
      { root: viewerRef.current, rootMargin: '200px' }
    );

    // مراقبة كل placeholder
    const placeholders = viewerRef.current.querySelectorAll('[data-page]');
    placeholders.forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, [numPages, loadedPages]);

  // التكبير / التصغير
  const zoomIn = () => setScale(prev => Math.min(prev + 0.2, 3.0));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.4));
  const resetZoom = () => setScale(1.0);

  // ملء الشاشة
  const toggleFullScreen = () => {
    if (!isFullScreen) {
      containerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  useEffect(() => {
    const handler = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // التنقل للصفحة
  const goToPage = (pageNum) => {
    const el = pageRefs.current[pageNum];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    // تأكد من تحميل الصفحة
    if (!loadedPages.has(pageNum)) {
      setLoadedPages(prev => new Set([...prev, pageNum]));
    }
    setShowToc(false);
  };

  // التنقل للفهرس
  const navigateToOutlineItem = async (item) => {
    if (!pdfDoc || !item.dest) return;
    try {
      let dest = item.dest;
      if (typeof dest === 'string') {
        dest = await pdfDoc.getDestination(dest);
      }
      if (dest) {
        const ref = dest[0];
        const pageIndex = await pdfDoc.getPageIndex(ref);
        goToPage(pageIndex + 1);
      }
    } catch {
      // fallback
    }
  };

  // عرض الصفحة
  const pageWidth = Math.min(containerWidth, 900) * scale;

  return (
    <div
      ref={containerRef}
      className={`flex flex-col bg-gray-800 rounded-2xl overflow-hidden ${
        isFullScreen ? 'fixed inset-0 z-50 rounded-none' : ''
      }`}
    >
      {/* شريط الأدوات العلوي */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 bg-gray-900 border-b border-gray-700 flex-shrink-0">
        {/* يمين - الفهرس واسم الملف */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {outline.length > 0 && (
            <button
              onClick={() => setShowToc(!showToc)}
              className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${
                showToc ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
              title="فهرس الكتاب"
              aria-label="فهرس الكتاب"
              aria-expanded={showToc}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
          )}
          <span className="text-xs text-gray-400 truncate hidden sm:block">{fileName}</span>
        </div>

        {/* وسط - أدوات التحكم */}
        <div className="flex items-center gap-1">
          {/* التكبير والتصغير */}
          <button onClick={zoomOut} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors" title="تصغير" aria-label="تصغير">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
            </svg>
          </button>
          <button onClick={resetZoom} className="px-2 py-1 text-xs text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors font-mono min-w-[50px] text-center">
            {Math.round(scale * 100)}%
          </button>
          <button onClick={zoomIn} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors" title="تكبير" aria-label="تكبير">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>

          <div className="w-px h-5 bg-gray-700 mx-1"></div>

          {/* رقم الصفحة */}
          {numPages && (
            <span className="text-xs text-gray-300 font-mono px-2">
              {numPages} صفحة
            </span>
          )}

          <div className="w-px h-5 bg-gray-700 mx-1 hidden sm:block"></div>

          {/* ملء الشاشة */}
          <button onClick={toggleFullScreen} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors hidden sm:block" title="ملء الشاشة" aria-label={isFullScreen ? 'الخروج من ملء الشاشة' : 'ملء الشاشة'}>
            {isFullScreen ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              </svg>
            )}
          </button>
        </div>

        {/* يسار - فراغ للتوازن */}
        <div className="flex-1"></div>
      </div>

      {/* المحتوى */}
      <div className="flex flex-1 min-h-0 relative">
        {/* الفهرس الجانبي */}
        {showToc && outline.length > 0 && (
          <div className="w-64 bg-gray-850 border-l border-gray-700 overflow-y-auto flex-shrink-0 bg-gray-900">
            <div className="p-3">
              <h3 className="text-sm font-bold text-gray-300 mb-3">فهرس الكتاب</h3>
              <div className="space-y-1">
                {outline.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => navigateToOutlineItem(item)}
                    className="w-full text-right text-xs text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg px-3 py-2 transition-colors truncate block"
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* عارض الصفحات */}
        <div
          ref={viewerRef}
          className="flex-1 overflow-auto py-4"
          style={{ scrollBehavior: 'smooth' }}
        >
          <Document
            file={fileUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-10 h-10 border-4 border-gray-600 border-t-blue-500 rounded-full animate-spin"></div>
                <p className="text-gray-400 text-sm">جاري تحميل المستند...</p>
              </div>
            }
            error={
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <svg className="w-12 h-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <p className="text-red-400 text-sm">فشل تحميل المستند</p>
              </div>
            }
          >
            {numPages && Array.from({ length: numPages }, (_, i) => i + 1).map(pageNum => (
              <div
                key={pageNum}
                ref={el => { pageRefs.current[pageNum] = el; }}
                data-page={pageNum}
                className="flex flex-col items-center mb-4"
              >
                {loadedPages.has(pageNum) ? (
                  <>
                    <Page
                      pageNumber={pageNum}
                      width={pageWidth}
                      className="shadow-lg"
                      loading={
                        <div
                          className="bg-gray-700 animate-pulse rounded-lg flex items-center justify-center"
                          style={{ width: pageWidth, height: pageWidth * 1.4 }}
                        >
                          <span className="text-gray-500 text-sm">صفحة {pageNum}</span>
                        </div>
                      }
                    />
                    <span className="text-xs text-gray-500 mt-2">{pageNum} / {numPages}</span>
                  </>
                ) : (
                  <div
                    className="bg-gray-700/50 rounded-lg flex items-center justify-center"
                    style={{ width: pageWidth, height: pageWidth * 1.4 }}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin"></div>
                      <span className="text-gray-500 text-xs">صفحة {pageNum}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </Document>
        </div>
      </div>
    </div>
  );
}
