import { createContext, useContext, useState, useEffect } from 'react';
import { API_BASE, SERVER_URL } from '../lib/api';

const SettingsContext = createContext();

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState({
    site_name: 'حل المنهج',
    logo_url: null,
    favicon_url: null,
    seo_title: '',
    seo_description: '',
    seo_keywords: '',
    primary_color: '#2563eb',
    footer_text: '',
    social_links: { twitter: '', youtube: '', telegram: '', whatsapp: '' },
    contact_email: ''
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/settings`)
      .then(res => res.json())
      .then(data => {
        if (data.social_links && typeof data.social_links === 'string') {
          try { data.social_links = JSON.parse(data.social_links); } catch {}
        }
        setSettings(prev => ({ ...prev, ...data }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const logoUrl = settings.logo_url
    ? (settings.logo_url.startsWith('http') ? settings.logo_url : `${SERVER_URL}${settings.logo_url}`)
    : null;

  return (
    <SettingsContext.Provider value={{ settings, logoUrl, loading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within SettingsProvider');
  return context;
}
