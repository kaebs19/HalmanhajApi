import { useState } from 'react';
import '../../styles/animations.css';

// ═══ تنسيق الإجابة الصحيحة ═══
export function formatCorrectAnswer(type, answer, question) {
  if (!answer) return '';
  switch (type) {
    case 'true_false': return answer.value ? 'صح' : 'خطأ';
    case 'mcq': case 'speed': {
      const opts = question?.question_data?.options || [];
      return opts[answer.index] || `الخيار ${answer.index + 1}`;
    }
    case 'fill_blank': case 'read_answer':
      return (answer.values || [answer.value]).filter(Boolean).join(' أو ');
    case 'ordering':
      return (answer.items || []).join(' → ');
    case 'matching': case 'image_match':
      return (answer.pairs || []).map(p => `${p.left} ↔ ${p.right}`).join('، ');
    case 'word_build': return answer.answer || '';
    case 'letter_pos': return `${answer.form || ''} (${answer.position || ''})`;
    case 'numeric_input': return answer.value || '';
    case 'text_input': return answer.value || '';
    default: return JSON.stringify(answer);
  }
}

// ═══ ألوان خيارات MCQ — Duolingo ═══
const MCQ_STYLES = [
  { border: '#1CB0F6', bg: '#E8F8FF', badge: '#1CB0F6', hoverBorder: '#0A8FD0' },  // A - أزرق
  { border: '#9B59B6', bg: '#F5EEF8', badge: '#9B59B6', hoverBorder: '#7D3C98' },  // B - بنفسجي
  { border: '#FF9600', bg: '#FFF8E7', badge: '#FF9600', hoverBorder: '#E08600' },  // C - برتقالي
  { border: '#58CC02', bg: '#F0FAE8', badge: '#58CC02', hoverBorder: '#4CAF00' },  // D - أخضر
  { border: '#1CB0F6', bg: '#E8F8FF', badge: '#1CB0F6', hoverBorder: '#0A8FD0' },  // E - أزرق
  { border: '#9B59B6', bg: '#F5EEF8', badge: '#9B59B6', hoverBorder: '#7D3C98' },  // F - بنفسجي
];

