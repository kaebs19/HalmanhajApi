import { useState } from 'react';

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
    default: return JSON.stringify(answer);
  }
}

// ═══ مكون خيارات السؤال ═══
export default function QuestionOptions({
  type, question, selectedOption, setSelectedOption,
  fillAnswer, setFillAnswer, matchingPairs, setMatchingPairs,
  matchLeft, setMatchLeft, orderingItems, setOrderingItems,
  classifyGroups, setClassifyGroups, onSubmit, submitting
}) {
  const [selectedItem, setSelectedItemLocal] = useState(null);
  const data = question.question_data || {};

  // ═══ صح وخطأ ═══
  if (type === 'true_false') {
    return (
      <div className="grid grid-cols-2 gap-4">
        {[{ val: true, label: '✅ صح', color: 'green' }, { val: false, label: '❌ خطأ', color: 'red' }].map(opt => (
          <button
            key={String(opt.val)}
            onClick={() => onSubmit(opt.val)}
            disabled={submitting}
            className={`py-6 rounded-2xl text-xl font-bold transition-all border-2 ${
              opt.color === 'green'
                ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100 hover:border-green-400'
                : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-400'
            } ${submitting ? 'opacity-50' : ''}`}
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {options.map((opt, idx) => (
          <button
            key={idx}
            onClick={() => onSubmit(idx)}
            disabled={submitting}
            className={`p-4 rounded-xl text-right font-medium transition-all border-2 ${
              submitting ? 'opacity-50' : 'hover:border-blue-400 hover:bg-blue-50'
            } border-gray-200 bg-white text-gray-800`}
          >
            <span className="inline-flex w-7 h-7 items-center justify-center bg-blue-100 text-blue-700 rounded-lg text-xs font-bold ml-2">
              {letters[idx]}
            </span>
            {opt}
          </button>
        ))}
      </div>
    );
  }

  // ═══ أكمل الفراغ / اقرأ وأجب ═══
  if (type === 'fill_blank' || type === 'read_answer') {
    return (
      <div className="space-y-3">
        {type === 'read_answer' && data.passage && (
          <div className="bg-blue-50 rounded-xl p-4 text-sm text-gray-700 leading-relaxed mb-4 max-h-40 overflow-y-auto">
            {data.passage}
          </div>
        )}
        <input
          type="text"
          value={fillAnswer}
          onChange={e => setFillAnswer(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && fillAnswer.trim() && onSubmit(fillAnswer.trim())}
          placeholder="اكتب إجابتك هنا..."
          className="w-full bg-white border-2 border-gray-200 rounded-xl px-5 py-4 text-lg text-center focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
          autoFocus
          dir="rtl"
        />
        <button
          onClick={() => fillAnswer.trim() && onSubmit(fillAnswer.trim())}
          disabled={!fillAnswer.trim() || submitting}
          className={`w-full py-3 rounded-xl text-sm font-bold transition-colors ${
            fillAnswer.trim() ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400'
          }`}
        >
          تأكيد
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
      <div className="space-y-4">
        <p className="text-xs text-gray-500 text-center">اضغط على عنصر من اليمين ثم العنصر المطابق من اليسار</p>
        <div className="grid grid-cols-2 gap-4">
          {/* العمود الأيمن */}
          <div className="space-y-2">
            {leftItems.map((item, i) => (
              <button
                key={i}
                onClick={() => !matched.includes(item) && setMatchLeft(item)}
                disabled={matched.includes(item)}
                className={`w-full p-3 rounded-xl text-sm font-medium transition-all border-2 text-right ${
                  matched.includes(item) ? 'bg-green-50 border-green-300 text-green-700' :
                  matchLeft === item ? 'bg-blue-50 border-blue-400 text-blue-700' :
                  'bg-white border-gray-200 hover:border-blue-300'
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
                className={`w-full p-3 rounded-xl text-sm font-medium transition-all border-2 text-right ${
                  matchedRight.includes(item) ? 'bg-green-50 border-green-300 text-green-700' :
                  'bg-white border-gray-200 hover:border-blue-300'
                } ${!matchLeft ? 'opacity-60' : ''}`}
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
      <div className="space-y-4">
        <p className="text-xs text-gray-500 text-center">اضغط على العناصر بالترتيب الصحيح</p>

        {/* العناصر المرتبة */}
        {orderingItems.length > 0 && (
          <div className="flex flex-wrap gap-2 p-3 bg-blue-50 rounded-xl min-h-[48px]">
            {orderingItems.map((item, i) => (
              <span key={i} className="inline-flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium">
                <span className="w-5 h-5 bg-blue-500 rounded-full text-[10px] flex items-center justify-center">{i + 1}</span>
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
              className="bg-white border-2 border-gray-200 px-4 py-2 rounded-xl text-sm font-medium hover:border-blue-400 hover:bg-blue-50 transition-all"
            >
              {item}
            </button>
          ))}
        </div>

        {orderingItems.length > 0 && (
          <button
            onClick={() => setOrderingItems([])}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            إعادة تعيين
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
      <div className="space-y-4">
        <p className="text-xs text-gray-500 text-center">اختر عنصر ثم اضغط على الفئة المناسبة</p>

        {/* العناصر المتبقية */}
        <div className="flex flex-wrap gap-2 justify-center">
          {remaining.map((item, i) => (
            <button
              key={i}
              onClick={() => setSelectedItemLocal(selectedItem === item ? null : item)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border-2 ${
                selectedItem === item ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-gray-200 hover:border-blue-300'
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
                className={`p-4 rounded-xl border-2 text-right transition-all min-h-[80px] ${
                  selectedItem ? 'border-blue-300 hover:bg-blue-50' : 'border-gray-200'
                }`}
              >
                <p className="text-sm font-bold text-gray-700 mb-2">{catName}</p>
                <div className="flex flex-wrap gap-1">
                  {catItems.map((it, j) => (
                    <span key={j} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{it}</span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ═══ نوع غير معروف ═══
  return (
    <div className="text-center py-8 text-gray-500">
      <p>نوع السؤال غير مدعوم حالياً</p>
    </div>
  );
}
