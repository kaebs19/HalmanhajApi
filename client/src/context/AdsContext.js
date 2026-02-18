import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../lib/api';

const AdsContext = createContext();

export function AdsProvider({ children }) {
  const [adsData, setAdsData] = useState({
    enabled: false,
    publisherId: '',
    slots: []
  });

  useEffect(() => {
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
