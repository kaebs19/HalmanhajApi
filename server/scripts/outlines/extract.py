#!/usr/bin/env python3
"""
استخراج فهرس كل كتاب (أسماء الوحدات والدروس فقط) من صور صفحاته المنشورة، عبر OCR.

يعمل على macOS فقط (يستخدم Vision عبر ocr.swift). لا ينشر نص الكتاب نفسه — العناوين فقط.
الناتج: server/data/lesson-outlines.json  { "<lesson slug>": {"units": [{"title", "lessons": [...]}], "lessons": [...]} }

الاستخدام:
  swiftc -O server/scripts/outlines/ocr.swift -o /tmp/ocrj
  python3 server/scripts/outlines/extract.py --ocr /tmp/ocrj [--only <slug>] [--cache /tmp/outline-cache]
"""
import argparse
import concurrent.futures as cf
import json
import os
import re
import subprocess
import sys
import urllib.parse
import urllib.request

SITE = 'https://www.halmanhaj.com'
FIRST_PAGE, LAST_PAGE = 2, 26
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'lesson-outlines.json')

ORDINALS = {
    'الأول': 1, 'الاول': 1, 'الأولى': 1, 'الاولى': 1, 'الثاني': 2, 'الثانية': 2, 'الثالث': 3, 'الثالثة': 3,
    'الرابع': 4, 'الرابعة': 4, 'الخامس': 5, 'الخامسة': 5, 'السادس': 6, 'السادسة': 6, 'السابع': 7, 'السابعة': 7,
    'الثامن': 8, 'الثامنة': 8, 'التاسع': 9, 'التاسعة': 9, 'العاشر': 10, 'العاشرة': 10,
    'الحادي عشر': 11, 'الحادية عشرة': 11, 'الثاني عشر': 12, 'الثانية عشرة': 12,
}
ARABIC_DIGITS = str.maketrans('٠١٢٣٤٥٦٧٨٩', '0123456789')
ORD_RE = '|'.join(sorted((re.escape(k) for k in ORDINALS), key=len, reverse=True))
HEAD_RE = re.compile(
    rf'^\s*(?P<kind>الوحدة|الفصل|الدرس|الباب)\s+(?P<ord>{ORD_RE}|[0-9٠-٩]+)\s*[:：\-–]\s*(?P<title>.*)$'
)
EN_UNIT_RE = re.compile(r'^\s*(?P<kind>Unit|UNIT|Lesson|LESSON)\s+(?P<ord>\d+)\s*[:：\-–.]?\s*(?P<title>.*)$')
# صيغة كتب العلوم والرياضيات المترجمة: "الفصل 3" في سطر، وعنوانه في السطر التالي، والدروس "3-1: ..."
CHAPTER_RE = re.compile(r'^\s*(?P<kind>الفصل|الوحدة)\s+(?P<ord>[0-9٠-٩]+)\s*$')
SECTION_RE = re.compile(r'^\s*(?P<major>[0-9٠-٩]+)\s*[-–]\s*(?P<minor>[0-9٠-٩]+)\s*[:：]?\s*(?P<title>\S.*)$')
NOISE_RE = re.compile(r'تحضيري|وزارة|Ministry|^\d[\d\s.\-–]*$|^[•>\-–]')


