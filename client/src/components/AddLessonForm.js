import { useState, useRef, useCallback } from 'react';
import api, { SERVER_URL } from '../lib/api';
import { Alert, Button, Input, Select, FormField, Textarea } from './ui';
import FileUploadProgress from './FileUploadProgress';
import ThumbnailGenerator from './ThumbnailGenerator';
import SeoGenerator from './SeoGenerator';

const LESSON_TYPES = [
  { value: 'حل', label: 'حل' },
  { value: 'كتاب', label: 'كتاب' },
  { value: 'تحضير', label: 'تحضير' },
  { value: 'تجميع', label: 'تجميع' },
  { value: 'فيديو', label: 'فيديو' },
];

const CATEGORY_OPTIONS = [
  { value: 'حل_كتاب', label: 'حل كتاب' },
  { value: 'ملخص', label: 'ملخص' },
  { value: 'اختبار', label: 'اختبار' },
  { value: 'ورقة_عمل', label: 'ورقة عمل' },
  { value: 'شرح', label: 'شرح' },
  { value: 'أخرى', label: 'أخرى' },
];

const BATCH_TYPES = [
  { value: 'حل', label: 'حل' },
  { value: 'كتاب', label: 'كتاب' },
  { value: 'تحضير', label: 'تحضير' },
  { value: 'تجميع', label: 'تجميع' },
  { value: 'فيديو', label: 'فيديو' },
];

