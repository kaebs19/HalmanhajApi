/**
 * تجهيز HTML الصفحة من السيرفر قبل إرساله (للسيو).
 *
 * التطبيق React يعمل في المتصفح، فكل رابط كان يصل لقوقل بنفس index.html:
 * نفس العنوان والوصف ولا روابط داخلية، فيُعدّ مكرراً أو "Discovered – not indexed".
 * هنا نكتب لكل مسار عنوانه ووصفه وcanonical وملخصاً نصياً بروابطه داخل #root
 * (React يستبدله فور التشغيل). وحين يؤكد الـ API أن المحتوى غير موجود نرجع 404 حقيقية.
 *
 * القاعدة: عند أي فشل (مهلة، خطأ 500...) نرجع الصفحة العادية بـ 200 ولا نضع noindex أبداً،
 * حتى لا يُحذف من الفهرس محتوى موجود بسبب عطل عابر.
 */
const fs = require('fs');
const path = require('path');
const { seoTitles } = require('../utils/seoTitles');

const SITE_URL = 'https://www.halmanhaj.com';
const SITE_NAME = 'حل مدرستي';
const API_TIMEOUT_MS = 2500;
const MAX_LINKS = 300;

// صفحات خاصة بالمستخدم أو مساعدة: لا فائدة من أرشفتها
const PRIVATE_PREFIXES = ['/auth/', '/admin', '/my-dashboard', '/notifications', '/search', '/learn/', '/faq/ask', '/exercises/', '/delete-account'];
const PRIVATE_EXACT = new Set(['/auth', '/login', '/register']);

// صفحات ثابتة معروفة لا تحتاج استعلاماً
const STATIC_PAGES = {
  '/privacy': { title: 'سياسة الخصوصية' },
  '/terms': { title: 'الشروط والأحكام' },
  '/intellectual-property': { title: 'سياسة الملكية الفكرية' },
  '/contact': { title: 'اتصل بنا' },
  '/faq': { title: 'سؤال وجواب', description: 'اسأل وأجب عن أسئلة المنهج الدراسي' },
  '/quizzes': { title: 'الاختبارات', description: 'اختبارات تفاعلية في جميع المواد الدراسية' },
  '/leaderboard': { title: 'لوحة الترتيب', description: 'تنافس مع زملائك واحصل على أعلى ترتيب' },
  '/exercises': { title: 'التمارين' },
};

// المقاطع المحجوزة لمسارات أخرى في App.js، فلا تُعامل كمرحلة
const RESERVED_FIRST_SEGMENTS = new Set([
  'files', 'quizzes', 'faq', 'profile', 'auth', 'search', 'privacy', 'terms', 'intellectual-property',
  'contact', 'delete-account', 'my-dashboard', 'leaderboard', 'exercises', 'notifications', 'learn',
  'admin', 'login', 'register', 'اختبارات',
]);

const escapeHtml = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const enc = (slug) => encodeURIComponent(slug);

const clip = (text, max = 160) => {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).trim()}…` : t;
};

let cachedTemplate = null;
let cachedTemplateMtime = 0;
function loadTemplate(indexPath) {
  const mtime = fs.statSync(indexPath).mtimeMs;
  if (!cachedTemplate || mtime !== cachedTemplateMtime) {
    cachedTemplate = fs.readFileSync(indexPath, 'utf8');
    cachedTemplateMtime = mtime;
  }
  return cachedTemplate;
}

async function fetchApi(port, apiPath) {
  const res = await fetch(`http://127.0.0.1:${port}/api/public${apiPath}`, {
    headers: { 'x-prerender': '1' },
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });
  if (res.status === 404) return { notFound: true };
  if (!res.ok) throw new Error(`API ${apiPath} → ${res.status}`);
  return { data: await res.json() };
}

const linkList = (items) => {
  if (!items.length) return '';
  const li = items.slice(0, MAX_LINKS)
    .map(({ href, label }) => `<li><a href="${escapeHtml(href)}">${escapeHtml(label)}</a></li>`)
    .join('');
  return `<ul>${li}</ul>`;
};

const breadcrumbNav = (crumbs) => {
  const parts = [{ href: '/', label: 'الرئيسية' }, ...crumbs]
    .map((c) => (c.href ? `<a href="${escapeHtml(c.href)}">${escapeHtml(c.label)}</a>` : `<span>${escapeHtml(c.label)}</span>`));
  return `<nav aria-label="مسار التنقل">${parts.join(' › ')}</nav>`;
};

const breadcrumbSchema = (crumbs) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [{ href: '/', label: 'الرئيسية' }, ...crumbs].map((c, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: c.label,
    ...(c.href && { item: `${SITE_URL}${c.href}` }),
  })),
});

// ═══════════════════════════════════════
// المحللات: كل واحد يرجع { title, description, bodyHtml, crumbs } أو { notFound }
// ═══════════════════════════════════════

