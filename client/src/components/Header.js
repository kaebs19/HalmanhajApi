import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';

const PAGE_TITLES = {
  '/admin/dashboard': 'لوحة التحكم',
  '/admin/stages': 'المراحل الدراسية',
  '/admin/tracks': 'المسارات الدراسية',
  '/admin/grades': 'الصفوف الدراسية',
  '/admin/subjects': 'المواد الدراسية',
  '/admin/lessons': 'الدروس والمحتوى',
  '/admin/semesters': 'الفصول الدراسية',
  '/admin/pdf-tools': 'أدوات PDF',
  '/admin/quizzes': 'إدارة الاختبارات',
  '/admin/faqs': 'سؤال وجواب',
  '/admin/settings': 'الإعدادات',
  '/admin/learning-paths': 'مسارات التعلم',
};

export default function Header() {
  const { admin, logout } = useAuth();
  const location = useLocation();

  const pathParts = location.pathname.split('/').filter(Boolean);
  const currentPath = pathParts.length >= 2 ? `/${pathParts[0]}/${pathParts[1]}` : `/${pathParts[0] || ''}`;
  const pageTitle = PAGE_TITLES[currentPath] || 'لوحة التحكم';

  const today = new Date().toLocaleDateString('ar-SA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-3.5 flex items-center justify-between sticky top-0 z-30">
      <div>
        <h2 className="text-lg font-bold text-gray-800">{pageTitle}</h2>
        <p className="text-xs text-gray-400">{today}</p>
      </div>

      <div className="flex items-center gap-4">
        {/* فاصل */}
        <div className="h-8 w-px bg-gray-200 hidden md:block"></div>

        {/* معلومات المستخدم */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-sm shadow-sm">
            {(admin?.display_name || admin?.username || 'A').charAt(0)}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-gray-700 leading-tight">
              {admin?.display_name || admin?.username}
            </p>
            <p className="text-xs text-gray-400">مدير</p>
          </div>
        </div>

        <button
          onClick={logout}
          className="flex items-center gap-1.5 bg-gray-50 hover:bg-red-50 text-gray-500 hover:text-red-600 px-3 py-2 rounded-xl text-sm transition-colors border border-gray-100 hover:border-red-200"
          title="تسجيل الخروج"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className="hidden sm:inline">خروج</span>
        </button>
      </div>
    </header>
  );
}
