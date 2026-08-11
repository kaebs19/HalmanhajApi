import { useState, useEffect } from 'react';
import { SERVER_URL } from '../../lib/api';

/**
 * صورة مرحلة/صف/مسار/مادة مع بديل آمن.
 * لو كان الملف مفقوداً على السيرفر (رابط قديم أو رفع فاشل) تظهر الأيقونة
 * بدل أيقونة الصورة المكسورة.
 */
export default function EntityImage({
  src,
  alt,
  icon,
  fallbackIcon = '📘',
  className = '',
  fallbackClassName = '',
  ...imgProps
}) {
  const [failed, setFailed] = useState(false);

  // إعادة المحاولة عند تغيّر الرابط (تنقّل بين الصفحات يعيد استخدام نفس المكوّن)
  useEffect(() => { setFailed(false); }, [src]);

  const showImage = src && !failed;

  if (showImage) {
    return (
      <img
        src={src.startsWith('http') ? src : `${SERVER_URL}${src}`}
        alt={alt}
        onError={() => setFailed(true)}
        className={className}
        loading="lazy"
        decoding="async"
        {...imgProps}
      />
    );
  }

  return (
    <div className={fallbackClassName || className} aria-hidden={!alt}>
      <span>{icon || fallbackIcon}</span>
    </div>
  );
}
