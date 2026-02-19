// مكونات Skeleton Loading
// تعرض هياكل عظمية متحركة تحاكي شكل المحتوى أثناء التحميل

export function Skeleton({ className = '', width, height, rounded = 'rounded-md' }) {
  return (
    <div
      className={`bg-gray-200 animate-pulse ${rounded} ${className}`}
      style={{ width, height }}
    />
  );
}

// بطاقة skeleton لبطاقات الدروس/الاختبارات
export function SkeletonCard({ className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 overflow-hidden ${className}`}>
      {/* صورة */}
      <div className="bg-gray-200 animate-pulse h-36 sm:h-44" />
      {/* محتوى */}
      <div className="p-3 space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-gray-200 animate-pulse" />
          <div className="h-3 bg-gray-200 animate-pulse rounded w-16" />
        </div>
        <div className="h-4 bg-gray-200 animate-pulse rounded w-full" />
        <div className="h-3 bg-gray-200 animate-pulse rounded w-2/3" />
        <div className="flex items-center gap-3 pt-1">
          <div className="h-3 bg-gray-200 animate-pulse rounded w-12" />
          <div className="h-3 bg-gray-200 animate-pulse rounded w-12" />
        </div>
      </div>
    </div>
  );
}

// بطاقة skeleton للمراحل الدراسية
export function SkeletonStageCard() {
  return (
    <div className="rounded-2xl bg-gray-200 animate-pulse p-5 sm:p-6 h-[88px] sm:h-[96px]" />
  );
}

// بطاقة skeleton للصفوف/المسارات (صغيرة)
export function SkeletonGradeCard() {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3 sm:p-4 flex flex-col items-center gap-2">
      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gray-200 animate-pulse" />
      <div className="h-3 bg-gray-200 animate-pulse rounded w-14" />
      <div className="h-2.5 bg-gray-200 animate-pulse rounded w-8" />
    </div>
  );
}

// skeleton لبطاقة اختبار
export function SkeletonQuizCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-gray-200 animate-pulse shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 animate-pulse rounded w-3/4" />
          <div className="flex gap-1.5">
            <div className="h-5 bg-gray-200 animate-pulse rounded-full w-14" />
            <div className="h-5 bg-gray-200 animate-pulse rounded-full w-16" />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-50">
        <div className="flex gap-3">
          <div className="h-3 bg-gray-200 animate-pulse rounded w-14" />
          <div className="h-3 bg-gray-200 animate-pulse rounded w-14" />
        </div>
        <div className="h-7 bg-gray-200 animate-pulse rounded-full w-12" />
      </div>
    </div>
  );
}

// أسطر نص وهمية
export function SkeletonText({ lines = 3, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3.5 bg-gray-200 animate-pulse rounded"
          style={{ width: i === lines - 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  );
}

// skeleton لهيدر الدرس (FilePage)
export function SkeletonFileHeader() {
  return (
    <div className="space-y-4">
      {/* breadcrumbs */}
      <div className="flex gap-2">
        <div className="h-3 bg-gray-200 animate-pulse rounded w-16" />
        <div className="h-3 bg-gray-200 animate-pulse rounded w-12" />
        <div className="h-3 bg-gray-200 animate-pulse rounded w-20" />
      </div>
      {/* header */}
      <div className="flex items-start gap-3">
        <div className="w-14 h-[72px] sm:w-16 sm:h-20 rounded-lg bg-gray-200 animate-pulse shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-5 bg-gray-200 animate-pulse rounded w-3/4" />
          <div className="h-3 bg-gray-200 animate-pulse rounded w-1/2" />
          <div className="flex gap-2 mt-2">
            <div className="h-6 bg-gray-200 animate-pulse rounded-full w-16" />
            <div className="h-6 bg-gray-200 animate-pulse rounded-full w-20" />
          </div>
        </div>
      </div>
      {/* viewer placeholder */}
      <div className="bg-gray-200 animate-pulse rounded-xl h-[60vh]" />
    </div>
  );
}

// skeleton لقائمة الدروس في صفحة المادة
export function SkeletonLessonList({ count = 6 }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
