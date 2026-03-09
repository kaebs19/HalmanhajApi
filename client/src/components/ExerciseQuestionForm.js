import { Input, Textarea } from './ui';

// ===================================
// Exercise Type Constants
// ===================================
const EXERCISE_TYPES = [
  { value: 'true_false',   label: 'صح أم خطأ',      icon: '✓✗' },
  { value: 'mcq',          label: 'اختيار من متعدد',  icon: '🔘' },
  { value: 'fill_blank',   label: 'أكمل الفراغ',     icon: '✏️' },
  { value: 'matching',     label: 'صل العمودين',     icon: '🔗' },
  { value: 'ordering',     label: 'رتّب الترتيب',    icon: '📋' },
  { value: 'classify',     label: 'صنّف العناصر',    icon: '📂' },
  { value: 'speed',        label: 'تمرين الزمن',     icon: '⏱️' },
  { value: 'read_answer',  label: 'اقرأ ثم أجب',     icon: '📖' },
  { value: 'image_match',  label: 'صل الصورة',       icon: '🖼️' },
  { value: 'word_build',  label: 'تركيب كلمة/جملة', icon: '🔤' },
  { value: 'letter_pos',  label: 'موضع الحرف',      icon: '🔠' },
];

const TYPE_LABEL = Object.fromEntries(EXERCISE_TYPES.map(t => [t.value, t.label]));
const TYPE_ICON = Object.fromEntries(EXERCISE_TYPES.map(t => [t.value, t.icon]));

const TYPE_COLORS = {
  true_false:  'bg-emerald-50 text-emerald-700',
  mcq:         'bg-blue-50 text-blue-700',
  fill_blank:  'bg-amber-50 text-amber-700',
  matching:    'bg-teal-50 text-teal-700',
  ordering:    'bg-orange-50 text-orange-700',
  classify:    'bg-violet-50 text-violet-700',
  speed:       'bg-red-50 text-red-700',
  read_answer: 'bg-indigo-50 text-indigo-700',
  image_match: 'bg-pink-50 text-pink-700',
  word_build:  'bg-violet-50 text-violet-700',
  letter_pos:  'bg-rose-50 text-rose-700',
};

