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
  const tocRef = useRef(null);

  const totalPagesCount = pages?.length || totalPages || 0;

  // ═══ Intersection Observer: lazy load + تتبع الصفحة الحالية ═══
  useEffect(() => {
    if (!viewerRef.current || !pages || pages.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const pageNum = parseInt(entry.target.dataset.page);
          if (!pageNum) return;

          if (entry.isIntersecting) {
            setLoadedImages(prev => new Set([...prev, pageNum]));
            if (pageNum > 1) setLoadedImages(prev => new Set([...prev, pageNum - 1]));
            if (pageNum < totalPagesCount) setLoadedImages(prev => new Set([...prev, pageNum + 1]));
            if (entry.intersectionRatio > 0.3) {
              setCurrentPage(pageNum);
            }
          }
        });
      },
      {
        root: viewerRef.current,
        rootMargin: '400px 0px',
        threshold: [0, 0.3, 0.5]
      }
    );

    const elements = viewerRef.current.querySelectorAll('[data-page]');
    elements.forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, [pages, totalPagesCount]);

  // ═══ تحميل أول 3 صفحات ═══
  useEffect(() => {
    if (pages && pages.length > 0) {
      const initial = new Set();
      for (let i = 1; i <= Math.min(3, pages.length); i++) initial.add(i);
      setLoadedImages(initial);
    }
  }, [pages]);

  // ═══ التنقل ═══
  const goToPage = useCallback((pageNum) => {
    const num = Math.max(1, Math.min(pageNum, totalPagesCount));
    const el = pageRefs.current[num];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  // ═══ التكبير ═══
  const zoomIn = useCallback(() => {
    setZoom(z => {
      const idx = ZOOM_LEVELS.indexOf(z);
      return idx < ZOOM_LEVELS.length - 1 ? ZOOM_LEVELS[idx + 1] : z;
    });
  }, []);

  const zoomOut = useCallback(() => {
    setZoom(z => {
      const idx = ZOOM_LEVELS.indexOf(z);
      return idx > 0 ? ZOOM_LEVELS[idx - 1] : z;
    });
  }, []);

  // ═══ ملء الشاشة ═══
  const toggleFullScreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }, []);

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
        case 'ArrowRight': e.preventDefault(); prevPage(); break;
        case 'ArrowLeft': e.preventDefault(); nextPage(); break;
        case 'ArrowUp': e.preventDefault(); prevPage(); break;
        case 'ArrowDown': e.preventDefault(); nextPage(); break;
        case '+': case '=': e.preventDefault(); zoomIn(); break;
        case '-': e.preventDefault(); zoomOut(); break;
        case 'f': case 'F':
          if (!e.ctrlKey && !e.metaKey) { e.preventDefault(); toggleFullScreen(); }
          break;
        case 'Escape': setShowToc(false); setShowPageInput(false); break;
        default: break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPageInput, nextPage, prevPage, zoomIn, zoomOut, toggleFullScreen]);

  // ═══ Swipe ═══
  const touchStartRef = useRef(null);
  const handleTouchStart = (e) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const handleTouchEnd = (e) => {
    if (!touchStartRef.current) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx > 0) prevPage(); else nextPage();
    }
    touchStartRef.current = null;
  };

  // ═══ إغلاق الفهرس ═══
  useEffect(() => {
    if (!showToc) return;
    const handler = (e) => { if (tocRef.current && !tocRef.current.contains(e.target)) setShowToc(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showToc]);

  // ═══ إدخال رقم الصفحة ═══
  const handlePageInputSubmit = (e) => {
    e.preventDefault();
    const num = parseInt(pageInput);
    if (num >= 1 && num <= totalPagesCount) { goToPage(num); setPageInput(''); }
  };

  // ═══ حالات خاصة ═══
  if (status === 'processing') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 bg-[#f0f0f0] rounded-xl">
        <div className="w-10 h-10 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
        <p className="text-gray-600 text-sm font-medium">جاري تحويل صفحات الكتاب...</p>
        <p className="text-gray-400 text-xs">هذه العملية تتم مرة واحدة فقط</p>
      </div>
    );
  }

  if (status === 'pending') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 bg-[#f0f0f0] rounded-xl">
        <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-gray-600 text-sm">في انتظار تحويل الصفحات</p>
      </div>
    );
  }

  if (!pages || pages.length === 0) return null;

  return (
    <div
      ref={containerRef}
      dir="ltr"
      className={`flex flex-col overflow-hidden ${
        isFullScreen ? 'fixed inset-0 z-50' : 'h-full rounded-xl'
      }`}
      style={{ backgroundColor: '#f0f0f0' }}
    >
      {/* ═══════ شريط الأدوات ═══════ */}
      <div className="flex items-center justify-between px-2 sm:px-3 py-1.5 bg-white border-b border-gray-200 flex-shrink-0 gap-1 z-10">

        {/* يسار: فهرس */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowToc(!showToc)}
            className={`p-2 rounded-lg transition-colors ${
              showToc ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
            }`}
            title="فهرس الصفحات"
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
            </svg>
          </button>
        </div>

        {/* وسط: تنقل + تكبير */}
        <div className="flex items-center gap-0.5 sm:gap-1">
          {/* تصغير */}
          <button onClick={zoomOut} disabled={zoom === ZOOM_LEVELS[0]}
            className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors disabled:opacity-30" title="تصغير">
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
            </svg>
          </button>

          <span className="text-xs sm:text-sm text-gray-600 font-mono min-w-[40px] text-center select-none">{zoom}%</span>

          {/* تكبير */}
          <button onClick={zoomIn} disabled={zoom === ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
            className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors disabled:opacity-30" title="تكبير">
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>

          <div className="w-px h-4 bg-gray-200 mx-1 hidden sm:block"></div>

          {/* أسهم التنقل */}
          <button onClick={prevPage} disabled={currentPage <= 1}
            className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors disabled:opacity-30" title="السابق">
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
            </svg>
          </button>

          {/* رقم الصفحة */}
          {showPageInput ? (
            <form onSubmit={handlePageInputSubmit} className="flex items-center gap-0.5">
              <input type="number" min="1" max={totalPagesCount} value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                className="w-12 h-7 bg-gray-100 border border-gray-300 rounded text-center text-sm text-gray-800 focus:outline-none focus:border-blue-400"
                autoFocus onBlur={() => { setShowPageInput(false); setPageInput(''); }} />
              <span className="text-xs text-gray-400">/</span>
              <span className="text-xs text-gray-500">{totalPagesCount}</span>
            </form>
          ) : (
            <button
              onClick={() => { setShowPageInput(true); setPageInput(String(currentPage)); }}
              className="text-xs sm:text-sm text-gray-700 font-mono px-2 py-1 hover:bg-gray-100 rounded transition-colors select-none" title="انتقل لصفحة">
              {currentPage} / {totalPagesCount}
            </button>
          )}

          <button onClick={nextPage} disabled={currentPage >= totalPagesCount}
            className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors disabled:opacity-30" title="التالي">
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
        </div>

        {/* يمين: ملء الشاشة */}
        <div className="flex items-center gap-1">
          <button onClick={toggleFullScreen}
            className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors" title="ملء الشاشة">
            {isFullScreen ? (
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
              </svg>
            ) : (
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* ═══════ المحتوى ═══════ */}
      <div className="flex flex-1 min-h-0 relative">
        {/* الفهرس الجانبي */}
        {showToc && (
          <div ref={tocRef}
            className="w-32 sm:w-40 border-r border-gray-200 overflow-y-auto flex-shrink-0 py-2 bg-white">
            <div className="space-y-1.5 px-1.5">
              {pages.map((page) => (
                <button key={page.page_number} onClick={() => goToPage(page.page_number)}
                  className={`w-full rounded-lg overflow-hidden transition-all ${
                    currentPage === page.page_number ? 'ring-2 ring-blue-500 shadow-sm' : 'opacity-60 hover:opacity-100'
                  }`}>
                  <img src={`${serverUrl}${page.thumb_url}`} alt={`${page.page_number}`}
                    className="w-full h-auto" loading="lazy" />
                  <span className="block text-[9px] text-gray-400 text-center py-0.5">{page.page_number}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* عارض الصفحات */}
        <div ref={viewerRef}
          className="flex-1 overflow-auto"
          onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}
          style={{ scrollBehavior: 'smooth' }}>
          <div className="flex flex-col items-center gap-4 sm:gap-5 py-4 sm:py-6 px-2 sm:px-4">
            {pages.map((page) => {
              const isLoaded = loadedImages.has(page.page_number);
              const scale = zoom / 100;
              const maxW = isFullScreen ? 1200 : 800;

              return (
                <div key={page.page_number}
                  ref={el => { pageRefs.current[page.page_number] = el; }}
                  data-page={page.page_number}
                  className="flex flex-col items-center"
                  style={{ width: `${Math.min(100, zoom)}%`, maxWidth: `${maxW * scale}px` }}>

                  {isLoaded ? (
                    <img src={`${serverUrl}${page.image_url}`} alt={`صفحة ${page.page_number}`}
                      className="w-full h-auto bg-white shadow-md rounded-sm"
                      loading="lazy" decoding="async" />
                  ) : (
                    <div className="w-full bg-white shadow-md rounded-sm flex items-center justify-center"
                      style={{ aspectRatio: page.width && page.height ? `${page.width}/${page.height}` : '210/297' }}>
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-5 h-5 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
                        <span className="text-gray-300 text-[10px]">{page.page_number}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* شريط التقدم */}
      <div className="h-0.5 w-full bg-gray-200 flex-shrink-0">
        <div className="h-full bg-blue-500 transition-all duration-300"
          style={{ width: `${(currentPage / totalPagesCount) * 100}%` }} />
      </div>
    </div>
  );
}
