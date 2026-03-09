import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSettings } from '../../context/SettingsContext';
import { useSemester } from '../../context/SemesterContext';
import { useUserAuth } from '../../context/UserAuthContext';
import { API_BASE } from '../../lib/api';

export default function PublicHeader() {
  const { settings, logoUrl } = useSettings();
  const { semesters, selectedSemester, setSelectedSemester } = useSemester();
  const { user, logout } = useUserAuth();
  const navigate = useNavigate();

  const [navigation, setNavigation] = useState({ stages: [] });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [gradesDropdown, setGradesDropdown] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetch(`${API_BASE}/public/navigation`)
      .then(res => res.json())
      .then(data => setNavigation(data))
      .catch(() => {});
  }, []);

  // جلب عدد الإشعارات غير المقروءة
  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('user_token');
    if (!token) return;
    fetch(`${API_BASE}/notifications?limit=1`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setUnreadCount(data.unread_count || 0))
      .catch(() => {});
  }, [user]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setGradesDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
      setMobileOpen(false);
    }
  };

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      {/* الصف الأول: شعار + بحث + أزرار */}
      <div className="border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* الشعار */}
            <Link to="/" className="flex items-center gap-3 flex-shrink-0">
              {logoUrl ? (
                <img src={logoUrl} alt={settings.site_name} className="h-10 w-auto" />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-md">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
              )}
              <div className="hidden sm:block">
                <span className="text-lg font-bold text-gray-800">{settings.site_name}</span>
                <p className="text-[10px] text-gray-400 -mt-0.5">منصة حلول المناهج الدراسية السعودية</p>
              </div>
            </Link>

            {/* البحث (Desktop) */}
            <form onSubmit={handleSearch} className="hidden md:flex items-center flex-1 max-w-lg mx-8">
              <div className="relative w-full">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث عن حلول، ملخصات، اختبارات..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                />
                <button type="submit" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              </div>
            </form>

            {/* أزرار المستخدم + القائمة */}
            <div className="flex items-center gap-3">
              {user ? (
                <div className="hidden sm:flex items-center gap-2">
                  <Link to="/favorites" className="text-sm text-gray-600 hover:text-blue-600 transition-colors">
                    المفضلة
                  </Link>
                  <span className="text-gray-300">|</span>
                  <span className="text-sm text-gray-700 font-medium">{user.name}</span>
                  <button onClick={logout} className="text-sm text-red-500 hover:text-red-600">
                    خروج
                  </button>
                </div>
              ) : (
                <div className="hidden sm:flex items-center gap-2">
                  <Link to="/auth/login" className="text-sm text-gray-600 hover:text-blue-600 transition-colors px-3 py-2">
                    دخول
                  </Link>
                  <Link to="/auth/register" className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                    حساب جديد
                  </Link>
                </div>
              )}

              {/* زر القائمة (Mobile) */}
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="md:hidden p-2 text-gray-600 hover:text-gray-800"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  {mobileOpen
                    ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  }
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* الصف الثاني: التنقل + اختيار الفصل */}
      <div className="hidden md:block border-b border-gray-50 bg-gray-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-11">
            {/* المراحل + الصفحات */}
            <nav className="flex items-center gap-1" ref={dropdownRef}>
              <Link to="/" className="text-sm text-gray-600 hover:text-blue-600 px-3 py-1.5 rounded-lg hover:bg-white transition-all">
                الرئيسية
              </Link>

              {navigation.stages?.map((stage) => (
                <div key={stage.id} className="relative">
                  <button
                    onClick={() => setGradesDropdown(gradesDropdown === stage.id ? null : stage.id)}
                    className="flex items-center gap-1 text-sm text-gray-600 hover:text-blue-600 px-3 py-1.5 rounded-lg hover:bg-white transition-all"
                  >
                    {stage.icon && <span className="text-base">{stage.icon}</span>}
                    {stage.name}
                    <svg className={`w-3.5 h-3.5 transition-transform ${gradesDropdown === stage.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* القائمة المنسدلة */}
                  {gradesDropdown === stage.id && (
                    <div className="absolute top-full right-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-100 py-2 min-w-[220px] z-50">
                      <Link
                        to={`/${stage.public_slug || stage.slug}`}
                        onClick={() => setGradesDropdown(null)}
                        className="block px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 border-b border-gray-50 mb-1"
                      >
                        كل {stage.name}
                      </Link>

                      {stage.grades?.length > 0 ? (
                        // عرض الصفوف (مع مسارات متداخلة عبر grade_tracks)
                        stage.grades.map(grade => (
                          <div key={grade.id}>
                            {grade.tracks?.length > 1 ? (
                              // صف له عدة مسارات → عنوان + قائمة مسارات
                              <>
                                <p className="px-4 py-1.5 text-xs font-bold text-gray-400 mt-1">{grade.name}</p>
                                {grade.tracks.map(track => (
                                  <Link
                                    key={track.id}
                                    to={`/${stage.public_slug || stage.slug}/${track.slug}`}
                                    onClick={() => setGradesDropdown(null)}
                                    className="block px-6 py-1.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                                  >
                                    {track.name}
                                  </Link>
                                ))}
                              </>
                            ) : (
                              // صف بدون مسارات أو مسار واحد → رابط مباشر
                              <Link
                                to={`/${stage.public_slug || stage.slug}/${grade.public_slug || grade.slug}`}
                                onClick={() => setGradesDropdown(null)}
                                className="block px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                              >
                                {grade.name}
                              </Link>
                            )}
                          </div>
                        ))
                      ) : stage.tracks?.length > 0 ? (
                        // عرض مسارات مباشرة (بدون صفوف)
                        stage.tracks.map(track => (
                          <Link
                            key={track.id}
                            to={`/${stage.public_slug || stage.slug}/${track.slug}`}
                            onClick={() => setGradesDropdown(null)}
                            className="block px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                          >
                            {track.name}
                          </Link>
                        ))
                      ) : null}
                    </div>
                  )}
                </div>
              ))}

              <Link to="/اختبارات" className="text-sm text-gray-600 hover:text-blue-600 px-3 py-1.5 rounded-lg hover:bg-white transition-all">
                اختبارات
              </Link>
              {user && (
                <Link to="/exercises" className="text-sm text-gray-600 hover:text-blue-600 px-3 py-1.5 rounded-lg hover:bg-white transition-all">
                  تمارين & تحديات
                </Link>
              )}
              <Link to="/faq" className="text-sm text-gray-600 hover:text-blue-600 px-3 py-1.5 rounded-lg hover:bg-white transition-all">
                سؤال وجواب
              </Link>
              {user && (
                <>
                  <Link to="/notifications" className="relative text-sm text-gray-600 hover:text-blue-600 px-2 py-1.5 rounded-lg hover:bg-white transition-all">
                    🔔
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </Link>
                  <Link to="/my-dashboard" className="text-sm text-gray-600 hover:text-blue-600 px-3 py-1.5 rounded-lg hover:bg-white transition-all">
                    📊 إحصائياتي
                  </Link>
                  <Link to="/leaderboard" className="text-sm text-gray-600 hover:text-blue-600 px-3 py-1.5 rounded-lg hover:bg-white transition-all">
                    🏆 الترتيب
                  </Link>
                </>
              )}
            </nav>

            {/* اختيار الفصل الدراسي */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">الفصل:</span>
              <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200 p-0.5">
                <button
                  onClick={() => setSelectedSemester('0')}
                  className={`text-xs px-2.5 py-1 rounded-md transition-all ${selectedSemester === '0' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  الكل
                </button>
                {semesters.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSemester(String(s.id))}
                    className={`text-xs px-2.5 py-1 rounded-md transition-all ${selectedSemester === String(s.id) ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* القائمة على الجوال */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white">
          <div className="px-4 py-3">
            {/* البحث */}
            <form onSubmit={handleSearch} className="mb-4">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
                <button type="submit" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              </div>
            </form>

            {/* اختيار الفصل */}
            <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-100">
              <span className="text-xs text-gray-400">الفصل:</span>
              <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-0.5">
                <button
                  onClick={() => setSelectedSemester('0')}
                  className={`text-xs px-3 py-1.5 rounded-md transition-all ${selectedSemester === '0' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}
                >
                  الكل
                </button>
                {semesters.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSemester(String(s.id))}
                    className={`text-xs px-3 py-1.5 rounded-md transition-all ${selectedSemester === String(s.id) ? 'bg-blue-600 text-white' : 'text-gray-600'}`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>

            {/* الروابط */}
            <div className="space-y-1">
              <Link to="/" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">
                الرئيسية
              </Link>
              {navigation.stages?.map(stage => (
                <div key={stage.id}>
                  <Link
                    to={`/${stage.public_slug || stage.slug}`}
                    onClick={() => setMobileOpen(false)}
                    className="block px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg"
                  >
                    {stage.icon && <span className="ml-2">{stage.icon}</span>}
                    {stage.name}
                  </Link>
                  <div className="pr-6 space-y-0.5">
                    {stage.grades?.map(grade => (
                      <Link
                        key={grade.id}
                        to={`/${stage.public_slug || stage.slug}/${grade.public_slug || grade.slug}`}
                        onClick={() => setMobileOpen(false)}
                        className="block px-3 py-1.5 text-xs text-gray-500 hover:text-blue-600 hover:bg-gray-50 rounded-lg"
                      >
                        {grade.name}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
              <Link to="/اختبارات" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">
                اختبارات
              </Link>
              {user && (
                <Link to="/exercises" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">
                  تمارين & تحديات
                </Link>
              )}
              <Link to="/faq" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">
                سؤال وجواب
              </Link>
              {user && (
                <>
                  <Link to="/notifications" onClick={() => setMobileOpen(false)} className="flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">
                    <span>🔔 الإشعارات</span>
                    {unreadCount > 0 && (
                      <span className="w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </Link>
                  <Link to="/my-dashboard" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">
                    📊 إحصائياتي
                  </Link>
                  <Link to="/leaderboard" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">
                    🏆 الترتيب
                  </Link>
                </>
              )}
            </div>

            {/* أزرار المستخدم */}
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
              {user ? (
                <>
                  <span className="block text-sm text-gray-700 font-medium px-3">{user.name}</span>
                  <Link to="/favorites" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg">
                    المفضلة
                  </Link>
                  <button onClick={() => { logout(); setMobileOpen(false); }} className="block w-full text-right px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg">
                    تسجيل الخروج
                  </button>
                </>
              ) : (
                <div className="flex gap-2">
                  <Link to="/auth/login" onClick={() => setMobileOpen(false)} className="flex-1 text-center text-sm text-gray-600 border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50">
                    دخول
                  </Link>
                  <Link to="/auth/register" onClick={() => setMobileOpen(false)} className="flex-1 text-center text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                    حساب جديد
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
