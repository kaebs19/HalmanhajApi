import { useState, useEffect, useCallback } from 'react';
import api, { SERVER_URL } from '../lib/api';

/**
 * مكتبة الصور المرفوعة سابقاً — لاختيار أيقونة جاهزة بدل رفعها من جديد
 * resource: subjects | stages | tracks
 */
export default function UploadedIconsPicker({
  resource = 'subjects',
  selectedUrl = '',
  onSelect,
  refreshKey = 0,
  compact = false,
}) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchImages = useCallback(async () => {
    try {
      const res = await api.get(`/${resource}/icon-library`);
      setImages(res.data);
      setError('');
    } catch {
      setError('تعذر جلب الأيقونات المرفوعة');
    } finally {
      setLoading(false);
    }
  }, [resource]);

  useEffect(() => {
    fetchImages();
  }, [fetchImages, refreshKey]);

  const handleDelete = async (e, url) => {
    e.stopPropagation();
    if (!window.confirm('حذف هذه الصورة من المكتبة نهائياً؟')) return;
    try {
      await api.delete(`/${resource}/icon-library`, { data: { url } });
      if (selectedUrl === url) onSelect('');
      fetchImages();
    } catch (err) {
      setError(err.response?.data?.message || 'تعذر حذف الصورة');
    }
  };

  const boxSize = compact ? 'w-12 h-12' : 'w-16 h-16';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">
          الأيقونات المرفوعة سابقاً
          {images.length > 0 && <span className="mr-1">({images.length})</span>}
        </p>
        <button
          type="button"
          onClick={fetchImages}
          className="text-xs text-blue-500 hover:text-blue-700"
        >
          تحديث
        </button>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {loading ? (
        <p className="text-xs text-gray-400 py-2">جارٍ التحميل...</p>
      ) : images.length === 0 ? (
        <p className="text-xs text-gray-400 py-2">لا توجد صور مرفوعة بعد — ارفع صورة وستظهر هنا للاستخدام لاحقاً</p>
      ) : (
        <div className={`flex flex-wrap gap-2 ${compact ? 'max-h-36' : 'max-h-48'} overflow-y-auto p-1`}>
          {images.map((img) => (
            <button
              key={img.url}
              type="button"
              onClick={() => onSelect(img.url)}
              title={img.in_use ? 'مستخدمة في مادة حالية' : 'غير مستخدمة'}
              className={`group relative ${boxSize} rounded-lg overflow-hidden transition-all ${
                selectedUrl === img.url
                  ? 'border-2 border-blue-500 ring-2 ring-blue-100'
                  : 'border border-gray-200 hover:border-gray-300 hover:scale-105'
              }`}
            >
              <img
                src={`${SERVER_URL}${img.url}`}
                alt="أيقونة مرفوعة"
                loading="lazy"
                className="w-full h-full object-cover"
              />
              {!img.in_use && (
                <span
                  role="button"
                  tabIndex={-1}
                  onClick={(e) => handleDelete(e, img.url)}
                  title="حذف من المكتبة"
                  className="absolute top-0 left-0 bg-red-500 text-white w-4 h-4 flex items-center justify-center text-[10px] leading-none opacity-0 group-hover:opacity-100 transition-opacity rounded-br-lg"
                >
                  x
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
