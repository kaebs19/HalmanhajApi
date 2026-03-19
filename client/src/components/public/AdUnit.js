import { useEffect, useRef } from 'react';
import { useAds } from '../../context/AdsContext';

let adsenseScriptLoaded = false;
let adsenseScriptReady = false;
let adsenseCallbacks = [];

function loadAdsenseScript(publisherId, callback) {
  if (adsenseScriptReady) { callback(); return; }
  adsenseCallbacks.push(callback);
  if (adsenseScriptLoaded) return;
  adsenseScriptLoaded = true;

  // تأخير تحميل السكربت حتى بعد تحميل الصفحة بالكامل
  const load = () => {
    const script = document.createElement('script');
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisherId}`;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      adsenseScriptReady = true;
      adsenseCallbacks.forEach(cb => cb());
      adsenseCallbacks = [];
    };
    document.head.appendChild(script);
  };

  // تحميل بعد 3 ثوان أو بعد تفاعل المستخدم (أيهما أسرع)
  let loaded = false;
  const doLoad = () => { if (!loaded) { loaded = true; load(); } };
  setTimeout(doLoad, 3000);
  ['scroll', 'touchstart', 'mousemove', 'click'].forEach(e =>
    window.addEventListener(e, doLoad, { once: true, passive: true })
  );
}

export default function AdUnit({ position, className = '' }) {
  const { enabled, publisherId, getSlot } = useAds();
  const adRef = useRef(null);
  const pushed = useRef(false);

  const slot = getSlot(position);

  useEffect(() => {
    if (!enabled || !publisherId || !slot) return;
    if (slot.custom_code) return;
    if (!slot.slot_id) return;

    loadAdsenseScript(publisherId, () => {
      if (pushed.current) return;
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        pushed.current = true;
      } catch (e) {}
    });
  }, [enabled, publisherId, slot]);

  if (!enabled || !publisherId || !slot) return null;

  if (slot.custom_code) {
    return (
      <div
        className={`ad-unit ${className}`}
        dangerouslySetInnerHTML={{ __html: slot.custom_code }}
      />
    );
  }

  if (!slot.slot_id) return null;

  return (
    <div className={`ad-unit ${className}`}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={publisherId}
        data-ad-slot={slot.slot_id}
        data-ad-format={slot.format || 'auto'}
        data-full-width-responsive="true"
      />
    </div>
  );
}
