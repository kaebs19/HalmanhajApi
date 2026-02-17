import { Helmet } from 'react-helmet-async';
import { useSettings } from '../../context/SettingsContext';

export default function SEO({ title, description, keywords, noIndex = false }) {
  const { settings } = useSettings();
  const siteName = settings.site_name || 'حل المنهج';

  const fullTitle = title ? `${title} | ${siteName}` : (settings.seo_title || siteName);
  const metaDescription = description || settings.seo_description || '';
  const metaKeywords = keywords || settings.seo_keywords || '';

  return (
    <Helmet>
      <title>{fullTitle}</title>
      {metaDescription && <meta name="description" content={metaDescription} />}
      {metaKeywords && <meta name="keywords" content={metaKeywords} />}
      <meta property="og:title" content={fullTitle} />
      {metaDescription && <meta property="og:description" content={metaDescription} />}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={siteName} />
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={fullTitle} />
      {metaDescription && <meta name="twitter:description" content={metaDescription} />}
      {noIndex && <meta name="robots" content="noindex,nofollow" />}
      <html lang="ar" dir="rtl" />
    </Helmet>
  );
}
