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

// ألوان badges حسب النوع
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
//        الصفحة الرئيسية: إنشاء / تعديل تمرين
// ═══════════════════════════════════════════════════════
export default function ExerciseEditorPage() {
  const { exerciseId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const lessonId = searchParams.get('lesson_id');
  const isEditing = !!exerciseId;

  // بيانات التمرين
  const [exercise, setExercise] = useState(null);
  const [form, setForm] = useState({
    title: '',
    type: 'mcq',
    description: '',
    xp_reward: 10,
    time_limit: '',
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // الأسئلة
  const [questions, setQuestions] = useState([]);
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [editQuestionData, setEditQuestionData] = useState(null);

  // نموذج سؤال جديد
  const [newQuestionData, setNewQuestionData] = useState(null);
  const [savingQuestion, setSavingQuestion] = useState(false);

  // قائمة التمارين للدرس (Page 1 مدمجة)
  const [lessonExercises, setLessonExercises] = useState([]);
  const [loadingList, setLoadingList] = useState(false);

  // ═══ جلب البيانات ═══
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
      });
      setQuestions(ex.questions || []);
    } catch {
      setError('خطأ في جلب بيانات التمرين');
    } finally {
      setLoading(false);
    }
  }, [exerciseId]);

  const fetchLessonExercises = useCallback(async () => {
    const lid = exercise?.lesson_id || lessonId;
    if (!lid) return;
    setLoadingList(true);
    try {
      const res = await api.get(`/exercises/lesson/${lid}`);
      setLessonExercises(res.data);
    } catch {
      // silent
    } finally {
      setLoadingList(false);
    }
  }, [exercise?.lesson_id, lessonId]);

  useEffect(() => {
    if (isEditing) {
      fetchExercise();
    } else {
      setNewQuestionData(null);
    }
  }, [isEditing, fetchExercise]);

  useEffect(() => {
    fetchLessonExercises();
  }, [fetchLessonExercises]);

  // ═══ حفظ التمرين (Step 1) ═══
  const handleSaveExercise = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error('عنوان التمرين مطلوب');
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
        });
        setExercise(res.data);
        toast.success('تم تحديث التمرين');
      } else {
        const res = await api.post('/exercises', {
          lesson_id: lessonId,
          title: form.title,
          type: form.type,
          description: form.description || null,
          xp_reward: form.xp_reward || 10,
          time_limit: form.type === 'speed' ? (form.time_limit || null) : null,
        });
        setExercise(res.data);
        setQuestions([]);
        toast.success('تم إنشاء التمرين');
        // الانتقال لوضع التعديل
        navigate(`/admin/exercises/${res.data.id}/edit`, { replace: true });
      }
      fetchLessonExercises();
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
  const handleTogglePublish = async (exId) => {
    try {
      const res = await api.patch(`/exercises/${exId}/publish`);
      if (exercise && exercise.id === exId) {
        setExercise(prev => ({ ...prev, is_published: res.data.is_published }));
      }
      setLessonExercises(prev => prev.map(e => e.id === exId ? { ...e, is_published: res.data.is_published } : e));
      toast.success(res.data.is_published ? 'تم نشر التمرين' : 'تم إلغاء النشر');
    } catch {
      toast.error('خطأ في تغيير حالة النشر');
    }
  };

  // ═══ حذف تمرين ═══
  const handleDeleteExercise = async (exId) => {
    if (!window.confirm('هل تريد حذف هذا التمرين وجميع أسئلته؟')) return;
    try {
      await api.delete(`/exercises/${exId}`);
      setLessonExercises(prev => prev.filter(e => e.id !== exId));
      toast.success('تم حذف التمرين');
      if (exercise && exercise.id === exId) {
        navigate(-1);
      }
    } catch {
      toast.error('خطأ في حذف التمرين');
    }
  };

  // ═══ فتح تعديل سؤال ═══
  const startEditQuestion = (q) => {
    setEditingQuestionId(q.id);
    setEditQuestionData(questionToFormData(exercise.type, q));
  };

  if (loading) {
    return <DashboardLayout><LoadingState /></DashboardLayout>;
  }

  const currentLessonId = exercise?.lesson_id || lessonId;

  return (
    <DashboardLayout>
      <div className="mb-6 max-w-4xl mx-auto">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
          <Link to="/admin/lessons" className="hover:text-blue-600 transition-colors">الدروس</Link>
          <span>/</span>
          <button onClick={() => navigate(-1)} className="hover:text-blue-600 transition-colors">العودة</button>
          <span>/</span>
          <span className="text-gray-800 font-medium">
            {isEditing ? 'تعديل التمرين' : 'تمرين جديد'}
          </span>
        </div>

        {error && <Alert className="mb-4">{error}</Alert>}

        {/* ═══════════════════════════════════════ */}
        {/* قائمة التمارين الحالية للدرس */}
        {/* ═══════════════════════════════════════ */}
        {currentLessonId && lessonExercises.length > 0 && (
          <Card className="p-4 mb-6">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              🧩 تمارين هذا الدرس ({lessonExercises.length})
            </h3>
            <div className="space-y-2">
              {lessonExercises.map(ex => (
                <div
                  key={ex.id}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    exercise?.id === ex.id ? 'border-blue-300 bg-blue-50' : 'border-gray-100 bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[ex.type] || 'bg-gray-100 text-gray-600'}`}>
                      {TYPE_ICON[ex.type]} {TYPE_LABEL[ex.type] || ex.type}
                    </span>
                    <span className="text-sm font-medium text-gray-800">{ex.title}</span>
                    <span className="text-xs text-gray-400">({ex.questions_count || 0} سؤال)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* نشر/إلغاء */}
                    <button
                      onClick={() => handleTogglePublish(ex.id)}
                      className={`text-xs px-2 py-1 rounded-lg transition-colors ${
                        ex.is_published
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                          : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                      }`}
                    >
                      {ex.is_published ? 'منشور' : 'مسودة'}
                    </button>
                    {/* تعديل */}
                    {exercise?.id !== ex.id && (
                      <Link
                        to={`/admin/exercises/${ex.id}/edit`}
                        className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1"
                      >
                        تعديل
                      </Link>
                    )}
                    {/* حذف */}
                    <button
                      onClick={() => handleDeleteExercise(ex.id)}
                      className="text-xs text-red-500 hover:text-red-700 px-2 py-1"
                    >
                      حذف
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* زر إضافة تمرين جديد */}
            {isEditing && (
              <Link
                to={`/admin/exercises/create?lesson_id=${currentLessonId}`}
                className="mt-3 inline-flex items-center gap-1 text-sm text-purple-600 hover:text-purple-800 font-medium"
              >
                + إضافة تمرين جديد
              </Link>
            )}
          </Card>
        )}

        {/* ═══════════════════════════════════════ */}
        {/* Step 1: معلومات التمرين */}
        {/* ═══════════════════════════════════════ */}
        <Card className="p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">
            {isEditing ? '✏️ تعديل معلومات التمرين' : '🧩 تمرين جديد'}
          </h2>

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

            {/* نوع التمرين — غير قابل للتعديل بعد الإنشاء */}
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

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={saving}>
                {saving ? 'جاري الحفظ...' : (isEditing ? 'تحديث التمرين' : 'إنشاء التمرين')}
              </Button>
              <Button variant="secondary" onClick={() => navigate(-1)}>العودة</Button>
            </div>
          </form>
        </Card>

        {/* ═══════════════════════════════════════ */}
        {/* Step 2: إدارة الأسئلة */}
        {/* ═══════════════════════════════════════ */}
        {exercise && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">
                📝 الأسئلة ({questions.length})
              </h2>
              {!exercise.is_published && (
                <button
                  onClick={() => handleTogglePublish(exercise.id)}
                  className="text-sm bg-emerald-600 text-white px-4 py-1.5 rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  نشر التمرين
                </button>
              )}
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
                            {/* عرض ملخص الإجابة */}
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
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