// ═══ مكون خيارات السؤال ═══
export default function QuestionOptions({
  type, question, selectedOption, setSelectedOption,
  fillAnswer, setFillAnswer, matchingPairs, setMatchingPairs,
  matchLeft, setMatchLeft, orderingItems, setOrderingItems,
  classifyGroups, setClassifyGroups, wordBuildPlaced, setWordBuildPlaced,
  onSubmit, submitting
}) {
  const [selectedItem, setSelectedItemLocal] = useState(null);
  const data = question.question_data || {};

  // ═══ صح وخطأ ═══
  if (type === 'true_false') {
    return (
      <div className="grid grid-cols-2 gap-4">
        {[{ val: true, label: '✅ صح', color: 'green' }, { val: false, label: '❌ خطأ', color: 'red' }].map((opt, idx) => (
          <button
            key={String(opt.val)}
            onClick={() => onSubmit(opt.val)}
            disabled={submitting}
            style={{ animationDelay: `${idx * 100}ms`, opacity: 0, animationFillMode: 'forwards' }}
            className={`py-7 rounded-2xl text-xl font-bold transition-all border-2 animate-fade-slide-up hover:scale-[1.02] active:scale-[0.98] ${
              opt.color === 'green'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-500/20'
                : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-400 hover:shadow-lg hover:shadow-red-500/20'
            } ${submitting ? 'opacity-50 pointer-events-none' : ''}`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    );
  }

  // ═══ اختيار من متعدد / سرعة ═══
  if (type === 'mcq' || type === 'speed') {
    const options = data.options || [];
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    return (
      <div className="space-y-3">
        {options.map((opt, idx) => {
          const s = MCQ_STYLES[idx % MCQ_STYLES.length];
          return (
            <button
              key={idx}
              onClick={() => onSubmit(idx)}
              disabled={submitting}
              style={{
                animationDelay: `${idx * 80}ms`, opacity: 0, animationFillMode: 'forwards',
                background: s.bg, borderColor: s.border, minHeight: '64px',
              }}
              className={`w-full p-4 rounded-xl text-right font-medium transition-all duration-200 border-2 animate-fade-slide-up
                hover:scale-[1.02] hover:shadow-md active:scale-[0.98]
                ${submitting ? 'opacity-50 pointer-events-none' : ''}
              `}
              onMouseEnter={e => e.currentTarget.style.borderColor = s.hoverBorder}
              onMouseLeave={e => e.currentTarget.style.borderColor = s.border}
            >
              <div className="flex items-center gap-3">
                {/* حرف الخيار (badge) */}
                <span
                  className="w-8 h-8 flex items-center justify-center text-white rounded-full text-sm font-bold shrink-0"
                  style={{ background: s.badge }}
                >
                  {letters[idx]}
                </span>
                {/* نص الخيار */}
                <span className="text-lg text-gray-800 flex-1">{opt}</span>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  // ═══ أكمل الفراغ / اقرأ وأجب ═══
  if (type === 'fill_blank' || type === 'read_answer') {
    return (
      <div className="space-y-3 animate-fade-slide-up" style={{ opacity: 0, animationFillMode: 'forwards' }}>
        {type === 'read_answer' && data.passage && (
          <div className="bg-[#5C6BC0]/5 border border-[#5C6BC0]/10 rounded-xl p-4 text-sm text-gray-700 leading-relaxed mb-4 max-h-40 overflow-y-auto">
            {data.passage}
          </div>
        )}
        <input
          type="text"
          value={fillAnswer}
          onChange={e => setFillAnswer(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && fillAnswer.trim() && onSubmit(fillAnswer.trim())}
          placeholder="اكتب إجابتك هنا..."
          className="w-full bg-white border-2 border-gray-200 rounded-xl px-5 py-4 text-lg text-center focus:outline-none focus:border-[#5C6BC0] focus:ring-2 focus:ring-[#5C6BC0]/20 transition-all"
          autoFocus
          dir="rtl"
        />
        <button
          onClick={() => fillAnswer.trim() && onSubmit(fillAnswer.trim())}
          disabled={!fillAnswer.trim() || submitting}
          className={`w-full py-3.5 rounded-xl text-sm font-bold transition-all ${
            fillAnswer.trim()
              ? 'bg-gradient-to-l from-[#5C6BC0] to-[#3F51B5] text-white hover:shadow-lg hover:shadow-[#5C6BC0]/30 active:scale-[0.98]'
              : 'bg-gray-200 text-gray-400'
          }`}
        >
          تأكيد ✓
        </button>
      </div>
    );
  }

  // ═══ توصيل ═══
  if (type === 'matching' || type === 'image_match') {
    const pairs = data.pairs || [];
    const leftItems = pairs.map(p => p.left);
    const rightItems = [...pairs.map(p => p.right)].sort(() => Math.random() - 0.5);
    const matched = matchingPairs.map(p => p.left);
    const matchedRight = matchingPairs.map(p => p.right);

    return (
      <div className="space-y-4 animate-fade-slide-up" style={{ opacity: 0, animationFillMode: 'forwards' }}>
        <p className="text-xs text-gray-400 text-center font-medium">اضغط على عنصر من اليمين ثم العنصر المطابق من اليسار</p>
        <div className="grid grid-cols-2 gap-4">
          {/* العمود الأيمن */}
          <div className="space-y-2">
            {leftItems.map((item, i) => (
              <button
                key={i}
                onClick={() => !matched.includes(item) && setMatchLeft(item)}
                disabled={matched.includes(item)}
                className={`w-full p-3.5 rounded-xl text-sm font-medium transition-all border-2 text-right ${
                  matched.includes(item) ? 'bg-[#43A047]/10 border-[#43A047]/30 text-[#43A047]' :
                  matchLeft === item ? 'bg-[#5C6BC0]/10 border-[#5C6BC0] text-[#5C6BC0] shadow-md' :
                  'bg-white border-gray-200 hover:border-[#5C6BC0]/50 hover:bg-[#5C6BC0]/5'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
          {/* العمود الأيسر */}
          <div className="space-y-2">
            {rightItems.map((item, i) => (
              <button
                key={i}
                onClick={() => {
                  if (matchedRight.includes(item) || !matchLeft) return;
                  const newPairs = [...matchingPairs, { left: matchLeft, right: item }];
                  setMatchingPairs(newPairs);
                  setMatchLeft(null);
                  if (newPairs.length === pairs.length) {
                    onSubmit(newPairs);
                  }
                }}
                disabled={matchedRight.includes(item)}
                className={`w-full p-3.5 rounded-xl text-sm font-medium transition-all border-2 text-right ${
                  matchedRight.includes(item) ? 'bg-[#43A047]/10 border-[#43A047]/30 text-[#43A047]' :
                  'bg-white border-gray-200 hover:border-[#5C6BC0]/50 hover:bg-[#5C6BC0]/5'
                } ${!matchLeft ? 'opacity-50' : ''}`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ═══ ترتيب ═══
  if (type === 'ordering') {
    const items = data.items || [];
    const remaining = items.filter(it => !orderingItems.includes(it));

    return (
      <div className="space-y-4 animate-fade-slide-up" style={{ opacity: 0, animationFillMode: 'forwards' }}>
        <p className="text-xs text-gray-400 text-center font-medium">اضغط على العناصر بالترتيب الصحيح</p>

        {/* العناصر المرتبة */}
        {orderingItems.length > 0 && (
          <div className="flex flex-wrap gap-2 p-3.5 bg-[#5C6BC0]/5 border border-[#5C6BC0]/10 rounded-xl min-h-[48px]">
            {orderingItems.map((item, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 bg-gradient-to-l from-[#5C6BC0] to-[#3F51B5] text-white px-3 py-1.5 rounded-lg text-sm font-medium shadow-sm">
                <span className="w-5 h-5 bg-white/20 rounded-full text-[10px] flex items-center justify-center font-bold">{i + 1}</span>
                {item}
              </span>
            ))}
          </div>
        )}

        {/* العناصر المتبقية */}
        <div className="flex flex-wrap gap-2">
          {remaining.map((item, i) => (
            <button
              key={i}
              onClick={() => {
                const newItems = [...orderingItems, item];
                setOrderingItems(newItems);
                if (newItems.length === items.length) {
                  onSubmit(newItems);
                }
              }}
              className="bg-white border-2 border-gray-200 px-4 py-2.5 rounded-xl text-sm font-medium hover:border-[#5C6BC0] hover:bg-[#5C6BC0]/5 hover:scale-[1.02] transition-all active:scale-[0.98]"
            >
              {item}
            </button>
          ))}
        </div>

        {orderingItems.length > 0 && (
          <button
            onClick={() => setOrderingItems([])}
            className="text-xs text-gray-400 hover:text-[#E53935] transition-colors font-medium"
          >
            🔄 إعادة تعيين
          </button>
        )}
      </div>
    );
  }

  // ═══ تصنيف ═══
  if (type === 'classify') {
    const categories = data.categories || [];
    const allItems = data.items || categories.flatMap(c => c.items || []);
    const usedItems = Object.values(classifyGroups).flat();
    const remaining = allItems.filter(it => !usedItems.includes(it));

    const totalExpected = allItems.length;
    const totalPlaced = usedItems.length;

    return (
      <div className="space-y-4 animate-fade-slide-up" style={{ opacity: 0, animationFillMode: 'forwards' }}>
        <p className="text-xs text-gray-400 text-center font-medium">اختر عنصر ثم اضغط على الفئة المناسبة</p>

        {/* العناصر المتبقية */}
        <div className="flex flex-wrap gap-2 justify-center">
          {remaining.map((item, i) => (
            <button
              key={i}
              onClick={() => setSelectedItemLocal(selectedItem === item ? null : item)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border-2 hover:scale-[1.02] active:scale-[0.98] ${
                selectedItem === item
                  ? 'bg-[#5C6BC0]/10 border-[#5C6BC0] text-[#5C6BC0] shadow-md'
                  : 'bg-white border-gray-200 hover:border-[#5C6BC0]/50'
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        {/* الفئات */}
        <div className="grid grid-cols-2 gap-3">
          {categories.map((cat, i) => {
            const catName = cat.name || cat;
            const catItems = classifyGroups[catName] || [];
            const cs = MCQ_STYLES[i % MCQ_STYLES.length];
            return (
              <button
                key={i}
                onClick={() => {
                  if (!selectedItem) return;
                  const newGroups = { ...classifyGroups, [catName]: [...catItems, selectedItem] };
                  setClassifyGroups(newGroups);
                  setSelectedItemLocal(null);
                  if (totalPlaced + 1 >= totalExpected) {
                    onSubmit(newGroups);
                  }
                }}
                className="p-4 rounded-xl border-2 text-right transition-all min-h-[80px] hover:scale-[1.01]"
                style={{
                  background: cs.bg,
                  borderColor: selectedItem ? cs.border : '#E5E7EB',
                }}
              >
                <p className="text-sm font-bold mb-2" style={{ color: cs.border }}>{catName}</p>
                <div className="flex flex-wrap gap-1">
                  {catItems.map((it, j) => (
                    <span key={j} className="text-xs text-white px-2 py-0.5 rounded-lg" style={{ background: cs.badge }}>{it}</span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ═══ تركيب كلمة/جملة ═══
  if (type === 'word_build') {
    const tiles = data.tiles || [];
    const buildType = data.build_type || 'word';
    const placed = wordBuildPlaced || [];
    const remaining = tiles.filter((_, i) => !placed.some(p => p.idx === i));

    return (
      <div className="space-y-5 animate-fade-slide-up" style={{ opacity: 0, animationFillMode: 'forwards' }}>
        {data.hint && data.display_hint && (
          <p className="text-center text-3xl">{data.hint}</p>
        )}

        {/* منطقة الإجابة (الفتحات) */}
        <div className="flex flex-wrap gap-2 justify-center p-4 bg-violet-50 border-2 border-dashed border-violet-200 rounded-2xl min-h-[64px] items-center">
          {placed.length === 0 && (
            <span className="text-violet-300 text-sm font-medium">اضغط على {buildType === 'sentence' ? 'الكلمات' : 'الحروف'} لترتيبها</span>
          )}
          {placed.map((p, i) => (
            <button
              key={i}
              onClick={() => {
                const newPlaced = placed.filter((_, j) => j !== i);
                setWordBuildPlaced(newPlaced);
              }}
              className="bg-gradient-to-b from-violet-500 to-violet-600 text-white px-4 py-2.5 rounded-xl text-xl font-bold shadow-md hover:from-violet-600 hover:to-violet-700 active:scale-95 transition-all"
              style={{ fontFamily: 'serif', minWidth: buildType === 'sentence' ? '60px' : '44px' }}
            >
              {p.tile}
            </button>
          ))}
        </div>

        {/* المقاطع المتبقية */}
        <div className="flex flex-wrap gap-3 justify-center">
          {remaining.map((tile, i) => {
            const origIdx = tiles.indexOf(tile);
            // Find the actual original index accounting for duplicates
            let realIdx = -1;
            for (let j = 0; j < tiles.length; j++) {
              if (tiles[j] === tile && !placed.some(p => p.idx === j)) {
                realIdx = j;
                break;
              }
            }
            return (
              <button
                key={`${tile}-${realIdx}`}
                onClick={() => {
                  const newPlaced = [...placed, { tile, idx: realIdx }];
                  setWordBuildPlaced(newPlaced);
                  // تحقق تلقائي عند إكمال الكل
                  if (newPlaced.length === tiles.length) {
                    const sep = buildType === 'sentence' ? ' ' : '';
                    const answer = newPlaced.map(p => p.tile).join(sep);
                    setTimeout(() => onSubmit(answer), 300);
                  }
                }}
                disabled={submitting}
                className="bg-white border-2 border-gray-200 px-4 py-2.5 rounded-xl text-xl font-bold text-gray-700 hover:border-violet-400 hover:bg-violet-50 hover:scale-105 active:scale-95 transition-all shadow-sm"
                style={{ fontFamily: 'serif', minWidth: buildType === 'sentence' ? '60px' : '44px' }}
              >
                {tile}
              </button>
            );
          })}
        </div>

        {placed.length > 0 && (
          <button onClick={() => setWordBuildPlaced([])}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors font-medium mx-auto block">
            🔄 إعادة تعيين
          </button>
        )}
      </div>
    );
  }

  // ═══ موضع الحرف ═══
  if (type === 'letter_pos') {
    const options = data.options || [];
    const letter = data.letter || '';
    const wordBlank = data.word_with_blank || '';

    return (
      <div className="space-y-5 animate-fade-slide-up" style={{ opacity: 0, animationFillMode: 'forwards' }}>
        {/* عرض الحرف والكلمة */}
        <div className="text-center space-y-2">
          <p className="text-lg text-gray-600 font-medium">اختر شكل حرف <span className="text-rose-600 text-2xl font-bold mx-1" style={{ fontFamily: 'serif' }}>({letter})</span> في:</p>
          <p className="text-4xl font-bold text-gray-800" style={{ fontFamily: 'serif' }} dir="rtl">{wordBlank}</p>
        </div>

        {/* الخيارات الأربعة */}
        <div className="grid grid-cols-2 gap-3">
          {options.map((form, idx) => {
            const colors = [
              { border: '#1CB0F6', bg: '#E8F8FF', hoverBorder: '#0A8FD0' },
              { border: '#9B59B6', bg: '#F5EEF8', hoverBorder: '#7D3C98' },
              { border: '#FF9600', bg: '#FFF8E7', hoverBorder: '#E08600' },
              { border: '#58CC02', bg: '#F0FAE8', hoverBorder: '#4CAF00' },
            ];
            const c = colors[idx % 4];
            return (
              <button
                key={idx}
                onClick={() => onSubmit(form)}
                disabled={submitting}
                style={{ background: c.bg, borderColor: c.border, animationDelay: `${idx * 100}ms`, opacity: 0, animationFillMode: 'forwards' }}
                className={`py-6 rounded-2xl text-center transition-all border-2 animate-fade-slide-up hover:scale-[1.03] active:scale-[0.97] hover:shadow-lg ${submitting ? 'opacity-50 pointer-events-none' : ''}`}
                onMouseEnter={e => e.currentTarget.style.borderColor = c.hoverBorder}
                onMouseLeave={e => e.currentTarget.style.borderColor = c.border}
              >
                <span className="text-4xl font-bold block" style={{ fontFamily: 'serif' }}>{form}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ═══ إدخال رقمي — لوحة أرقام مخصصة ═══
  if (type === 'numeric_input') {
    const hint = data.hint || '';
    const numVal = fillAnswer || '';

    const handleNumPad = (key) => {
      if (key === 'backspace') {
        setFillAnswer(numVal.slice(0, -1));
      } else if (key === '.' && numVal.includes('.')) {
        return; // نقطة واحدة فقط
      } else if (key === '-') {
        if (numVal.startsWith('-')) setFillAnswer(numVal.slice(1));
        else setFillAnswer('-' + numVal);
      } else {
        setFillAnswer(numVal + key);
      }
    };

    const numKeys = ['1','2','3','4','5','6','7','8','9','.','0','backspace'];
    const keyColors = ['#1CB0F6','#58CC02','#FF9600','#9B59B6','#1CB0F6','#58CC02','#FF9600','#9B59B6','#1CB0F6','#78909C','#58CC02','#EF5350'];

    return (
      <div className="space-y-4 animate-fade-slide-up" style={{ opacity: 0, animationFillMode: 'forwards' }}>
        {hint && <div className="text-center text-3xl mb-1">{hint}</div>}

        {/* حقل عرض الرقم */}
        <div className="mx-auto max-w-xs">
          <div
            className="text-center py-4 px-6 rounded-2xl border-3 text-4xl font-bold min-h-[64px] flex items-center justify-center transition-all"
            style={{
              background: numVal ? '#E8F8FF' : '#F8F9FA',
              borderColor: numVal ? '#1CB0F6' : '#E0E0E0',
              borderWidth: '3px',
              borderStyle: 'solid',
              color: numVal ? '#1A73E8' : '#BDBDBD',
              direction: 'ltr',
            }}
          >
            {numVal || '?'}
          </div>
        </div>

        {/* لوحة الأرقام */}
        <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
          {numKeys.map((key, idx) => (
            <button
              key={key}
              onClick={() => handleNumPad(key)}
              disabled={submitting}
              className="py-4 rounded-2xl text-2xl font-bold transition-all hover:scale-105 active:scale-95 select-none"
              style={{
                background: key === 'backspace' ? '#FFEBEE' : `${keyColors[idx]}15`,
                color: key === 'backspace' ? '#EF5350' : keyColors[idx],
                border: `2px solid ${key === 'backspace' ? '#FFCDD2' : keyColors[idx]}30`,
              }}
            >
              {key === 'backspace' ? '⌫' : key}
            </button>
          ))}
        </div>

        {/* زر إرسال */}
        <button
          onClick={() => numVal.trim() && onSubmit(numVal.trim())}
          disabled={submitting || !numVal.trim()}
          className="w-full max-w-xs mx-auto block py-3.5 rounded-2xl text-white text-lg font-bold transition-all hover:shadow-lg active:scale-[0.97] disabled:opacity-40"
          style={{ background: numVal.trim() ? '#58CC02' : '#BDBDBD' }}
        >
          {submitting ? '⏳' : '✓'} تأكيد
        </button>
      </div>
    );
  }

  // ═══ إدخال نصي ═══
  if (type === 'text_input') {
    const hint = data.hint || '';

    return (
      <div className="space-y-5 animate-fade-slide-up" style={{ opacity: 0, animationFillMode: 'forwards' }}>
        {hint && <div className="text-center text-3xl mb-1">{hint}</div>}

        {/* حقل الإدخال */}
        <div className="mx-auto max-w-sm">
          <input
            type="text"
            value={fillAnswer}
            onChange={e => setFillAnswer(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && fillAnswer.trim()) onSubmit(fillAnswer.trim()); }}
            placeholder="اكتب إجابتك هنا..."
            disabled={submitting}
            autoFocus
            className="w-full text-center text-2xl font-bold py-4 px-6 rounded-2xl border-3 outline-none transition-all"
            style={{
              background: fillAnswer ? '#E8F8FF' : '#F8F9FA',
              borderColor: fillAnswer ? '#1CB0F6' : '#E0E0E0',
              borderWidth: '3px',
              borderStyle: 'solid',
              color: '#1A73E8',
            }}
            dir="rtl"
          />
        </div>

        {/* زر إرسال */}
        <button
          onClick={() => fillAnswer.trim() && onSubmit(fillAnswer.trim())}
          disabled={submitting || !fillAnswer.trim()}
          className="w-full max-w-sm mx-auto block py-3.5 rounded-2xl text-white text-lg font-bold transition-all hover:shadow-lg active:scale-[0.97] disabled:opacity-40"
          style={{ background: fillAnswer.trim() ? '#58CC02' : '#BDBDBD' }}
        >
          {submitting ? '⏳' : '✓'} تأكيد
        </button>
      </div>
    );
  }

  // ═══ نوع غير معروف ═══
  return (
    <div className="text-center py-8 text-gray-400">
      <span className="text-4xl block mb-2">🤔</span>
      <p className="font-medium">نوع السؤال غير مدعوم حالياً</p>
    </div>
  );
}
