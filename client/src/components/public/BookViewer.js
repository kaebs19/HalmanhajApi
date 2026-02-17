import { useState, useEffect, useRef, useCallback } from 'react';

const ZOOM_LEVELS = [50, 75, 100, 125, 150];
const DEFAULT_ZOOM = 100;

export default function BookViewer({ pages, totalPages, status, pdfUrl, fileName, serverUrl }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [loadedImages, setLoadedImages] = useState(new Set());
  const [pageInput, setPageInput] = useState('');
  const [showPageInput, setShowPageInput] = useState(false);

  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const pageRefs = useRef({});
  const observerRef = useRef(null);
  const tocRef = useRef(null);

  const totalPagesCount = pages?.length || totalPages || 0;

  // ═══ Intersection Observer للتحميل الكسول + تتبع الصفحة الحالية ═══
  useEffect(() => {
    if (!viewerRef.current || !pages || pages.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const pageNum = parseInt(entry.target.dataset.page);
          if (!pageNum) return;

          if (entry.isIntersecting) {
            // تحميل الصورة
            setLoadedImages(prev => new Set([...prev, pageNum]));

            // تحميل مسبق للصفحات المجاورة
            if (pageNum > 1) setLoadedImages(prev => new Set([...prev, pageNum - 1]));
            if (pageNum < totalPagesCount) setLoadedImages(prev => new Set([...prev, pageNum + 1]));

            // تحديث الصفحة الحالية
            if (entry.intersectionRatio > 0.3) {
              setCurrentPage(pageNum);
            }
          }
        });
      },
      {
        root: viewerRef.current,
        rootMargin: '300px 0px',
        threshold: [0, 0.3, 0.5]
      }
    );

    observerRef.current = observer;

    // مراقبة عناصر الصفحات
    const elements = viewerRef.current.querySelectorAll('[data-page]');
    elements.forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, [pages, totalPagesCount]);

  // ═══ تحميل أول 3 صفحات مباشرة ═══
  useEffect(() => {
    if (pages && pages.length > 0) {
      const initial = new Set();
      for (let i = 1; i <= Math.min(3, pages.length); i++) {
        initial.add(i);
      }
      setLoadedImages(initial);
    }
  }, [pages]);

  // ═══ التنقل للصفحة ═══
  const goToPage = useCallback((pageNum) => {
    const num = Math.max(1, Math.min(pageNum, totalPagesCount));
    const el = pageRefs.current[num];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setCurrentPage(num);
    setLoadedImages(prev => new Set([...prev, num]));
    setShowToc(false);
    setShowPageInput(false);
  }, [totalPagesCount]);

  const nextPage = useCallback(() => {
    if (currentPage < totalPagesCount) goToPage(currentPage + 1);
  }, [currentPage, totalPagesCount, goToPage]);

  const prevPage = useCallback(() => {
    if (currentPage > 1) goToPage(currentPage - 1);
  }, [currentPage, goToPage]);

  // ═══ التكبير / التصغير ═══
  const zoomIn = () => {
    const idx = ZOOM_LEVELS.indexOf(zoom);
    if (idx < ZOOM_LEVELS.length - 1) setZoom(ZOOM_LEVELS[idx + 1]);
  };

  const zoomOut = () => {
    const idx = ZOOM_LEVELS.indexOf(zoom);
    if (idx > 0) setZoom(ZOOM_LEVELS[idx - 1]);
  };

  // ═══ ملء الشاشة ═══
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

  // ═══ اختصارات لوحة المفاتيح ═══
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (showPageInput) return;

      switch (e.key) {
        case 'ArrowRight': // RTL: الصفحة السابقة
          e.preventDefault();
          prevPage();
          break;
        case 'ArrowLeft': // RTL: الصفحة التالية
          e.preventDefault();
          nextPage();
          break;
        case 'ArrowUp':
          e.preventDefault();
          prevPage();
          break;
        case 'ArrowDown':
          e.preventDefault();
          nextPage();
          break;
        case '+':
        case '=':
          e.preventDefault();
          zoomIn();
          break;
        case '-':
          e.preventDefault();
          zoomOut();
          break;
        case 'f':
        case 'F':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            toggleFullScreen();
          }
          break;
        case 'Escape':
          setShowToc(false);
          setShowPageInput(false);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, showPageInput, nextPage, prevPage]);

  // ═══ دعم اللمس (Swipe) ═══
  const touchStartRef = useRef(null);
  const handleTouchStart = (e) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchEnd = (e) => {
    if (!touchStartRef.current) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;

    // Swipe أفقي فقط (أكبر من 60px وأقل من الرأسي)
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx > 0) prevPage(); // RTL: swipe right = previous
      else nextPage(); // RTL: swipe left = next
    }

    touchStartRef.current = null;
  };

  // ═══ إغلاق القائمة عند النقر خارجها ═══
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (tocRef.current && !tocRef.current.contains(e.target)) {
        setShowToc(false);
      }
    };
    if (showToc) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showToc]);

  // ═══ إدخال رقم الصفحة ═══
  const handlePageInputSubmit = (e) => {
    e.preventDefault();
    const num = parseInt(pageInput);
    if (num >= 1 && num <= totalPagesCount) {
      goToPage(num);
      setPageInput('');
    }
  };

  // ═══ تحميل PDF ═══
  const handleDownload = () => {
    if (pdfUrl) {
      window.open(`${serverUrl}${pdfUrl}`, '_blank');
    }
  };

  // ═══ حالات خاصة ═══
  if (status === 'processing') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 bg-[#1a1a2e] rounded-2xl">
        <div className="w-12 h-12 border-4 border-gray-600 border-t-blue-500 rounded-full animate-spin"></div>
        <p className="text-gray-300 text-sm">جاري تحويل صفحات PDF لصور...</p>
        <p className="text-gray-500 text-xs">هذه العملية تتم مرة واحدة فقط</p>
      </div>
    );
  }

  if (status === 'pending') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 bg-[#1a1a2e] rounded-2xl">
        <svg className="w-12 h-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-gray-300 text-sm">في انتظار تحويل صفحات PDF</p>
      </div>
    );
  }

  if (!pages || pages.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      dir="ltr"
      className={`flex flex-col rounded-2xl overflow-hidden ${
        isFullScreen ? 'fixed inset-0 z-50 rounded-none' : ''
      }`}
      style={{ backgroundColor: '#1a1a2e' }}
    >
      {/* ═══ شريط الأدوات العلوي ═══ */}
      <div
        className="flex items-center justify-between px-2 sm:px-4 py-2 border-b border-gray-700/50 flex-shrink-0 gap-1"
        style={{ backgroundColor: '#16213e' }}
      >
        {/* يسار - الفهرس + تنزيل */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* زر الفهرس */}
          <button
            onClick={() => setShowToc(!showToc)}
            className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
              showToc ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
            title="فهرس الصفحات"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
          </button>

          {/* تنزيل PDF */}
          {pdfUrl && (
            <button
              onClick={handleDownload}
              className="p-1.5 sm:p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="تحميل PDF"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            </button>
          )}

          {/* اسم الملف */}
          <span className="text-xs text-gray-500 truncate max-w-[100px] sm:max-w-[200px] hidden sm:block">
            {fileName}
          </span>
        </div>

        {/* وسط - التنقل + التكبير */}
        <div className="flex items-center gap-0.5 sm:gap-1">
          {/* التكبير */}
          <button
            onClick={zoomOut}
            className="p-1 sm:p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="تصغير"
            disabled={zoom === ZOOM_LEVELS[0]}
          >
            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM13.5 10.5h-6" />
            </svg>
          </button>

          <span className="text-xs text-gray-300 font-mono min-w-[40px] text-center">
            {zoom}%
          </span>

          <button
            onClick={zoomIn}
            className="p-1 sm:p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="تكبير"
            disabled={zoom === ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
          >
            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
            </svg>
          </button>

          <div className="w-px h-5 bg-gray-700 mx-0.5 sm:mx-1"></div>

          {/* التنقل بين الصفحات */}
          <button
            onClick={prevPage}
            className="p-1 sm:p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            disabled={currentPage <= 1}
            title="الصفحة السابقة"
          >
            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
            </svg>
          </button>

          {/* رقم الصفحة - قابل للنقر */}
          {showPageInput ? (
            <form onSubmit={handlePageInputSubmit} className="flex items-center">
              <input
                type="number"
                min="1"
                max={totalPagesCount}
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                className="w-12 h-6 bg-white/10 border border-gray-600 rounded text-center text-xs text-white focus:outline-none focus:border-blue-500"
                autoFocus
                onBlur={() => { setShowPageInput(false); setPageInput(''); }}
              />
              <span className="text-xs text-gray-500 mx-1">/</span>
              <span className="text-xs text-gray-400">{totalPagesCount}</span>
            </form>
          ) : (
            <button
              onClick={() => { setShowPageInput(true); setPageInput(String(currentPage)); }}
              className="text-xs text-gray-300 hover:text-white font-mono px-1.5 py-0.5 hover:bg-white/10 rounded transition-colors"
              title="انتقل لصفحة"
            >
              {currentPage} / {totalPagesCount}
            </button>
          )}

          <button
            onClick={nextPage}
            className="p-1 sm:p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            disabled={currentPage >= totalPagesCount}
            title="الصفحة التالية"
          >
            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
        </div>

        {/* يمين - ملء الشاشة */}
        <div className="flex items-center gap-1">
          <button
            onClick={toggleFullScreen}
            className="p-1.5 sm:p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="ملء الشاشة"
          >
            {isFullScreen ? (
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
              </svg>
            ) : (
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* ═══ المحتوى الرئيسي ═══ */}
      <div className="flex flex-1 min-h-0 relative">
        {/* ═══ الفهرس الجانبي (thumbnails) ═══ */}
        {showToc && (
          <div
            ref={tocRef}
            className="w-36 sm:w-44 border-r border-gray-700/50 overflow-y-auto flex-shrink-0 py-2"
            style={{ backgroundColor: '#0f1629' }}
          >
            <div className="space-y-2 px-2">
              {pages.map((page) => (
                <button
                  key={page.page_number}
                  onClick={() => goToPage(page.page_number)}
                  className={`w-full rounded-lg overflow-hidden transition-all ${
                    currentPage === page.page_number
                      ? 'ring-2 ring-blue-500 opacity-100'
                      : 'opacity-60 hover:opacity-90'
                  }`}
                >
                  <img
                    src={`${serverUrl}${page.thumb_url}`}
                    alt={`صفحة ${page.page_number}`}
                    className="w-full h-auto rounded-lg"
                    loading="lazy"
                  />
                  <span className="block text-[10px] text-gray-400 mt-1 text-center pb-1">
                    {page.page_number}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ═══ عارض الصفحات ═══ */}
        <div
          ref={viewerRef}
          className="flex-1 overflow-auto py-4"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          style={{ scrollBehavior: 'smooth' }}
        >
          <div className="flex flex-col items-center gap-3 sm:gap-4">
            {pages.map((page) => {
              const isLoaded = loadedImages.has(page.page_number);
              const imageWidth = zoom / 100;

              return (
                <div
                  key={page.page_number}
                  ref={el => { pageRefs.current[page.page_number] = el; }}
                  data-page={page.page_number}
                  className="flex flex-col items-center"
                  style={{ maxWidth: `${Math.min(900 * imageWidth, isFullScreen ? 1400 : 900)}px`, width: `${Math.min(100, zoom)}%` }}
                >
                  {isLoaded ? (
                    <img
                      src={`${serverUrl}${page.image_url}`}
                      alt={`صفحة ${page.page_number}`}
                      className="w-full h-auto rounded shadow-lg"
                      style={{
                        maxWidth: `${Math.min(900 * imageWidth, isFullScreen ? 1400 : 900)}px`,
                      }}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div
                      className="w-full rounded shadow-lg flex items-center justify-center"
                      style={{
                        backgroundColor: '#252545',
                        aspectRatio: page.width && page.height ? `${page.width}/${page.height}` : '210/297',
                      }}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-6 h-6 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin"></div>
                        <span className="text-gray-500 text-xs">
                          {page.page_number}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* رقم الصفحة */}
                  <span className="text-[10px] text-gray-500 mt-1.5">
                    {page.page_number}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══ شريط التقدم السفلي ═══ */}
      <div className="h-1 w-full" style={{ backgroundColor: '#0f1629' }}>
        <div
          className="h-full bg-blue-600 transition-all duration-300"
          style={{ width: `${(currentPage / totalPagesCount) * 100}%` }}
        />
      </div>
    </div>
  );
}
