import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE, SERVER_URL } from '../../lib/api';
import { useSettings } from '../../context/SettingsContext';
import SEO from '../../components/public/SEO';

function LessonCard({ lesson }) {
  return (
    <Link
      to={`/files/${lesson.slug}`}
      className="group bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md hover:border-blue-100 transition-all"
    >
      {lesson.thumbnail_url ? (
        <img src={`${SERVER_URL}${lesson.thumbnail_url}`} alt={lesson.title} className="w-full h-40 object-cover" />
      ) : (
        <div className="w-full h-40 bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
          <svg className="w-12 h-12 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
      )}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md font-medium">{lesson.type}</span>
          <span className="text-xs text-gray-400">{lesson.subject_name}</span>
        </div>
        <h3 className="text-sm font-bold text-gray-800 group-hover:text-blue-600 transition-colors line-clamp-2 leading-relaxed">
          {lesson.title}
        </h3>
        <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            {lesson.views || 0}
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {lesson.downloads || 0}
          </span>
        </div>
      </div>
    </Link>
  );
}

// ألوان متنوعة لكل مرحلة
const STAGE_THEMES = [
  { gradient: 'from-blue-500 to-blue-600', light: 'bg-blue-50', lightBorder: 'border-blue-100', heading: 'text-blue-800', badge: 'bg-blue-100 text-blue-700', cardBg: 'bg-gradient-to-br from-blue-50 to-blue-100/50', cardHover: 'hover:shadow-lg hover:shadow-blue-100/50 hover:border-blue-300 hover:-translate-y-0.5', iconBg: 'bg-blue-100 text-blue-600' },
  { gradient: 'from-emerald-500 to-emerald-600', light: 'bg-emerald-50', lightBorder: 'border-emerald-100', heading: 'text-emerald-800', badge: 'bg-emerald-100 text-emerald-700', cardBg: 'bg-gradient-to-br from-emerald-50 to-emerald-100/50', cardHover: 'hover:shadow-lg hover:shadow-emerald-100/50 hover:border-emerald-300 hover:-translate-y-0.5', iconBg: 'bg-emerald-100 text-emerald-600' },
  { gradient: 'from-purple-500 to-purple-600', light: 'bg-purple-50', lightBorder: 'border-purple-100', heading: 'text-purple-800', badge: 'bg-purple-100 text-purple-700', cardBg: 'bg-gradient-to-br from-purple-50 to-purple-100/50', cardHover: 'hover:shadow-lg hover:shadow-purple-100/50 hover:border-purple-300 hover:-translate-y-0.5', iconBg: 'bg-purple-100 text-purple-600' },
  { gradient: 'from-amber-500 to-amber-600', light: 'bg-amber-50', lightBorder: 'border-amber-100', heading: 'text-amber-800', badge: 'bg-amber-100 text-amber-700', cardBg: 'bg-gradient-to-br from-amber-50 to-amber-100/50', cardHover: 'hover:shadow-lg hover:shadow-amber-100/50 hover:border-amber-300 hover:-translate-y-0.5', iconBg: 'bg-amber-100 text-amber-600' },
];

// أرقام عربية للصفوف بدون أيقونة
const GRADE_NUMBERS = ['١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩', '١٠', '١١', '١٢'];

function StageSection({ stage, index }) {
  const stageSlug = stage.public_slug || stage.slug;
  const theme = STAGE_THEMES[index % STAGE_THEMES.length];
  const hasGrades = stage.grades?.length > 0;
  const hasTracks = stage.tracks?.length > 0;
  const items = hasGrades ? stage.grades : (hasTracks ? stage.tracks : []);

  return (
    <div className="pb-10 mb-6 border-b border-gray-100 last:border-b-0 last:mb-0 last:pb-0">
      {/* عنوان المرحلة البارز */}
      <Link
        to={`/${stageSlug}`}
        className="group flex items-center gap-3 mb-6"
      >
        <span className="text-3xl md:text-4xl">{stage.icon || '📚'}</span>
        <div>
          <h3 className={`text-xl md:text-2xl font-bold ${theme.heading} group-hover:underline underline-offset-4 transition-all`}>
            {stage.name}
          </h3>
          <p className="text-gray-400 text-xs mt-0.5">
            {hasGrades ? `${stage.grades.length} صف دراسي` : hasTracks ? `${stage.tracks.length} مسار` : ''}
          </p>
        </div>
        <svg className="w-5 h-5 text-gray-300 group-hover:text-gray-500 group-hover:-translate-x-1 transition-all rotate-180 mr-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </Link>

      {/* الصفوف أو المسارات كبطاقات احترافية */}
      {items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {items.map((item, itemIndex) => {
            const hasIcon = item.icon && !item.icon.startsWith('/');
            const displayIcon = hasIcon ? item.icon : GRADE_NUMBERS[itemIndex] || '📖';

            return (
              <Link
                key={item.id}
                to={`/${stageSlug}/${item.slug}`}
                className={`group/card relative ${theme.cardBg} rounded-2xl border ${theme.lightBorder} p-4 text-center transition-all duration-200 ${theme.cardHover}`}
              >
                {/* الأيقونة */}
                <div className={`w-14 h-14 mx-auto rounded-xl ${theme.iconBg} flex items-center justify-center mb-3 group-hover/card:scale-110 transition-transform`}>
                  <span className={hasIcon ? 'text-2xl' : 'text-xl font-bold'}>{displayIcon}</span>
                </div>

                {/* اسم الصف */}
                <h4 className="text-sm font-bold text-gray-800 leading-snug mb-1.5 line-clamp-2">
                  {item.name}
                </h4>

                {/* عدد المواد */}
                {item.subjects_count > 0 && (
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${theme.badge}`}>
                    {item.subjects_count} مادة
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  const { settings } = useSettings();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/public/home`)
      .then(res => res.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div>
      <SEO />
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl md:text-5xl font-bold mb-4 leading-tight">{settings.site_name}</h1>
          <p className="text-blue-100 text-lg md:text-xl max-w-2xl mx-auto mb-8">
            {settings.seo_description || 'حلول المناهج الدراسية لجميع المراحل الدراسية'}
          </p>

          {/* إحصائيات */}
          {data?.stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
              {[
                { label: 'ملف تعليمي', value: data.stats.lessons_count },
                { label: 'مادة دراسية', value: data.stats.subjects_count },
                { label: 'صف دراسي', value: data.stats.grades_count },
                { label: 'مشاهدة', value: data.stats.total_views },
              ].map((stat, i) => (
                <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
                  <p className="text-2xl font-bold">{Number(stat.value).toLocaleString('ar-SA')}</p>
                  <p className="text-blue-200 text-xs">{stat.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* المراحل الدراسية مع الصفوف */}
      {data?.stages?.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-gray-800">المراحل الدراسية</h2>
            <p className="text-sm text-gray-400">اختر المرحلة ثم الصف الدراسي</p>
          </div>
          <div className="space-y-2">
            {data.stages.map((stage, i) => (
              <StageSection key={stage.id} stage={stage} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* الدروس المميزة */}
      {data?.featured?.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-800">محتوى مميز</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {data.featured.map(lesson => (
              <LessonCard key={lesson.id} lesson={lesson} />
            ))}
          </div>
        </section>
      )}

      {/* أحدث الدروس */}
      {data?.latest?.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-800">أحدث المحتوى</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {data.latest.map(lesson => (
              <LessonCard key={lesson.id} lesson={lesson} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
