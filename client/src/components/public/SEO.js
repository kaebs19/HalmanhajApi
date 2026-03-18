import { Helmet } from 'react-helmet-async';
import { useSettings } from '../../context/SettingsContext';
import { useLocation } from 'react-router-dom';

export default function SEO({ title, description, keywords, noIndex = false, structuredData, image, breadcrumbs }) {
  const { settings } = useSettings();
  const location = useLocation();
  const siteName = settings.site_name || 'حل المنهج';
  const siteUrl = 'https://www.halmanhaj.com';

  const fullTitle = title ? `${title} | ${siteName}` : (settings.seo_title || siteName);
  const metaDescription = description || settings.seo_description || 'موقع حل المنهج يقدم حلول الكتب والملخصات والاختبارات لجميع المراحل الدراسية في المملكة العربية السعودية';
  const metaKeywords = keywords || settings.seo_keywords || '';
  const canonicalUrl = `${siteUrl}${location.pathname}`;
  const ogImage = image ? `${siteUrl}${image}` : (settings.logo_url ? `${siteUrl}${settings.logo_url}` : '');

  // Breadcrumb structured data
  const breadcrumbLD = breadcrumbs?.length ? {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': breadcrumbs.map((b, i) => ({
      '@type': 'ListItem',
      'position': i + 1,
      'name': b.name,
      'item': b.url ? `${siteUrl}${b.url}` : undefined
    }))
  } : null;

  // Educational website structured data
  const websiteLD = !title ? {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    'name': siteName,
    'url': siteUrl,
    'description': metaDescription,
    'inLanguage': 'ar',
    'potentialAction': {
      '@type': 'SearchAction',
      'target': `${siteUrl}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string'
    }
  } : null;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={metaDescription} />
      {metaKeywords && <meta name="keywords" content={metaKeywords} />}
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:locale" content="ar_SA" />
      {ogImage && <meta property="og:image" content={ogImage} />}

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={metaDescription} />
      {ogImage && <meta name="twitter:image" content={ogImage} />}

      {noIndex && <meta name="robots" content="noindex,nofollow" />}
      <html lang="ar" dir="rtl" />

      {/* Structured Data */}
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}
      {breadcrumbLD && (
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbLD)}
        </script>
      )}
      {websiteLD && (
        <script type="application/ld+json">
          {JSON.stringify(websiteLD)}
        </script>
      )}
    </Helmet>
  );
}
