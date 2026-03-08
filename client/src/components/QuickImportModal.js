import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useToast } from './ui/Toast';
import { TYPE_LABEL } from './ExerciseQuestionForm';

const IMPORT_TYPES = [
  { value: 'mcq', label: 'اختيار من متعدد', icon: '🔘' },
  { value: 'true_false', label: 'صح أم خطأ', icon: '✓✗' },
  { value: 'fill_blank', label: 'أكمل الفراغ', icon: '✏️' },
  { value: 'classify', label: 'صنّف العناصر', icon: '📂' },
];

const selectClass = 'w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none disabled:bg-gray-50 disabled:text-gray-400';

export default function QuickImportModal({ onClose, onImported }) {
  const toast = useToast();
  const navigate = useNavigate();

  // ─── Step state ───
  const [step, setStep] = useState(1);

  // ─── Step 1: Target ───
  const [stages, setStages] = useState([]);
  const [grades, setGrades] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedStage, setSelectedStage] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [exerciseType, setExerciseType] = useState('mcq');
  const [title, setTitle] = useState('');

  // ─── Step 2: Upload ───
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);

  // ─── Step 3: Result ───
  const [result, setResult] = useState(null);
  const [createdExerciseId, setCreatedExerciseId] = useState(null);

  // ─── Fetch classification data ───
  useEffect(() => {
    const fetchMeta = async () => {
      const [stagesRes, gradesRes, subjectsRes] = await Promise.allSettled([
        api.get('/stages'),
        api.get('/grades'),
        api.get('/subjects'),
      ]);
      if (stagesRes.status === 'fulfilled') setStages(stagesRes.value.data);
      if (gradesRes.status === 'fulfilled') setGrades(gradesRes.value.data);
      if (subjectsRes.status === 'fulfilled') setSubjects(subjectsRes.value.data);
    };
    fetchMeta();
  }, []);

  // ─── Cascading filters ───
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

  // ─── Auto-generate title ───
  const getAutoTitle = () => {
    const subjectName = subjects.find(s => String(s.id) === String(selectedSubject))?.name || '';
    const today = new Date().toLocaleDateString('ar-SA');
    return `${TYPE_LABEL[exerciseType] || exerciseType} - ${subjectName} - ${today}`;
  };

  // ─── Template download ───
  const handleDownloadTemplate = async () => {
    try {
      const res = await api.get(`/exercises/import-template/${exerciseType}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `قالب_${TYPE_LABEL[exerciseType] || exerciseType}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('خطأ في تحميل القالب');
    }
  };

  // ─── Import handler ───
  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    try {
      // 1. إنشاء التمرين
      const finalTitle = title.trim() || getAutoTitle();
      const exRes = await api.post('/exercises', {
        subject_id: selectedSubject,
        stage_id: selectedStage || null,
        grade_id: selectedGrade || null,
        title: finalTitle,
        type: exerciseType,
        difficulty: 'medium',
        xp_reward: 10,
      });
      const exerciseId = exRes.data.id;
      setCreatedExerciseId(exerciseId);

      // 2. استيراد الأسئلة
      const formData = new FormData();
      formData.append('file', file);
      const importRes = await api.post(`/exercises/${exerciseId}/import`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setResult(importRes.data);
      setStep(3);
      if (importRes.data.imported > 0) {
        toast.success(importRes.data.message);
        onImported();
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'خطأ في الاستيراد';
      toast.error(msg);
      setResult({ error: msg });
      setStep(3);
    } finally {
      setImporting(false);
    }
  };

  // ─── Reset for "import another" ───
  const handleReset = () => {
    setStep(1);
    setFile(null);
    setResult(null);
    setCreatedExerciseId(null);
    setTitle('');
  };

  // ─── Step indicators ───
  const steps = [
    { num: 1, label: 'اختيار الهدف' },
    { num: 2, label: 'رفع الملف' },
    { num: 3, label: 'النتيجة' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* ═══ Header ═══ */}
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="flex items-center gap-2">
            <span className="text-xl">📥</span>
            <h3 className="text-lg font-bold text-gray-800">استيراد سريع للأسئلة</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ═══ Step Indicator ═══ */}
        <div className="flex items-center justify-center gap-2 px-6 pt-4 pb-2">
          {steps.map((s, i) => (
            <div key={s.num} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                step >= s.num
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-400'
              }`}>
                {step > s.num ? '✓' : s.num}
              </div>
              <span className={`text-xs font-medium hidden sm:inline ${
                step >= s.num ? 'text-gray-700' : 'text-gray-400'
              }`}>{s.label}</span>
              {i < steps.length - 1 && (
                <div className={`w-8 h-0.5 ${step > s.num ? 'bg-blue-400' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* ═══ Body ═══ */}
        <div className="px-6 py-5 space-y-4">

          {/* ─── STEP 1: Select Target ─── */}
          {step === 1 && (
            <>
              {/* المرحلة */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1.5 block">المرحلة الدراسية</label>
                <select
                  value={selectedStage}
                  onChange={e => { setSelectedStage(e.target.value); setSelectedGrade(''); setSelectedSubject(''); }}
                  className={selectClass}
                >
                  <option value="">اختر المرحلة</option>
                  {stages.map(s => <option key={s.id} value={s.id}>{s.icon || ''} {s.name}</option>)}
                </select>
              </div>

              {/* الصف */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1.5 block">الصف</label>
                <select
                  value={selectedGrade}
                  onChange={e => { setSelectedGrade(e.target.value); setSelectedSubject(''); }}
                  disabled={!selectedStage}
                  className={selectClass}
                >
                  <option value="">اختر الصف</option>
                  {filteredGrades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>

              {/* المادة */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1.5 block">المادة</label>
                <select
                  value={selectedSubject}
                  onChange={e => setSelectedSubject(e.target.value)}
                  disabled={filteredSubjects.length === 0}
                  className={selectClass}
                >
                  <option value="">اختر المادة</option>
                  {filteredSubjects.map(s => <option key={s.id} value={s.id}>{s.icon || ''} {s.name}</option>)}
                </select>
              </div>

              {/* نوع التمرين */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-2 block">نوع التمرين</label>
                <div className="grid grid-cols-2 gap-2">
                  {IMPORT_TYPES.map(t => {
                    const isSelected = exerciseType === t.value;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setExerciseType(t.value)}
                        className={`flex items-center gap-2 p-2.5 rounded-lg transition-all border-2 text-sm ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50 shadow-sm'
                            : 'border-gray-200 bg-white hover:border-blue-300'
                        }`}
                      >
                        <span className="text-lg">{t.icon}</span>
                        <span className={`font-medium ${isSelected ? 'text-blue-700' : 'text-gray-600'}`}>
                          {t.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* اسم التمرين */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1.5 block">اسم التمرين</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={selectedSubject ? getAutoTitle() : 'يُولَّد تلقائياً عند الاستيراد'}
                  className={selectClass}
                />
                <p className="text-[10px] text-gray-400 mt-1">اتركه فارغاً للتوليد التلقائي</p>
              </div>
            </>
          )}

          {/* ─── STEP 2: Upload File ─── */}
          {step === 2 && (
            <>
              {/* File upload area */}
              <label className="block cursor-pointer">
                <div className={`flex flex-col items-center justify-center gap-2 px-4 py-8 border-2 border-dashed rounded-xl text-sm transition-colors ${
                  file
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                    : 'border-gray-300 text-gray-500 hover:border-violet-400 hover:bg-violet-50/30'
                }`}>
                  {file ? (
                    <>
                      <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="font-bold">{file.name}</span>
                      <span className="text-xs text-emerald-600">{(file.size / 1024).toFixed(1)} KB</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <span className="font-medium">اسحب الملف هنا أو اضغط للاختيار</span>
                      <span className="text-xs text-gray-400">.xlsx, .json</span>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  accept=".xlsx,.xls,.json"
                  className="hidden"
                  onChange={(e) => { setFile(e.target.files[0] || null); setResult(null); }}
                />
              </label>

              {/* Template download */}
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-violet-300 text-violet-700 rounded-xl text-sm font-medium hover:bg-violet-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                تحميل قالب Excel جاهز ({TYPE_LABEL[exerciseType] || exerciseType})
              </button>

              {/* Info box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                <p className="font-bold mb-1">📋 ملاحظة:</p>
                <p>تأكد أن الملف يتبع تنسيق القالب. يمكنك تحميل القالب أعلاه كمرجع.</p>
              </div>
            </>
          )}

          {/* ─── STEP 3: Result ─── */}
          {step === 3 && result && (
            <>
              {result.error ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
                  <svg className="w-12 h-12 text-red-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-red-700 font-bold text-sm">{result.error}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Success header */}
                  <div className={`rounded-xl p-5 text-center ${
                    result.imported > 0
                      ? 'bg-emerald-50 border border-emerald-200'
                      : 'bg-amber-50 border border-amber-200'
                  }`}>
                    {result.imported > 0 ? (
                      <svg className="w-12 h-12 text-emerald-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : (
                      <svg className="w-12 h-12 text-amber-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    )}
                    <p className={`font-bold text-sm ${result.imported > 0 ? 'text-emerald-800' : 'text-amber-800'}`}>
                      {result.message}
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-gray-700">{result.total || 0}</p>
                      <p className="text-[10px] text-gray-500">الإجمالي</p>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-emerald-700">{result.imported || 0}</p>
                      <p className="text-[10px] text-emerald-600">تم إضافة</p>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-amber-700">{(result.skipped || 0) + (result.errors?.length || 0)}</p>
                      <p className="text-[10px] text-amber-600">تخطي/أخطاء</p>
                    </div>
                  </div>

                  {/* Error details */}
                  {result.errors?.length > 0 && (
                    <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                      <p className="text-xs font-bold text-red-700 mb-2">تفاصيل الأخطاء:</p>
                      <ul className="space-y-1">
                        {result.errors.slice(0, 5).map((e, i) => (
                          <li key={i} className="text-xs text-red-600">
                            صف {e.row}: {e.message}
                          </li>
                        ))}
                        {result.errors.length > 5 && (
                          <li className="text-xs text-red-400">
                            +{result.errors.length - 5} أخطاء أخرى
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* ═══ Footer ═══ */}
        <div className="px-6 py-4 border-t bg-gray-50 rounded-b-2xl flex items-center justify-between">
          {step === 1 && (
            <>
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 font-medium">
                إلغاء
              </button>
              <button
                onClick={() => setStep(2)}
                disabled={!selectedSubject}
                className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  !selectedSubject
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-l from-blue-600 to-blue-700 text-white hover:shadow-lg hover:shadow-blue-500/30'
                }`}
              >
                التالي ←
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 font-medium"
              >
                ← رجوع
              </button>
              <button
                onClick={handleImport}
                disabled={!file || importing}
                className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  !file || importing
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-l from-emerald-600 to-emerald-700 text-white hover:shadow-lg hover:shadow-emerald-500/30'
                }`}
              >
                {importing ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    جاري الاستيراد...
                  </span>
                ) : 'استيراد ←'}
              </button>
            </>
          )}

          {step === 3 && (
            <>
              <button
                onClick={handleReset}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 font-medium"
              >
                استيراد آخر
              </button>
              {createdExerciseId && !result?.error && (
                <button
                  onClick={() => {
                    onClose();
                    navigate(`/admin/exercises/${createdExerciseId}/edit`);
                  }}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-l from-blue-600 to-blue-700 text-white hover:shadow-lg hover:shadow-blue-500/30 transition-all"
                >
                  عرض التمرين ←
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
