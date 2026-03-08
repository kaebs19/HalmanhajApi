import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useToast } from './ui/Toast';
import { TYPE_LABEL, TYPE_COLORS } from './ExerciseQuestionForm';

const IMPORT_TYPES = [
  { value: 'mcq', label: 'اختيار من متعدد', icon: '🔘' },
  { value: 'true_false', label: 'صح أم خطأ', icon: '✓✗' },
  { value: 'fill_blank', label: 'أكمل الفراغ', icon: '✏️' },
  { value: 'classify', label: 'صنّف العناصر', icon: '📂' },
];

const selectClass = 'w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none disabled:bg-gray-50 disabled:text-gray-400';

export default function QuickImportModal({ onClose, onImported }) {
  const { toast } = useToast();
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
  const [importMode, setImportMode] = useState('single'); // 'single' | 'all'
  const [autoPublish, setAutoPublish] = useState(true);
  const [title, setTitle] = useState('');

  // ─── Step 2: Upload ───
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [sheetMessage, setSheetMessage] = useState('');

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
      if (importMode === 'all') {
        // ── استيراد ذكي: كل الأنواع ──
        const formData = new FormData();
        formData.append('file', file);
        formData.append('subject_id', selectedSubject);
        if (selectedStage) formData.append('stage_id', selectedStage);
        if (selectedGrade) formData.append('grade_id', selectedGrade);
        formData.append('auto_publish', autoPublish);

        const importRes = await api.post('/exercises/import-all', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        setResult(importRes.data);
        setStep(3);
        if (importRes.data.total_questions > 0) {
          toast.success(`تم استيراد ${importRes.data.total_questions} سؤال في ${importRes.data.total_exercises} تمرين`);
          onImported();
        }
      } else {
        // ── استيراد نوع واحد (الكود الحالي) ──
        const finalTitle = title.trim() || getAutoTitle();
        const exRes = await api.post('/exercises', {
          subject_id: selectedSubject,
          stage_id: selectedStage || null,
          grade_id: selectedGrade || null,
          title: finalTitle,
          type: exerciseType,
          difficulty: 'medium',
          xp_reward: 10,
          is_published: autoPublish,
        });
        const exerciseId = exRes.data.id;
        setCreatedExerciseId(exerciseId);

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

  // ─── File change with sheet detection ───
  const handleFileChange = async (e) => {
    const f = e.target.files[0] || null;
    setFile(f);
    setResult(null);
    setSheetMessage('');

    if (f && f.name.match(/\.xlsx?$/i)) {
      try {
        const XLSX = (await import('xlsx')).default;
        const data = await f.arrayBuffer();
        const wb = XLSX.read(data, { type: 'array', bookSheets: true });
        const sheets = wb.SheetNames;

        const SHEET_TYPE_MAP = { MCQ: 'mcq', TrueFalse: 'true_false', FillBlank: 'fill_blank', Classify: 'classify' };
        const IMPORT_TYPE_LABELS = { mcq: 'اختيار من متعدد', true_false: 'صح أم خطأ', fill_blank: 'أكمل الفراغ', classify: 'تصنيف' };

        const matchingSheet = sheets.find(s => SHEET_TYPE_MAP[s]);
        if (matchingSheet) {
          const detectedType = SHEET_TYPE_MAP[matchingSheet];
          if (detectedType !== exerciseType) {
            setSheetMessage(`تم اكتشاف نوع [${IMPORT_TYPE_LABELS[detectedType]}] في الملف، سيتم الاستيراد تلقائياً`);
          }
        }
      } catch { /* ignore parse errors */ }
    }
  };

  // ─── Reset for "import another" ───
  const handleReset = () => {
    setStep(1);
    setFile(null);
    setResult(null);
    setCreatedExerciseId(null);
    setTitle('');
    setSheetMessage('');
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
              {/* طريقة الاستيراد */}
              <div className="flex rounded-xl border border-gray-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setImportMode('single')}
                  className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                    importMode === 'single' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  نوع واحد
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode('all')}
                  className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                    importMode === 'all' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  كل الأنواع
                </button>
              </div>

              {/* نشر تلقائي */}
              <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoPublish}
                  onChange={e => setAutoPublish(e.target.checked)}
                  className="accent-emerald-600 w-4 h-4"
                />
                <span className="text-sm text-emerald-700 font-medium">✅ نشر تلقائي بعد الاستيراد</span>
                <span className="text-[10px] text-emerald-500 mr-auto">(يمكن إلغاؤه لاحقاً)</span>
              </label>

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

              {/* نوع التمرين — فقط في وضع "نوع واحد" */}
              {importMode === 'single' && (
                <>
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

              {/* رسالة وضع "كل الأنواع" */}
              {importMode === 'all' && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
                  <p className="font-bold mb-1">استيراد ذكي</p>
                  <p className="text-xs text-blue-600">
                    سيتم قراءة جميع الأوراق في الملف وإنشاء تمرين منفصل لكل نوع تلقائياً.
                    الأوراق المدعومة: MCQ, TrueFalse, FillBlank, Classify, Matching, Ordering
                  </p>
                </div>
              )}
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
                  onChange={handleFileChange}
                />
              </label>

              {/* Template download — فقط في وضع "نوع واحد" */}
              {importMode === 'single' && (
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
              )}

              {/* Sheet detection message */}
              {sheetMessage && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700 flex items-center gap-2">
                  <span>ℹ️</span>
                  <span>{sheetMessage}</span>
                </div>
              )}

              {/* Info box */}
              {!sheetMessage && importMode === 'single' && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-500">
                  <p className="font-bold mb-1">📋 ملاحظة:</p>
                  <p>تأكد أن الملف يتبع تنسيق القالب. يمكنك تحميل القالب أعلاه كمرجع.</p>
                </div>
              )}

              {/* Info box — وضع "كل الأنواع" */}
              {!sheetMessage && importMode === 'all' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                  <p className="font-bold mb-1">📋 تنسيق الملف المطلوب:</p>
                  <p>يجب أن يحتوي الملف على أوراق بأسماء محددة: MCQ, TrueFalse, FillBlank, Classify, Matching, Ordering</p>
                </div>
              )}
            </>
          )}

          {/* ─── STEP 3: Result (كل الأنواع) ─── */}
          {step === 3 && result && importMode === 'all' && (
            <>
              {/* خطأ في الطلب */}
              {result.error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
                  <svg className="w-12 h-12 text-red-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-red-700 font-bold text-sm">{result.error}</p>
                </div>
              )}

              {/* نتائج الاستيراد الذكي */}
              {!result.error && (
                <div className="space-y-4">
                  {/* Status header */}
                  <div className={`rounded-xl p-5 text-center ${
                    result.total_questions > 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'
                  }`}>
                    {result.total_questions > 0 ? (
                      <svg className="w-12 h-12 text-emerald-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : (
                      <svg className="w-12 h-12 text-amber-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    )}
                    <p className={`font-bold text-sm ${result.total_questions > 0 ? 'text-emerald-800' : 'text-amber-800'}`}>
                      {result.total_questions > 0
                        ? `تم استيراد ${result.total_questions} سؤال في ${result.total_exercises} تمرين`
                        : 'لم يتم العثور على أوراق متوافقة في الملف'}
                    </p>
                  </div>

                  {/* جدول النتائج */}
                  {result.results && result.results.length > 0 && (
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">النوع</th>
                            <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">الأسئلة</th>
                            <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">أخطاء</th>
                            <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">الحالة</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {result.results.map((r, i) => (
                            <tr key={i}>
                              <td className="px-4 py-2.5">
                                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[r.type] || 'bg-gray-100 text-gray-600'}`}>
                                  {TYPE_LABEL[r.type] || r.type}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-center font-bold text-emerald-600">{r.questions}</td>
                              <td className="px-4 py-2.5 text-center font-bold text-red-500">{r.errors || 0}</td>
                              <td className="px-4 py-2.5 text-center text-emerald-600 text-xs font-bold">تم</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* الأوراق المتخطاة */}
                  {result.skipped_sheets && result.skipped_sheets.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                      <p className="font-bold mb-1">الأوراق المتخطاة:</p>
                      <p>{result.skipped_sheets.join('، ')}</p>
                    </div>
                  )}

                  {/* إحصائيات */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-gray-700">{result.total_exercises || 0}</p>
                      <p className="text-[10px] text-gray-500">تمارين</p>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-emerald-700">{result.total_questions || 0}</p>
                      <p className="text-[10px] text-emerald-600">أسئلة</p>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-amber-700">{result.skipped_sheets?.length || 0}</p>
                      <p className="text-[10px] text-amber-600">تخطي</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ─── STEP 3: Result (نوع واحد) ─── */}
          {step === 3 && result && importMode === 'single' && (() => {
            const imported = result.imported || 0;
            const errCount = result.errors?.length || 0;
            const isError = result.error; // خطأ في الطلب نفسه
            const isFail = !isError && imported === 0 && errCount > 0; // كل الصفوف فشلت
            const isPartial = !isError && imported > 0 && errCount > 0; // نجاح جزئي
            const isSuccess = !isError && imported > 0 && errCount === 0; // نجاح كامل

            return (
              <>
                {/* ── خطأ في الطلب ── */}
                {isError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
                    <svg className="w-12 h-12 text-red-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-red-700 font-bold text-sm">{result.error}</p>
                  </div>
                )}

                {/* ── نتائج الاستيراد ── */}
                {!isError && (
                  <div className="space-y-4">
                    {/* Status header */}
                    <div className={`rounded-xl p-5 text-center ${
                      isSuccess ? 'bg-emerald-50 border border-emerald-200' :
                      isPartial ? 'bg-amber-50 border border-amber-200' :
                      isFail ? 'bg-red-50 border border-red-200' :
                      'bg-gray-50 border border-gray-200'
                    }`}>
                      {isSuccess && (
                        <svg className="w-12 h-12 text-emerald-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                      {isPartial && (
                        <svg className="w-12 h-12 text-amber-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      )}
                      {isFail && (
                        <svg className="w-12 h-12 text-red-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                      <p className={`font-bold text-sm ${
                        isSuccess ? 'text-emerald-800' :
                        isPartial ? 'text-amber-800' :
                        isFail ? 'text-red-800' : 'text-gray-700'
                      }`}>
                        {isFail ? 'فشل الاستيراد — لم يتم إضافة أي سؤال' :
                         isPartial ? `تم استيراد ${imported} سؤال مع ${errCount} خطأ` :
                         result.message}
                      </p>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-gray-50 rounded-lg p-3 text-center">
                        <p className="text-lg font-bold text-gray-700">{result.total || 0}</p>
                        <p className="text-[10px] text-gray-500">الإجمالي</p>
                      </div>
                      <div className="bg-emerald-50 rounded-lg p-3 text-center">
                        <p className="text-lg font-bold text-emerald-700">{imported}</p>
                        <p className="text-[10px] text-emerald-600">تم إضافة</p>
                      </div>
                      <div className={`rounded-lg p-3 text-center ${errCount > 0 ? 'bg-red-50' : 'bg-amber-50'}`}>
                        <p className={`text-lg font-bold ${errCount > 0 ? 'text-red-700' : 'text-amber-700'}`}>{(result.skipped || 0) + errCount}</p>
                        <p className={`text-[10px] ${errCount > 0 ? 'text-red-600' : 'text-amber-600'}`}>تخطي/أخطاء</p>
                      </div>
                    </div>

                    {/* Error details — أول 3 أخطاء */}
                    {errCount > 0 && (
                      <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                        <p className="text-xs font-bold text-red-700 mb-2">تفاصيل الأخطاء:</p>
                        <ul className="space-y-1">
                          {result.errors.slice(0, 3).map((e, i) => (
                            <li key={i} className="text-xs text-red-600">
                              صف {e.row}: {e.message}
                            </li>
                          ))}
                          {errCount > 3 && (
                            <li className="text-xs text-red-400">
                              +{errCount - 3} أخطاء أخرى
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </>
            );
          })()}
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
              {importMode === 'single' && createdExerciseId && !result?.error && (
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
              {importMode === 'all' && result?.total_questions > 0 && (
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-l from-blue-600 to-blue-700 text-white hover:shadow-lg hover:shadow-blue-500/30 transition-all"
                >
                  عرض التمارين ←
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
