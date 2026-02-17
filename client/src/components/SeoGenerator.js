import { useState } from 'react';
import api from '../lib/api';
import { Input, Textarea } from './ui';

export default function SeoGenerator({
  seoTitle, setSeoTitle,
  seoDescription, setSeoDescription,
  slug, setSlug,
  subjectId, gradeIds, trackIds, semester, type, title
}) {
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!subjectId) {
      setError('اختر المادة أولاً');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await api.post('/tools/seo/generate', {
        subject_id: subjectId,
        grade_ids: gradeIds,
        track_ids: trackIds,
        semester,
        type,
        title
      });
      setSeoTitle(res.data.seoTitle);
      setSeoDescription(res.data.seoDescription);
      setSlug(res.data.slug);
      setExpanded(true);
    } catch (err) {
      setError(err.response?.data?.message || 'خطأ في توليد بيانات SEO');
    } finally {
      setLoading(false);
    }
  };

  const descLength = seoDescription?.length || 0;
  const titleLength = seoTitle?.length || 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 bg-gradient-to-l from-gray-50 to-emerald-50 border-b border-gray-100 flex items-center justify-between hover:from-gray-100 hover:to-emerald-100 transition-colors"
      >
        <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
          🔍 تحسين محركات البحث (SEO)
        </h4>
        <div className="flex items-center gap-2">
          {seoTitle && (
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
              مكتمل
            </span>
          )}
          <span className={`text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </div>
      </button>

      {expanded && (
        <div className="p-4 space-y-4">
          {error && (
            <p className="text-red-500 text-xs bg-red-50 p-2 rounded-lg">{error}</p>
          )}

          {/* زر التوليد التلقائي */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading || !subjectId}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-l from-emerald-500 to-teal-600 text-white rounded-lg text-sm font-medium hover:from-emerald-600 hover:to-teal-700 transition-all disabled:opacity-50 shadow-sm"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                جاري التوليد...
              </>
            ) : (
              <>
                <span>✨</span>
                توليد SEO تلقائي
              </>
            )}
          </button>

          {/* عنوان SEO */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-gray-600">عنوان SEO</label>
              <span className={`text-xs ${titleLength > 60 ? 'text-amber-600' : 'text-gray-400'}`}>
                {titleLength}/60
              </span>
            </div>
            <Input
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
              placeholder="العنوان الذي يظهر في Google"
              className="text-sm"
            />
            {seoTitle && (
              <div className="mt-2 p-3 bg-gray-50 rounded-lg border">
                <p className="text-blue-700 text-sm font-medium hover:underline cursor-pointer truncate">
                  {seoTitle}
                </p>
                <p className="text-xs text-emerald-700 mt-0.5 truncate">
                  halmanhaj.com/{slug || '...'}
                </p>
                {seoDescription && (
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{seoDescription}</p>
                )}
              </div>
            )}
          </div>

          {/* Slug */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-gray-600">رابط الصفحة (Slug)</label>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 whitespace-nowrap bg-gray-50 px-2 py-2 rounded-r-lg border border-l-0">
                halmanhaj.com/
              </span>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="رابط-الصفحة"
                className="text-sm flex-1 rounded-r-none"
                dir="ltr"
              />
            </div>
          </div>

          {/* وصف SEO */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-gray-600">وصف SEO</label>
              <span className={`text-xs ${descLength > 155 ? 'text-red-600' : descLength > 120 ? 'text-amber-600' : 'text-gray-400'}`}>
                {descLength}/155
              </span>
            </div>
            <Textarea
              value={seoDescription}
              onChange={(e) => setSeoDescription(e.target.value)}
              placeholder="الوصف الذي يظهر تحت العنوان في Google (155 حرف)"
              rows={2}
              className="text-sm"
            />
            {/* Progress bar */}
            <div className="mt-1.5 h-1 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all rounded-full ${
                  descLength > 155 ? 'bg-red-500' : descLength > 120 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min((descLength / 155) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
