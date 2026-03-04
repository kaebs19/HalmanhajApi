import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE, SERVER_URL } from '../../lib/api';
import { useSettings } from '../../context/SettingsContext';

import SEO from '../../components/public/SEO';
import AdUnit from '../../components/public/AdUnit';
import { SkeletonStageCard, SkeletonGradeCard, SkeletonCard } from '../../components/ui/Skeleton';

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

function LessonCard({ lesson }) {
  return (
    <Link
      to={`/files/${lesson.slug}`}
      className="group bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg hover:border-blue-200 hover:-translate-y-0.5 transition-all duration-200"
    >
      <div className="relative">
        {lesson.thumbnail_url ? (
          <img src={`${SERVER_URL}${lesson.thumbnail_url}`} alt={lesson.title} className="w-full h-36 sm:h-44 object-cover" />
        ) : (
          <div className="w-full h-36 sm:h-44 bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
            <svg className="w-10 h-10 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        )}
        {/* badge نوع الملف */}
        <span className={`absolute top-2 right-2 text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-semibold shadow-sm ${TYPE_COLORS[lesson.type] || 'bg-gray-500 text-white'}`}>
          {lesson.type}
        </span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="flex items-center gap-1.5 mb-1.5">
          {lesson.subject_icon && <span className="text-sm">{lesson.subject_icon}</span>}
          <span className="text-[10px] sm:text-xs text-gray-500 font-medium truncate">{lesson.subject_name}</span>
        </div>
        <h3 className="text-xs sm:text-sm font-bold text-gray-800 group-hover:text-blue-600 transition-colors line-clamp-2 leading-relaxed">
          {lesson.title}
        </h3>
        <div className="flex items-center gap-3 mt-2.5 text-[10px] sm:text-xs text-gray-400">
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
        </div>
      </div>
    </Link>
  );
}

// ألوان المراحل الثلاث: أخضر ابتدائي، أزرق متوسط، بنفسجي ثانوي
const STAGE_COLORS = [
  {
    bg: 'bg-gradient-to-br from-emerald-500 to-green-600',
    light: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    badge: 'bg-emerald-100 text-emerald-700',
    hover: 'hover:shadow-emerald-200/50 hover:border-emerald-300',
    icon: 'text-emerald-600',
  },
  {
    bg: 'bg-gradient-to-br from-blue-500 to-blue-600',
    light: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    badge: 'bg-blue-100 text-blue-700',
    hover: 'hover:shadow-blue-200/50 hover:border-blue-300',
    icon: 'text-blue-600',
  },
  {
    bg: 'bg-gradient-to-br from-purple-500 to-violet-600',
    light: 'bg-purple-50',
    border: 'border-purple-200',
    text: 'text-purple-700',
    badge: 'bg-purple-100 text-purple-700',
    hover: 'hover:shadow-purple-200/50 hover:border-purple-300',
    icon: 'text-purple-600',
  },
  {
    bg: 'bg-gradient-to-br from-amber-500 to-orange-600',
    light: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-700',
    hover: 'hover:shadow-amber-200/50 hover:border-amber-300',
    icon: 'text-amber-600',
  },
];

const STAGE_ICONS = [
  // ابتدائي
  <svg key="1" className="w-8 h-8 sm:w-10 sm:h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
  </svg>,
  // متوسط
  <svg key="2" className="w-8 h-8 sm:w-10 sm:h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
  </svg>,
  // ثانوي
  <svg key="3" className="w-8 h-8 sm:w-10 sm:h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
  </svg>,
  // إضافي
  <svg key="4" className="w-8 h-8 sm:w-10 sm:h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
  </svg>,
];

export default function HomePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAllLatest, setShowAllLatest] = useState(false);
  const { settings } = useSettings();
  const INITIAL_LATEST = 12;

  useEffect(() => {
    fetch(`${API_BASE}/public/home`)
      .then(res => res.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // بيانات Schema.org للصفحة الرئيسية
  const siteUrl = settings.site_url || (typeof window !== 'undefined' ? window.location.origin : '');
  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: settings.site_name || 'حل المنهج',
    url: siteUrl,
    description: settings.seo_description || '',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${siteUrl}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string'
    }
  };

  if (loading) {
    return (
      <div>
        {/* skeleton المراحل */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-4 sm:pt-8 sm:pb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {[1, 2, 3].map(i => <SkeletonStageCard key={i} />)}
          </div>
        </section>

        {/* skeleton الصفوف */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 sm:gap-3">
            {Array.from({ length: 8 }).map((_, i) => <SkeletonGradeCard key={i} />)}
          </div>
        </section>

        {/* skeleton الدروس */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="h-6 bg-gray-200 animate-pulse rounded w-32 mb-5" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div>
      <SEO structuredData={websiteSchema} />

      {/* ═══════════════════════════════════════ */}
      {/* بطاقات المراحل الدراسية - مباشرة بعد الهيدر */}
      {/* ═══════════════════════════════════════ */}
      {data?.stages?.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-4 sm:pt-8 sm:pb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {data.stages.map((stage, i) => {
              const color = STAGE_COLORS[i % STAGE_COLORS.length];
              const stageSlug = stage.public_slug || stage.slug;
              const hasGrades = stage.grades?.length > 0;
              const hasTracks = stage.tracks?.length > 0;
              const itemsCount = hasGrades ? stage.grades.length : (hasTracks ? stage.tracks.length : 0);

              return (
                <Link
                  key={stage.id}
                  to={`/${stageSlug}`}
                  className={`group relative rounded-2xl overflow-hidden ${color.bg} p-5 sm:p-6 text-white shadow-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5`}
                >
                  {/* خلفية زخرفية */}
                  <div className="absolute top-0 left-0 w-full h-full opacity-10">
                    <div className="absolute -top-8 -left-8 w-32 h-32 bg-white rounded-full"></div>
                    <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white rounded-full"></div>
                  </div>

                  <div className="relative flex items-center gap-3 sm:gap-4">
                    {/* أيقونة أو صورة */}
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {stage.image_url ? (
                        <img src={`${SERVER_URL}${stage.image_url}`} alt={stage.name} className="w-full h-full object-cover" />
                      ) : stage.icon ? (
                        <span className="text-3xl sm:text-4xl">{stage.icon}</span>
                      ) : (
                        STAGE_ICONS[i % STAGE_ICONS.length]
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg sm:text-xl font-bold leading-tight">{stage.name}</h2>
                      <p className="text-white/70 text-xs sm:text-sm mt-1">
                        {itemsCount > 0 ? `${itemsCount} ${hasGrades ? 'صف دراسي' : 'مسار'}` : 'اكتشف المزيد'}
                      </p>
                    </div>

                    {/* سهم */}
                    <svg className="w-5 h-5 text-white/50 group-hover:text-white group-hover:-translate-x-1 transition-all rotate-180 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <AdUnit position="home_after_stages" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4" />

      {/* ═══════════════════════════════════════ */}
      {/* الصفوف داخل كل مرحلة */}
      {/* ═══════════════════════════════════════ */}
      {data?.stages?.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
          {data.stages.map((stage, stageIndex) => {
            const color = STAGE_COLORS[stageIndex % STAGE_COLORS.length];
            const stageSlug = stage.public_slug || stage.slug;
            const hasGrades = stage.grades?.length > 0;
            const hasTracks = stage.tracks?.length > 0;
            const items = hasGrades ? stage.grades : (hasTracks ? stage.tracks : []);

            if (items.length === 0) return null;

            return (
              <div key={stage.id} className="mb-6 last:mb-0">
                {/* عنوان المرحلة */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{stage.icon || '📚'}</span>
                  <h3 className={`text-sm sm:text-base font-bold ${color.text}`}>{stage.name}</h3>
                  <div className="flex-1 h-px bg-gray-100"></div>
                  <Link to={`/${stageSlug}`} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                    عرض الكل
                  </Link>
                </div>

                {/* الصفوف */}
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 sm:gap-3">
                  {items.map((item) => {
                    return (
                      <Link
                        key={item.id}
                        to={`/${stageSlug}/${item.slug}`}
                        className={`group text-center p-3 sm:p-4 rounded-xl border ${color.border} ${color.light} ${color.hover} hover:shadow-md transition-all duration-150`}
                      >
                        {/* أيقونة أو صورة */}
                        {item.image_url ? (
                          <img src={`${SERVER_URL}${item.image_url}`} alt={item.name} className="w-9 h-9 sm:w-10 sm:h-10 mx-auto rounded-lg object-cover mb-1.5" />
                        ) : item.icon && item.icon.startsWith('/') ? (
                          <img src={`${SERVER_URL}${item.icon}`} alt={item.name} className="w-9 h-9 sm:w-10 sm:h-10 mx-auto rounded-lg object-cover mb-1.5" />
                        ) : item.icon ? (
                          <span className="text-2xl sm:text-3xl block mb-1.5">{item.icon}</span>
                        ) : (
                          <div className={`w-9 h-9 sm:w-10 sm:h-10 mx-auto rounded-lg ${color.badge} flex items-center justify-center mb-1.5`}>
                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                            </svg>
                          </div>
                        )}

                        <h4 className="text-[11px] sm:text-xs font-bold text-gray-700 leading-tight line-clamp-2">
                          {item.name}
                        </h4>

                        {item.subjects_count > 0 && (
                          <span className="text-[9px] sm:text-[10px] text-gray-400 mt-1 block">
                            {item.subjects_count} مادة
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* اختبر نفسك - أحدث الاختبارات */}
      {/* ═══════════════════════════════════════ */}
      {data?.quizzes?.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 text-sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                </svg>
              </span>
              اختبر نفسك
            </h2>
            <Link to="/quizzes" className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 transition-colors">
              عرض الكل
              <svg className="w-4 h-4 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {data.quizzes.map(quiz => (
              <Link
                key={quiz.id}
                to={`/quizzes/${quiz.slug || quiz.id}`}
                className="group bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 hover:shadow-lg hover:border-emerald-200 hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className="flex items-start gap-3">
                  {/* أيقونة المادة */}
                  <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0 group-hover:bg-emerald-100 transition-colors">
                    {quiz.subject_icon && !quiz.subject_icon.startsWith('/') ? (
                      <span className="text-xl">{quiz.subject_icon}</span>
                    ) : (
                      <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                      </svg>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-800 text-sm sm:text-base line-clamp-2 group-hover:text-emerald-700 transition-colors">
                      {quiz.title}
                    </h3>

                    {/* المادة والصف */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {quiz.subject_name && (
                        <span className="text-[10px] sm:text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {quiz.subject_name}
                        </span>
                      )}
                      {quiz.grade_name && (
                        <span className="text-[10px] sm:text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                          {quiz.grade_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* تفاصيل أسفل البطاقة */}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-50">
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {quiz.questions_count} سؤال
                    </span>
                    {quiz.duration_minutes > 0 && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {quiz.duration_minutes} دقيقة
                      </span>
                    )}
                  </div>

                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full group-hover:bg-emerald-600 group-hover:text-white transition-all">
                    ابدأ
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* أحدث الإضافات */}
      {/* ═══════════════════════════════════════ */}
      {data?.latest?.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 text-sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              أحدث الإضافات
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {(showAllLatest ? data.latest : data.latest.slice(0, INITIAL_LATEST)).map(lesson => (
              <LessonCard key={lesson.id} lesson={lesson} />
            ))}
            {data.latest.length > INITIAL_LATEST && !showAllLatest && (
              <div className="col-span-full flex justify-center mt-4">
                <button
                  onClick={() => setShowAllLatest(true)}
                  className="px-6 py-2.5 bg-blue-50 text-blue-600 rounded-xl font-medium text-sm hover:bg-blue-100 transition-colors border border-blue-200"
                >
                  عرض مزيد ({data.latest.length - INITIAL_LATEST} إضافة)
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      <AdUnit position="home_between_sections" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4" />

      {/* ═══════════════════════════════════════ */}
      {/* محتوى مميز */}
      {/* ═══════════════════════════════════════ */}
      {data?.featured?.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 sm:pb-10">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600 text-sm">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </span>
              محتوى مميز
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {data.featured.map(lesson => (
              <LessonCard key={lesson.id} lesson={lesson} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