const DIFFICULTY_OPTIONS = [
  { value: 'easy',   label: 'سهل',    color: 'bg-green-50 text-green-700 border-green-200' },
  { value: 'medium', label: 'متوسط',  color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  { value: 'hard',   label: 'صعب',    color: 'bg-red-50 text-red-700 border-red-200' },
];

const DIFF_LABEL = Object.fromEntries(DIFFICULTY_OPTIONS.map(d => [d.value, d.label]));
const DIFF_COLORS = Object.fromEntries(DIFFICULTY_OPTIONS.map(d => [d.value, d.color]));

// ===================================
// Build question payload from form data
// ===================================
function buildQuestionPayload(exerciseType, formData) {
  const base = { question_text: formData.question_text || '' };

  switch (exerciseType) {
    case 'true_false':
      return {
        ...base,
        question_data: {},
        correct_answer: { value: formData.correctValue === true || formData.correctValue === 'true' }
      };

    case 'mcq':
    case 'speed':
      return {
        ...base,
        question_data: { options: (formData.options || []).map(o => o.text) },
        correct_answer: { index: (formData.options || []).findIndex(o => o.is_correct) }
      };

    case 'fill_blank':
    case 'read_answer':
      return {
        ...base,
        question_data: formData.passage ? { passage: formData.passage } : {},
        correct_answer: { values: [formData.answerText || ''] }
      };

    case 'matching':
    case 'image_match':
      return {
        ...base,
        question_data: {},
        correct_answer: { pairs: (formData.pairs || []).map(p => ({ ...p })) }
      };

    case 'ordering':
      return {
        ...base,
        question_data: {},
        correct_answer: { items: [...(formData.items || [])] }
      };

    case 'classify':
      return {
        ...base,
        question_data: { categories: [...(formData.categories || [])] },
        correct_answer: { groups: { ...(formData.groups || {}) } }
      };

    case 'word_build':
      return {
        ...base,
        question_data: {
          build_type: formData.buildType || 'word',
          tiles: (formData.tiles || '').split(/[,،]/).map(t => t.trim()).filter(Boolean),
          hint: formData.hint || '',
          display_hint: !!formData.hint
        },
        correct_answer: { answer: formData.correctAnswer || '' }
      };

    case 'letter_pos':
      return {
        ...base,
        question_data: {
          letter: formData.letter || '',
          word: formData.word || '',
          word_with_blank: formData.wordWithBlank || '',
          options: formData.options || []
        },
        correct_answer: {
          position: formData.position || 'initial',
          form: formData.correctForm || ''
        }
      };

    case 'numeric_input':
      return {
        ...base,
        question_data: { hint: formData.hint || '' },
        correct_answer: { value: String(formData.correctValue || '').trim() }
      };

    case 'text_input': {
      const variants = (formData.variants || '').split(/[,،]/).map(v => v.trim()).filter(Boolean);
      return {
        ...base,
        question_data: { hint: formData.hint || '' },
        correct_answer: { value: (formData.correctValue || '').trim(), variants }
      };
    }

    default:
      return { ...base, question_data: {}, correct_answer: {} };
  }
}

// ===================================
// Convert saved question to form data
// ===================================
function questionToFormData(exerciseType, question) {
  const base = { question_text: question.question_text || '' };
  const qd = question.question_data || {};
  const ca = question.correct_answer || {};

  switch (exerciseType) {
    case 'true_false':
      return { ...base, correctValue: ca.value === true };

    case 'mcq':
    case 'speed': {
      const opts = (qd.options || ['', '', '', '']).map((text, i) => ({
        text,
        is_correct: i === (ca.index ?? 0)
      }));
      return { ...base, options: opts };
    }

    case 'fill_blank':
      return { ...base, answerText: (ca.values || [''])[0] || '' };

    case 'read_answer':
      return { ...base, passage: qd.passage || '', answerText: (ca.values || [''])[0] || '' };

    case 'matching':
      return { ...base, pairs: (ca.pairs || [{ left: '', right: '' }, { left: '', right: '' }]).map(p => ({ ...p })) };

    case 'image_match':
      return { ...base, pairs: (ca.pairs || [{ imageUrl: '', label: '' }, { imageUrl: '', label: '' }]).map(p => ({ ...p })) };

    case 'ordering':
      return { ...base, items: [...(ca.items || ['', '', ''])] };

    case 'classify': {
      const categories = [...(qd.categories || ['', ''])];
      const groups = {};
      categories.forEach(cat => {
        groups[cat] = [...((ca.groups || {})[cat] || [])];
      });
      return { ...base, categories, groups, newItems: {} };
    }

    case 'word_build':
      return {
        ...base,
        buildType: qd.build_type || 'word',
        tiles: (qd.tiles || []).join('، '),
        hint: qd.hint || '',
        correctAnswer: ca.answer || ''
      };

    case 'letter_pos':
      return {
        ...base,
        letter: qd.letter || '',
        word: qd.word || '',
        wordWithBlank: qd.word_with_blank || '',
        options: qd.options || [],
        position: ca.position || '',
        correctForm: ca.form || ''
      };

    case 'numeric_input':
      return { ...base, correctValue: ca.value || '', hint: qd.hint || '' };

    case 'text_input':
      return { ...base, correctValue: ca.value || '', variants: (ca.variants || []).join('، '), hint: qd.hint || '' };

    default:
      return base;
  }
}

// ===================================
// Empty form data by exercise type
// ===================================
function getEmptyFormData(exerciseType) {
  switch (exerciseType) {
    case 'true_false':
      return { question_text: '', correctValue: true };
    case 'mcq':
    case 'speed':
      return {
        question_text: '',
        options: [
          { text: '', is_correct: true },
          { text: '', is_correct: false },
          { text: '', is_correct: false },
          { text: '', is_correct: false },
        ]
      };
    case 'fill_blank':
      return { question_text: '', answerText: '' };
    case 'read_answer':
      return { question_text: '', passage: '', answerText: '' };
    case 'matching':
      return { question_text: '', pairs: [{ left: '', right: '' }, { left: '', right: '' }] };
    case 'image_match':
      return { question_text: '', pairs: [{ imageUrl: '', label: '' }, { imageUrl: '', label: '' }] };
    case 'ordering':
      return { question_text: '', items: ['', '', ''] };
    case 'classify':
      return { question_text: '', categories: ['', ''], groups: {}, newItems: {} };
    case 'word_build':
      return { question_text: '', buildType: 'word', tiles: '', hint: '', correctAnswer: '' };
    case 'letter_pos':
      return { question_text: '', letter: '', word: '', wordWithBlank: '', options: [], position: '', correctForm: '' };
    case 'numeric_input':
      return { question_text: '', correctValue: '', hint: '' };
    case 'text_input':
      return { question_text: '', correctValue: '', variants: '', hint: '' };
    default:
      return { question_text: '' };
  }
}

// ===================================
// Question Form Component
// ===================================
function ExerciseQuestionForm({ exerciseType, data, onChange }) {
  const setField = (field, value) => onChange(prev => ({ ...prev, [field]: value }));

  // === MCQ helpers ===
  const updateOption = (idx, field, value) => {
    const newOptions = [...(data.options || [])];
    if (field === 'is_correct' && value === true) {
      newOptions.forEach((o, i) => { o.is_correct = i === idx; });
    } else {
      newOptions[idx] = { ...newOptions[idx], [field]: value };
    }
    onChange(prev => ({ ...prev, options: newOptions }));
  };
  const addOption = () => {
    if ((data.options || []).length >= 6) return;
    onChange(prev => ({ ...prev, options: [...(prev.options || []), { text: '', is_correct: false }] }));
  };
  const removeOption = (idx) => {
    if ((data.options || []).length <= 2) return;
    const newOptions = (data.options || []).filter((_, i) => i !== idx);
    if (!newOptions.some(o => o.is_correct)) newOptions[0].is_correct = true;
    onChange(prev => ({ ...prev, options: newOptions }));
  };

  // === Matching / Image Match helpers ===
  const updatePair = (idx, field, value) => {
    const pairs = [...(data.pairs || [])];
    pairs[idx] = { ...pairs[idx], [field]: value };
    onChange(prev => ({ ...prev, pairs }));
  };
  const addPair = () => {
    if ((data.pairs || []).length >= 8) return;
    const emptyPair = exerciseType === 'image_match' ? { imageUrl: '', label: '' } : { left: '', right: '' };
    onChange(prev => ({ ...prev, pairs: [...(prev.pairs || []), emptyPair] }));
  };
  const removePair = (idx) => {
    if ((data.pairs || []).length <= 2) return;
    onChange(prev => ({ ...prev, pairs: (prev.pairs || []).filter((_, i) => i !== idx) }));
  };

  // === Ordering helpers ===
  const updateItem = (idx, value) => {
    const items = [...(data.items || [])];
    items[idx] = value;
    onChange(prev => ({ ...prev, items }));
  };
  const addItem = () => {
    if ((data.items || []).length >= 8) return;
    onChange(prev => ({ ...prev, items: [...(prev.items || []), ''] }));
  };
  const removeItem = (idx) => {
    if ((data.items || []).length <= 2) return;
    onChange(prev => ({ ...prev, items: (prev.items || []).filter((_, i) => i !== idx) }));
  };

  // === Classify helpers ===
  const addCategory = () => {
    if ((data.categories || []).length >= 6) return;
    onChange(prev => ({ ...prev, categories: [...(prev.categories || []), ''] }));
  };
  const updateCategory = (idx, value) => {
    const cats = [...(data.categories || [])];
    const oldName = cats[idx];
    cats[idx] = value;
    const groups = { ...(data.groups || {}) };
    if (oldName && groups[oldName]) {
      groups[value] = groups[oldName];
      delete groups[oldName];
    }
    onChange(prev => ({ ...prev, categories: cats, groups }));
  };
  const removeCategory = (idx) => {
    if ((data.categories || []).length <= 2) return;
    const cats = [...(data.categories || [])];
    const removed = cats[idx];
    cats.splice(idx, 1);
    const groups = { ...(data.groups || {}) };
    delete groups[removed];
    onChange(prev => ({ ...prev, categories: cats, groups }));
  };
  const addItemToCategory = (cat) => {
    const groups = { ...(data.groups || {}) };
    groups[cat] = [...(groups[cat] || []), data.newItems?.[cat] || ''];
    const newItems = { ...(data.newItems || {}), [cat]: '' };
    onChange(prev => ({ ...prev, groups, newItems }));
  };
  const removeItemFromCategory = (cat, itemIdx) => {
    const groups = { ...(data.groups || {}) };
    groups[cat] = (groups[cat] || []).filter((_, i) => i !== itemIdx);
    onChange(prev => ({ ...prev, groups }));
  };
  const setNewItemText = (cat, value) => {
    onChange(prev => ({ ...prev, newItems: { ...(prev.newItems || {}), [cat]: value } }));
  };

  // === X button SVG ===
  const XButton = ({ onClick }) => (
    <button type="button" onClick={onClick} className="p-1 text-gray-300 hover:text-red-500 transition-colors">
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Question Text */}
      <div>
        <span className="text-xs font-medium text-gray-500 mb-1.5 block">نص السؤال</span>
        <Textarea
          value={data.question_text || ''}
          onChange={e => setField('question_text', e.target.value)}
          placeholder="اكتب نص السؤال هنا..."
          rows={2}
        />
      </div>

      {/* True/False */}
      {exerciseType === 'true_false' && (
        <div>
          <span className="text-xs font-medium text-gray-500 mb-2 block">الإجابة الصحيحة</span>
          <div className="flex gap-3">
            {[{ val: true, label: 'صح' }, { val: false, label: 'خطأ' }].map(opt => (
              <label key={String(opt.val)} className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                data.correctValue === opt.val ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 bg-gray-50'
              }`}>
                <input
                  type="radio"
                  name="tf-correct"
                  checked={data.correctValue === opt.val}
                  onChange={() => setField('correctValue', opt.val)}
                  className="w-4 h-4 text-emerald-600"
                />
                <span className={`text-sm font-medium ${data.correctValue === opt.val ? 'text-emerald-700' : 'text-gray-600'}`}>
                  {opt.label}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* MCQ / Speed */}
      {(exerciseType === 'mcq' || exerciseType === 'speed') && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">الخيارات (اختر الإجابة الصحيحة)</span>
            {(data.options || []).length < 6 && (
              <button type="button" onClick={addOption} className="text-xs text-blue-600 hover:text-blue-800">+ خيار</button>
            )}
          </div>
          {(data.options || []).map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="radio"
                name="correct-option"
                checked={opt.is_correct}
                onChange={() => updateOption(i, 'is_correct', true)}
                className="w-4 h-4 text-emerald-600"
              />
              <Input
                value={opt.text || ''}
                onChange={e => updateOption(i, 'text', e.target.value)}
                placeholder={`الخيار ${i + 1}`}
                className="flex-1"
              />
              {(data.options || []).length > 2 && <XButton onClick={() => removeOption(i)} />}
            </div>
          ))}
        </div>
      )}

      {/* Fill Blank */}
      {exerciseType === 'fill_blank' && (
        <div>
          <p className="text-xs text-gray-400 mb-2">اكتب الجملة في نص السؤال واستخدم ___ مكان الفراغ</p>
          <span className="text-xs font-medium text-gray-500 mb-1.5 block">الإجابة الصحيحة</span>
          <Input
            value={data.answerText || ''}
            onChange={e => setField('answerText', e.target.value)}
            placeholder="الإجابة الصحيحة"
          />
        </div>
      )}

      {/* Read Answer */}
      {exerciseType === 'read_answer' && (
        <div className="space-y-3">
          <div>
            <span className="text-xs font-medium text-gray-500 mb-1.5 block">نص القراءة</span>
            <Textarea
              value={data.passage || ''}
              onChange={e => setField('passage', e.target.value)}
              placeholder="اكتب نص القراءة هنا..."
              rows={4}
            />
          </div>
          <div>
            <span className="text-xs font-medium text-gray-500 mb-1.5 block">الإجابة الصحيحة</span>
            <Input
              value={data.answerText || ''}
              onChange={e => setField('answerText', e.target.value)}
              placeholder="الإجابة الصحيحة"
            />
          </div>
        </div>
      )}

      {/* Matching */}
      {exerciseType === 'matching' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">الأزواج (يسار ← يمين)</span>
            {(data.pairs || []).length < 8 && (
              <button type="button" onClick={addPair} className="text-xs text-teal-600 hover:text-teal-800">+ زوج</button>
            )}
          </div>
          {(data.pairs || []).map((pair, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={pair.left || ''}
                onChange={e => updatePair(i, 'left', e.target.value)}
                placeholder={`المصطلح ${i + 1}`}
                className="flex-1"
              />
              <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
              <Input
                value={pair.right || ''}
                onChange={e => updatePair(i, 'right', e.target.value)}
                placeholder={`التعريف ${i + 1}`}
                className="flex-1"
              />
              {(data.pairs || []).length > 2 && <XButton onClick={() => removePair(i)} />}
            </div>
          ))}
        </div>
      )}

      {/* Image Match */}
      {exerciseType === 'image_match' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">الأزواج (رابط الصورة + التسمية)</span>
            {(data.pairs || []).length < 8 && (
              <button type="button" onClick={addPair} className="text-xs text-pink-600 hover:text-pink-800">+ زوج</button>
            )}
          </div>
          {(data.pairs || []).map((pair, i) => (
            <div key={i} className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Input
                    value={pair.imageUrl || ''}
                    onChange={e => updatePair(i, 'imageUrl', e.target.value)}
                    placeholder={`رابط الصورة ${i + 1}`}
                  />
                  {pair.imageUrl && (
                    <img src={pair.imageUrl} alt="preview" className="w-16 h-16 object-cover rounded mt-1" />
                  )}
                </div>
                <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
                <Input
                  value={pair.label || ''}
                  onChange={e => updatePair(i, 'label', e.target.value)}
                  placeholder={`التسمية ${i + 1}`}
                  className="flex-1"
                />
                {(data.pairs || []).length > 2 && <XButton onClick={() => removePair(i)} />}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ordering */}
      {exerciseType === 'ordering' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">العناصر بالترتيب الصحيح</span>
            {(data.items || []).length < 8 && (
              <button type="button" onClick={addItem} className="text-xs text-orange-600 hover:text-orange-800">+ عنصر</button>
            )}
          </div>
          <p className="text-[10px] text-gray-400">ادخل العناصر بالترتيب الصحيح، سيتم خلطها للطالب تلقائياً</p>
          {(data.items || []).map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-400 w-5 text-center">{i + 1}</span>
              <Input
                value={item}
                onChange={e => updateItem(i, e.target.value)}
                placeholder={`العنصر ${i + 1}`}
                className="flex-1"
              />
              {(data.items || []).length > 2 && <XButton onClick={() => removeItem(i)} />}
            </div>
          ))}
        </div>
      )}

      {/* Word Build */}
      {exerciseType === 'word_build' && (
        <div className="space-y-3">
          <div>
            <span className="text-xs font-medium text-gray-500 mb-2 block">نوع التركيب</span>
            <div className="flex gap-3">
              {[{ val: 'word', label: 'كلمة' }, { val: 'sentence', label: 'جملة' }].map(opt => (
                <label key={opt.val} className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                  data.buildType === opt.val ? 'border-violet-300 bg-violet-50' : 'border-gray-200 bg-gray-50'
                }`}>
                  <input type="radio" name="build-type" checked={data.buildType === opt.val}
                    onChange={() => setField('buildType', opt.val)} className="w-4 h-4 text-violet-600" />
                  <span className={`text-sm font-medium ${data.buildType === opt.val ? 'text-violet-700' : 'text-gray-600'}`}>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <span className="text-xs font-medium text-gray-500 mb-1.5 block">
              {data.buildType === 'sentence' ? 'الكلمات (مفصولة بفاصلة)' : 'الحروف/المقاطع (مفصولة بفاصلة)'}
            </span>
            <Input value={data.tiles || ''} onChange={e => setField('tiles', e.target.value)}
              placeholder={data.buildType === 'sentence' ? 'يَلعَبُ، الوَلَدُ، بِالكُرَةِ' : 'ب، ي، ت'} dir="rtl" />
          </div>
          <div>
            <span className="text-xs font-medium text-gray-500 mb-1.5 block">تلميح (اختياري)</span>
            <Input value={data.hint || ''} onChange={e => setField('hint', e.target.value)} placeholder="🏠 أو نص تلميح" />
          </div>
          <div>
            <span className="text-xs font-medium text-gray-500 mb-1.5 block">الإجابة الصحيحة</span>
            <Input value={data.correctAnswer || ''} onChange={e => setField('correctAnswer', e.target.value)}
              placeholder={data.buildType === 'sentence' ? 'الوَلَدُ يَلعَبُ بِالكُرَةِ' : 'بَيت'} dir="rtl" />
          </div>
        </div>
      )}

      {/* Letter Position */}
      {exerciseType === 'letter_pos' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-xs font-medium text-gray-500 mb-1.5 block">الحرف المستهدف</span>
              <Input value={data.letter || ''} onChange={e => setField('letter', e.target.value)}
                placeholder="ض" className="text-center text-2xl" dir="rtl" />
            </div>
            <div>
              <span className="text-xs font-medium text-gray-500 mb-1.5 block">الكلمة</span>
              <Input value={data.word || ''} onChange={e => setField('word', e.target.value)}
                placeholder="نَهَض" className="text-center text-lg" dir="rtl" />
            </div>
          </div>
          <div>
            <span className="text-xs font-medium text-gray-500 mb-2 block">موضع الحرف</span>
            <div className="grid grid-cols-4 gap-2">
              {[
                { val: 'initial', label: 'أول', example: 'ضـ' },
                { val: 'middle', label: 'وسط', example: 'ـضـ' },
                { val: 'final', label: 'آخر', example: 'ـض' },
                { val: 'standalone', label: 'منفرد', example: 'ض' },
              ].map(pos => (
                <button key={pos.val} type="button"
                  onClick={() => {
                    const letter = data.letter || 'ض';
                    const FORMS = { initial: letter + 'ـ', middle: 'ـ' + letter + 'ـ', final: 'ـ' + letter, standalone: letter };
                    const options = [letter + 'ـ', 'ـ' + letter + 'ـ', 'ـ' + letter, letter];
                    const wordWithBlank = (data.word || '').replace(new RegExp(letter), '___');
                    onChange(prev => ({ ...prev, position: pos.val, correctForm: FORMS[pos.val], options, wordWithBlank }));
                  }}
                  className={`p-2 rounded-xl border-2 text-center transition-colors ${
                    data.position === pos.val ? 'border-rose-300 bg-rose-50' : 'border-gray-200 bg-gray-50'
                  }`}>
                  <span className="block text-xl font-bold" style={{ fontFamily: 'serif' }}>{pos.example}</span>
                  <span className="text-[10px] text-gray-500">{pos.label}</span>
                </button>
              ))}
            </div>
          </div>
          {data.position && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <p className="text-gray-500">الكلمة مع فراغ: <span className="font-bold text-gray-800">{data.wordWithBlank || '---'}</span></p>
              <p className="text-gray-500">الشكل الصحيح: <span className="font-bold text-rose-600 text-lg">{data.correctForm}</span></p>
            </div>
          )}
        </div>
      )}

      {/* Numeric Input */}
      {exerciseType === 'numeric_input' && (
        <div className="space-y-3">
          <div>
            <span className="text-xs font-medium text-gray-500 mb-1.5 block">الإجابة الرقمية الصحيحة</span>
            <Input
              type="number"
              value={data.correctValue || ''}
              onChange={e => setField('correctValue', e.target.value)}
              placeholder="مثال: 5"
              className="text-center text-lg"
              dir="ltr"
              step="any"
            />
          </div>
          <div>
            <span className="text-xs font-medium text-gray-500 mb-1.5 block">تلميح (اختياري — إيموجي)</span>
            <Input
              value={data.hint || ''}
              onChange={e => setField('hint', e.target.value)}
              placeholder="🌳"
              className="text-center text-2xl"
            />
          </div>
        </div>
      )}

      {/* Text Input */}
      {exerciseType === 'text_input' && (
        <div className="space-y-3">
          <div>
            <span className="text-xs font-medium text-gray-500 mb-1.5 block">الإجابة الصحيحة</span>
            <Input
              value={data.correctValue || ''}
              onChange={e => setField('correctValue', e.target.value)}
              placeholder="الإجابة"
              dir="rtl"
            />
          </div>
          <div>
            <span className="text-xs font-medium text-gray-500 mb-1.5 block">بدائل مقبولة (مفصولة بفاصلة)</span>
            <Input
              value={data.variants || ''}
              onChange={e => setField('variants', e.target.value)}
              placeholder="بديل1، بديل2"
              dir="rtl"
            />
            <p className="text-[10px] text-gray-400 mt-1">إجابات أخرى تُعتبر صحيحة (اختياري)</p>
          </div>
          <div>
            <span className="text-xs font-medium text-gray-500 mb-1.5 block">تلميح (اختياري)</span>
            <Input
              value={data.hint || ''}
              onChange={e => setField('hint', e.target.value)}
              placeholder="💡 تلميح أو إيموجي"
              className="text-center"
            />
          </div>
        </div>
      )}

      {/* Classify */}
      {exerciseType === 'classify' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">الفئات</span>
              {(data.categories || []).length < 6 && (
                <button type="button" onClick={addCategory} className="text-xs text-violet-600 hover:text-violet-800">+ فئة</button>
              )}
            </div>
            {(data.categories || []).map((cat, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs font-bold text-violet-400 w-5 text-center">{i + 1}</span>
                <Input
                  value={cat}
                  onChange={e => updateCategory(i, e.target.value)}
                  placeholder={`اسم الفئة ${i + 1}`}
                  className="flex-1"
                />
                {(data.categories || []).length > 2 && <XButton onClick={() => removeCategory(i)} />}
              </div>
            ))}
          </div>

          {(data.categories || []).filter(c => c.trim()).map((cat) => (
            <div key={cat} className="bg-gray-50 rounded-lg p-3">
              <span className="text-xs font-semibold text-violet-700 mb-2 block">عناصر: {cat}</span>
              <div className="space-y-1.5">
                {((data.groups || {})[cat] || []).map((item, itemIdx) => (
                  <div key={itemIdx} className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400 w-4">•</span>
                    <span className="text-sm text-gray-700 flex-1">{item}</span>
                    <XButton onClick={() => removeItemFromCategory(cat, itemIdx)} />
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Input
                  value={(data.newItems || {})[cat] || ''}
                  onChange={e => setNewItemText(cat, e.target.value)}
                  placeholder="اسم العنصر..."
                  className="flex-1 text-sm"
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); addItemToCategory(cat); }
                  }}
                />
                <button
                  type="button"
                  onClick={() => addItemToCategory(cat)}
                  disabled={!(data.newItems || {})[cat]?.trim()}
                  className="text-xs text-violet-600 hover:text-violet-800 disabled:opacity-30"
                >
                  + أضف
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Named exports
export { EXERCISE_TYPES, TYPE_LABEL, TYPE_ICON, TYPE_COLORS };
export { DIFFICULTY_OPTIONS, DIFF_LABEL, DIFF_COLORS };
export { buildQuestionPayload, questionToFormData, getEmptyFormData };

// Default export
export default ExerciseQuestionForm;