export default function AddLessonForm({ subjects, stages = [], grades = [], preSelectedStageId = '', preSelectedGradeId = '', onClose, onSuccess }) {
  // === Dropdowns متدرجة ===
  const [selectedStage, setSelectedStage] = useState(preSelectedStageId ? String(preSelectedStageId) : '');
  const [selectedGrade, setSelectedGrade] = useState(preSelectedGradeId ? String(preSelectedGradeId) : '');

  // === حقول الدرس الأساسية ===
  const [title, setTitle] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedGradeIds, setSelectedGradeIds] = useState([]);
  const [selectedTrackIds, setSelectedTrackIds] = useState([]);
  const [semester, setSemester] = useState(1);
  const [type, setType] = useState('حل');
  const [description, setDescription] = useState('');
  const [keywords, setKeywords] = useState('');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generatingKeywords, setGeneratingKeywords] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedBytes, setUploadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [uploadEta, setUploadEta] = useState(0);
  const [uploadError, setUploadError] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const uploadStartTimeRef = useRef(0);
  const lastLoadedRef = useRef(0);
  const lastTimeRef = useRef(0);
  const speedSamplesRef = useRef([]);
  const abortControllerRef = useRef(null);

  // === حقول SEO والصورة المصغرة ===
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [slug, setSlug] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');

  // === حقول الموقع العام ===
  const [category, setCategory] = useState('حل_كتاب');
  const [isPublished, setIsPublished] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);

  // === أدوات PDF المدمجة ===
  const [showPdfTools, setShowPdfTools] = useState(false);
  const [pdfToolType, setPdfToolType] = useState(null);
  const [pdfToolFiles, setPdfToolFiles] = useState([]);
  const [pdfToolLoading, setPdfToolLoading] = useState(false);
  const [pdfToolProgress, setPdfToolProgress] = useState(0);
  const [splitPage, setSplitPage] = useState('');
  const [pdfInfo, setPdfInfo] = useState(null);

  // === القسم المتقدم ===
  const [showAdvanced, setShowAdvanced] = useState(false);

  // === وضع الإضافة المتعددة ===
  const [batchMode, setBatchMode] = useState(false);
  const [batchLessons, setBatchLessons] = useState([
    { title: '', type: 'حل', file: null },
    { title: '', type: 'حل', file: null },
    { title: '', type: 'حل', file: null },
  ]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

  // === Computed: الصفوف حسب المرحلة المختارة ===
  const filteredGradesForForm = grades.filter(g => String(g.stage_id) === String(selectedStage));

  // === Computed: المواد حسب الصف المختار ===
  const filteredSubjectsForForm = selectedGrade
    ? subjects.filter(s => s.grades?.some(g => String(g.grade_id) === String(selectedGrade)))
    : selectedStage
      ? subjects.filter(s =>
          s.grades?.some(g => String(g.stage_id) === String(selectedStage)) ||
          s.tracks?.some(t => String(t.stage_id) === String(selectedStage))
        )
      : subjects;

  // المادة المختارة مع صفوفها ومساراتها
  const selectedSubject = subjects.find(s => s.id === selectedSubjectId);
  const availableGrades = selectedSubject?.grades || [];
  const availableTracks = selectedSubject?.tracks || [];

  // تجميع الصفوف حسب المرحلة
  const gradesByStage = {};
  availableGrades.forEach(g => {
    const stage = g.stage_name || 'أخرى';
    if (!gradesByStage[stage]) gradesByStage[stage] = [];
    gradesByStage[stage].push(g);
  });

  // تجميع المسارات حسب المرحلة
  const tracksByStage = {};
  availableTracks.forEach(t => {
    const stage = t.stage_name || 'أخرى';
    if (!tracksByStage[stage]) tracksByStage[stage] = [];
    tracksByStage[stage].push(t);
  });

  // === Handlers: Cascading dropdowns ===
  const handleStageChange = (stageId) => {
    setSelectedStage(stageId);
    setSelectedGrade('');
    setSelectedSubjectId('');
    setSelectedGradeIds([]);
    setSelectedTrackIds([]);
  };

  const handleGradeChange = (gradeId) => {
    setSelectedGrade(gradeId);
    setSelectedSubjectId('');
    setSelectedGradeIds([]);
    setSelectedTrackIds([]);
  };

  const handleSubjectChange = (subjectId) => {
    setSelectedSubjectId(subjectId);
    setSelectedTrackIds([]);
    setKeywords('');

    // تحديد الصف المختار تلقائياً
    if (selectedGrade) {
      const subject = subjects.find(s => s.id === subjectId);
      const matchingGrade = subject?.grades?.find(g => String(g.grade_id) === String(selectedGrade));
      if (matchingGrade) {
        setSelectedGradeIds([matchingGrade.grade_id]);
      } else {
        setSelectedGradeIds([]);
      }
    } else {
      // تحديد كل الصفوف
      const subject = subjects.find(s => s.id === subjectId);
      setSelectedGradeIds(subject?.grades?.map(g => g.grade_id) || []);
    }
  };

  const toggleGrade = (gradeId) => {
    setSelectedGradeIds(prev =>
      prev.includes(gradeId)
        ? prev.filter(id => id !== gradeId)
        : [...prev, gradeId]
    );
  };

  const toggleTrack = (trackId) => {
    setSelectedTrackIds(prev =>
      prev.includes(trackId)
        ? prev.filter(id => id !== trackId)
        : [...prev, trackId]
    );
  };

  const selectAllGrades = () => {
    if (selectedGradeIds.length === availableGrades.length) {
      setSelectedGradeIds([]);
    } else {
      setSelectedGradeIds(availableGrades.map(g => g.grade_id));
    }
  };

  const selectAllTracks = () => {
    if (selectedTrackIds.length === availableTracks.length) {
      setSelectedTrackIds([]);
    } else {
      setSelectedTrackIds(availableTracks.map(t => t.track_id));
    }
  };

  const handleGenerateKeywords = async () => {
    if (!selectedSubjectId) {
      setError('اختر المادة أولاً');
      return;
    }

    setGeneratingKeywords(true);
    setError('');
    try {
      const res = await api.post('/lessons/generate-keywords', {
        subject_id: selectedSubjectId,
        grade_ids: selectedGradeIds,
        track_ids: selectedTrackIds,
        semester,
        type,
        title
      });
      setKeywords(res.data.keywords);
    } catch {
      setError('خطأ في توليد الكلمات المفتاحية');
    } finally {
      setGeneratingKeywords(false);
    }
  };

  const resetUploadState = useCallback(() => {
    setUploadProgress(0);
    setUploadedBytes(0);
    setTotalBytes(0);
    setUploadSpeed(0);
    setUploadEta(0);
    setUploadError(null);
    uploadStartTimeRef.current = 0;
    lastLoadedRef.current = 0;
    lastTimeRef.current = 0;
    speedSamplesRef.current = [];
  }, []);

  const buildFormData = useCallback(() => {
    const formData = new FormData();
    formData.append('subject_id', selectedSubjectId);
    formData.append('title', title);
    formData.append('description', description);
    formData.append('semester', semester);
    formData.append('type', type);
    formData.append('keywords', keywords);
    formData.append('grade_ids', JSON.stringify(selectedGradeIds));
    formData.append('track_ids', JSON.stringify(selectedTrackIds));

    if (seoTitle) formData.append('seo_title', seoTitle);
    if (seoDescription) formData.append('seo_description', seoDescription);
    if (slug) formData.append('slug', slug);
    if (thumbnailUrl) formData.append('thumbnail_url', thumbnailUrl);
    formData.append('category', category);
    formData.append('is_published', isPublished);
    formData.append('is_featured', isFeatured);

    if (files && files.length > 0) {
      for (const file of files) {
        formData.append('files', file);
      }
    }
    return formData;
  }, [selectedSubjectId, title, description, semester, type, keywords, selectedGradeIds, selectedTrackIds, seoTitle, seoDescription, slug, thumbnailUrl, category, isPublished, isFeatured, files]);

  const handleUploadProgress = useCallback((e) => {
    if (!e.total) return;

    const now = Date.now();
    const loaded = e.loaded;
    const total = e.total;
    const percent = Math.round((loaded / total) * 100);

    setUploadProgress(percent);
    setUploadedBytes(loaded);
    setTotalBytes(total);

    if (lastTimeRef.current > 0) {
      const timeDiff = (now - lastTimeRef.current) / 1000;
      const bytesDiff = loaded - lastLoadedRef.current;
      if (timeDiff > 0.2) {
        const instantSpeed = bytesDiff / timeDiff;
        speedSamplesRef.current.push(instantSpeed);
        if (speedSamplesRef.current.length > 5) speedSamplesRef.current.shift();

        const avgSpeed = speedSamplesRef.current.reduce((a, b) => a + b, 0) / speedSamplesRef.current.length;
        setUploadSpeed(avgSpeed);

        const remaining = total - loaded;
        if (avgSpeed > 0) {
          setUploadEta(remaining / avgSpeed);
        }

        lastLoadedRef.current = loaded;
        lastTimeRef.current = now;
      }
    } else {
      uploadStartTimeRef.current = now;
      lastLoadedRef.current = loaded;
      lastTimeRef.current = now;
    }
  }, []);

  const uploadWithRetry = useCallback(async (formData, maxRetries = 2) => {
    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          setUploadError(`إعادة المحاولة (${attempt}/${maxRetries})...`);
          await new Promise(r => setTimeout(r, 2000 * attempt));
          setUploadError(null);
          lastLoadedRef.current = 0;
          lastTimeRef.current = 0;
          speedSamplesRef.current = [];
        }

        abortControllerRef.current = new AbortController();

        const result = await api.post('/lessons', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: handleUploadProgress,
          signal: abortControllerRef.current.signal,
          timeout: 600000,
        });

        return result;
      } catch (err) {
        lastError = err;

        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
          throw err;
        }

        const isNetworkError = !err.response && (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error'));
        const isTimeout = err.code === 'ECONNABORTED';

        if ((isNetworkError || isTimeout) && attempt < maxRetries) {
          continue;
        }

        throw err;
      }
    }

    throw lastError;
  }, [handleUploadProgress]);

  const handleCancelUpload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // === إرسال فردي ===
  const handleSubmit = async (e, isQuickAdd = false) => {
    if (e) e.preventDefault();
    setError('');
    setSuccess('');

    if (!title.trim()) {
      setError('عنوان الدرس مطلوب');
      return false;
    }
    if (!selectedSubjectId) {
      setError('اختر المادة');
      return false;
    }
    if (selectedGradeIds.length === 0 && selectedTrackIds.length === 0) {
      setError('اختر صف أو مسار واحد على الأقل');
      return false;
    }
    if (!files || files.length === 0) {
      setError('يجب رفع ملف واحد على الأقل');
      return false;
    }

    setLoading(true);
    setIsUploading(true);
    resetUploadState();

    try {
      const formData = buildFormData();
      await uploadWithRetry(formData);

      if (isQuickAdd) {
        setSuccess('تم إضافة الدرس بنجاح! يمكنك إضافة درس آخر');
        // إعادة تعيين المحتوى فقط
        setTitle('');
        setFiles([]);
        setDescription('');
        setKeywords('');
        setSlug('');
        setSeoTitle('');
        setSeoDescription('');
        setThumbnailUrl('');
        // الإبقاء على: selectedStage, selectedGrade, selectedSubjectId, semester, type, selectedGradeIds, selectedTrackIds
        setTimeout(() => setSuccess(''), 3000);
        return true;
      } else {
        setSuccess('تم إضافة الدرس بنجاح');
        setTimeout(() => {
          onSuccess?.();
        }, 1000);
        return true;
      }
    } catch (err) {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
        setError('تم إلغاء الرفع');
      } else if (!err.response && (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error'))) {
        setError('فشل الاتصال بالسيرفر. تأكد من اتصالك بالإنترنت وحاول مرة أخرى.');
        setUploadError('انقطع الاتصال');
      } else if (err.code === 'ECONNABORTED') {
        setError('انتهت مهلة الرفع. الملف قد يكون كبيراً جداً أو الاتصال بطيء.');
        setUploadError('انتهت المهلة');
      } else {
        setError(err.response?.data?.message || 'حدث خطأ في إضافة الدرس');
      }
      return false;
    } finally {
      setLoading(false);
      setIsUploading(false);
      abortControllerRef.current = null;
    }
  };

  // === إضافة سريعة ===
  const handleQuickAdd = async () => {
    await handleSubmit(null, true);
  };

  // === Batch Mode Handlers ===
  const updateBatchLesson = (idx, field, value) => {
    setBatchLessons(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  };

  const addBatchRow = () => {
    if (batchLessons.length >= 10) return;
    setBatchLessons(prev => [...prev, { title: '', type: 'حل', file: null }]);
  };

  const removeBatchRow = (idx) => {
    if (batchLessons.length <= 1) return;
    setBatchLessons(prev => prev.filter((_, i) => i !== idx));
  };

  const handleBatchSubmit = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedSubjectId) {
      setError('اختر المادة أولاً');
      return;
    }

    const validLessons = batchLessons.filter(l => l.title.trim());
    if (validLessons.length === 0) {
      setError('أدخل عنوان درس واحد على الأقل');
      return;
    }

    // تحديد الصفوف للإرسال
    const gradeIdsToSend = selectedGradeIds.length > 0
      ? selectedGradeIds
      : selectedGrade ? [selectedGrade] : [];

    if (gradeIdsToSend.length === 0 && selectedTrackIds.length === 0) {
      setError('اختر صف أو مسار واحد على الأقل');
      return;
    }

    setBatchLoading(true);
    setBatchProgress({ current: 0, total: validLessons.length });

    let successCount = 0;
    const errors = [];

    for (let i = 0; i < validLessons.length; i++) {
      const lesson = validLessons[i];
      setBatchProgress({ current: i + 1, total: validLessons.length });

      try {
        const formData = new FormData();
        formData.append('subject_id', selectedSubjectId);
        formData.append('title', lesson.title);
        formData.append('type', lesson.type);
        formData.append('semester', semester);
        formData.append('grade_ids', JSON.stringify(gradeIdsToSend));
        formData.append('track_ids', JSON.stringify(selectedTrackIds));
        formData.append('category', category);
        formData.append('is_published', isPublished);
        if (lesson.file) formData.append('files', lesson.file);

        await api.post('/lessons', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 300000,
        });
        successCount++;
      } catch (err) {
        errors.push(`${lesson.title}: ${err.response?.data?.message || 'خطأ'}`);
      }
    }

    setBatchLoading(false);

    if (successCount === validLessons.length) {
      setSuccess(`تم إضافة ${successCount} من ${validLessons.length} درس بنجاح`);
      setTimeout(() => {
        onSuccess?.();
      }, 1500);
    } else if (successCount > 0) {
      setSuccess(`تم إضافة ${successCount} من ${validLessons.length} درس`);
      if (errors.length > 0) {
        setError(`فشل: ${errors.join(' | ')}`);
      }
    } else {
      setError(`فشل إضافة جميع الدروس: ${errors.join(' | ')}`);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-5">
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-l from-blue-600 to-blue-700 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          إضافة درس جديد
        </h2>
        <div className="flex items-center gap-3">
          {/* تبديل الوضع */}
          <div className="flex bg-white/20 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setBatchMode(false)}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors ${!batchMode ? 'bg-white text-blue-700 font-medium' : 'text-white/80 hover:text-white'}`}
            >
              فردي
            </button>
            <button
              type="button"
              onClick={() => setBatchMode(true)}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors ${batchMode ? 'bg-white text-blue-700 font-medium' : 'text-white/80 hover:text-white'}`}
            >
              متعدد
            </button>
          </div>
          <button type="button" onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      {/* Alerts */}
      <div className="px-6 pt-4">
        {error && <Alert>{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}
      </div>

      <form onSubmit={batchMode ? handleBatchSubmit : handleSubmit} className="p-6 space-y-5">

        {/* ═══════════════════════════════════════════ */}
        {/* القسم 0: الاختيار المتدرج (مرحلة ← صف ← مادة) */}
        {/* ═══════════════════════════════════════════ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField label="المرحلة *">
            <Select
              value={selectedStage}
              onChange={(e) => handleStageChange(e.target.value)}
              required
            >
              <option value="">اختر المرحلة</option>
              {stages.map(s => (
                <option key={s.id} value={s.id}>
                  {s.icon ? s.icon + ' ' : ''}{s.name}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="الصف *">
            <Select
              value={selectedGrade}
              onChange={(e) => handleGradeChange(e.target.value)}
              disabled={!selectedStage}
              required
            >
              <option value="">{selectedStage ? 'اختر الصف' : 'اختر المرحلة أولاً'}</option>
              {filteredGradesForForm.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </Select>
          </FormField>

          <FormField label="المادة *">
            <Select
              value={selectedSubjectId}
              onChange={(e) => handleSubjectChange(e.target.value)}
              disabled={!selectedStage}
              required
            >
              <option value="">{selectedGrade ? 'اختر المادة' : selectedStage ? 'اختر الصف أولاً' : 'اختر المرحلة أولاً'}</option>
              {filteredSubjectsForForm.map(s => (
                <option key={s.id} value={s.id}>
                  {s.icon ? s.icon + ' ' : ''}{s.name}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        {/* ═══════════════════════════════════════════ */}
        {/* الوضع الفردي */}
        {/* ═══════════════════════════════════════════ */}
        {!batchMode && (
          <>
            {/* القسم 1: الملف الرئيسي */}
            <div className="bg-gradient-to-l from-blue-50/80 to-indigo-50/80 rounded-xl border-2 border-blue-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center text-sm font-bold">1</div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-800">الملف الرئيسي *</h3>
                    <p className="text-[11px] text-gray-500">PDF, صور, فيديو, مستندات (حتى 10 ملفات، 200MB لكل ملف)</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-400 hidden sm:inline">صورة مصغرة:</span>
                  <ThumbnailGenerator
                    thumbnailUrl={thumbnailUrl}
                    onThumbnailChange={setThumbnailUrl}
                    lessonFiles={files}
                  />
                </div>
              </div>

              <FileUploadProgress
                files={files}
                onFilesChange={setFiles}
                accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.mp4,.webm,.doc,.docx,.ppt,.pptx"
                multiple={true}
                maxFiles={10}
                maxFileSize={200 * 1024 * 1024}
                uploadProgress={uploadProgress}
                isUploading={isUploading}
                uploadedBytes={uploadedBytes}
                totalBytes={totalBytes}
                uploadSpeed={uploadSpeed}
                uploadEta={uploadEta}
                uploadError={uploadError}
              />
            </div>

            {/* القسم 2: معلومات الدرس الأساسية */}
            <div className="bg-gray-50/50 rounded-xl border border-gray-200 p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-lg bg-gray-600 text-white flex items-center justify-center text-sm font-bold">2</div>
                <h3 className="text-sm font-bold text-gray-800">معلومات الدرس</h3>
              </div>

              {/* العنوان */}
              <FormField label="عنوان الدرس *">
                <Input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: الوحدة الأولى - التوحيد"
                  required
                />
              </FormField>

              {/* النوع + الفصل */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="النوع">
                  <Select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                  >
                    {LESSON_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="الفصل الدراسي">
                  <Select
                    value={semester}
                    onChange={(e) => setSemester(parseInt(e.target.value))}
                  >
                    <option value={1}>الفصل الأول</option>
                    <option value={2}>الفصل الثاني</option>
                    <option value={0}>مشترك للفصلين</option>
                  </Select>
                </FormField>
              </div>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* القسم المتقدم (قابل للطي) */}
            {/* ═══════════════════════════════════════════ */}
            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors w-full py-2"
              >
                <svg className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
                <span className="font-medium">إعدادات متقدمة</span>
                <span className="text-xs text-gray-400">(الصفوف، الوصف، الكلمات المفتاحية، SEO، أدوات PDF)</span>
              </button>

              {showAdvanced && (
                <div className="space-y-4 mt-3 p-5 bg-gray-50 rounded-xl border border-gray-200">

                  {/* التصنيف + خيارات النشر */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField label="التصنيف">
                      <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                        {CATEGORY_OPTIONS.map(c => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </Select>
                    </FormField>
                    <div className="flex items-end gap-6 pb-1 md:col-span-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isPublished}
                          onChange={(e) => setIsPublished(e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">منشور على الموقع</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isFeatured}
                          onChange={(e) => setIsFeatured(e.target.checked)}
                          className="w-4 h-4 text-amber-500 rounded border-gray-300 focus:ring-amber-500"
                        />
                        <span className="text-sm text-gray-700">مميز</span>
                      </label>
                    </div>
                  </div>

                  {/* الصفوف */}
                  {selectedSubjectId && availableGrades.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-gray-600 text-sm font-medium">الصفوف *</label>
                        <button
                          type="button"
                          onClick={selectAllGrades}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          {selectedGradeIds.length === availableGrades.length ? 'إلغاء الكل' : 'تحديد الكل'}
                        </button>
                      </div>
                      <div className="bg-white rounded-lg p-3 space-y-3 border border-gray-100">
                        {Object.entries(gradesByStage).map(([stageName, stageGrades]) => (
                          <div key={stageName}>
                            <p className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                              {stageName}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {stageGrades.map(g => (
                                <label
                                  key={g.grade_id}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm cursor-pointer transition-all border ${
                                    selectedGradeIds.includes(g.grade_id)
                                      ? 'bg-blue-100 border-blue-300 text-blue-800 shadow-sm'
                                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedGradeIds.includes(g.grade_id)}
                                    onChange={() => toggleGrade(g.grade_id)}
                                    className="hidden"
                                  />
                                  {g.grade_name}
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* المسارات */}
                  {selectedSubjectId && availableTracks.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-gray-600 text-sm font-medium">المسارات *</label>
                        <button
                          type="button"
                          onClick={selectAllTracks}
                          className="text-xs text-emerald-600 hover:text-emerald-800"
                        >
                          {selectedTrackIds.length === availableTracks.length ? 'إلغاء الكل' : 'تحديد الكل'}
                        </button>
                      </div>
                      <div className="bg-white rounded-lg p-3 space-y-3 border border-gray-100">
                        {Object.entries(tracksByStage).map(([stageName, tracks]) => (
                          <div key={stageName}>
                            <p className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                              {stageName}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {tracks.map(t => (
                                <label
                                  key={t.track_id}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm cursor-pointer transition-all border ${
                                    selectedTrackIds.includes(t.track_id)
                                      ? 'bg-emerald-100 border-emerald-300 text-emerald-800 shadow-sm'
                                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedTrackIds.includes(t.track_id)}
                                    onChange={() => toggleTrack(t.track_id)}
                                    className="hidden"
                                  />
                                  {t.track_name}
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* تحذير عدم وجود صفوف */}
                  {selectedSubjectId && availableGrades.length === 0 && availableTracks.length === 0 && (
                    <Alert variant="warning">
                      هذه المادة غير مرتبطة بأي صفوف أو مسارات. أضف صفوف/مسارات من صفحة المواد أولاً.
                    </Alert>
                  )}

                  {/* الوصف */}
                  <FormField label="الوصف (اختياري)">
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="وصف مختصر للدرس..."
                      rows={2}
                    />
                  </FormField>

                  {/* الكلمات المفتاحية */}
                  <FormField label="الكلمات المفتاحية">
                    <div className="flex gap-2">
                      <Textarea
                        value={keywords}
                        onChange={(e) => setKeywords(e.target.value)}
                        placeholder="كلمات مفتاحية مفصولة بفاصلة..."
                        rows={2}
                        className="flex-1 text-sm"
                      />
                      <button
                        type="button"
                        onClick={handleGenerateKeywords}
                        disabled={generatingKeywords || !selectedSubjectId}
                        className="self-start px-4 py-3 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap border border-purple-200"
                      >
                        {generatingKeywords ? 'جاري التوليد...' : 'توليد تلقائي'}
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">افصل بين الكلمات بفاصلة (,)</p>
                  </FormField>

                  {/* SEO + أدوات PDF */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <SeoGenerator
                      seoTitle={seoTitle}
                      setSeoTitle={setSeoTitle}
                      seoDescription={seoDescription}
                      setSeoDescription={setSeoDescription}
                      slug={slug}
                      setSlug={setSlug}
                      subjectId={selectedSubjectId}
                      gradeIds={selectedGradeIds}
                      trackIds={selectedTrackIds}
                      semester={semester}
                      type={type}
                      title={title}
                    />

                    {/* أدوات PDF */}
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setShowPdfTools(!showPdfTools)}
                        className="w-full px-4 py-3 bg-gradient-to-l from-gray-50 to-blue-50 border-b border-gray-100 flex items-center justify-between hover:from-gray-100 hover:to-blue-100 transition-colors"
                      >
                        <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                          <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          أدوات PDF السريعة
                        </h4>
                        <span className={`text-gray-400 transition-transform text-xs ${showPdfTools ? 'rotate-180' : ''}`}>
                          ▼
                        </span>
                      </button>

                      {showPdfTools && (
                        <div className="p-4 space-y-3">
                          {!pdfToolType ? (
                            <div className="flex flex-wrap gap-2">
                              <button type="button" onClick={() => setPdfToolType('compress')} className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 hover:bg-blue-100 transition-colors">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                                ضغط
                              </button>
                              <button type="button" onClick={() => setPdfToolType('merge')} className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-700 hover:bg-purple-100 transition-colors">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                دمج
                              </button>
                              <button type="button" onClick={() => setPdfToolType('split')} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 hover:bg-emerald-100 transition-colors">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                                تقسيم
                              </button>
                              <a href="/admin/pdf-tools" className="flex items-center gap-1 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
                                المزيد ←
                              </a>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="text-sm text-gray-600 font-medium">
                                  {pdfToolType === 'compress' && 'ضغط PDF'}
                                  {pdfToolType === 'merge' && 'دمج PDF'}
                                  {pdfToolType === 'split' && 'تقسيم PDF'}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => { setPdfToolType(null); setPdfToolFiles([]); setPdfInfo(null); }}
                                  className="text-xs text-gray-400 hover:text-gray-600"
                                >
                                  ← رجوع
                                </button>
                              </div>

                              {/* ضغط PDF */}
                              {pdfToolType === 'compress' && (
                                <>
                                  <FileUploadProgress
                                    files={pdfToolFiles}
                                    onFilesChange={setPdfToolFiles}
                                    accept=".pdf"
                                    multiple={false}
                                    uploadProgress={pdfToolProgress}
                                    isUploading={pdfToolLoading}
                                  />
                                  <button
                                    type="button"
                                    disabled={pdfToolLoading || !pdfToolFiles.length}
                                    onClick={async () => {
                                      setPdfToolLoading(true);
                                      setPdfToolProgress(0);
                                      try {
                                        const fd = new FormData();
                                        fd.append('file', pdfToolFiles[0]);
                                        const res = await api.post('/pdf-tools/compress', fd, {
                                          headers: { 'Content-Type': 'multipart/form-data' },
                                          onUploadProgress: (e) => { if (e.total) setPdfToolProgress(Math.round((e.loaded / e.total) * 100)); },
                                        });
                                        const dlRes = await fetch(`${SERVER_URL}${res.data.downloadUrl}`);
                                        const blob = await dlRes.blob();
                                        const compressedFile = new File([blob], `compressed-${pdfToolFiles[0].name}`, { type: 'application/pdf' });
                                        setFiles(prev => [...(prev || []), compressedFile]);
                                        setPdfToolType(null);
                                        setPdfToolFiles([]);
                                        setShowPdfTools(false);
                                        alert(`تم الضغط! ${res.data.originalSizeFormatted} → ${res.data.compressedSizeFormatted} (توفير ${res.data.savedPercent}%)`);
                                      } catch { setError('خطأ في ضغط الملف'); }
                                      finally { setPdfToolLoading(false); setPdfToolProgress(0); }
                                    }}
                                    className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                                  >
                                    {pdfToolLoading ? 'جاري الضغط...' : 'ضغط وإضافة للدرس'}
                                  </button>
                                </>
                              )}

                              {/* دمج PDF */}
                              {pdfToolType === 'merge' && (
                                <>
                                  <FileUploadProgress
                                    files={pdfToolFiles}
                                    onFilesChange={setPdfToolFiles}
                                    accept=".pdf"
                                    multiple={true}
                                    maxFiles={20}
                                    uploadProgress={pdfToolProgress}
                                    isUploading={pdfToolLoading}
                                  />
                                  {pdfToolFiles.length >= 2 && (
                                    <div className="bg-gray-50 rounded-lg p-2 space-y-1">
                                      {pdfToolFiles.map((f, i) => (
                                        <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                                          <span className="font-bold text-gray-400 w-4 text-center">{i + 1}</span>
                                          <span className="truncate flex-1">{f.name}</span>
                                          <div className="flex gap-1">
                                            {i > 0 && <button type="button" onClick={() => { const u = [...pdfToolFiles]; [u[i-1], u[i]] = [u[i], u[i-1]]; setPdfToolFiles(u); }} className="text-blue-500 hover:text-blue-700">▲</button>}
                                            {i < pdfToolFiles.length - 1 && <button type="button" onClick={() => { const u = [...pdfToolFiles]; [u[i], u[i+1]] = [u[i+1], u[i]]; setPdfToolFiles(u); }} className="text-blue-500 hover:text-blue-700">▼</button>}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  <button
                                    type="button"
                                    disabled={pdfToolLoading || pdfToolFiles.length < 2}
                                    onClick={async () => {
                                      setPdfToolLoading(true);
                                      setPdfToolProgress(0);
                                      try {
                                        const fd = new FormData();
                                        pdfToolFiles.forEach(f => fd.append('files', f));
                                        fd.append('order', JSON.stringify(pdfToolFiles.map((_, i) => i)));
                                        const res = await api.post('/pdf-tools/merge', fd, {
                                          headers: { 'Content-Type': 'multipart/form-data' },
                                          onUploadProgress: (e) => { if (e.total) setPdfToolProgress(Math.round((e.loaded / e.total) * 100)); },
                                        });
                                        const dlRes = await fetch(`${SERVER_URL}${res.data.downloadUrl}`);
                                        const blob = await dlRes.blob();
                                        const mergedFile = new File([blob], `merged-${Date.now()}.pdf`, { type: 'application/pdf' });
                                        setFiles(prev => [...(prev || []), mergedFile]);
                                        setPdfToolType(null);
                                        setPdfToolFiles([]);
                                        setShowPdfTools(false);
                                        alert(`تم الدمج! ${res.data.fileCount} ملفات → ${res.data.totalPages} صفحة`);
                                      } catch { setError('خطأ في دمج الملفات'); }
                                      finally { setPdfToolLoading(false); setPdfToolProgress(0); }
                                    }}
                                    className="w-full py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
                                  >
                                    {pdfToolLoading ? 'جاري الدمج...' : `دمج ${pdfToolFiles.length} ملفات وإضافة للدرس`}
                                  </button>
                                </>
                              )}

                              {/* تقسيم PDF */}
                              {pdfToolType === 'split' && (
                                <>
                                  <FileUploadProgress
                                    files={pdfToolFiles}
                                    onFilesChange={async (newFiles) => {
                                      setPdfToolFiles(newFiles);
                                      setPdfInfo(null);
                                      setSplitPage('');
                                      if (newFiles.length) {
                                        try {
                                          const fd = new FormData();
                                          fd.append('file', newFiles[0]);
                                          const res = await api.post('/pdf-tools/info', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                                          setPdfInfo(res.data);
                                          setSplitPage(Math.ceil(res.data.pageCount / 2).toString());
                                        } catch {}
                                      }
                                    }}
                                    accept=".pdf"
                                    multiple={false}
                                    uploadProgress={pdfToolProgress}
                                    isUploading={pdfToolLoading}
                                  />
                                  {pdfInfo && (
                                    <div className="flex items-center gap-3">
                                      <span className="text-xs text-gray-500">{pdfInfo.pageCount} صفحة — التقسيم بعد:</span>
                                      <input
                                        type="number"
                                        min="1"
                                        max={pdfInfo.pageCount - 1}
                                        value={splitPage}
                                        onChange={(e) => setSplitPage(e.target.value)}
                                        className="w-16 border rounded-lg px-2 py-1 text-sm text-center"
                                      />
                                    </div>
                                  )}
                                  <button
                                    type="button"
                                    disabled={pdfToolLoading || !pdfToolFiles.length || !pdfInfo}
                                    onClick={async () => {
                                      setPdfToolLoading(true);
                                      setPdfToolProgress(0);
                                      try {
                                        const fd = new FormData();
                                        fd.append('file', pdfToolFiles[0]);
                                        fd.append('splitAfterPage', splitPage);
                                        const res = await api.post('/pdf-tools/split', fd, {
                                          headers: { 'Content-Type': 'multipart/form-data' },
                                          onUploadProgress: (e) => { if (e.total) setPdfToolProgress(Math.round((e.loaded / e.total) * 100)); },
                                        });
                                        const newFiles = [];
                                        for (const part of res.data.parts) {
                                          const dlRes = await fetch(`${SERVER_URL}${part.downloadUrl}`);
                                          const blob = await dlRes.blob();
                                          newFiles.push(new File([blob], `${part.label}.pdf`, { type: 'application/pdf' }));
                                        }
                                        setFiles(prev => [...(prev || []), ...newFiles]);
                                        setPdfToolType(null);
                                        setPdfToolFiles([]);
                                        setPdfInfo(null);
                                        setShowPdfTools(false);
                                        alert(`تم التقسيم! جزء 1: ${res.data.parts[0].pages} صفحة، جزء 2: ${res.data.parts[1].pages} صفحة`);
                                      } catch { setError('خطأ في تقسيم الملف'); }
                                      finally { setPdfToolLoading(false); setPdfToolProgress(0); }
                                    }}
                                    className="w-full py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                                  >
                                    {pdfToolLoading ? 'جاري التقسيم...' : 'تقسيم وإضافة الأجزاء للدرس'}
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* أزرار الإرسال — الوضع الفردي */}
            {/* ═══════════════════════════════════════════ */}
            <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
              {isUploading ? (
                <>
                  <Button type="button" disabled className="px-8">
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      جاري الرفع... {uploadProgress}%
                    </span>
                  </Button>
                  <Button variant="secondary" onClick={handleCancelUpload} className="!bg-red-50 !text-red-600 !border-red-200 hover:!bg-red-100">
                    إلغاء الرفع
                  </Button>
                </>
              ) : (
                <>
                  <Button type="submit" disabled={loading} className="px-8">
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        جاري الإضافة...
                      </span>
                    ) : 'إضافة الدرس'}
                  </Button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleQuickAdd}
                    className="px-4 py-2.5 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-100 transition-colors border border-emerald-200 disabled:opacity-50"
                  >
                    إضافة وفتح جديد
                  </button>
                  <Button variant="secondary" onClick={onClose}>إلغاء</Button>
                </>
              )}
              {files.length > 0 && !isUploading && (
                <span className="text-xs text-gray-400 mr-auto">
                  {files.length} {files.length === 1 ? 'ملف' : 'ملفات'} جاهزة للرفع
                </span>
              )}
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* الوضع المتعدد (Batch) */}
        {/* ═══════════════════════════════════════════ */}
        {batchMode && (
          <>
            {/* النوع + الفصل (مشترك) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="النوع (مشترك)">
                <Select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  {LESSON_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="الفصل الدراسي (مشترك)">
                <Select
                  value={semester}
                  onChange={(e) => setSemester(parseInt(e.target.value))}
                >
                  <option value={1}>الفصل الأول</option>
                  <option value={2}>الفصل الثاني</option>
                  <option value={0}>مشترك للفصلين</option>
                </Select>
              </FormField>
            </div>

            {/* قائمة الدروس */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-700">الدروس ({batchLessons.filter(l => l.title.trim()).length} من {batchLessons.length})</h3>
                {batchLessons.length < 10 && (
                  <button
                    type="button"
                    onClick={addBatchRow}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    + إضافة صف
                  </button>
                )}
              </div>

              {batchLessons.map((lesson, idx) => (
                <div key={idx} className="flex gap-3 items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <span className="text-gray-400 font-mono text-sm w-6 text-center flex-shrink-0">{idx + 1}</span>
                  <input
                    type="text"
                    placeholder="عنوان الدرس"
                    value={lesson.title}
                    onChange={(e) => updateBatchLesson(idx, 'title', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                  <select
                    value={lesson.type}
                    onChange={(e) => updateBatchLesson(idx, 'type', e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none w-24 flex-shrink-0"
                  >
                    {BATCH_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <label className="flex items-center gap-1 px-3 py-2 bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors flex-shrink-0">
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    <span className="text-xs text-gray-500">
                      {lesson.file ? lesson.file.name.substring(0, 15) + '...' : 'ملف'}
                    </span>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.webp"
                      onChange={(e) => updateBatchLesson(idx, 'file', e.target.files[0] || null)}
                      className="hidden"
                    />
                  </label>
                  {batchLessons.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeBatchRow(idx)}
                      className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* شريط التقدم في Batch */}
            {batchLoading && (
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-700">
                    جاري إضافة الدروس... ({batchProgress.current}/{batchProgress.total})
                  </span>
                  <span className="text-xs text-blue-500">
                    {Math.round((batchProgress.current / batchProgress.total) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* أزرار الإرسال — الوضع المتعدد */}
            <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
              <Button type="submit" disabled={batchLoading} className="px-8">
                {batchLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    جاري الإضافة... {batchProgress.current}/{batchProgress.total}
                  </span>
                ) : `إضافة ${batchLessons.filter(l => l.title.trim()).length} درس`}
              </Button>
              <Button variant="secondary" onClick={onClose} disabled={batchLoading}>إلغاء</Button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
