import { useEffect } from 'react';
import { Link } from 'react-router-dom';

const SITE_URL = 'https://www.halmanhaj.com';

// new URL يرمّز العربية ولا يُعيد ترميز ما هو مُرمَّز أصلاً
function toAbsolute(path) {
  try {
    return new URL(path, SITE_URL).href;
  } catch {
    return null;
  }
}

export default function Breadcrumbs({ items }) {
  const itemsKey = JSON.stringify(items || []);

  // مخطط BreadcrumbList — يجعل قوقل يعرض المسار في نتيجة البحث بدل الرابط الخام
  useEffect(() => {
    const trail = [{ label: 'الرئيسية', to: '/' }, ...(items || [])].filter((i) => i?.label);
    if (trail.length < 2) return undefined;

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: trail.map((item, index) => {
        const url = item.to ? toAbsolute(item.to) : null;
        return {
          '@type': 'ListItem',
          position: index + 1,
          name: item.label,
          ...(url ? { item: url } : {}),
        };
      }),
    };

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-breadcrumb', '');
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);

    return () => script.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey]);

  return (
    <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6 flex-wrap">
      <Link to="/" className="hover:text-blue-600 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      </Link>
      {items.map((item, index) => (
        <span key={index} className="flex items-center gap-2">
          <svg className="w-3 h-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {item.to ? (
            <Link to={item.to} className="hover:text-blue-600 transition-colors">{item.label}</Link>
          ) : (
            <span className="text-gray-800 font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
