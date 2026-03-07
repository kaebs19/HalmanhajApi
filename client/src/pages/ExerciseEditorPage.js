import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import DashboardLayout from './DashboardLayout';
import { Button, Card, Input, Select, Textarea, FormField, LoadingState, EmptyState, Alert } from '../components/ui';
import { useToast } from '../components/ui/Toast';

// ═══════════════════════════════════════
// ثوابت أنواع التمارين
// ═══════════════════════════════════════
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
};

const DIFFICULTY_OPTIONS = [
  { value: 'easy',   label: 'سهل',    color: 'bg-green-50 text-green-700 border-green-200' },
  { value: 'medium', label: 'متوسط',  color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  { value: 'hard',   label: 'صعب',    color: 'bg-red-50 text-red-700 border-red-200' },
];

// ═══════════════════════════════════════
// بناء payload السؤال من بيانات الفورم
// ═══════════════════════════════════════
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

    default:
      return { ...base, question_data: {}, correct_answer: {} };
  }
}

// ═══════════════════════════════════════
// تحويل بيانات سؤال محفوظ → بيانات الفورم
// ═══════════════════════════════════════
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

    default:
      return base;
  }
}

// ═══════════════════════════════════════
// بيانات فورم فارغة حسب نوع التمرين
// ═══════════════════════════════════════
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
    default:
      return { question_text: '' };
  }
}

