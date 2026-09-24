import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../lib/api';

const AdsContext = createContext();

export function AdsProvider({ children }) {
  // السيرفر يضمّن الإعدادات في الصفحة (window.__ADS__) لتُحجز أماكن الإعلانات من أول رسم
  const [adsData, setAdsData] = useState(() => {
    const inline = typeof window !== 'undefined' ? window.__ADS__ : null;
    return {
      enabled: inline?.enabled || false,
      publisherId: inline?.publisher_id || '',
      slots: inline?.slots || []
    };
  });

  useEffect(() => {
    if (window.__ADS__) return;
    fetch(`${API_BASE}/ads/public`)
      .then(res => res.json())
      .then(data => {
        setAdsData({
          enabled: data.enabled || false,
          publisherId: data.publisher_id || '',
          slots: data.slots || []
        });
      })
      .catch(() => {});
  }, []);

  const getSlot = useCallback((position) => {
    if (!adsData.enabled) return null;
    return adsData.slots.find(s => s.position === position) || null;
  }, [adsData]);

  return (
    <AdsContext.Provider value={{ ...adsData, getSlot }}>
      {children}
    </AdsContext.Provider>
  );
}

export function useAds() {
  const context = useContext(AdsContext);
  if (!context) throw new Error('useAds must be used within AdsProvider');
  return context;
}