async function resolveHome(port) {
  const { data } = await fetchApi(port, '/navigation');
  const stages = Array.isArray(data) ? data : (data.stages || []);
  const links = [];
  stages.forEach((s) => {
    const stageSlug = s.public_slug || s.slug;
    links.push({ href: `/${enc(stageSlug)}`, label: s.name });
    (s.grades || []).forEach((g) => links.push({ href: `/${enc(stageSlug)}/${enc(g.public_slug || g.slug)}`, label: `${g.name} - ${s.name}` }));
  });
  return {
    fullTitle: null, // عنوان index.html الافتراضي
    h1: SITE_NAME,
    description: null,
    bodyHtml: linkList(links),
  };
}

async function resolveStage(port, stageSlug) {
  const r = await fetchApi(port, `/stages/${enc(stageSlug)}`);
  if (r.notFound) return r;
  const { stage, grades = [], tracks = [] } = r.data;
  const slug = stage.public_slug || stage.slug;
  const t = seoTitles.stage(stage.name, grades.map((g) => g.name));
  const links = [
    ...grades.map((g) => ({ href: `/${enc(slug)}/${enc(g.public_slug || g.slug)}`, label: g.name })),
    ...tracks.map((tr) => ({ href: `/${enc(slug)}/${enc(tr.slug)}`, label: tr.name })),
  ];
  return { ...t, h1: stage.name, bodyHtml: linkList(links), crumbs: [{ label: stage.name }] };
}

async function resolveGrade(port, stageSlug, gradeSlug) {
  const r = await fetchApi(port, `/grades/${enc(gradeSlug)}`);
  if (r.notFound) return r;
  const { grade, subjects = [], tracks = [] } = r.data;
  const t = seoTitles.grade(grade.name, grade.stage_name, subjects.map((s) => s.name));
  const base = `/${enc(stageSlug)}/${enc(gradeSlug)}`;
  const links = [
    ...tracks.map((tr) => ({ href: `/${enc(stageSlug)}/${enc(tr.slug)}?grade_id=${grade.id}`, label: tr.name })),
    ...subjects.map((s) => ({ href: `${base}/${enc(s.public_slug || s.slug)}`, label: s.name })),
  ];
  return {
    ...t,
    h1: grade.name,
    bodyHtml: linkList(links),
    crumbs: [{ href: `/${enc(stageSlug)}`, label: grade.stage_name }, { label: grade.name }],
  };
}

async function resolveSubject(port, stageSlug, gradeSlug, subjectSlug) {
  const r = await fetchApi(port, `/subjects/${enc(subjectSlug)}?limit=${MAX_LINKS}`);
  if (r.notFound) return r;
  const { subject, lessons = [] } = r.data;
  const parent = subject.grades?.[0] || subject.tracks?.[0] || {};
  const t = seoTitles.subject(subject.name, parent.name, parent.stage_name);
  const links = lessons.map((l) => ({ href: `/files/${enc(l.slug)}`, label: l.title }));
  return {
    ...t,
    h1: subject.name,
    bodyHtml: linkList(links),
    crumbs: [
      ...(parent.stage_name ? [{ href: `/${enc(stageSlug)}`, label: parent.stage_name }] : []),
      ...(parent.name ? [{ href: `/${enc(stageSlug)}/${enc(gradeSlug)}`, label: parent.name }] : []),
      { label: subject.name },
    ],
  };
}

async function resolveFile(port, fileSlug) {
  const r = await fetchApi(port, `/files/${enc(fileSlug)}`);
  if (r.notFound) return r;
  const { lesson, related = [], navigation = {} } = r.data;
  const title = lesson.seo_title?.trim() || lesson.title;
  const description = lesson.seo_description?.trim() || lesson.description || `${lesson.title} - ${lesson.subject_name}`;
  const g = lesson.grades?.[0];
  const links = [navigation.previous, navigation.next, ...related]
    .filter(Boolean)
    .map((l) => ({ href: `/files/${enc(l.slug)}`, label: l.title }));
  const crumbs = [];
  if (g) {
    const stageSlug = g.stage_public_slug || g.stage_slug;
    const gradeSlug = g.public_slug || g.slug;
    crumbs.push({ href: `/${enc(stageSlug)}`, label: g.stage_name });
    crumbs.push({ href: `/${enc(stageSlug)}/${enc(gradeSlug)}`, label: g.name });
    crumbs.push({ href: `/${enc(stageSlug)}/${enc(gradeSlug)}/${enc(lesson.subject_public_slug || lesson.subject_slug)}`, label: lesson.subject_name });
  }
  crumbs.push({ label: lesson.title });
  return {
    title,
    description,
    h1: lesson.title,
    intro: lesson.description,
    bodyHtml: linkList(links),
    crumbs,
    image: lesson.thumbnail_url ? `${SITE_URL}${lesson.thumbnail_url}` : null,
  };
}

