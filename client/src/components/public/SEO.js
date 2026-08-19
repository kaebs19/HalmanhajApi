import { useEffect } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { useLocation } from 'react-router-dom';

const SITE_URL = 'https://www.halmanhaj.com';

/**
 * وسوم السيو تُحدَّث مباشرة في <head> بدل مكتبة خارجية.
 * السبب: react-helmet-async لا يعمل مع React 19 (يفشل بصمت)، فكانت كل الصفحات
 * ترث عنوان ووصف وcanonical الصفحة الرئيسية من index.html فتُعدّ مكرّرة.
 * التحديث هنا يستبدل الوسم الموجود بدل إضافة نسخة ثانية منه.
 */
function upsertMeta(attr, key, content) {
  const selector = `meta[${attr}="${key}"]`;
  let el = document.head.querySelector(selector);
  if (!content) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!href) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

// مخططات البيانات المنظمة الخاصة بالصفحة — تُمسح وتُعاد كتابتها مع كل صفحة
function replaceJsonLd(schemas) {
  document.head
    .querySelectorAll('script[type="application/ld+json"][data-seo]')
    .forEach((node) => node.remove());

  schemas.filter(Boolean).forEach((schema) => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-seo', '');
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
  });
}

export default function SEO({ title, description, keywords, noIndex = false, structuredData, image, breadcrumbs }) {
  const { settings } = useSettings();
  const location = useLocation();

  const siteName = settings.site_name || 'حل مدرستي';
  const fullTitle = title ? `${title} | ${siteName}` : (settings.seo_title || siteName);
  const metaDescription = description || settings.seo_description
    || 'موقع حل مدرستي يقدم حلول الكتب والملخصات والاختبارات لجميع المراحل الدراسية في المملكة العربية السعودية';
  const metaKeywords = keywords || settings.seo_keywords || '';
  const canonicalUrl = `${SITE_URL}${location.pathname}`;
  const ogImage = image ? `${SITE_URL}${image}` : (settings.logo_url ? `${SITE_URL}${settings.logo_url}` : '');

  const breadcrumbsKey = breadcrumbs ? JSON.stringify(breadcrumbs) : '';
  const structuredDataKey = structuredData ? JSON.stringify(structuredData) : '';

  useEffect(() => {
    document.title = fullTitle;

    upsertMeta('name', 'description', metaDescription);
    upsertMeta('name', 'keywords', metaKeywords);
    upsertMeta('name', 'robots', noIndex ? 'noindex, nofollow' : 'index, follow');
    upsertLink('canonical', canonicalUrl);

    upsertMeta('property', 'og:title', fullTitle);
    upsertMeta('property', 'og:description', metaDescription);
    upsertMeta('property', 'og:url', canonicalUrl);
    upsertMeta('property', 'og:site_name', siteName);
    upsertMeta('property', 'og:image', ogImage);

    upsertMeta('name', 'twitter:title', fullTitle);
    upsertMeta('name', 'twitter:description', metaDescription);
    upsertMeta('name', 'twitter:image', ogImage);

    const breadcrumbLD = breadcrumbs?.length ? {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbs.map((b, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: b.name,
        item: b.url ? `${SITE_URL}${b.url}` : undefined,
      })),
    } : null;

    replaceJsonLd([structuredData, breadcrumbLD]);

    return () => replaceJsonLd([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullTitle, metaDescription, metaKeywords, canonicalUrl, siteName, ogImage, noIndex, breadcrumbsKey, structuredDataKey]);

  return null;
}