// ═══════════════════════════════════════════════════════
// Component: حقول السؤال الديناميكية
// ═══════════════════════════════════════════════════════
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
      {/* نص السؤال */}
      <div>
        <span className="text-xs font-medium text-gray-500 mb-1.5 block">نص السؤال</span>
        <Textarea
          value={data.question_text || ''}
          onChange={e => setField('question_text', e.target.value)}
          placeholder="اكتب نص السؤال هنا..."
          rows={2}
        />
      </div>

      {/* ═══ صح أم خطأ ═══ */}
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

      {/* ═══ اختيار من متعدد / تمرين الزمن ═══ */}
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

      {/* ═══ أكمل الفراغ ═══ */}
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

      {/* ═══ اقرأ ثم أجب ═══ */}
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

      {/* ═══ صل العمودين ═══ */}
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

      {/* ═══ صل الصورة ═══ */}
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

      {/* ═══ رتّب الترتيب ═══ */}
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

      {/* ═══ صنّف العناصر ═══ */}
      {exerciseType === 'classify' && (
        <div className="space-y-4">
          {/* الفئات */}
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

          {/* العناصر لكل فئة */}
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


// ═══════════════════════════════════════════════════════
// Wizard Step Indicator
// ═══════════════════════════════════════════════════════
function StepIndicator({ currentStep, steps, onStepClick }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((step, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === currentStep;
        const isCompleted = stepNum < currentStep;
        const isClickable = stepNum < currentStep || (stepNum === currentStep);

        return (
          <div key={stepNum} className="flex items-center">
            <button
              type="button"
              onClick={() => isClickable && onStepClick(stepNum)}
              disabled={!isClickable}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                  : isCompleted
                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 cursor-pointer'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                isActive ? 'bg-white/20' : isCompleted ? 'bg-emerald-200' : 'bg-gray-200'
              }`}>
                {isCompleted ? (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : stepNum}
              </span>
              <span className="text-sm font-medium">{step}</span>
            </button>

            {i < steps.length - 1 && (
              <div className={`w-8 h-0.5 mx-1 ${isCompleted ? 'bg-emerald-300' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}


// ═══════════════════════════════════════════════════════
//        الصفحة الرئيسية: إنشاء / تعديل تمرين
// ═══════════════════════════════════════════════════════
export default function ExerciseEditorPage() {
  const { exerciseId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const lessonIdParam = searchParams.get('lesson_id');
  const isEditing = !!exerciseId;

  // ═══ Wizard Step ═══
  const [wizardStep, setWizardStep] = useState(1);

  // ═══ Step 1: بيانات الموقع ═══
  const [stages, setStages] = useState([]);
  const [grades, setGrades] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [selectedStage, setSelectedStage] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedLesson, setSelectedLesson] = useState('');
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [loadingLessons, setLoadingLessons] = useState(false);

  // ═══ Step 2: بيانات التمرين ═══
  const [exercise, setExercise] = useState(null);
  const [form, setForm] = useState({
    title: '',
    type: 'mcq',
    description: '',
    xp_reward: 10,
    time_limit: '',
    difficulty: 'medium',
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ═══ Step 3: الأسئلة ═══
  const [questions, setQuestions] = useState([]);
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [editQuestionData, setEditQuestionData] = useState(null);
  const [newQuestionData, setNewQuestionData] = useState(null);
  const [savingQuestion, setSavingQuestion] = useState(false);

  // ═══ Import ═══
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  // ═══ جلب المراحل والصفوف والمواد ═══
  useEffect(() => {
    const fetchLocationData = async () => {
      setLoadingLocation(true);
      try {
        const [stagesRes, gradesRes, subjectsRes] = await Promise.allSettled([
          api.get('/stages'),
          api.get('/grades'),
          api.get('/subjects'),
        ]);
        if (stagesRes.status === 'fulfilled') setStages(stagesRes.value.data);
        if (gradesRes.status === 'fulfilled') setGrades(gradesRes.value.data);
        if (subjectsRes.status === 'fulfilled') setSubjects(subjectsRes.value.data);
      } catch {
        // silent
      } finally {
        setLoadingLocation(false);
      }
    };
    fetchLocationData();
  }, []);

  // ═══ جلب الدروس عند اختيار المادة ═══
  useEffect(() => {
    if (!selectedSubject) {
      setLessons([]);
      return;
    }
    const fetchLessons = async () => {
      setLoadingLessons(true);
      try {
        const res = await api.get(`/lessons?subject_id=${selectedSubject}`);
        setLessons(res.data.lessons || res.data || []);
      } catch {
        setLessons([]);
      } finally {
        setLoadingLessons(false);
      }
    };
    fetchLessons();
  }, [selectedSubject]);

  // ═══ جلب التمرين (وضع التعديل) ═══
  const fetchExercise = useCallback(async () => {
    if (!exerciseId) return;
    setLoading(true);
    try {
      const res = await api.get(`/exercises/${exerciseId}`);
      const ex = res.data;
      setExercise(ex);
      setForm({
        title: ex.title || '',
        type: ex.type || 'mcq',
        description: ex.description || '',
        xp_reward: ex.xp_reward || 10,
        time_limit: ex.time_limit || '',
        difficulty: ex.difficulty || 'medium',
      });
      setQuestions(ex.questions || []);

      // ملء بيانات الموقع
      const subjectId = ex.subject_id || ex.lesson_subject_id;
      if (subjectId) setSelectedSubject(subjectId);
      if (ex.grade_id) setSelectedGrade(ex.grade_id);
      if (ex.stage_id) {
        setSelectedStage(ex.stage_id);
      } else if (ex.grade_id && grades.length > 0) {
        const grade = grades.find(g => String(g.id) === String(ex.grade_id));
        if (grade?.stage_id) setSelectedStage(grade.stage_id);
      }
      if (ex.lesson_id) setSelectedLesson(ex.lesson_id);

      // القفز للخطوة 3 مباشرة
      setWizardStep(3);
    } catch {
      setError('خطأ في جلب بيانات التمرين');
    } finally {
      setLoading(false);
    }
  }, [exerciseId, grades]);

  // ═══ التوافق مع ?lesson_id=xxx ═══
  useEffect(() => {
    if (lessonIdParam && !isEditing) {
      const fetchLessonInfo = async () => {
        try {
          const res = await api.get(`/lessons/${lessonIdParam}`);
          const lesson = res.data;
          if (lesson.subject_id) setSelectedSubject(lesson.subject_id);
          if (lesson.grade_id) {
            setSelectedGrade(lesson.grade_id);
            // derive stage from grade
            const grade = grades.find(g => String(g.id) === String(lesson.grade_id));
            if (grade?.stage_id) setSelectedStage(grade.stage_id);
          }
          setSelectedLesson(lessonIdParam);
          setWizardStep(2);
        } catch {
          setSelectedLesson(lessonIdParam);
        }
      };
      // wait for grades to be loaded
      if (grades.length > 0) {
        fetchLessonInfo();
      }
    }
  }, [lessonIdParam, isEditing, grades]);

  useEffect(() => {
    if (isEditing) {
      fetchExercise();
    }
  }, [isEditing, fetchExercise]);

  // ═══ تصفية الصفوف حسب المرحلة ═══
  const filteredGrades = selectedStage
    ? grades.filter(g => String(g.stage_id) === String(selectedStage))
    : [];

  // ═══ تصفية المواد حسب الصف أو المرحلة ═══
  const filteredSubjects = selectedGrade
    ? subjects.filter(s => {
        // للصفوف الثانوية (لها مسارات): أظهر مواد المسارات
        const grade = grades.find(g => String(g.id) === String(selectedGrade));
        if (grade?.tracks && grade.tracks.length > 0) {
          const trackIds = grade.tracks.map(t => String(t.track_id || t.id));
          return s.tracks?.some(t => trackIds.includes(String(t.track_id)));
        }
        // عبر جدول subject_grades
        if (s.grades?.some(g => String(g.grade_id) === String(selectedGrade))) return true;
        // fallback: العمود القديم grade_id مباشرة على المادة
        if (s.grade_id && String(s.grade_id) === String(selectedGrade)) return true;
        return false;
      })
    : selectedStage
      ? subjects.filter(s => {
          // عبر جدول subject_grades / subject_tracks
          if (s.grades?.some(g => String(g.stage_id) === String(selectedStage))) return true;
          if (s.tracks?.some(t => String(t.stage_id) === String(selectedStage))) return true;
          // fallback: عبر grade_id المباشر → stage
          if (s.grade_id) {
            const g = grades.find(gr => String(gr.id) === String(s.grade_id));
            if (g && String(g.stage_id) === String(selectedStage)) return true;
          }
          return false;
        })
      : [];

  // ═══ معالج اختيار المرحلة ═══
  const handleStageChange = (stageId) => {
    setSelectedStage(stageId === selectedStage ? '' : stageId);
    setSelectedGrade('');
    setSelectedSubject('');
    setSelectedLesson('');
  };

  // ═══ معالج اختيار الصف ═══
  const handleGradeChange = (gradeId) => {
    setSelectedGrade(gradeId === selectedGrade ? '' : gradeId);
    setSelectedSubject('');
    setSelectedLesson('');
  };

  // ═══ معالج اختيار المادة ═══
  const handleSubjectChange = (subjectId) => {
    setSelectedSubject(subjectId === selectedSubject ? '' : subjectId);
    setSelectedLesson('');
  };

  // ═══ حفظ التمرين (إنشاء / تحديث) ═══
  const handleSaveExercise = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error('عنوان التمرين مطلوب');
      return;
    }
    if (!selectedSubject && !isEditing) {
      toast.error('يجب اختيار المادة أولاً');
      setWizardStep(1);
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (isEditing) {
        const res = await api.put(`/exercises/${exerciseId}`, {
          title: form.title,
          description: form.description || null,
          xp_reward: form.xp_reward || 10,
          time_limit: form.type === 'speed' ? (form.time_limit || null) : null,
          difficulty: form.difficulty || 'medium',
          stage_id: selectedStage || null,
          grade_id: selectedGrade || null,
          subject_id: selectedSubject || null,
          lesson_id: selectedLesson || null,
        });
        setExercise(res.data);
        toast.success('تم تحديث التمرين');
        setWizardStep(3);
      } else {
        const res = await api.post('/exercises', {
          subject_id: selectedSubject,
          stage_id: selectedStage || null,
          grade_id: selectedGrade || null,
          lesson_id: selectedLesson || null,
          title: form.title,
          type: form.type,
          description: form.description || null,
          xp_reward: form.xp_reward || 10,
          time_limit: form.type === 'speed' ? (form.time_limit || null) : null,
          difficulty: form.difficulty || 'medium',
        });
        setExercise(res.data);
        setQuestions([]);
        toast.success('تم إنشاء التمرين');
        navigate(`/admin/exercises/${res.data.id}/edit`, { replace: true });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'خطأ في حفظ التمرين');
    } finally {
      setSaving(false);
    }
  };

  // ═══ إضافة سؤال ═══
  const handleAddQuestion = async () => {
    if (!newQuestionData?.question_text?.trim()) {
      toast.error('نص السؤال مطلوب');
      return;
    }

    setSavingQuestion(true);
    try {
      const payload = buildQuestionPayload(exercise.type, newQuestionData);
      const res = await api.post(`/exercises/${exercise.id}/questions`, payload);
      setQuestions(prev => [...prev, res.data]);
      setNewQuestionData(getEmptyFormData(exercise.type));
      toast.success('تم إضافة السؤال');
    } catch (err) {
      toast.error(err.response?.data?.message || 'خطأ في إضافة السؤال');
    } finally {
      setSavingQuestion(false);
    }
  };

  // ═══ تعديل سؤال ═══
  const handleUpdateQuestion = async (qid) => {
    if (!editQuestionData?.question_text?.trim()) {
      toast.error('نص السؤال مطلوب');
      return;
    }

    setSavingQuestion(true);
    try {
      const payload = buildQuestionPayload(exercise.type, editQuestionData);
      const res = await api.put(`/exercises/${exercise.id}/questions/${qid}`, payload);
      setQuestions(prev => prev.map(q => q.id === qid ? res.data : q));
      setEditingQuestionId(null);
      setEditQuestionData(null);
      toast.success('تم تحديث السؤال');
    } catch (err) {
      toast.error(err.response?.data?.message || 'خطأ في تحديث السؤال');
    } finally {
      setSavingQuestion(false);
    }
  };

  // ═══ حذف سؤال ═══
  const handleDeleteQuestion = async (qid) => {
    if (!window.confirm('هل تريد حذف هذا السؤال؟')) return;
    try {
      await api.delete(`/exercises/${exercise.id}/questions/${qid}`);
      setQuestions(prev => prev.filter(q => q.id !== qid));
      toast.success('تم حذف السؤال');
    } catch {
      toast.error('خطأ في حذف السؤال');
    }
  };

  // ═══ تبديل النشر ═══
  const handleTogglePublish = async () => {
    if (!exercise) return;
    try {
      const res = await api.patch(`/exercises/${exercise.id}/publish`);
      setExercise(prev => ({ ...prev, is_published: res.data.is_published }));
      toast.success(res.data.is_published ? 'تم نشر التمرين' : 'تم إلغاء النشر');
    } catch {
      toast.error('خطأ في تغيير حالة النشر');
    }
  };

  // ═══ استيراد أسئلة من ملف ═══
  const handleImportQuestions = async () => {
    if (!importFile || !exercise) return;
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      const res = await api.post(`/exercises/${exercise.id}/import`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportResult(res.data);
      if (res.data.imported > 0) {
        toast.success(res.data.message);
        // إعادة تحميل الأسئلة
        const qRes = await api.get(`/exercises/${exercise.id}`);
        setQuestions(qRes.data.questions || []);
      }
      setImportFile(null);
    } catch (err) {
      const msg = err.response?.data?.message || 'خطأ في استيراد الأسئلة';
      toast.error(msg);
      setImportResult({ error: msg });
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTemplate = async (type) => {
    try {
      const res = await api.get(`/exercises/import-template/${type}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `قالب_${TYPE_LABEL[type] || type}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('خطأ في تحميل القالب');
    }
  };

  // ═══ فتح تعديل سؤال ═══
  const startEditQuestion = (q) => {
    setEditingQuestionId(q.id);
    setEditQuestionData(questionToFormData(exercise.type, q));
  };

  // ═══ أسماء العناصر المختارة (للـ breadcrumb) ═══
  const selectedStageName = stages.find(s => String(s.id) === String(selectedStage))?.name || '';
  const selectedGradeName = grades.find(g => String(g.id) === String(selectedGrade))?.name || '';
  const selectedSubjectName = subjects.find(s => String(s.id) === String(selectedSubject))?.name || '';
  const selectedLessonName = lessons.find(l => String(l.id) === String(selectedLesson))?.title || '';

  if (loading) {
    return <DashboardLayout><LoadingState /></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="mb-6 max-w-4xl mx-auto">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-4 flex-wrap">
          <Link to="/admin/exercises" className="hover:text-blue-600 transition-colors">التمارين</Link>
          {selectedStageName && (
            <>
              <span>/</span>
              <span className="text-gray-600">{selectedStageName}</span>
            </>
          )}
          {selectedGradeName && (
            <>
              <span>/</span>
              <span className="text-gray-600">{selectedGradeName}</span>
            </>
          )}
          {selectedSubjectName && (
            <>
              <span>/</span>
              <span className="text-gray-600">{selectedSubjectName}</span>
            </>
          )}
          {selectedLessonName && (
            <>
              <span>/</span>
              <span className="text-gray-600">{selectedLessonName}</span>
            </>
          )}
          <span>/</span>
          <span className="text-gray-800 font-medium">
            {isEditing ? 'تعديل التمرين' : 'تمرين جديد'}
          </span>
        </div>

        {error && <Alert className="mb-4">{error}</Alert>}

        {/* Step Indicator */}
        <StepIndicator
          currentStep={wizardStep}
          steps={['الموقع', 'المعلومات', 'الأسئلة']}
          onStepClick={(step) => {
            if (step < wizardStep || (isEditing && step <= 3)) {
              setWizardStep(step);
            }
          }}
        />

        {/* ═══════════════════════════════════════ */}
        {/* الخطوة 1: الموقع (المرحلة / الصف / المادة / الدرس) */}
        {/* ═══════════════════════════════════════ */}
        {wizardStep === 1 && (
          <Card className="p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-6">اختر موقع التمرين</h2>

            {loadingLocation ? (
              <LoadingState />
            ) : (
              <div className="space-y-6">
                {/* المراحل */}
                <div>
                  <span className="text-sm font-medium text-gray-600 mb-3 block">المرحلة الدراسية</span>
                  <div className="flex gap-3 flex-wrap">
                    {stages.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleStageChange(s.id)}
                        className={`px-5 py-3 rounded-xl font-medium text-sm transition-all duration-200 border-2 ${
                          String(selectedStage) === String(s.id)
                            ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/25'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                        }`}
                      >
                        {s.icon && <span className="ml-2">{s.icon}</span>}
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* الصفوف */}
                {selectedStage && filteredGrades.length > 0 && (
                  <div>
                    <span className="text-sm font-medium text-gray-600 mb-3 block">الصف</span>
                    <div className="flex gap-2 flex-wrap">
                      {filteredGrades.map(g => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => handleGradeChange(g.id)}
                          className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border-2 ${
                            String(selectedGrade) === String(g.id)
                              ? 'bg-violet-600 text-white border-violet-600 shadow-lg shadow-violet-500/25'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300 hover:bg-violet-50'
                          }`}
                        >
                          {g.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* المواد */}
                {(selectedGrade || selectedStage) && filteredSubjects.length > 0 && (
                  <div>
                    <span className="text-sm font-medium text-gray-600 mb-3 block">المادة</span>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {filteredSubjects.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => handleSubjectChange(s.id)}
                          className={`p-4 rounded-xl text-sm font-medium transition-all duration-200 border-2 text-right ${
                            String(selectedSubject) === String(s.id)
                              ? 'bg-amber-50 text-amber-800 border-amber-400 shadow-lg shadow-amber-500/15'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-amber-300 hover:bg-amber-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {s.icon && <span className="text-lg">{s.icon}</span>}
                            <span>{s.name}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* الدرس (اختياري) */}
                {selectedSubject && (
                  <div>
                    <span className="text-sm font-medium text-gray-600 mb-2 block">
                      الدرس <span className="text-gray-400 font-normal">(اختياري)</span>
                    </span>
                    {loadingLessons ? (
                      <div className="text-sm text-gray-400">جاري تحميل الدروس...</div>
                    ) : (
                      <select
                        value={selectedLesson}
                        onChange={e => setSelectedLesson(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none"
                      >
                        <option value="">مرتبط بالمادة فقط (بدون درس محدد)</option>
                        {lessons.map(l => (
                          <option key={l.id} value={l.id}>{l.title}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {/* إرشاد */}
                {!selectedStage && (
                  <div className="text-center py-8 text-gray-400">
                    <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <p className="text-sm">اختر المرحلة الدراسية للبدء</p>
                  </div>
                )}

                {selectedStage && !selectedSubject && filteredSubjects.length === 0 && filteredGrades.length > 0 && !selectedGrade && (
                  <div className="text-center py-6 text-gray-400">
                    <p className="text-sm">اختر الصف لعرض المواد</p>
                  </div>
                )}

                {/* زر التالي */}
                <div className="flex justify-end pt-4 border-t">
                  <Button
                    onClick={() => {
                      if (!selectedSubject) {
                        toast.error('يجب اختيار المادة للمتابعة');
                        return;
                      }
                      setWizardStep(2);
                    }}
                    disabled={!selectedSubject}
                  >
                    التالي: معلومات التمرين
                    <svg className="w-4 h-4 mr-1 rotate-180 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* ═══════════════════════════════════════ */}
        {/* الخطوة 2: معلومات التمرين */}
        {/* ═══════════════════════════════════════ */}
        {wizardStep === 2 && (
          <Card className="p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              {isEditing ? 'تعديل معلومات التمرين' : 'معلومات التمرين'}
            </h2>

            {/* ملخص الموقع */}
            <div className="bg-gray-50 rounded-xl p-3 mb-6 flex items-center gap-3 flex-wrap text-sm">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {selectedStageName && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-lg text-xs font-medium">{selectedStageName}</span>}
              {selectedGradeName && <span className="bg-violet-100 text-violet-700 px-2 py-0.5 rounded-lg text-xs font-medium">{selectedGradeName}</span>}
              {selectedSubjectName && <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-lg text-xs font-medium">{selectedSubjectName}</span>}
              {selectedLessonName && <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded-lg text-xs font-medium">{selectedLessonName}</span>}
              <button
                type="button"
                onClick={() => setWizardStep(1)}
                className="text-xs text-blue-600 hover:text-blue-800 mr-auto"
              >
                تغيير
              </button>
            </div>

            <form onSubmit={handleSaveExercise} className="space-y-4">
              <FormField label="عنوان التمرين">
                <Input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="مثال: تمرين على جمع الأعداد"
                  required
                />
              </FormField>

              {/* نوع التمرين */}
              <div>
                <span className="text-sm font-medium text-gray-700 mb-2 block">نوع التمرين</span>
                {isEditing ? (
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${TYPE_COLORS[form.type] || 'bg-gray-100'}`}>
                    <span>{TYPE_ICON[form.type]}</span>
                    <span className="font-medium">{TYPE_LABEL[form.type]}</span>
                    <span className="text-xs opacity-60">(لا يمكن تغيير النوع بعد الإنشاء)</span>
                  </div>
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    {EXERCISE_TYPES.map(t => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, type: t.value }))}
                        className={`text-sm px-4 py-2 rounded-lg font-medium transition-colors border ${
                          form.type === t.value
                            ? 'bg-blue-100 border-blue-300 text-blue-800'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {t.icon} {t.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* الصعوبة */}
              <div>
                <span className="text-sm font-medium text-gray-700 mb-2 block">مستوى الصعوبة</span>
                <div className="flex gap-3">
                  {DIFFICULTY_OPTIONS.map(d => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, difficulty: d.value }))}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border-2 ${
                        form.difficulty === d.value
                          ? d.color + ' border-current'
                          : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="نقاط المكافأة (XP)">
                  <Input
                    type="number"
                    value={form.xp_reward}
                    onChange={e => setForm(prev => ({ ...prev, xp_reward: parseInt(e.target.value) || 10 }))}
                    min={1}
                    max={100}
                  />
                </FormField>

                {form.type === 'speed' && (
                  <FormField label="الحد الزمني (ثواني)">
                    <Input
                      type="number"
                      value={form.time_limit}
                      onChange={e => setForm(prev => ({ ...prev, time_limit: parseInt(e.target.value) || '' }))}
                      placeholder="مثال: 60"
                      min={10}
                    />
                  </FormField>
                )}
              </div>

              <FormField label="الوصف (اختياري)">
                <Textarea
                  value={form.description}
                  onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="وصف مختصر للتمرين..."
                  rows={2}
                />
              </FormField>

              <div className="flex gap-3 pt-4 border-t">
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => setWizardStep(1)}
                >
                  <svg className="w-4 h-4 ml-1 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  السابق
                </Button>
                <Button type="submit" disabled={saving} className="mr-auto">
                  {saving ? 'جاري الحفظ...' : (isEditing ? 'تحديث والانتقال للأسئلة' : 'إنشاء والانتقال للأسئلة')}
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* ═══════════════════════════════════════ */}
        {/* الخطوة 3: الأسئلة */}
        {/* ═══════════════════════════════════════ */}
        {wizardStep === 3 && exercise && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">
                الأسئلة ({questions.length})
              </h2>
              <div className="flex items-center gap-3">
                {/* شارة النوع */}
                <span className={`text-xs px-3 py-1 rounded-full font-medium ${TYPE_COLORS[exercise.type] || 'bg-gray-100'}`}>
                  {TYPE_ICON[exercise.type]} {TYPE_LABEL[exercise.type]}
                </span>
                {/* زر النشر */}
                <button
                  onClick={handleTogglePublish}
                  className={`text-sm px-4 py-1.5 rounded-lg transition-colors ${
                    exercise.is_published
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  {exercise.is_published ? 'منشور' : 'نشر التمرين'}
                </button>
              </div>
            </div>

            {/* ملخص معلومات التمرين */}
            <div className="bg-gray-50 rounded-xl p-3 mb-6 text-sm text-gray-600">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="font-medium text-gray-800">{exercise.title}</span>
                <span className="text-gray-400">|</span>
                <span>{DIFFICULTY_OPTIONS.find(d => d.value === (exercise.difficulty || form.difficulty))?.label || 'متوسط'}</span>
                <span className="text-gray-400">|</span>
                <span>{form.xp_reward} XP</span>
                {form.time_limit && (
                  <>
                    <span className="text-gray-400">|</span>
                    <span>{form.time_limit} ثانية</span>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setWizardStep(2)}
                  className="text-xs text-blue-600 hover:text-blue-800 mr-auto"
                >
                  تعديل المعلومات
                </button>
              </div>
            </div>

            {/* قائمة الأسئلة المحفوظة */}
            {questions.length > 0 && (
              <div className="space-y-3 mb-6">
                {questions.map((q, idx) => (
                  <div key={q.id} className="border rounded-xl p-4 bg-white">
                    {editingQuestionId === q.id ? (
                      /* === وضع التعديل === */
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-blue-600">تعديل السؤال #{idx + 1}</span>
                          <button
                            onClick={() => { setEditingQuestionId(null); setEditQuestionData(null); }}
                            className="text-xs text-gray-400 hover:text-gray-600"
                          >
                            إلغاء
                          </button>
                        </div>
                        <ExerciseQuestionForm
                          exerciseType={exercise.type}
                          data={editQuestionData}
                          onChange={setEditQuestionData}
                        />
                        <div className="flex gap-2 pt-2">
                          <Button
                            size="sm"
                            onClick={() => handleUpdateQuestion(q.id)}
                            disabled={savingQuestion}
                          >
                            {savingQuestion ? 'جاري الحفظ...' : 'حفظ التعديل'}
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => { setEditingQuestionId(null); setEditQuestionData(null); }}
                          >
                            إلغاء
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* === وضع العرض === */
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <span className="text-xs font-bold text-gray-400 mt-1 w-5">{idx + 1}</span>
                          <div>
                            <p className="text-sm text-gray-800 font-medium">{q.question_text || '(بدون نص)'}</p>
                            {exercise.type === 'true_false' && q.correct_answer && (
                              <span className="text-xs text-gray-400 mt-1 block">
                                الإجابة: {q.correct_answer.value ? 'صح' : 'خطأ'}
                              </span>
                            )}
                            {exercise.type === 'mcq' && q.question_data?.options && (
                              <span className="text-xs text-gray-400 mt-1 block">
                                {q.question_data.options.length} خيارات — الصحيح: {q.question_data.options[q.correct_answer?.index] || '؟'}
                              </span>
                            )}
                            {exercise.type === 'fill_blank' && q.correct_answer?.values && (
                              <span className="text-xs text-gray-400 mt-1 block">
                                الإجابة: {q.correct_answer.values[0]}
                              </span>
                            )}
                            {exercise.type === 'matching' && q.correct_answer?.pairs && (
                              <span className="text-xs text-gray-400 mt-1 block">
                                {q.correct_answer.pairs.length} أزواج
                              </span>
                            )}
                            {exercise.type === 'ordering' && q.correct_answer?.items && (
                              <span className="text-xs text-gray-400 mt-1 block">
                                {q.correct_answer.items.length} عناصر
                              </span>
                            )}
                            {exercise.type === 'classify' && q.question_data?.categories && (
                              <span className="text-xs text-gray-400 mt-1 block">
                                {q.question_data.categories.length} فئات
                              </span>
                            )}
                            {exercise.type === 'image_match' && q.correct_answer?.pairs && (
                              <span className="text-xs text-gray-400 mt-1 block">
                                {q.correct_answer.pairs.length} أزواج صور
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEditQuestion(q)}
                            className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1"
                          >
                            تعديل
                          </button>
                          <button
                            onClick={() => handleDeleteQuestion(q.id)}
                            className="text-xs text-red-500 hover:text-red-700 px-2 py-1"
                          >
                            حذف
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {questions.length === 0 && (
              <EmptyState
                icon="📝"
                message="لا توجد أسئلة بعد"
                subMessage="أضف أول سؤال لهذا التمرين"
              />
            )}

            {/* ═══ استيراد أسئلة من ملف ═══ */}
            <div className="border-t pt-4 mt-4">
              <button
                type="button"
                onClick={() => { setShowImportPanel(!showImportPanel); setImportResult(null); setImportFile(null); }}
                className={`w-full py-3 border-2 border-dashed rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${
                  showImportPanel
                    ? 'border-violet-400 bg-violet-50 text-violet-700'
                    : 'border-gray-300 text-gray-500 hover:text-violet-600 hover:border-violet-300'
                }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                استيراد أسئلة من ملف Excel / JSON
              </button>

              {showImportPanel && (
                <div className="mt-3 bg-violet-50/50 border-2 border-violet-200 rounded-xl p-5 space-y-4">
                  {/* تحميل القالب */}
                  <div>
                    <h4 className="text-sm font-bold text-violet-800 mb-2">1. حمّل القالب المناسب</h4>
                    <p className="text-xs text-gray-500 mb-3">
                      حمّل قالب Excel لنوع التمرين &quot;{TYPE_LABEL[exercise.type]}&quot;، ثم املأ الأسئلة فيه
                    </p>
                    <button
                      type="button"
                      onClick={() => handleDownloadTemplate(exercise.type)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-violet-300 text-violet-700 rounded-lg text-sm font-medium hover:bg-violet-100 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      تحميل قالب {TYPE_LABEL[exercise.type]}
                    </button>
                  </div>

                  {/* رفع الملف */}
                  <div>
                    <h4 className="text-sm font-bold text-violet-800 mb-2">2. ارفع الملف</h4>
                    <div className="flex items-center gap-3">
                      <label className="flex-1 cursor-pointer">
                        <div className={`flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg text-sm transition-colors ${
                          importFile
                            ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                            : 'border-gray-300 text-gray-500 hover:border-violet-400 hover:bg-white'
                        }`}>
                          {importFile ? (
                            <>
                              <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                              {importFile.name}
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              اختر ملف (.xlsx أو .json)
                            </>
                          )}
                        </div>
                        <input
                          type="file"
                          accept=".xlsx,.xls,.json"
                          className="hidden"
                          onChange={(e) => { setImportFile(e.target.files[0] || null); setImportResult(null); }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={handleImportQuestions}
                        disabled={!importFile || importing}
                        className={`px-5 py-3 rounded-lg text-sm font-bold transition-colors ${
                          !importFile || importing
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-violet-600 text-white hover:bg-violet-700'
                        }`}
                      >
                        {importing ? (
                          <span className="flex items-center gap-2">
                            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity=".25" />
                              <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" opacity=".75" />
                            </svg>
                            جاري الاستيراد...
                          </span>
                        ) : 'استيراد'}
                      </button>
                    </div>
                  </div>

                  {/* نتيجة الاستيراد */}
                  {importResult && (
                    <div className={`rounded-lg p-4 text-sm ${
                      importResult.error
                        ? 'bg-red-50 border border-red-200'
                        : importResult.imported > 0
                          ? 'bg-emerald-50 border border-emerald-200'
                          : 'bg-amber-50 border border-amber-200'
                    }`}>
                      {importResult.error ? (
                        <p className="text-red-700">{importResult.error}</p>
                      ) : (
                        <div className="space-y-2">
                          <p className={importResult.imported > 0 ? 'text-emerald-800 font-bold' : 'text-amber-800 font-bold'}>
                            {importResult.message}
                          </p>
                          <div className="flex gap-4 text-xs">
                            <span className="text-gray-600">الإجمالي: {importResult.total}</span>
                            <span className="text-emerald-600">تم استيراد: {importResult.imported}</span>
                            {importResult.skipped > 0 && (
                              <span className="text-amber-600">تم تخطي: {importResult.skipped}</span>
                            )}
                            {importResult.errors?.length > 0 && (
                              <span className="text-red-600">أخطاء: {importResult.errors.length}</span>
                            )}
                          </div>
                          {importResult.errors?.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-red-100">
                              <p className="text-xs font-bold text-red-700 mb-1">تفاصيل الأخطاء:</p>
                              <ul className="space-y-1">
                                {importResult.errors.slice(0, 5).map((e, i) => (
                                  <li key={i} className="text-xs text-red-600">
                                    صف {e.row}: {e.message}
                                  </li>
                                ))}
                                {importResult.errors.length > 5 && (
                                  <li className="text-xs text-red-400">
                                    +{importResult.errors.length - 5} أخطاء أخرى
                                  </li>
                                )}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* نموذج إضافة سؤال جديد */}
            <div className="border-t pt-4 mt-4">
              {newQuestionData ? (
                <div className="bg-blue-50/50 border-2 border-blue-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-blue-700">سؤال جديد</span>
                    <button
                      onClick={() => setNewQuestionData(null)}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      إلغاء
                    </button>
                  </div>

                  <ExerciseQuestionForm
                    exerciseType={exercise.type}
                    data={newQuestionData}
                    onChange={setNewQuestionData}
                  />

                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={handleAddQuestion}
                      disabled={savingQuestion || !newQuestionData.question_text?.trim()}
                    >
                      {savingQuestion ? 'جاري الإضافة...' : 'حفظ السؤال'}
                    </Button>
                    <Button variant="secondary" onClick={() => setNewQuestionData(null)}>
                      إلغاء
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setNewQuestionData(getEmptyFormData(exercise.type))}
                  className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:text-blue-600 hover:border-blue-300 transition-colors font-medium"
                >
                  + إضافة سؤال جديد
                </button>
              )}
            </div>

            {/* أزرار التنقل */}
            <div className="flex gap-3 pt-4 mt-4 border-t">
              <Button
                variant="secondary"
                onClick={() => setWizardStep(2)}
              >
                <svg className="w-4 h-4 ml-1 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                تعديل المعلومات
              </Button>
              <Link
                to="/admin/exercises"
                className="mr-auto inline-flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                العودة لقائمة التمارين
              </Link>
            </div>
          </Card>
        )}

        {/* حالة عدم وجود تمرين في الخطوة 3 */}
        {wizardStep === 3 && !exercise && !loading && (
          <Card className="p-6">
            <EmptyState
              icon="⚠️"
              message="لم يتم إنشاء التمرين بعد"
              subMessage="يجب إنشاء التمرين أولاً في الخطوة السابقة"
            />
            <div className="flex justify-center mt-4">
              <Button onClick={() => setWizardStep(2)}>العودة لمعلومات التمرين</Button>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