function segmentsOf(reqPath) {
  return reqPath.split('/').filter(Boolean).map((s) => {
    try { return decodeURIComponent(s); } catch { return s; }
  });
}

async function resolve(reqPath, port) {
  if (PRIVATE_EXACT.has(reqPath) || PRIVATE_PREFIXES.some((p) => reqPath.startsWith(p))) {
    return { noIndex: true };
  }
  if (reqPath === '/') return resolveHome(port);
  if (STATIC_PAGES[reqPath]) return { ...STATIC_PAGES[reqPath] };

  const seg = segmentsOf(reqPath);
  if (seg[0] === 'files' && seg.length === 2) return resolveFile(port, seg[1]);
  if (RESERVED_FIRST_SEGMENTS.has(seg[0])) return {}; // صفحات أخرى في التطبيق: canonical فقط

  if (seg.length === 1) return resolveStage(port, seg[0]);
  if (seg.length === 2) return resolveGrade(port, seg[0], seg[1]);
  if (seg.length === 3) return resolveSubject(port, seg[0], seg[1], seg[2]);
  return { notFound: true };
}

// ═══════════════════════════════════════
// كتابة النتيجة داخل index.html
// ═══════════════════════════════════════

function setMeta(html, attr, key, content) {
  const tag = `<meta ${attr}="${key}" content="${escapeHtml(content)}"/>`;
  const re = new RegExp(`<meta\\s+${attr}="${key}"\\s+content="[^"]*"\\s*/?>`);
  return re.test(html) ? html.replace(re, tag) : html.replace('</head>', `${tag}</head>`);
}

function render(template, reqPath, page) {
  let html = template;
  const canonical = `${SITE_URL}${reqPath === '/' ? '/' : reqPath}`;

  if (page.notFound || page.noIndex) {
    html = setMeta(html, 'name', 'robots', 'noindex, follow');
  }
  if (page.notFound) {
    return html.replace(/<title>[^<]*<\/title>/, `<title>الصفحة غير موجودة | ${SITE_NAME}</title>`);
  }

  const fullTitle = page.fullTitle !== undefined && page.fullTitle !== null
    ? page.fullTitle
    : (page.title ? `${page.title} | ${SITE_NAME}` : null);
  if (fullTitle) {
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(fullTitle)}</title>`);
    html = setMeta(html, 'property', 'og:title', fullTitle);
    html = setMeta(html, 'name', 'twitter:title', fullTitle);
  }
  if (page.description) {
    const d = clip(page.description);
    html = setMeta(html, 'name', 'description', d);
    html = setMeta(html, 'property', 'og:description', d);
    html = setMeta(html, 'name', 'twitter:description', d);
  }
  if (page.image) {
    html = setMeta(html, 'property', 'og:image', page.image);
  }
  if (!page.noIndex) {
    html = html.replace('</head>', `<link rel="canonical" href="${escapeHtml(canonical)}"/></head>`);
    html = setMeta(html, 'property', 'og:url', canonical);
  }
  if (page.crumbs?.length) {
    // data-seo: مكوّن SEO في React يمسح هذه المخططات ويكتب نسخته
    const json = JSON.stringify(breadcrumbSchema(page.crumbs)).replace(/</g, '\\u003c');
    html = html.replace('</head>', `<script type="application/ld+json" data-seo>${json}</script></head>`);
  }

  if (page.h1 || page.bodyHtml) {
    const body = [
      page.crumbs?.length ? breadcrumbNav(page.crumbs) : '',
      page.h1 ? `<h1>${escapeHtml(page.h1)}</h1>` : '',
      page.intro || page.description ? `<p>${escapeHtml(page.intro || page.description)}</p>` : '',
      page.bodyHtml || '',
    ].join('');
    html = html.replace('<div id="root"></div>', `<div id="root"><main>${body}</main></div>`);
  }
  return html;
}

/**
 * Middleware يخدم index.html للمسارات غير الـ API مع وسوم خاصة بكل صفحة.
 */
function seoPrerender({ indexPath, port }) {
  return async (req, res) => {
    let template;
    try {
      template = loadTemplate(indexPath);
    } catch (err) {
      return res.status(500).send('Build not found');
    }

    let page = {};
    try {
      page = await resolve(req.path, port);
    } catch (err) {
      console.error('seoPrerender:', req.path, err.message);
      page = {}; // فشل مؤقت: الصفحة العادية بلا noindex
    }

    res.set('Cache-Control', 'no-cache');
    res.status(page.notFound ? 404 : 200).type('html').send(render(template, req.path, page));
  };
}

module.exports = { seoPrerender, _internal: { resolve, render, segmentsOf } };
