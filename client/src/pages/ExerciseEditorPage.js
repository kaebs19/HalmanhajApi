import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import DashboardLayout from './DashboardLayout';
import { Button, Card, Input, Textarea, FormField, LoadingState, EmptyState, Alert } from '../components/ui';
import { useToast } from '../components/ui/Toast';
import ExerciseQuestionForm, {
  EXERCISE_TYPES, TYPE_LABEL, TYPE_ICON, TYPE_COLORS,
  DIFFICULTY_OPTIONS,
  buildQuestionPayload, questionToFormData, getEmptyFormData,
} from '../components/ExerciseQuestionForm';

// ===================================
// Type Selector Grid (3x3 icon grid)
// ===================================
function TypeSelectorGrid({ value, onChange, disabled }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {EXERCISE_TYPES.map(t => {
        const isSelected = value === t.value;
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => !disabled && onChange(t.value)}
            disabled={disabled}
            className={`flex flex-col items-center justify-center gap-1.5 p-4 rounded-xl transition-all duration-200 border-2 ${
              isSelected
                ? 'border-blue-500 bg-blue-50 shadow-md shadow-blue-500/15'
                : disabled
                  ? 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
                  : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/50 cursor-pointer'
            }`}
          >
            <span className="text-2xl">{t.icon}</span>
            <span className={`text-xs font-medium ${isSelected ? 'text-blue-700' : 'text-gray-600'}`}>
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ===================================
// Import Modal
// ===================================
function ImportModal({ exercise, onClose, onImported }) {
  const { toast } = useToast();
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const handleImport = async () => {
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
        onImported();
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

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-bold text-gray-800">استيراد أسئلة من ملف</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Download Template */}
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

          {/* Upload File */}
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
                onClick={handleImport}
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
                    جاري...
                  </span>
                ) : 'استيراد'}
              </button>
            </div>
          </div>

          {/* Import Result */}
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

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 rounded-b-2xl flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}


// ===================================
// Main Page: Create / Edit Exercise
// ===================================
export default function ExerciseEditorPage() {
  const { exerciseId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const questionsRef = useRef(null);

  const lessonIdParam = searchParams.get('lesson_id');
  const isEditing = !!exerciseId;

  // === Location Data ===
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

  // === Exercise Data ===
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

  // === Questions ===
  const [questions, setQuestions] = useState([]);
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [editQuestionData, setEditQuestionData] = useState(null);
  const [newQuestionData, setNewQuestionData] = useState(null);
  const [savingQuestion, setSavingQuestion] = useState(false);

  // === Import & Metadata Toggle ===
  const [showImportModal, setShowImportModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);

  // === Fetch stages, grades, subjects ===
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

  // === Fetch lessons when subject changes ===
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

  // === Fetch exercise (edit mode) ===
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

      // Fill location data
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
    } catch {
      setError('خطأ في جلب بيانات التمرين');
    } finally {
      setLoading(false);
    }
  }, [exerciseId, grades]);

  // === Handle ?lesson_id=xxx ===
  useEffect(() => {
    if (lessonIdParam && !isEditing) {
      const fetchLessonInfo = async () => {
        try {
          const res = await api.get(`/lessons/${lessonIdParam}`);
          const lesson = res.data;
          if (lesson.subject_id) setSelectedSubject(lesson.subject_id);
          if (lesson.grade_id) {
            setSelectedGrade(lesson.grade_id);
            const grade = grades.find(g => String(g.id) === String(lesson.grade_id));
            if (grade?.stage_id) setSelectedStage(grade.stage_id);
          }
          setSelectedLesson(lessonIdParam);
        } catch {
          setSelectedLesson(lessonIdParam);
        }
      };
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

  // === Subject filtering with 3-layer fallback ===
  const filteredGrades = selectedStage
    ? grades.filter(g => String(g.stage_id) === String(selectedStage))
    : [];

  const filteredSubjects = selectedGrade
    ? subjects.filter(s => {
        const grade = grades.find(g => String(g.id) === String(selectedGrade));
        if (grade?.tracks && grade.tracks.length > 0) {
          const trackIds = grade.tracks.map(t => String(t.track_id || t.id));
          return s.tracks?.some(t => trackIds.includes(String(t.track_id)));
        }
        if (s.grades?.some(g => String(g.grade_id) === String(selectedGrade))) return true;
        if (s.grade_id && String(s.grade_id) === String(selectedGrade)) return true;
        return false;
      })
    : selectedStage
      ? subjects.filter(s => {
          if (s.grades?.some(g => String(g.stage_id) === String(selectedStage))) return true;
          if (s.tracks?.some(t => String(t.stage_id) === String(selectedStage))) return true;
          if (s.grade_id) {
            const g = grades.find(gr => String(gr.id) === String(s.grade_id));
            if (g && String(g.stage_id) === String(selectedStage)) return true;
          }
          return false;
        })
      : [];

  // === Handlers ===
  const handleStageChange = (val) => {
    setSelectedStage(val);
    setSelectedGrade('');
    setSelectedSubject('');
    setSelectedLesson('');
  };
  const handleGradeChange = (val) => {
    setSelectedGrade(val);
    setSelectedSubject('');
    setSelectedLesson('');
  };
  const handleSubjectChange = (val) => {
    setSelectedSubject(val);
    setSelectedLesson('');
  };

  // === Save exercise (create/update) ===
  const handleSaveExercise = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error('عنوان التمرين مطلوب');
      return;
    }
    if (!selectedSubject && !isEditing) {
      toast.error('يجب اختيار المادة أولاً');
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
        setShowMetadata(false);
        toast.success('تم تحديث التمرين');
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
        toast.success('تم إنشاء التمرين — أضف الأسئلة الآن');
        navigate(`/admin/exercises/${res.data.id}/edit`, { replace: true });
        // Smooth scroll to questions section
        setTimeout(() => {
          questionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'خطأ في حفظ التمرين');
    } finally {
      setSaving(false);
    }
  };

  // === Add question ===
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

  // === Update question ===
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

  // === Delete question ===
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

  // === Toggle publish (مع تحقق) ===
  const handleTogglePublish = async () => {
    if (!exercise) return;
    if (!exercise.is_published && questions.length === 0) {
      toast.error('لا يمكن نشر تمرين بدون أسئلة');
      return;
    }
    try {
      const res = await api.patch(`/exercises/${exercise.id}/publish`);
      setExercise(prev => ({ ...prev, is_published: res.data.is_published }));
      toast.success(res.data.is_published ? 'تم نشر التمرين' : 'تم إلغاء النشر');
    } catch {
      toast.error('خطأ في تغيير حالة النشر');
    }
  };

  // === ترتيب الأسئلة ===
  const handleMoveQuestion = async (idx, direction) => {
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= questions.length) return;
    const newQuestions = [...questions];
    [newQuestions[idx], newQuestions[newIdx]] = [newQuestions[newIdx], newQuestions[idx]];
    setQuestions(newQuestions);
    try {
      await api.put(`/exercises/${exercise.id}/questions/reorder`, {
        orders: newQuestions.map((q, i) => ({ id: q.id, order_index: i })),
      });
    } catch {
      toast.error('خطأ في ترتيب الأسئلة');
    }
  };

  // === Reload questions after import ===
  const handleImportDone = async () => {
    try {
      const qRes = await api.get(`/exercises/${exercise.id}`);
      setQuestions(qRes.data.questions || []);
    } catch { /* silent */ }
  };

  // === Start editing a question ===
  const startEditQuestion = (q) => {
    setEditingQuestionId(q.id);
    setEditQuestionData(questionToFormData(exercise.type, q));
  };

  // === Breadcrumb names ===
  const selectedStageName = stages.find(s => String(s.id) === String(selectedStage))?.name || '';
  const selectedGradeName = grades.find(g => String(g.id) === String(selectedGrade))?.name || '';
  const selectedSubjectName = subjects.find(s => String(s.id) === String(selectedSubject))?.name || '';
  const selectedLessonName = lessons.find(l => String(l.id) === String(selectedLesson))?.title || '';

  if (loading) {
    return <DashboardLayout><LoadingState /></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className={`mb-6 max-w-4xl mx-auto ${exercise ? 'pb-24' : ''}`}>

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

        {/* ============================== */}
        {/* Phase 1: Setup (combined)      */}
        {/* ============================== */}
        {!exercise ? (
          <Card className="p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-6">
              إنشاء تمرين جديد
            </h2>

            {loadingLocation ? (
              <LoadingState />
            ) : (
              <form onSubmit={handleSaveExercise} className="space-y-6">
                {/* Cascading Dropdowns */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Stage */}
                  <FormField label="المرحلة الدراسية">
                    <select
                      value={selectedStage}
                      onChange={e => handleStageChange(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none"
                    >
                      <option value="">اختر المرحلة</option>
                      {stages.map(s => (
                        <option key={s.id} value={s.id}>{s.icon || ''} {s.name}</option>
                      ))}
                    </select>
                  </FormField>

                  {/* Grade */}
                  <FormField label="الصف">
                    <select
                      value={selectedGrade}
                      onChange={e => handleGradeChange(e.target.value)}
                      disabled={!selectedStage}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none disabled:bg-gray-50 disabled:text-gray-400"
                    >
                      <option value="">{selectedStage ? 'اختر الصف' : 'اختر المرحلة أولاً'}</option>
                      {filteredGrades.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </FormField>

                  {/* Subject */}
                  <FormField label="المادة">
                    <select
                      value={selectedSubject}
                      onChange={e => handleSubjectChange(e.target.value)}
                      disabled={!selectedStage}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none disabled:bg-gray-50 disabled:text-gray-400"
                    >
                      <option value="">{selectedStage ? 'اختر المادة' : 'اختر المرحلة أولاً'}</option>
                      {filteredSubjects.map(s => (
                        <option key={s.id} value={s.id}>{s.icon || ''} {s.name}</option>
                      ))}
                    </select>
                  </FormField>

                  {/* Lesson */}
                  <FormField label={<>الدرس <span className="text-gray-400 font-normal text-xs">(اختياري)</span></>}>
                    <select
                      value={selectedLesson}
                      onChange={e => setSelectedLesson(e.target.value)}
                      disabled={!selectedSubject}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none disabled:bg-gray-50 disabled:text-gray-400"
                    >
                      <option value="">بدون درس محدد</option>
                      {loadingLessons ? (
                        <option disabled>جاري التحميل...</option>
                      ) : (
                        lessons.map(l => (
                          <option key={l.id} value={l.id}>{l.title}</option>
                        ))
                      )}
                    </select>
                  </FormField>
                </div>

                {/* Title */}
                <FormField label="عنوان التمرين">
                  <Input
                    type="text"
                    value={form.title}
                    onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="مثال: تمرين على جمع الأعداد"
                    required
                  />
                </FormField>

                {/* Type Selector Grid */}
                <div>
                  <span className="text-sm font-medium text-gray-700 mb-3 block">نوع التمرين</span>
                  <TypeSelectorGrid
                    value={form.type}
                    onChange={(val) => setForm(prev => ({ ...prev, type: val }))}
                    disabled={false}
                  />
                </div>

                {/* Difficulty */}
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

                {/* XP + Time */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                {/* Save Button */}
                <div className="pt-4 border-t">
                  <button
                    type="submit"
                    disabled={saving || !selectedSubject || !form.title.trim()}
                    className={`w-full py-3 rounded-xl text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
                      saving || !selectedSubject || !form.title.trim()
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-l from-blue-600 to-blue-700 text-white hover:shadow-lg hover:shadow-blue-500/25'
                    }`}
                  >
                    {saving ? (
                      <>
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity=".25" />
                          <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" opacity=".75" />
                        </svg>
                        جاري الحفظ...
                      </>
                    ) : (
                      <>
                        حفظ وأضف الأسئلة
                        <svg className="w-4 h-4 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </Card>
        ) : (
          <>
            {/* ============================== */}
            {/* Phase 2: Questions             */}
            {/* ============================== */}

            {/* Collapsible Metadata Summary */}
            <div className="bg-white rounded-xl border border-gray-200 mb-4">
              <button
                type="button"
                onClick={() => setShowMetadata(!showMetadata)}
                className="w-full flex items-center justify-between px-5 py-3 text-sm"
              >
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-bold text-gray-800">{exercise.title || form.title}</span>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${TYPE_COLORS[exercise.type || form.type] || 'bg-gray-100'}`}>
                    {TYPE_ICON[exercise.type || form.type]} {TYPE_LABEL[exercise.type || form.type]}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                    DIFFICULTY_OPTIONS.find(d => d.value === (exercise.difficulty || form.difficulty))?.color || ''
                  }`}>
                    {DIFFICULTY_OPTIONS.find(d => d.value === (exercise.difficulty || form.difficulty))?.label || 'متوسط'}
                  </span>
                  <span className="text-xs text-gray-400">{form.xp_reward} XP</span>
                </div>
                <svg className={`w-4 h-4 text-gray-400 transition-transform ${showMetadata ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showMetadata && (
                <div className="px-5 pb-5 border-t">
                  <form onSubmit={handleSaveExercise} className="space-y-4 pt-4">
                    {/* Location Dropdowns */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField label="المرحلة">
                        <select
                          value={selectedStage}
                          onChange={e => handleStageChange(e.target.value)}
                          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none"
                        >
                          <option value="">اختر المرحلة</option>
                          {stages.map(s => (
                            <option key={s.id} value={s.id}>{s.icon || ''} {s.name}</option>
                          ))}
                        </select>
                      </FormField>
                      <FormField label="الصف">
                        <select
                          value={selectedGrade}
                          onChange={e => handleGradeChange(e.target.value)}
                          disabled={!selectedStage}
                          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none disabled:bg-gray-50 disabled:text-gray-400"
                        >
                          <option value="">{selectedStage ? 'اختر الصف' : '-'}</option>
                          {filteredGrades.map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                        </select>
                      </FormField>
                      <FormField label="المادة">
                        <select
                          value={selectedSubject}
                          onChange={e => handleSubjectChange(e.target.value)}
                          disabled={!selectedStage}
                          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none disabled:bg-gray-50 disabled:text-gray-400"
                        >
                          <option value="">{selectedStage ? 'اختر المادة' : '-'}</option>
                          {filteredSubjects.map(s => (
                            <option key={s.id} value={s.id}>{s.icon || ''} {s.name}</option>
                          ))}
                        </select>
                      </FormField>
                      <FormField label="الدرس (اختياري)">
                        <select
                          value={selectedLesson}
                          onChange={e => setSelectedLesson(e.target.value)}
                          disabled={!selectedSubject}
                          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none disabled:bg-gray-50 disabled:text-gray-400"
                        >
                          <option value="">بدون درس</option>
                          {lessons.map(l => (
                            <option key={l.id} value={l.id}>{l.title}</option>
                          ))}
                        </select>
                      </FormField>
                    </div>

                    {/* Title */}
                    <FormField label="عنوان التمرين">
                      <Input
                        type="text"
                        value={form.title}
                        onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="عنوان التمرين"
                        required
                      />
                    </FormField>

                    {/* Type (read-only in edit mode) */}
                    <div>
                      <span className="text-sm font-medium text-gray-700 mb-2 block">نوع التمرين</span>
                      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${TYPE_COLORS[form.type] || 'bg-gray-100'}`}>
                        <span>{TYPE_ICON[form.type]}</span>
                        <span className="font-medium">{TYPE_LABEL[form.type]}</span>
                        <span className="text-xs opacity-60">(لا يمكن تغيير النوع بعد الإنشاء)</span>
                      </div>
                    </div>

                    {/* Difficulty */}
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

                    {/* XP + Time */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                    {/* Save Button */}
                    <div className="flex gap-3 pt-3 border-t">
                      <Button type="submit" disabled={saving}>
                        {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                      </Button>
                      <Button variant="secondary" type="button" onClick={() => setShowMetadata(false)}>
                        إلغاء
                      </Button>
                    </div>
                  </form>
                </div>
              )}
            </div>

            {/* Questions Section */}
            <div ref={questionsRef}>
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-800">
                    الأسئلة ({questions.length})
                  </h2>
                </div>

                {/* Saved Questions List */}
                {questions.length > 0 ? (
                  <div className="space-y-3 mb-6">
                    {questions.map((q, idx) => (
                      <div key={q.id} className="border rounded-xl p-4 bg-white">
                        {editingQuestionId === q.id ? (
                          /* Edit Mode */
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
                          /* View Mode */
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
                            <div className="flex items-center gap-1">
                              {/* ترتيب */}
                              <button
                                onClick={() => handleMoveQuestion(idx, -1)}
                                disabled={idx === 0}
                                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                title="نقل لأعلى"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                              </button>
                              <button
                                onClick={() => handleMoveQuestion(idx, 1)}
                                disabled={idx === questions.length - 1}
                                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                title="نقل لأسفل"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                              </button>
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
                ) : (
                  <EmptyState
                    icon="📝"
                    message="لا توجد أسئلة بعد"
                    subMessage="أضف أول سؤال لهذا التمرين"
                  />
                )}

                {/* New Question Form */}
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
            </div>

            {/* ============================== */}
            {/* Sticky Bottom Action Bar       */}
            {/* ============================== */}
            <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-lg">
              <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
                {/* Questions count */}
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="font-bold text-gray-800">{questions.length}</span>
                  <span>سؤال</span>
                  {exercise.is_published && (
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">منشور</span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {/* Preview Button */}
                  {questions.length > 0 && (
                    <button
                      onClick={() => setShowPreview(true)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-white border border-violet-300 text-violet-600 rounded-lg text-sm font-medium hover:bg-violet-50 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      معاينة
                    </button>
                  )}

                  {/* Import Button */}
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    استيراد
                  </button>

                  {/* Publish Button */}
                  <button
                    onClick={handleTogglePublish}
                    className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-bold transition-colors ${
                      exercise.is_published
                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                    }`}
                  >
                    {exercise.is_published ? (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        منشور
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        نشر التمرين
                      </>
                    )}
                  </button>

                  {/* Back to list */}
                  <Link
                    to="/admin/exercises"
                    className="flex items-center gap-1 px-3 py-2 text-xs text-gray-500 hover:text-gray-700 font-medium"
                  >
                    القائمة
                  </Link>
                </div>
              </div>
            </div>

            {/* Import Modal */}
            {showImportModal && (
              <ImportModal
                exercise={exercise}
                onClose={() => setShowImportModal(false)}
                onImported={handleImportDone}
              />
            )}

            {/* Preview Modal */}
            {showPreview && (
              <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowPreview(false)}>
                <div className="bg-gray-100 rounded-2xl w-full max-w-md shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                  {/* Phone Header */}
                  <div className="bg-white rounded-t-2xl px-5 py-4 border-b flex items-center justify-between sticky top-0 z-10">
                    <div>
                      <h3 className="font-bold text-gray-800 text-sm">{exercise.title}</h3>
                      <p className="text-xs text-gray-400">{TYPE_ICON[exercise.type]} {TYPE_LABEL[exercise.type]} · {questions.length} سؤال</p>
                    </div>
                    <button onClick={() => setShowPreview(false)} className="text-gray-400 hover:text-gray-600 p-1">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Questions Preview */}
                  <div className="p-4 space-y-4">
                    {questions.map((q, idx) => (
                      <div key={q.id} className="bg-white rounded-xl p-4 shadow-sm">
                        <p className="text-xs text-gray-400 mb-2">سؤال {idx + 1} من {questions.length}</p>
                        <p className="text-sm font-medium text-gray-800 mb-3 leading-relaxed">{q.question_text}</p>

                        {/* True/False */}
                        {exercise.type === 'true_false' && (
                          <div className="flex gap-3">
                            <div className="flex-1 py-2.5 rounded-lg border-2 border-gray-200 text-center text-sm font-medium text-gray-600">صح</div>
                            <div className="flex-1 py-2.5 rounded-lg border-2 border-gray-200 text-center text-sm font-medium text-gray-600">خطأ</div>
                          </div>
                        )}

                        {/* MCQ / Speed */}
                        {(exercise.type === 'mcq' || exercise.type === 'speed') && q.question_data?.options && (
                          <div className="space-y-2">
                            {q.question_data.options.map((opt, oi) => (
                              <div key={oi} className="py-2.5 px-4 rounded-lg border-2 border-gray-200 text-sm text-gray-600">{opt}</div>
                            ))}
                          </div>
                        )}

                        {/* Fill Blank */}
                        {exercise.type === 'fill_blank' && (
                          <div className="py-2.5 px-4 rounded-lg border-2 border-dashed border-gray-300 text-sm text-gray-400">اكتب الإجابة هنا...</div>
                        )}

                        {/* Matching */}
                        {exercise.type === 'matching' && q.question_data?.left && (
                          <div className="space-y-2">
                            {q.question_data.left.map((l, li) => (
                              <div key={li} className="flex items-center gap-2">
                                <div className="flex-1 py-2 px-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700">{l}</div>
                                <span className="text-gray-300">—</span>
                                <div className="flex-1 py-2 px-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">{q.question_data.right?.[li] || '?'}</div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Ordering */}
                        {exercise.type === 'ordering' && q.correct_answer?.items && (
                          <div className="space-y-2">
                            {[...q.correct_answer.items].sort(() => Math.random() - 0.5).map((item, ii) => (
                              <div key={ii} className="py-2.5 px-4 rounded-lg border-2 border-gray-200 text-sm text-gray-600 flex items-center gap-2">
                                <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16M4 16h16" /></svg>
                                {item}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Classify */}
                        {exercise.type === 'classify' && q.question_data?.categories && (
                          <div className="grid grid-cols-2 gap-2">
                            {q.question_data.categories.map((cat, ci) => (
                              <div key={ci} className="bg-gray-50 rounded-lg p-2 border border-gray-200">
                                <p className="text-xs font-bold text-gray-600 mb-1 text-center">{cat}</p>
                                <div className="h-12 border-2 border-dashed border-gray-200 rounded flex items-center justify-center text-xs text-gray-300">اسحب هنا</div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Read Answer */}
                        {exercise.type === 'read_answer' && (
                          <div className="py-2.5 px-4 rounded-lg border-2 border-dashed border-gray-300 text-sm text-gray-400">اكتب الإجابة...</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