def fetch_json(url):
    req = urllib.request.Request(url, headers={'x-prerender': '1', 'User-Agent': 'halmanhaj-outline'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def file_slugs():
    with urllib.request.urlopen(f'{SITE}/sitemap.xml', timeout=30) as r:
        xml = r.read().decode()
    slugs = re.findall(r'<loc>https://www\.halmanhaj\.com/files/([^<]+)</loc>', xml)
    return list(dict.fromkeys(urllib.parse.unquote(s) for s in slugs))


def ordinal(value):
    v = value.translate(ARABIC_DIGITS)
    return int(v) if v.isdigit() else ORDINALS.get(value, 99)


WATERMARK_RE = re.compile(r'\S*تحضير\S*|\S*حضيري|\S*ضيري|\bصيري\b|\bالحلا\b|منصة\s+\S+\s+التعليمية')
ARABIC_RE = re.compile(r'[\u0600-\u06FF]')


def clean_title(t):
    t = WATERMARK_RE.sub(' ', t)
    t = re.sub(r'(?<=\s)[\d٠-٩]+(?=\s)', ' ', f' {t} ').strip()   # أرقام صفحات عالقة وسط السطر
    t = re.sub(r'[\^;%]+', ' ', t)
    t = re.sub(r'\.{2,}.*$', '', t)                      # "العنوان ........ ٢٣" → العنوان
    t = re.sub(r'[?!]+(?:[.?!]+)?', ' ', t) if ')' not in t else t
    if ARABIC_RE.search(t):
        # عناوين ثنائية اللغة: نُبقي العربية فقط
        t = re.sub(r'\(?\s*[A-Za-z][A-Za-z\s,\'\-&]*[A-Za-z]\s*\)?', ' ', t)
    # الوصف الطويل بعد العنوان (كتب التربية الفنية): "مجال الرسم: يحتوي على..." → "مجال الرسم"
    if len(t) > 60 and ':' in t:
        t = t.split(':')[0]
    for cut in (' ويتكون', ' يحتوي', ' ويحتوي', ' تقويم الوحدة', ' تقويم الفصل'):
        if cut in t:
            t = t.split(cut)[0]
    t = re.sub(r'[\s.\d٠-٩]+$', '', t)           # أرقام الصفحات في آخر السطر
    t = re.sub(r'\s+', ' ', t).strip(' :-–،,.')
    # OCR يقرأ "(" أحياناً فاصلة أو ! أو -: "التنظيم ,المفهوم، الأهمية)" → "التنظيم (المفهوم، الأهمية)"
    if t.count(')') > t.count('('):
        m = re.search(r'\s[!?,;\-–\s]+(?=[^!?,;\-–\s][^()]*\))', t)
        t = t[:m.start()] + ' (' + t[m.end():] if m else t.replace(')', '')
    t = re.sub(r'[!?]', '', t)
    for _ in range(3):
        t = re.sub(r'\s+(?:ال|[^\s()])\s*$', '', t)                 # حرف منفرد في آخر السطر
    t = re.sub(r'\s+[A-Z]{4,}$', '', t)                   # بقايا OCR كبيرة الحروف: "My Family WTYLIH"
    t = re.sub(r'\s+', ' ', t).strip(' :-–،,.')
    words = t.split(' ')
    for k in range(len(words) // 2, 0, -1):       # "المكتبات البرمجية المكتبات البرمجية" → مرة واحدة
        if words[-k:] == words[-2 * k:-k]:
            words = words[:-k]
            break
    return ' '.join(words)


def ordered_lines(lines):
    """ترتيب القراءة: عمودان من اليمين لليسار إن وُجدا، ومن الأعلى للأسفل داخل كل عمود."""
    for l in lines:
        l['xc'] = l['x'] + l['w'] / 2
    heads = [l for l in lines if HEAD_RE.match(l['t']) or CHAPTER_RE.match(l['t'])]
    two_cols = sum(l['xc'] >= 0.5 for l in heads) >= 1 and sum(l['xc'] < 0.5 for l in heads) >= 1
    if two_cols:
        right = sorted((l for l in lines if l['xc'] >= 0.5), key=lambda l: -l['y'])
        left = sorted((l for l in lines if l['xc'] < 0.5), key=lambda l: -l['y'])
        return right + left
    return sorted(lines, key=lambda l: -l['y'])


def title_below(ordered, i):
    """عنوان مكتوب في السطر التالي (نتجاوز أرقام الصفحات والعلامة المائية)."""
    l = ordered[i]
    for nxt in ordered[i + 1:i + 5]:
        if l['y'] - nxt['y'] > 0.08:
            break
        if NOISE_RE.search(nxt['t']) or CHAPTER_RE.match(nxt['t']) or SECTION_RE.match(nxt['t']) or HEAD_RE.match(nxt['t']):
            continue
        if abs(nxt['xc'] - l['xc']) < 0.25:
            t = clean_title(nxt['t'])
            return t if len(t) >= 3 else ''
    return ''


def headings_of_page(lines):
    ordered = ordered_lines(lines)
    out = []
    for i, l in enumerate(ordered):
        c = CHAPTER_RE.match(l['t'])
        if c:
            title = title_below(ordered, i)
            n = ordinal(c.group('ord'))
            label = f"{c.group('kind')} {n}"
            out.append({'unit': True, 'n': n, 'title': title if len(title) >= 3 else '', 'label': label})
            continue
        sec = SECTION_RE.match(l['t'])
        if sec:
            title = clean_title(sec.group('title'))
            major, minor = ordinal(sec.group('major')), ordinal(sec.group('minor'))
            if len(title) >= 3 and major < 50 and minor < 50:
                out.append({'unit': False, 'n': minor, 'major': major, 'pair': (major, minor), 'title': title, 'label': f'{major}-{minor}'})
            continue
        m = HEAD_RE.match(l['t']) or EN_UNIT_RE.match(l['t'])
        if not m:
            continue
        title = m.group('title').strip()
        if not clean_title(title):
            # "الفصل الأول:" والعنوان في السطر التالي
            title = title_below(ordered, i)
            if not title:
                continue
        # عنوان ملفوف على سطرين: السطر التالي مباشرة في نفس العمود
        nxt = ordered[i + 1] if i + 1 < len(ordered) else None
        if nxt and not (HEAD_RE.match(nxt['t']) or EN_UNIT_RE.match(nxt['t']) or NOISE_RE.search(nxt['t'])) \
                and 0 < l['y'] - nxt['y'] < 0.06 and abs(nxt['xc'] - l['xc']) < 0.25 \
                and (not title or title.endswith(':') or len(nxt['t']) < 35):
            if nxt['t'].strip() not in title:
                title = f'{title} {nxt["t"]}'
        title = clean_title(title)
        if len(title) < 3:
            continue
        kind = m.group('kind')
        is_unit = kind in ('الوحدة', 'الباب', 'Unit', 'UNIT') or (kind == 'الفصل' and not title.startswith('الدراسي'))
        out.append({'unit': is_unit, 'n': ordinal(m.group('ord')), 'title': title, 'label': f'{kind} {m.group("ord")}'})
    numeric = sum(bool(re.fullmatch(r'[\d٠-٩\s]+', l['t'].strip())) for l in lines)
    return out, numeric


def is_toc_page(heads, numeric):
    return len(heads) >= 3 or (len(heads) >= 2 and numeric >= 4)


def build_outline(pages):
    """pages: [(page_number, lines)] بالترتيب. نأخذ أول كتلة متصلة من صفحات الفهرس."""
    toc, started, gap = [], False, 0
    for _, lines in pages:
        heads, numeric = headings_of_page(lines)
        if is_toc_page(heads, numeric):
            toc.extend(heads)
            started, gap = True, 0
        elif started:
            gap += 1
            if gap > 1:            # نسمح بصفحة واحدة بينية (مثل صفحة أرقام فقط)
                break
    if len(toc) < 2:
        return None

    # بعض الكتب ترقّم الدروس "رقم الدرس-رقم الفصل" (2-1 = الدرس 2 من الفصل 1) وبعضها بالعكس:
    # نحدد الاتجاه بمقارنة الرقمين مع الفصل الذي يسبق الدرس في ترتيب القراءة
    first = second = 0
    last_unit = None
    for h in toc:
        if h['unit']:
            last_unit = h['n']
        elif 'pair' in h and last_unit is not None:
            first += h['pair'][0] == last_unit
            second += h['pair'][1] == last_unit
    if first == second == 0:
        # لا فصول معروفة: الرقم الثابت بين الدروس المتتالية هو رقم الفصل
        pairs = [h['pair'] for h in toc if 'pair' in h]
        first = sum(a[0] == b[0] for a, b in zip(pairs, pairs[1:]))
        second = sum(a[1] == b[1] for a, b in zip(pairs, pairs[1:]))
    if second > first:
        for h in toc:
            if 'pair' in h:
                h['major'], h['n'] = h['pair'][1], h['pair'][0]

    fmt = lambda h: f"{h['label']}: {h['title']}" if h['title'] else h['label']
    units, loose, current, seen = [], [], None, set()
    for h in toc:
        if h['unit']:
            key = h['label'] if not h['title'] else fmt(h)
            if key in seen:
                current = next(u for u in units if u['key'] == key)
                continue
            seen.add(key)
            current = {'n': h['n'], 'key': key, 'title': fmt(h), 'lessons': []}
            units.append(current)
        else:
            entry = {'n': h['n'], 'title': fmt(h)}
            owner = next((u for u in units if 'major' in h and u['n'] == h['major']), None) if 'major' in h else None
            if 'major' in h and not owner:
                # درس قبل ظهور فصله في ترتيب القراءة: ننشئ الفصل ونكمل عنوانه إن ظهر لاحقاً
                owner = {'n': h['major'], 'key': f"الفصل {h['major']}", 'title': f"الفصل {h['major']}", 'lessons': []}
                units.append(owner)
                seen.add(owner['key'])
            bucket = owner['lessons'] if owner else (current['lessons'] if current else loose)
            if entry['title'] not in (e['title'] for e in bucket):
                bucket.append(entry)

    if len({u['n'] for u in units}) == len(units):   # كتب متعددة الأجزاء تبدأ كل جزء بـ"الوحدة الأولى"
        units.sort(key=lambda u: u['n'])
    for u in units:
        u['lessons'].sort(key=lambda e: e['n'])
    result = {
        'units': [{'title': u['title'], 'lessons': [e['title'] for e in u['lessons']]} for u in units],
        'lessons': [e['title'] for e in loose],
    }
    total = len(result['units']) + len(result['lessons']) + sum(len(u['lessons']) for u in result['units'])
    return result if total >= 2 else None


def download(url, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return dest
    req = urllib.request.Request(url, headers={'User-Agent': 'halmanhaj-outline'})
    with urllib.request.urlopen(req, timeout=60) as r, open(dest, 'wb') as f:
        f.write(r.read())
    return dest


def process(slug, ocr, cache):
    try:
        data = fetch_json(f'{SITE}/api/public/files/{urllib.parse.quote(slug)}/pages')
    except Exception as e:
        return slug, None, f'pages api: {e}'
    pages = [p for p in data.get('pages') or [] if FIRST_PAGE <= p['page_number'] <= LAST_PAGE]
    if not pages:
        return slug, None, 'no page images'
    folder = os.path.join(cache, re.sub(r'[^\w-]', '_', slug)[:80])
    os.makedirs(folder, exist_ok=True)
    files = []
    for p in pages:
        dest = os.path.join(folder, f"{p['page_number']:03d}.webp")
        try:
            files.append((p['page_number'], download(SITE + p['image_url'], dest)))
        except Exception:
            pass
    ocr_cache = os.path.join(folder, 'ocr.jsonl')
    if os.path.exists(ocr_cache) and os.path.getsize(ocr_cache) > 0:
        stdout = open(ocr_cache).read()
    else:
        stdout = subprocess.run([ocr, *[f for _, f in files]], capture_output=True, text=True, timeout=600).stdout
        open(ocr_cache, 'w').write(stdout)
    by_file = {}
    for line in stdout.splitlines():
        try:
            j = json.loads(line)
            by_file[j['file']] = j['lines']
        except ValueError:
            pass
    ordered = [(n, by_file.get(f, [])) for n, f in files]
    outline = build_outline(ordered)
    return slug, outline, None if outline else 'no table of contents found'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--ocr', required=True)
    ap.add_argument('--only')
    ap.add_argument('--cache', default='/tmp/outline-cache')
    ap.add_argument('--workers', type=int, default=4)
    args = ap.parse_args()

    slugs = [args.only] if args.only else file_slugs()
    existing = {}
    if os.path.exists(OUT) and not args.only:
        existing = json.load(open(OUT))
    results, skipped = dict(existing), {}
    todo = [s for s in slugs if s not in existing]
    print(f'{len(slugs)} books, {len(todo)} to process', flush=True)

    with cf.ThreadPoolExecutor(args.workers) as pool:
        for i, (slug, outline, reason) in enumerate(pool.map(lambda s: process(s, args.ocr, args.cache), todo), 1):
            if outline:
                results[slug] = outline
            else:
                skipped[slug] = reason
            print(f'[{i}/{len(todo)}] {"✓" if outline else "–"} {slug[:70]} {reason or ""}', flush=True)
            if i % 10 == 0 and not args.only:
                json.dump(results, open(OUT, 'w'), ensure_ascii=False, indent=1, sort_keys=True)

    if args.only:
        print(json.dumps(results.get(args.only), ensure_ascii=False, indent=1))
        return
    json.dump(results, open(OUT, 'w'), ensure_ascii=False, indent=1, sort_keys=True)
    json.dump(skipped, open(OUT.replace('.json', '.skipped.json'), 'w'), ensure_ascii=False, indent=1, sort_keys=True)
    print(f'done: {len(results)} outlines, {len(skipped)} skipped', flush=True)


if __name__ == '__main__':
    sys.exit(main())
