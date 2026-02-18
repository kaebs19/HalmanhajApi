import { useEffect, useRef } from 'react';
import { useAds } from '../../context/AdsContext';

let adsenseScriptLoaded = false;

function loadAdsenseScript(publisherId) {
  if (adsenseScriptLoaded) return;
  adsenseScriptLoaded = true;
  const script = document.createElement('script');
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisherId}`;
  script.async = true;
  script.crossOrigin = 'anonymous';
  document.head.appendChild(script);
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

    loadAdsenseScript(publisherId);

    const timer = setTimeout(() => {
      if (pushed.current) return;
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        pushed.current = true;
      } catch (e) {}
    }, 100);

    return () => clearTimeout(timer);
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
