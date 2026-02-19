import { useState, useEffect, useRef } from 'react';
import api from '../lib/api';
import DashboardLayout from './DashboardLayout';
import { Button, Input, Select, FormField, Textarea } from '../components/ui';
import { useToast } from '../components/ui/Toast';

const QUESTION_TYPES = [
  { value: 'multiple_choice', label: 'اختيار متعدد' },
  { value: 'true_false', label: 'صح أو خطأ' },
  { value: 'fill_blank', label: 'إملاء فراغ' },
  { value: 'matching', label: 'توصيل' },
  { value: 'ordering', label: 'ترتيب' },
];

export default function QuizzesManagePage() {
  const { toast } = useToast();
  const [quizzes, setQuizzes] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [grades, setGrades] = useState([]);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // list | editor
  const [editingQuiz, setEditingQuiz] = useState(null);
  const [saving, setSaving] = useState(false);
  const [aiAvailable, setAiAvailable] = useState(false);

  // Modals
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);

  // حقول الاختبار
  const [form, setForm] = useState({
    title: '', description: '', subject_id: '', grade_id: '',
    stage_id: '', track_id: '', semester: 0,
    time_limit: 30, passing_score: 60, is_published: true
  });

  // أسئلة الاختبار
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [savingQuestion, setSavingQuestion] = useState(false);

  // DnD
  const [draggedIdx, setDraggedIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  useEffect(() => { fetchData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async () => {
    try {
      const [quizzesRes, subjectsRes, gradesRes, stagesRes, aiRes] = await Promise.all([
        api.get('/quizzes'),
        api.get('/subjects'),
        api.get('/grades'),
        api.get('/stages'),
        api.get('/quizzes/ai-status').catch(() => ({ data: { available: false } }))
      ]);
      setQuizzes(quizzesRes.data);
      setSubjects(subjectsRes.data);
      setGrades(gradesRes.data);
      setStages(stagesRes.data);
      setAiAvailable(aiRes.data?.available || false);
    } catch {
      toast.error('خطأ في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      title: '', description: '', subject_id: '', grade_id: '',
      stage_id: '', track_id: '', semester: 0,
      time_limit: 30, passing_score: 60, is_published: true
    });
    setQuizQuestions([]);
    setEditingQuiz(null);
  };

  // ═══════════════════════════════════════
  // فتح محرر الاختبار
  // ═══════════════════════════════════════
  const openEditor = async (quiz = null) => {
    if (quiz) {
      try {
        const res = await api.get(`/quizzes/${quiz.id}`);
        const data = res.data;
        setForm({
          title: data.title || '',
          description: data.description || '',
          subject_id: data.subject_id || '',
          grade_id: data.grade_id || '',
          stage_id: data.stage_id || '',
          track_id: data.track_id || '',
          semester: data.semester || 0,
          time_limit: data.time_limit || data.duration_minutes || 30,
          passing_score: data.passing_score || 60,
          is_published: data.is_published !== false
        });
        setQuizQuestions(data.quiz_questions || []);
        setEditingQuiz(data);
      } catch {
        toast.error('خطأ في تحميل بيانات الاختبار');
        return;
      }
    } else {
      resetForm();
    }
    setView('editor');
  };

  // ═══════════════════════════════════════
  // حفظ بيانات الاختبار
  // ═══════════════════════════════════════
  const handleSaveQuiz = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error('عنوان الاختبار مطلوب');
      return;
    }
    setSaving(true);
    try {
      if (editingQuiz) {
        const res = await api.put(`/quizzes/${editingQuiz.id}`, form);
        setEditingQuiz(prev => ({ ...prev, ...res.data }));
        toast.success('تم حفظ بيانات الاختبار');
      } else {
        const res = await api.post('/quizzes', form);
        setEditingQuiz(res.data);
        toast.success('تم إنشاء الاختبار');
      }
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'خطأ في الحفظ');
    } finally {
      setSaving(false);
    }
  };

  // ═══════════════════════════════════════
  // حذف اختبار
  // ═══════════════════════════════════════
  const handleDeleteQuiz = async (id) => {
    if (!window.confirm('هل تريد حذف هذا الاختبار؟ سيتم حذف جميع الأسئلة والمحاولات.')) return;
    try {
      await api.delete(`/quizzes/${id}`);
      setQuizzes(prev => prev.filter(q => q.id !== id));
      toast.success('تم حذف الاختبار');
    } catch {
      toast.error('خطأ في الحذف');
    }
  };

  // ═══════════════════════════════════════
  // إضافة سؤال
  // ═══════════════════════════════════════
  const handleAddQuestion = async (questionData) => {
    if (!editingQuiz) return;
    setSavingQuestion(true);
    try {
      const res = await api.post(`/quizzes/${editingQuiz.id}/questions`, questionData);
      setQuizQuestions(prev => [...prev, res.data]);
      toast.success('تم إضافة السؤال');
    } catch (err) {
      toast.error(err.response?.data?.message || 'خطأ في إضافة السؤال');
    } finally {
      setSavingQuestion(false);
    }
  };

  // ═══════════════════════════════════════
  // تعديل سؤال
  // ═══════════════════════════════════════
  const handleUpdateQuestion = async (questionId, questionData) => {
    setSavingQuestion(true);
    try {
      const res = await api.put(`/quizzes/questions/${questionId}`, questionData);
      setQuizQuestions(prev => prev.map(q => q.id === questionId ? res.data : q));
      toast.success('تم تحديث السؤال');
    } catch (err) {
      toast.error(err.response?.data?.message || 'خطأ في تحديث السؤال');
    } finally {
      setSavingQuestion(false);
    }
  };

  // ═══════════════════════════════════════
  // حذف سؤال
  // ═══════════════════════════════════════
  const handleDeleteQuestion = async (questionId) => {
    if (!window.confirm('هل تريد حذف هذا السؤال؟')) return;
    try {
      await api.delete(`/quizzes/questions/${questionId}`);
      setQuizQuestions(prev => prev.filter(q => q.id !== questionId));
      toast.success('تم حذف السؤال');
    } catch {
      toast.error('خطأ في حذف السؤال');
    }
  };

  // ═══════════════════════════════════════
  // إضافة أسئلة دفعة واحدة (من CSV أو AI)
  // ═══════════════════════════════════════
  const handleBatchAdd = async (questions) => {
    if (!editingQuiz || !questions.length) return;
    try {
      const res = await api.post(`/quizzes/${editingQuiz.id}/questions/batch`, { questions });
      if (res.data.questions) {
        setQuizQuestions(prev => [...prev, ...res.data.questions]);
      }
      toast.success(`تم إضافة ${res.data.imported} سؤال`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'خطأ في إضافة الأسئلة');
    }
  };

  // ═══════════════════════════════════════
  // سحب وإفلات الأسئلة
  // ═══════════════════════════════════════
  const handleDragStart = (idx) => setDraggedIdx(idx);
  const handleDragOver = (e, idx) => { e.preventDefault(); setDragOverIdx(idx); };
  const handleDragEnd = () => { setDraggedIdx(null); setDragOverIdx(null); };

  const handleDrop = async (e, dropIdx) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === dropIdx) {
      setDraggedIdx(null);
      setDragOverIdx(null);
      return;
    }

    const newQuestions = [...quizQuestions];
    const [moved] = newQuestions.splice(draggedIdx, 1);
    newQuestions.splice(dropIdx, 0, moved);
    setQuizQuestions(newQuestions);
    setDraggedIdx(null);
    setDragOverIdx(null);

    // حفظ الترتيب
    if (editingQuiz) {
      try {
        const orders = newQuestions.map((q, i) => ({ id: q.id, sort_order: i }));
        await api.put(`/quizzes/${editingQuiz.id}/questions/reorder`, { orders });
      } catch {
        toast.error('خطأ في حفظ الترتيب');
      }
    }
  };

  // ═══════════════════════════════════════
  // عرض القائمة
  // ═══════════════════════════════════════
  if (view === 'list') {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-800">إدارة الاختبارات</h1>
              <p className="text-sm text-gray-500 mt-0.5">{quizzes.length} اختبار</p>
            </div>
            <Button onClick={() => openEditor()}>+ إضافة اختبار</Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
          ) : quizzes.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
              </svg>
              <p className="text-sm">لا توجد اختبارات بعد</p>
              <button onClick={() => openEditor()} className="text-sm text-blue-600 mt-2 hover:underline">إنشاء أول اختبار</button>
            </div>
          ) : (
            <div className="space-y-3">
              {quizzes.map(quiz => (
                <div key={quiz.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between hover:border-gray-300 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-bold text-gray-800 truncate">{quiz.title}</h3>
                      {!quiz.is_published && (
                        <span className="text-[10px] bg-yellow-50 text-yellow-600 px-1.5 py-0.5 rounded font-medium">مسودة</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {quiz.questions_count} سؤال
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {quiz.time_limit || quiz.duration_minutes} د
                      </span>
                      {Number(quiz.attempts_count) > 0 && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                          </svg>
                          {quiz.attempts_count} محاولة
                        </span>
                      )}
                      {quiz.subject_name && (
                        <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded text-[10px] font-medium">{quiz.subject_name}</span>
                      )}
                      {quiz.grade_name && (
                        <span className="bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded text-[10px] font-medium">{quiz.grade_name}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mr-4">
                    <button onClick={() => openEditor(quiz)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button onClick={() => handleDeleteQuiz(quiz.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DashboardLayout>
    );
  }

  // ═══════════════════════════════════════
  // عرض المحرر
  // ═══════════════════════════════════════
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setView('list'); resetForm(); }}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-800">
                {editingQuiz ? 'تعديل الاختبار' : 'اختبار جديد'}
              </h1>
              {editingQuiz && (
                <p className="text-xs text-gray-400 mt-0.5">{quizQuestions.length} سؤال</p>
              )}
            </div>
          </div>
        </div>

        {/* بيانات الاختبار */}
        <form onSubmit={handleSaveQuiz} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            بيانات الاختبار
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="عنوان الاختبار *">
              <Input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} placeholder="عنوان الاختبار" required />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="المدة (دقيقة)">
                <Input type="number" value={form.time_limit} onChange={e => setForm(f => ({...f, time_limit: parseInt(e.target.value) || 30}))} min={1} />
              </FormField>
              <FormField label="درجة النجاح %">
                <Input type="number" value={form.passing_score} onChange={e => setForm(f => ({...f, passing_score: parseInt(e.target.value) || 60}))} min={0} max={100} />
              </FormField>
            </div>
          </div>

          <FormField label="الوصف">
            <Textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} rows={2} placeholder="وصف الاختبار..." />
          </FormField>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <FormField label="المرحلة">
              <Select value={form.stage_id} onChange={e => setForm(f => ({...f, stage_id: e.target.value}))}>
                <option value="">اختر</option>
                {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </FormField>
            <FormField label="الصف">
              <Select value={form.grade_id} onChange={e => setForm(f => ({...f, grade_id: e.target.value}))}>
                <option value="">اختر</option>
                {grades.filter(g => !form.stage_id || g.stage_id === form.stage_id).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </Select>
            </FormField>
            <FormField label="المادة">
              <Select value={form.subject_id} onChange={e => setForm(f => ({...f, subject_id: e.target.value}))}>
                <option value="">اختر</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </FormField>
            <FormField label="الفصل">
              <Select value={form.semester} onChange={e => setForm(f => ({...f, semester: parseInt(e.target.value)}))}>
                <option value={0}>مشترك</option>
                <option value={1}>الأول</option>
                <option value={2}>الثاني</option>
              </Select>
            </FormField>
          </div>

          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_published} onChange={e => setForm(f => ({...f, is_published: e.target.checked}))} className="w-4 h-4 text-blue-600 rounded" />
              <span className="text-sm text-gray-700">منشور</span>
            </label>
            <Button type="submit" disabled={saving}>
              {saving ? 'جاري الحفظ...' : (editingQuiz ? 'حفظ التعديلات' : 'إنشاء الاختبار')}
            </Button>
          </div>
        </form>

        {/* الأسئلة */}
        {editingQuiz && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                الأسئلة ({quizQuestions.length})
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowCsvModal(true)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  استيراد CSV
                </button>
                {aiAvailable && (
                  <button
                    onClick={() => setShowAiModal(true)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-violet-50 text-violet-600 hover:bg-violet-100 transition-colors"
                  >
                    <span className="text-sm">&#10024;</span>
                    توليد بالذكاء الاصطناعي
                  </button>
                )}
              </div>
            </div>

            {/* قائمة الأسئلة */}
            {quizQuestions.map((question, idx) => (
              <QuestionCard
                key={question.id}
                question={question}
                index={idx}
                onUpdate={handleUpdateQuestion}
                onDelete={handleDeleteQuestion}
                saving={savingQuestion}
                isDragging={draggedIdx === idx}
                isDragOver={dragOverIdx === idx}
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
              />
            ))}

            {/* إضافة سؤال جديد */}
            <NewQuestionForm onAdd={handleAddQuestion} saving={savingQuestion} />
          </div>
        )}
      </div>

      {/* CSV Import Modal */}
      {showCsvModal && editingQuiz && (
        <CsvImportModal
          quizId={editingQuiz.id}
          onClose={() => setShowCsvModal(false)}
          onImport={handleBatchAdd}
        />
      )}

      {/* AI Generate Modal */}
      {showAiModal && editingQuiz && (
        <AiGenerateModal
          quizId={editingQuiz.id}
          onClose={() => setShowAiModal(false)}
          onAdd={handleBatchAdd}
          stages={stages}
          grades={grades}
          subjects={subjects}
        />
      )}
    </DashboardLayout>
  );
}

// ═══════════════════════════════════════
// بطاقة سؤال موجود
// ═══════════════════════════════════════
function QuestionCard({ question, index, onUpdate, onDelete, saving, isDragging, isDragOver, onDragStart, onDragOver, onDrop, onDragEnd }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(null);

  const startEdit = () => {
    setEditData({
      type: question.type,
      question_text: question.question_text,
      explanation: question.explanation || '',
      points: question.points || 1,
      options: question.options || [],
      metadata: question.metadata || null
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    const payload = {
      type: editData.type,
      question_text: editData.question_text,
      explanation: editData.explanation,
      points: editData.points,
    };

    if (editData.type === 'matching' || editData.type === 'ordering') {
      payload.metadata = JSON.stringify(editData.metadata);
      payload.options = JSON.stringify([]);
    } else {
      payload.options = JSON.stringify(editData.options.map(o => ({
        text: o.option_text || o.text,
        is_correct: o.is_correct
      })));
    }

    await onUpdate(question.id, payload);
    setIsEditing(false);
  };

  const typeLabel = QUESTION_TYPES.find(t => t.value === question.type)?.label || question.type;
  const typeColors = {
    multiple_choice: 'bg-blue-50 text-blue-600',
    true_false: 'bg-amber-50 text-amber-600',
    fill_blank: 'bg-purple-50 text-purple-600',
    matching: 'bg-teal-50 text-teal-600',
    ordering: 'bg-orange-50 text-orange-600',
  };

  if (isEditing && editData) {
    return (
      <div className="bg-white rounded-xl border-2 border-blue-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-blue-600">تعديل سؤال {index + 1}</span>
          <button onClick={() => setIsEditing(false)} className="text-xs text-gray-400 hover:text-gray-600">إلغاء</button>
        </div>
        <QuestionFormFields
          data={editData}
          onChange={setEditData}
        />
        <div className="flex gap-2 pt-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`bg-white rounded-xl border p-4 transition-all ${
        isDragging ? 'opacity-40 scale-[0.98]' : ''
      } ${isDragOver ? 'border-blue-400 shadow-md' : 'border-gray-200'}`}
    >
      <div className="flex items-start gap-3">
        {/* مقبض السحب */}
        <div className="cursor-grab active:cursor-grabbing pt-0.5 text-gray-300 hover:text-gray-500">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-bold text-gray-400">{index + 1}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${typeColors[question.type] || 'bg-gray-50 text-gray-500'}`}>
              {typeLabel}
            </span>
            {question.points > 1 && (
              <span className="text-[10px] bg-gray-50 text-gray-500 px-1.5 py-0.5 rounded">{question.points} نقاط</span>
            )}
          </div>
          <p className="text-sm text-gray-800 font-medium mb-2">{question.question_text}</p>

          {/* الخيارات */}
          {question.options && question.options.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {question.options.map((opt, i) => (
                <span key={opt.id || i} className={`text-xs px-2 py-1 rounded-lg ${
                  opt.is_correct ? 'bg-emerald-50 text-emerald-700 font-medium' : 'bg-gray-50 text-gray-500'
                }`}>
                  {opt.is_correct && '\u2713 '}
                  {opt.option_text}
                </span>
              ))}
            </div>
          )}

          {/* عرض أزواج التوصيل */}
          {question.type === 'matching' && question.metadata?.pairs && (
            <div className="space-y-1">
              {question.metadata.pairs.map((pair, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="bg-teal-50 text-teal-700 px-2 py-0.5 rounded">{pair.left}</span>
                  <svg className="w-3 h-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                  <span className="bg-teal-50 text-teal-700 px-2 py-0.5 rounded">{pair.right}</span>
                </div>
              ))}
            </div>
          )}

          {/* عرض عناصر الترتيب */}
          {question.type === 'ordering' && question.metadata?.items && (
            <div className="flex flex-wrap gap-1.5">
              {question.metadata.items.map((item, i) => (
                <span key={i} className="text-xs bg-orange-50 text-orange-700 px-2 py-1 rounded-lg">
                  {i + 1}. {item}
                </span>
              ))}
            </div>
          )}

          {question.explanation && (
            <p className="text-xs text-gray-400 mt-2 border-t border-gray-50 pt-2">
              <span className="font-medium">الشرح:</span> {question.explanation}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button onClick={startEdit} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button onClick={() => onDelete(question.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// نموذج إضافة سؤال جديد
// ═══════════════════════════════════════
function NewQuestionForm({ onAdd, saving }) {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState({
    type: 'multiple_choice',
    question_text: '',
    explanation: '',
    points: 1,
    options: [
      { text: '', is_correct: true },
      { text: '', is_correct: false },
      { text: '', is_correct: false },
      { text: '', is_correct: false },
    ],
    metadata: null
  });

  const resetData = () => {
    setData({
      type: 'multiple_choice',
      question_text: '',
      explanation: '',
      points: 1,
      options: [
        { text: '', is_correct: true },
        { text: '', is_correct: false },
        { text: '', is_correct: false },
        { text: '', is_correct: false },
      ],
      metadata: null
    });
  };

  const handleSubmit = async () => {
    if (!data.question_text.trim()) return;

    const payload = {
      type: data.type,
      question_text: data.question_text,
      explanation: data.explanation,
      points: data.points,
    };

    if (data.type === 'matching' || data.type === 'ordering') {
      payload.metadata = JSON.stringify(data.metadata);
      payload.options = JSON.stringify([]);
    } else {
      payload.options = JSON.stringify(data.options.map(o => ({
        text: o.text || o.option_text,
        is_correct: o.is_correct
      })));
    }

    await onAdd(payload);
    resetData();
    // نبقي الفورم مفتوح لإضافة أسئلة أخرى
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:text-blue-600 hover:border-blue-300 transition-colors flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        إضافة سؤال
      </button>
    );
  }

  return (
    <div className="bg-white rounded-xl border-2 border-emerald-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-emerald-600">سؤال جديد</span>
        <button onClick={() => { setIsOpen(false); resetData(); }} className="text-xs text-gray-400 hover:text-gray-600">إغلاق</button>
      </div>

      <QuestionFormFields data={data} onChange={setData} />

      <div className="flex gap-2 pt-2">
        <Button onClick={handleSubmit} disabled={saving || !data.question_text.trim()}>
          {saving ? 'جاري الإضافة...' : 'إضافة السؤال'}
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// حقول نموذج السؤال (مشترك بين الإضافة والتعديل)
// ═══════════════════════════════════════
function QuestionFormFields({ data, onChange }) {
  const setField = (field, value) => onChange(prev => ({ ...prev, [field]: value }));

  const handleTypeChange = (newType) => {
    let newOptions;
    let newMetadata = null;
    if (newType === 'true_false') {
      newOptions = [
        { text: 'صح', is_correct: true },
        { text: 'خطأ', is_correct: false }
      ];
    } else if (newType === 'fill_blank') {
      newOptions = [
        { text: '', is_correct: true }
      ];
    } else if (newType === 'matching') {
      newOptions = [];
      newMetadata = { pairs: [{ left: '', right: '' }, { left: '', right: '' }] };
    } else if (newType === 'ordering') {
      newOptions = [];
      newMetadata = { items: ['', ''] };
    } else {
      newOptions = [
        { text: '', is_correct: true },
        { text: '', is_correct: false },
        { text: '', is_correct: false },
        { text: '', is_correct: false },
      ];
    }
    onChange(prev => ({ ...prev, type: newType, options: newOptions, metadata: newMetadata }));
  };

  const updateOption = (idx, field, value) => {
    const newOptions = [...data.options];
    if (field === 'is_correct' && value === true) {
      // فقط خيار واحد صحيح (ماعدا fill_blank)
      newOptions.forEach((o, i) => { o.is_correct = i === idx; });
    } else {
      newOptions[idx] = { ...newOptions[idx], [field]: value };
    }
    onChange(prev => ({ ...prev, options: newOptions }));
  };

  const addOption = () => {
    if (data.options.length >= 6) return;
    onChange(prev => ({
      ...prev,
      options: [...prev.options, { text: '', is_correct: false }]
    }));
  };

  const removeOption = (idx) => {
    if (data.options.length <= 2) return;
    const newOptions = data.options.filter((_, i) => i !== idx);
    // تأكد من وجود خيار صحيح
    if (!newOptions.some(o => o.is_correct)) newOptions[0].is_correct = true;
    onChange(prev => ({ ...prev, options: newOptions }));
  };

  // ═══ Matching helpers ═══
  const updatePair = (idx, side, value) => {
    const pairs = [...(data.metadata?.pairs || [])];
    pairs[idx] = { ...pairs[idx], [side]: value };
    onChange(prev => ({ ...prev, metadata: { ...prev.metadata, pairs } }));
  };
  const addPair = () => {
    if ((data.metadata?.pairs?.length || 0) >= 8) return;
    const pairs = [...(data.metadata?.pairs || []), { left: '', right: '' }];
    onChange(prev => ({ ...prev, metadata: { ...prev.metadata, pairs } }));
  };
  const removePair = (idx) => {
    if ((data.metadata?.pairs?.length || 0) <= 2) return;
    const pairs = (data.metadata?.pairs || []).filter((_, i) => i !== idx);
    onChange(prev => ({ ...prev, metadata: { ...prev.metadata, pairs } }));
  };

  // ═══ Ordering helpers ═══
  const updateItem = (idx, value) => {
    const items = [...(data.metadata?.items || [])];
    items[idx] = value;
    onChange(prev => ({ ...prev, metadata: { ...prev.metadata, items } }));
  };
  const addItem = () => {
    if ((data.metadata?.items?.length || 0) >= 8) return;
    const items = [...(data.metadata?.items || []), ''];
    onChange(prev => ({ ...prev, metadata: { ...prev.metadata, items } }));
  };
  const removeItem = (idx) => {
    if ((data.metadata?.items?.length || 0) <= 2) return;
    const items = (data.metadata?.items || []).filter((_, i) => i !== idx);
    onChange(prev => ({ ...prev, metadata: { ...prev.metadata, items } }));
  };

  return (
    <div className="space-y-4">
      {/* نوع السؤال */}
      <div className="flex gap-2 flex-wrap">
        {QUESTION_TYPES.map(t => (
          <button
            key={t.value}
            type="button"
            onClick={() => handleTypeChange(t.value)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
              data.type === t.value
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* نص السؤال */}
      <Textarea
        value={data.question_text}
        onChange={e => setField('question_text', e.target.value)}
        placeholder="نص السؤال..."
        rows={2}
      />

      {/* الخيارات حسب النوع */}
      {data.type === 'multiple_choice' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">الخيارات (اختر الإجابة الصحيحة)</span>
            {data.options.length < 6 && (
              <button type="button" onClick={addOption} className="text-xs text-blue-600 hover:text-blue-800">+ خيار</button>
            )}
          </div>
          {data.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="radio"
                name="correct-option"
                checked={opt.is_correct}
                onChange={() => updateOption(i, 'is_correct', true)}
                className="w-4 h-4 text-emerald-600"
              />
              <Input
                value={opt.text || opt.option_text || ''}
                onChange={e => updateOption(i, 'text', e.target.value)}
                placeholder={`الخيار ${i + 1}`}
                className="flex-1"
              />
              {data.options.length > 2 && (
                <button type="button" onClick={() => removeOption(i)} className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {data.type === 'true_false' && (
        <div className="flex gap-3">
          {data.options.map((opt, i) => (
            <label key={i} className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
              opt.is_correct ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 bg-gray-50'
            }`}>
              <input
                type="radio"
                name="tf-correct"
                checked={opt.is_correct}
                onChange={() => updateOption(i, 'is_correct', true)}
                className="w-4 h-4 text-emerald-600"
              />
              <span className={`text-sm font-medium ${opt.is_correct ? 'text-emerald-700' : 'text-gray-600'}`}>
                {opt.text || opt.option_text}
              </span>
            </label>
          ))}
        </div>
      )}

      {data.type === 'fill_blank' && (
        <div>
          <span className="text-xs font-medium text-gray-500 mb-1.5 block">الإجابة الصحيحة</span>
          <Input
            value={data.options[0]?.text || data.options[0]?.option_text || ''}
            onChange={e => updateOption(0, 'text', e.target.value)}
            placeholder="اكتب الإجابة الصحيحة"
          />
        </div>
      )}

      {/* توصيل */}
      {data.type === 'matching' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">الأزواج (يسار ← يمين)</span>
            {(data.metadata?.pairs?.length || 0) < 8 && (
              <button type="button" onClick={addPair} className="text-xs text-teal-600 hover:text-teal-800">+ زوج</button>
            )}
          </div>
          {(data.metadata?.pairs || []).map((pair, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={pair.left}
                onChange={e => updatePair(i, 'left', e.target.value)}
                placeholder={`المصطلح ${i + 1}`}
                className="flex-1"
              />
              <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
              <Input
                value={pair.right}
                onChange={e => updatePair(i, 'right', e.target.value)}
                placeholder={`التعريف ${i + 1}`}
                className="flex-1"
              />
              {(data.metadata?.pairs?.length || 0) > 2 && (
                <button type="button" onClick={() => removePair(i)} className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ترتيب */}
      {data.type === 'ordering' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">العناصر بالترتيب الصحيح</span>
            {(data.metadata?.items?.length || 0) < 8 && (
              <button type="button" onClick={addItem} className="text-xs text-orange-600 hover:text-orange-800">+ عنصر</button>
            )}
          </div>
          <p className="text-[10px] text-gray-400">ادخل العناصر بالترتيب الصحيح، سيتم خلطها للطالب تلقائيا</p>
          {(data.metadata?.items || []).map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-400 w-5 text-center">{i + 1}</span>
              <Input
                value={item}
                onChange={e => updateItem(i, e.target.value)}
                placeholder={`العنصر ${i + 1}`}
                className="flex-1"
              />
              {(data.metadata?.items?.length || 0) > 2 && (
                <button type="button" onClick={() => removeItem(i)} className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* الشرح + النقاط */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="md:col-span-3">
          <span className="text-xs font-medium text-gray-500 mb-1.5 block">شرح الإجابة (اختياري)</span>
          <Input
            value={data.explanation}
            onChange={e => setField('explanation', e.target.value)}
            placeholder="لماذا هذه الإجابة صحيحة؟"
          />
        </div>
        <div>
          <span className="text-xs font-medium text-gray-500 mb-1.5 block">النقاط</span>
          <Input
            type="number"
            value={data.points}
            onChange={e => setField('points', parseInt(e.target.value) || 1)}
            min={1}
            max={10}
          />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// CSV Import Modal
// ═══════════════════════════════════════
function CsvImportModal({ quizId, onClose, onImport }) {
  const { toast } = useToast();
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [importing, setImporting] = useState(false);

  const CSV_TEMPLATE = `type,question_text,option1,option2,option3,option4,correct,explanation,points
multiple_choice,ما عاصمة السعودية؟,الرياض,جدة,الدمام,مكة,1,الرياض عاصمة المملكة,1
true_false,الأرض كروية,صح,خطأ,,,1,,1
fill_blank,عاصمة مصر هي ___,,,,,,القاهرة,1
matching,صل المصطلح بالتعريف,H2O=ماء,NaCl=ملح,CO2=ثاني أكسيد,,,,1
ordering,رتب الأرقام تصاعدياً,واحد,اثنان,ثلاثة,أربعة,,,1`;

  const downloadTemplate = () => {
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'quiz_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setPreview(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post(`/quizzes/${quizId}/import-csv?preview=true`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setPreview(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'خطأ في قراءة الملف');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleImport = async () => {
    if (!preview) return;
    setImporting(true);
    try {
      const validQuestions = preview.results
        .filter(r => r.valid)
        .map(r => r.question);
      await onImport(validQuestions);
      toast.success(`تم استيراد ${validQuestions.length} سؤال`);
      onClose();
    } catch {
      toast.error('خطأ في الاستيراد');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-800">استيراد أسئلة من CSV</h3>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Upload */}
          <div className="flex items-center gap-3">
            <label className="flex-1 flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-blue-300 transition-colors">
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <span className="text-sm text-gray-500">
                {uploading ? 'جاري التحليل...' : 'اختر ملف CSV'}
              </span>
              <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
            </label>
            <button onClick={downloadTemplate} className="text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap">
              تنزيل القالب
            </button>
          </div>

          {/* Preview */}
          {preview && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-xs">
                <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded">{preview.total} سطر</span>
                <span className="bg-emerald-50 text-emerald-600 px-2 py-1 rounded">{preview.valid} صالح</span>
                {preview.invalid > 0 && (
                  <span className="bg-red-50 text-red-600 px-2 py-1 rounded">{preview.invalid} خطأ</span>
                )}
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto">
                {preview.results.map((r, i) => (
                  <div key={i} className={`text-xs p-3 rounded-lg border ${
                    r.valid ? 'bg-emerald-50/50 border-emerald-100' : 'bg-red-50/50 border-red-100'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      {r.valid ? (
                        <span className="text-emerald-500">\u2713</span>
                      ) : (
                        <span className="text-red-500">\u2717</span>
                      )}
                      <span className="text-gray-400">سطر {r.row}</span>
                      <span className="font-medium text-gray-700">{r.question.question_text?.substring(0, 60) || '—'}</span>
                    </div>
                    {r.errors.length > 0 && (
                      <div className="text-red-500 mr-5">
                        {r.errors.map((err, j) => <div key={j}>{err}</div>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {preview && preview.valid > 0 && (
          <div className="p-5 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-400">
              سيتم استيراد {preview.valid} سؤال من أصل {preview.total}
            </span>
            <Button onClick={handleImport} disabled={importing}>
              {importing ? 'جاري الاستيراد...' : `استيراد ${preview.valid} سؤال`}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// AI Generate Modal (Claude API + File Upload)
// ═══════════════════════════════════════
const DIFFICULTY_LEVELS = [
  { value: 'easy', label: 'سهل', color: 'bg-green-100 text-green-700' },
  { value: 'medium', label: 'متوسط', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'hard', label: 'صعب', color: 'bg-red-100 text-red-700' },
];

function AiGenerateModal({ quizId, onClose, onAdd, stages, grades, subjects }) {
  const { toast } = useToast();
  const fileInputRef = useRef(null);

  // حالة التوليد
  const [prompt, setPrompt] = useState('');
  const [count, setCount] = useState(5);
  const [types, setTypes] = useState(['multiple_choice', 'true_false']);
  const [difficulty, setDifficulty] = useState('medium');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(null);
  const [selected, setSelected] = useState({});
  const [adding, setAdding] = useState(false);

  // رفع ملف
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // قوائم متدرجة
  const [stageId, setStageId] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [subjectId, setSubjectId] = useState('');

  // فلترة الصفوف حسب المرحلة
  const filteredGrades = stageId
    ? grades.filter(g => String(g.stage_id) === String(stageId))
    : [];

  // فلترة المواد حسب الصف
  const filteredSubjects = gradeId
    ? subjects.filter(s => {
        const subjectGrades = s.grades || [];
        return subjectGrades.some(g => String(g.grade_id) === String(gradeId));
      })
    : [];

  const toggleType = (type) => {
    setTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  // معالجة الملف
  const handleFileSelect = (selectedFile) => {
    if (!selectedFile) return;

    const maxSize = 20 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      toast.error('حجم الملف يتجاوز 20MB');
      return;
    }

    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(selectedFile.type)) {
      toast.error('نوع الملف غير مدعوم. الأنواع المسموحة: PDF, JPG, PNG, WebP');
      return;
    }

    setFile(selectedFile);

    // معاينة
    if (selectedFile.type.startsWith('image/')) {
      setFilePreview(URL.createObjectURL(selectedFile));
    } else {
      setFilePreview(null);
    }
  };

  const removeFile = () => {
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // أحداث السحب والإفلات
  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  };

  // توليد
  const handleGenerate = async () => {
    if (!prompt.trim() || types.length === 0) return;
    setGenerating(true);
    setGenerated(null);
    try {
      const formData = new FormData();
      formData.append('prompt', prompt.trim());
      formData.append('count', count);
      formData.append('types', JSON.stringify(types));
      formData.append('difficulty', difficulty);

      // أسماء المرحلة/الصف/المادة (للسياق النصي)
      if (stageId) {
        const s = stages.find(st => String(st.id) === String(stageId));
        if (s) formData.append('stage', s.name);
      }
      if (gradeId) {
        const g = grades.find(gr => String(gr.id) === String(gradeId));
        if (g) formData.append('grade', g.name);
      }
      if (subjectId) {
        const sub = subjects.find(su => String(su.id) === String(subjectId));
        if (sub) formData.append('subject', sub.name);
      }

      if (file) {
        formData.append('file', file);
      }

      const res = await api.post(`/quizzes/${quizId}/generate`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000
      });

      setGenerated(res.data.questions);
      const sel = {};
      res.data.questions.forEach((_, i) => { sel[i] = true; });
      setSelected(sel);
    } catch (err) {
      toast.error(err.response?.data?.message || 'خطأ في التوليد');
    } finally {
      setGenerating(false);
    }
  };

  const handleAdd = async () => {
    if (!generated) return;
    setAdding(true);
    try {
      const selectedQuestions = generated.filter((_, i) => selected[i]);
      await onAdd(selectedQuestions);
      toast.success(`تم إضافة ${selectedQuestions.length} سؤال`);
      onClose();
    } catch {
      toast.error('خطأ في إضافة الأسئلة');
    } finally {
      setAdding(false);
    }
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;
  const typeLabel = (type) => QUESTION_TYPES.find(t => t.value === type)?.label || type;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
            <span>&#10024;</span>
            توليد أسئلة بالذكاء الاصطناعي
          </h3>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!generated ? (
            <>
              {/* منطقة رفع الملف */}
              <div>
                <span className="text-xs font-medium text-gray-500 mb-1.5 block">رفع ملف (اختياري)</span>
                {!file ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
                      isDragging
                        ? 'border-violet-400 bg-violet-50'
                        : 'border-gray-200 hover:border-gray-300 bg-gray-50/50'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.webp"
                      onChange={e => handleFileSelect(e.target.files[0])}
                      className="hidden"
                    />
                    <svg className="w-8 h-8 mx-auto text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                    </svg>
                    <p className="text-xs text-gray-400">
                      اسحب ملف هنا أو <span className="text-violet-600">اختر ملف</span>
                    </p>
                    <p className="text-[10px] text-gray-300 mt-1">PDF, PNG, JPG, WebP — حد أقصى 20MB</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                    {filePreview ? (
                      <img src={filePreview} alt="معاينة" className="w-12 h-12 object-cover rounded-lg" />
                    ) : (
                      <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 font-medium truncate">{file.name}</p>
                      <p className="text-[10px] text-gray-400">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                    </div>
                    <button onClick={removeFile} className="p-1 text-gray-400 hover:text-red-500 rounded">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              {/* القوائم المتدرجة */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <span className="text-xs font-medium text-gray-500 mb-1.5 block">المرحلة</span>
                  <select
                    value={stageId}
                    onChange={e => { setStageId(e.target.value); setGradeId(''); setSubjectId(''); }}
                    className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 bg-white focus:ring-1 focus:ring-violet-300 focus:border-violet-300"
                  >
                    <option value="">الكل</option>
                    {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <span className="text-xs font-medium text-gray-500 mb-1.5 block">الصف</span>
                  <select
                    value={gradeId}
                    onChange={e => { setGradeId(e.target.value); setSubjectId(''); }}
                    disabled={!stageId}
                    className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 bg-white focus:ring-1 focus:ring-violet-300 focus:border-violet-300 disabled:opacity-50"
                  >
                    <option value="">الكل</option>
                    {filteredGrades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div>
                  <span className="text-xs font-medium text-gray-500 mb-1.5 block">المادة</span>
                  <select
                    value={subjectId}
                    onChange={e => setSubjectId(e.target.value)}
                    disabled={!gradeId}
                    className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 bg-white focus:ring-1 focus:ring-violet-300 focus:border-violet-300 disabled:opacity-50"
                  >
                    <option value="">الكل</option>
                    {filteredSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              {/* الموضوع */}
              <div>
                <span className="text-xs font-medium text-gray-500 mb-1.5 block">وصف الأسئلة المطلوبة</span>
                <Textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder={file ? 'مثال: أنشئ أسئلة من محتوى الملف المرفق...' : 'مثال: 5 أسئلة عن الكسور العشرية للصف السادس...'}
                  rows={3}
                />
              </div>

              {/* العدد + الصعوبة */}
              <div className="flex items-end gap-4">
                <div>
                  <span className="text-xs font-medium text-gray-500 mb-1.5 block">عدد الأسئلة</span>
                  <Input
                    type="number"
                    value={count}
                    onChange={e => setCount(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
                    min={1}
                    max={20}
                    className="w-20"
                  />
                </div>
                <div className="flex-1">
                  <span className="text-xs font-medium text-gray-500 mb-1.5 block">مستوى الصعوبة</span>
                  <div className="flex gap-2">
                    {DIFFICULTY_LEVELS.map(d => (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => setDifficulty(d.value)}
                        className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                          difficulty === d.value ? d.color : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* الأنواع */}
              <div>
                <span className="text-xs font-medium text-gray-500 mb-2 block">أنواع الأسئلة</span>
                <div className="flex flex-wrap gap-2">
                  {QUESTION_TYPES.map(t => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => toggleType(t.value)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                        types.includes(t.value)
                          ? 'bg-violet-100 text-violet-700'
                          : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleGenerate}
                disabled={generating || !prompt.trim() || types.length === 0}
                className="w-full"
              >
                {generating ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    جاري التوليد... (قد يستغرق دقيقة)
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <span>&#10024;</span>
                    {file ? 'توليد أسئلة من الملف' : 'توليد الأسئلة'}
                  </span>
                )}
              </Button>
            </>
          ) : (
            <>
              {/* نتائج التوليد */}
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{generated.length} سؤال تم توليده</span>
                <button
                  onClick={() => { setGenerated(null); setSelected({}); }}
                  className="text-blue-600 hover:text-blue-800"
                >
                  توليد جديد
                </button>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {generated.map((q, i) => (
                  <div key={i} className={`p-3 rounded-lg border transition-colors ${
                    selected[i] ? 'bg-violet-50/50 border-violet-200' : 'bg-gray-50 border-gray-100'
                  }`}>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!selected[i]}
                        onChange={e => setSelected(prev => ({ ...prev, [i]: e.target.checked }))}
                        className="w-4 h-4 text-violet-600 rounded mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{typeLabel(q.type)}</span>
                        </div>
                        <p className="text-sm text-gray-800 font-medium">{q.question_text}</p>
                        {q.options && q.options.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {q.options.map((opt, j) => (
                              <span key={j} className={`text-[10px] px-1.5 py-0.5 rounded ${
                                opt.is_correct ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'
                              }`}>
                                {opt.text || opt.option_text}
                              </span>
                            ))}
                          </div>
                        )}
                        {q.metadata?.pairs && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {q.metadata.pairs.map((p, j) => (
                              <span key={j} className="text-[10px] bg-teal-50 text-teal-600 px-1.5 py-0.5 rounded">
                                {p.left} → {p.right}
                              </span>
                            ))}
                          </div>
                        )}
                        {q.metadata?.items && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {q.metadata.items.map((item, j) => (
                              <span key={j} className="text-[10px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded">
                                {j + 1}. {item}
                              </span>
                            ))}
                          </div>
                        )}
                        {q.explanation && (
                          <p className="text-[10px] text-gray-400 mt-1">{q.explanation}</p>
                        )}
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {generated && selectedCount > 0 && (
          <div className="p-5 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-400">
              {selectedCount} سؤال محدد من {generated.length}
            </span>
            <Button onClick={handleAdd} disabled={adding}>
              {adding ? 'جاري الإضافة...' : `إضافة ${selectedCount} سؤال`}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
