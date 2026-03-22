import { useState, useEffect, useRef } from 'react';
import { useAds } from '../../context/AdsContext';

let adsenseScriptLoaded = false;

/**
 * إعلان ملء الشاشة (Interstitial)
 * يظهر عند فتح صفحة معينة (مثل فتح كتاب) مع عد تنازلي ثم زر إغلاق
 *
 * Props:
 *   position - مفتاح موضع الإعلان (مثل 'file_interstitial')
 *   onClose  - callback عند الإغلاق
 *   delay    - عدد ثوان العد التنازلي (افتراضي 5)
 */
export default function AdInterstitial({ position = 'file_interstitial', onClose, delay = 5 }) {
  const { enabled, publisherId, getSlot } = useAds();
  const slot = getSlot(position);
  const [countdown, setCountdown] = useState(delay);
  const [canClose, setCanClose] = useState(false);
  const adRef = useRef(null);
  const pushed = useRef(false);

  // عد تنازلي
  useEffect(() => {
    if (countdown <= 0) {
      setCanClose(true);
      return;
    }
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // تحميل الإعلان
  useEffect(() => {
    if (!enabled || !publisherId || !slot) return;
    if (slot.custom_code) return;
    if (!slot.slot_id) return;

    const load = () => {
      if (pushed.current) return;
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        pushed.current = true;
      } catch (e) {}
    };

    if (window.adsbygoogle) {
      load();
    } else {
      if (!adsenseScriptLoaded) {
        adsenseScriptLoaded = true;
        const script = document.createElement('script');
        script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisherId}`;
        script.async = true;
        script.crossOrigin = 'anonymous';
        script.onload = load;
        document.head.appendChild(script);
      }
    }
  }, [enabled, publisherId, slot]);

  // منع السكرول أثناء عرض الإعلان
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // إذا الإعلانات مطفأة أو لا يوجد slot، أغلق فوراً
  if (!enabled || !slot) {
    onClose?.();
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center" dir="rtl">
      {/* خلفية */}
      <div className="absolute inset-0" onClick={canClose ? onClose : undefined} />

      {/* محتوى الإعلان */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-[95%] mx-auto overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
          <span className="text-xs text-gray-400">إعلان</span>
          {canClose ? (
            <button
              onClick={onClose}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              إغلاق
            </button>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-6 h-6 flex items-center justify-center bg-blue-100 text-blue-600 font-bold rounded-full text-xs">
                {countdown}
              </span>
              ثانية
            </span>
          )}
        </div>

        {/* منطقة الإعلان */}
        <div className="p-4 min-h-[400px] flex items-center justify-center">
          {slot.custom_code ? (
            <div dangerouslySetInnerHTML={{ __html: slot.custom_code }} />
          ) : slot.slot_id ? (
            <ins
              ref={adRef}
              className="adsbygoogle"
              style={{ display: 'block', width: '100%', minHeight: '400px' }}
              data-ad-client={publisherId}
              data-ad-slot={slot.slot_id}
              data-ad-format="auto"
              data-full-width-responsive="true"
            />
          ) : (
            <p className="text-gray-300 text-sm">جاري تحميل الإعلان...</p>
          )}
        </div>
      </div>
    </div>
  );
}
