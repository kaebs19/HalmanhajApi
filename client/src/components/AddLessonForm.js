import { useState, useRef, useCallback, useEffect } from 'react';
import api from '../lib/api';
import { createTusUpload, createMultiTusUpload } from '../lib/tusUpload';
import { Alert, Button, Input, Select, FormField, Textarea } from './ui';
import FileUploadProgress from './FileUploadProgress';
import ThumbnailGenerator from './ThumbnailGenerator';
import SeoGenerator from './SeoGenerator';
import { gradeLabel, SEMESTER_LABELS, descriptionTemplates, semesterSynonyms } from '../lib/lessonText';

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

const TYPE_PREFIXES = {
  'حل': 'حل كتاب الطالب',
  'كتاب': 'كتاب',
  'تحضير': 'تحضير درس',
  'تجميع': 'تجميع',
  'فيديو': 'شرح فيديو',
};

export default function AddLessonForm({ subjects, stages = [], grades = [], tracks = [], preSelectedStageId = '', preSelectedGradeId = '', onClose, onSuccess }) {
  // === Dropdowns متدرجة ===
  const [selectedStage, setSelectedStage] = useState(preSelectedStageId ? String(preSelectedStageId) : '');
  const [selectedTrack, setSelectedTrack] = useState('');
  const [selectedGrade, setSelectedGrade] = useState(preSelectedGradeId ? String(preSelectedGradeId) : '');

  // === حقول الدرس الأساسية ===
  const [title, setTitle] = useState('');
  const [isAutoTitle, setIsAutoTitle] = useState(true);
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
  const tusUploadRef = useRef(null);

  // === حقول SEO والصورة المصغرة ===
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [slug, setSlug] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');

  // === المصدر (قائمته تُدار من الإعدادات) ===
  const [sourceOptions, setSourceOptions] = useState([]);
  const [source, setSource] = useState('');
  const [customSource, setCustomSource] = useState('');

  // === حقول الموقع العام ===
  const [category, setCategory] = useState('حل_كتاب');
  const [isPublished, setIsPublished] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);

  // === القسم المتقدم ===
  const [showAdvanced, setShowAdvanced] = useState(true);

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

  // === Computed: المسارات حسب المرحلة (مع fallback من بيانات المواد) ===
  const tracksFromProp = tracks.filter(t => String(t.stage_id) === String(selectedStage));
  const tracksFromSubjects = tracks.length === 0 && selectedStage
    ? [...new Map(
        subjects.flatMap(s => s.tracks || [])
          .filter(t => String(t.stage_id) === String(selectedStage))
          .map(t => [t.track_id, { id: t.track_id, name: t.track_name, stage_id: t.stage_id, icon: t.icon || '' }])
      ).values()]
    : [];
  const filteredTracksForStage = tracksFromProp.length > 0 ? tracksFromProp : tracksFromSubjects;
  const stageHasTracks = filteredTracksForStage.length > 0;

  // === Computed: المواد حسب الصف أو المسار المختار ===
  const filteredSubjectsForForm = selectedGrade
    ? subjects.filter(s => s.grades?.some(g => String(g.grade_id) === String(selectedGrade)))
    : selectedTrack
      ? subjects.filter(s => s.tracks?.some(t => String(t.track_id) === String(selectedTrack)))
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

  // === المصدر النهائي: المختار من القائمة أو المكتوب يدوياً ===
  const effectiveSource = source === '__custom__' ? customSource.trim() : source;

  // === اسم الصف/المسار المستعمل في الأوصاف الجاهزة ===
  const contextGradeName =
    filteredGradesForForm.find(g => String(g.id) === String(selectedGrade))?.name ||
    availableGrades.find(g => String(g.grade_id) === String(selectedGradeIds[0]))?.grade_name ||
    '';
  const contextTrackName = stageHasTracks
    ? filteredTracksForStage.find(t => String(t.id) === String(selectedTrack))?.name || ''
    : '';
  // "الصف" تُضاف للصفوف فقط — أسماء المسارات تبقى كما هي
  const audienceLabel = contextGradeName ? gradeLabel(contextGradeName) : contextTrackName;

  const descriptionOptions = descriptionTemplates({
    type,
    subjectName: selectedSubject?.name || '',
    audience: audienceLabel,
    semester,
  });

  // === الكلمات المفتاحية المقترحة (مرادفات الفصل التي يبحث بها الطلاب) ===
  const keywordList = keywords.split(',').map(k => k.trim()).filter(Boolean);
  const subjectNameForKeywords = selectedSubject?.name || '';
  const keywordSuggestions = semester === 0 ? [] : [
    ...semesterSynonyms(semester),
    ...(subjectNameForKeywords && audienceLabel
      ? [`${subjectNameForKeywords} ${audienceLabel} ${semesterSynonyms(semester)[1]}`]
      : []),
  ];

  const toggleKeyword = (word) => {
    const list = keywords.split(',').map(k => k.trim()).filter(Boolean);
    const next = list.includes(word) ? list.filter(k => k !== word) : [...list, word];
    setKeywords(next.join(', '));
  };

  const addAllKeywordSuggestions = () => {
    const list = keywords.split(',').map(k => k.trim()).filter(Boolean);
    setKeywords([...new Set([...list, ...keywordSuggestions])].join(', '));
  };

  // === جلب مصادر الدروس من إعدادات الموقع ===
  useEffect(() => {
    let cancelled = false;
    api.get('/settings')
      .then(res => {
        if (cancelled) return;
        const raw = res.data?.lesson_sources;
        let list = [];
        if (Array.isArray(raw)) {
          list = raw;
        } else if (typeof raw === 'string') {
          try { list = JSON.parse(raw); } catch { list = []; }
        }
        setSourceOptions(Array.isArray(list) ? list.filter(s => s && String(s).trim()) : []);
        const def = res.data?.default_lesson_source;
        if (def && String(def).trim()) setSource(String(def).trim());
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // === توليد العنوان التلقائي ===
  useEffect(() => {
    if (!isAutoTitle) return;
    const prefix = TYPE_PREFIXES[type] || type;
    const subjectName = selectedSubject?.name || '';
    // اسم المسار عند وجود مسارات للمرحلة
    const trackName = stageHasTracks
      ? filteredTracksForStage.find(t => String(t.id) === String(selectedTrack))?.name || ''
      : '';
    // اسم الصف عند عدم وجود مسارات — بصيغة "الصف الثاني متوسط"
    const rawGradeName = !stageHasTracks
      ? filteredGradesForForm.find(g => String(g.id) === String(selectedGrade))?.name || ''
      : '';
    const gradeName = gradeLabel(rawGradeName);
    const semesterLabel = SEMESTER_LABELS[semester] || '';
    const parts = [prefix, subjectName, trackName || gradeName, semesterLabel].filter(Boolean);
    if (parts.length > 1) {
      setTitle(parts.join(' '));
    }
  }, [isAutoTitle, type, selectedSubject, selectedTrack, selectedGrade, semester,
      filteredGradesForForm, filteredTracksForStage, stageHasTracks]);

  // === Handlers: Cascading dropdowns ===
  const handleStageChange = (stageId) => {
    setSelectedStage(stageId);
    setSelectedTrack('');
    setSelectedGrade('');
    setSelectedSubjectId('');
    setSelectedGradeIds([]);
    setSelectedTrackIds([]);
  };

  const handleTrackChange = (trackId) => {
    setSelectedTrack(trackId);
    setSelectedSubjectId('');
    setSelectedGradeIds([]);
    setSelectedTrackIds(trackId ? [trackId] : []);
  };

  const handleGradeChange = (gradeId) => {
    setSelectedGrade(gradeId);
    setSelectedSubjectId('');
    setSelectedGradeIds([]);
    if (!stageHasTracks) setSelectedTrackIds([]);
  };

  const handleSubjectChange = (subjectId) => {
    setSelectedSubjectId(subjectId);
    setKeywords('');

    const subject = subjects.find(s => s.id === subjectId);

    // تحديد الصف المختار تلقائياً
    if (selectedGrade) {
      const matchingGrade = subject?.grades?.find(g => String(g.grade_id) === String(selectedGrade));
      if (matchingGrade) {
        setSelectedGradeIds([matchingGrade.grade_id]);
      } else {
        setSelectedGradeIds([]);
      }
    } else {
      setSelectedGradeIds(subject?.grades?.map(g => g.grade_id) || []);
    }

    // تحديد المسارات تلقائياً — كل مسارات المادة في نفس المرحلة
    if (stageHasTracks) {
      const subjectTrackIds = subject?.tracks
        ?.filter(t => String(t.stage_id) === String(selectedStage))
        .map(t => t.track_id) || [];
      const combined = selectedTrack
        ? [...new Set([selectedTrack, ...subjectTrackIds])]
        : subjectTrackIds;
      setSelectedTrackIds(combined);
    } else {
      setSelectedTrackIds([]);
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
  }, []);

  const buildFormData = useCallback((tusFiles = null) => {
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
    formData.append('source', effectiveSource);

    if (tusFiles && tusFiles.length > 0) {
      formData.append('tus_files', JSON.stringify(tusFiles));
    }
    return formData;
  }, [selectedSubjectId, title, description, semester, type, keywords, selectedGradeIds, selectedTrackIds, seoTitle, seoDescription, slug, thumbnailUrl, category, isPublished, isFeatured, effectiveSource]);

  const handleCancelUpload = useCallback(() => {
    if (tusUploadRef.current) {
      tusUploadRef.current.abort();
      tusUploadRef.current = null;
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
    if (stageHasTracks && selectedTrackIds.length === 0) {
      setError('اختر مسار واحد على الأقل');
      return false;
    }
    if (!stageHasTracks && selectedGradeIds.length === 0) {
      setError('اختر صف واحد على الأقل');
      return false;
    }
    if (!files || files.length === 0) {
      setError('يجب رفع ملف واحد على الأقل');
      return false;
    }

    setLoading(true);
    setIsUploading(true);
    resetUploadState();

    const token = localStorage.getItem('token');

    try {
      // المرحلة 1: رفع الملفات عبر tus
      const tusResults = await new Promise((resolve, reject) => {
        const handle = createMultiTusUpload(files, token, {
          onTotalProgress(totalUploaded, totalSize, percent, speed, eta) {
            setUploadProgress(percent);
            setUploadedBytes(totalUploaded);
            setTotalBytes(totalSize);
            setUploadSpeed(speed);
            setUploadEta(eta);
          },
          onFileError(fileIndex, error) {
            setUploadError(`فشل رفع ${files[fileIndex].name}: ${error.message || 'خطأ في الشبكة'}`);
          },
          onAllComplete(results) {
            const failed = results.filter(r => !r.success);
            if (failed.length > 0) {
              reject(new Error(`فشل رفع ${failed.length} ملف(ات)`));
            } else {
              resolve(results.map(r => r.fileInfo));
            }
          },
        });

        tusUploadRef.current = handle;
      });

      // المرحلة 2: إرسال بيانات الدرس مع مراجع الملفات
      setUploadProgress(100);
      setUploadError(null);

      const formData = buildFormData(tusResults);
      await api.post('/lessons', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      });

      if (isQuickAdd) {
        setSuccess('تم إضافة الدرس بنجاح! يمكنك إضافة درس آخر');
        setTitle('');
        setIsAutoTitle(true);
        setFiles([]);
        setDescription('');
        setKeywords('');
        setSlug('');
        setSeoTitle('');
        setSeoDescription('');
        setThumbnailUrl('');
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
      if (err.message?.includes('فشل رفع')) {
        setError(err.message);
        setUploadError('فشل رفع بعض الملفات');
      } else if (!err.response && (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error'))) {
        setError('فشل الاتصال بالسيرفر. تأكد من اتصالك بالإنترنت وحاول مرة أخرى.');
        setUploadError('انقطع الاتصال');
      } else {
        setError(err.response?.data?.message || 'حدث خطأ في إضافة الدرس');
      }
      return false;
    } finally {
      setLoading(false);
      setIsUploading(false);
      tusUploadRef.current = null;
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

    const gradeIdsToSend = selectedGradeIds.length > 0
      ? selectedGradeIds
      : selectedGrade ? [selectedGrade] : [];

    if (stageHasTracks && selectedTrackIds.length === 0) {
      setError('اختر مسار واحد على الأقل');
      return;
    }
    if (!stageHasTracks && gradeIdsToSend.length === 0) {
      setError('اختر صف واحد على الأقل');
      return;
    }

    setBatchLoading(true);
    setBatchProgress({ current: 0, total: validLessons.length });

    let successCount = 0;
    const errors = [];
    const token = localStorage.getItem('token');

    for (let i = 0; i < validLessons.length; i++) {
      const lesson = validLessons[i];
      setBatchProgress({ current: i + 1, total: validLessons.length });

      try {
        let tusFiles = null;

        // رفع الملف عبر tus إن وجد
        if (lesson.file) {
          const tusResult = await new Promise((resolve, reject) => {
            createTusUpload(lesson.file, token, {
              onSuccess(fileInfo) { resolve(fileInfo); },
              onError(error) { reject(error); },
            });
          });
          tusFiles = [tusResult];
        }

        // إرسال بيانات الدرس
        const formData = new FormData();
        formData.append('subject_id', selectedSubjectId);
        formData.append('title', lesson.title);
        formData.append('type', lesson.type);
        formData.append('semester', semester);
        formData.append('grade_ids', JSON.stringify(gradeIdsToSend));
        formData.append('track_ids', JSON.stringify(selectedTrackIds));
        formData.append('category', category);
        formData.append('is_published', isPublished);
        formData.append('source', effectiveSource);
        if (tusFiles) {
          formData.append('tus_files', JSON.stringify(tusFiles));
        }

        await api.post('/lessons', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 30000,
        });
        successCount++;
      } catch (err) {
        errors.push(`${lesson.title}: ${err.response?.data?.message || err.message || 'خطأ'}`);
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
        {/* القسم 0: الاختيار المتدرج (مرحلة ← [مسار] ← صف ← مادة) */}
        {/* ═══════════════════════════════════════════ */}
        <div className={`grid grid-cols-1 gap-4 ${stageHasTracks ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
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

          {stageHasTracks && (
            <FormField label="المسار *">
              <Select
                value={selectedTrack}
                onChange={(e) => handleTrackChange(e.target.value)}
                disabled={!selectedStage}
                required
              >
                <option value="">اختر المسار</option>
                {filteredTracksForStage.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.icon ? t.icon + ' ' : ''}{t.name}
                  </option>
                ))}
              </Select>
            </FormField>
          )}

          <FormField label={stageHasTracks ? 'الصف (اختياري)' : 'الصف *'}>
            <Select
              value={selectedGrade}
              onChange={(e) => handleGradeChange(e.target.value)}
              disabled={!selectedStage}
              required={!stageHasTracks}
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
              disabled={stageHasTracks ? !selectedTrack : !selectedStage}
              required
            >
              <option value="">
                {stageHasTracks
                  ? (selectedTrack ? 'اختر المادة' : 'اختر المسار أولاً')
                  : (selectedGrade ? 'اختر المادة' : selectedStage ? 'اختر الصف أولاً' : 'اختر المرحلة أولاً')
                }
              </option>
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
                  onChange={(e) => { setTitle(e.target.value); setIsAutoTitle(false); }}
                  placeholder="يتم توليده تلقائياً أو اكتب يدوياً"
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

              {/* المصدر */}
              <SourcePicker
                options={sourceOptions}
                source={source}
                setSource={setSource}
                customSource={customSource}
                setCustomSource={setCustomSource}
              />
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
                <span className="text-xs text-gray-400">(الصفوف، الوصف، الكلمات المفتاحية، SEO)</span>
              </button>

              {showAdvanced && (
                <div className="space-y-4 mt-3 p-5 bg-gray-50 rounded-xl border border-gray-200">

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

                  {/* المسارات — تظهر كل مسارات المرحلة (للمواد المشتركة) أو مسارات المادة */}
                  {selectedSubjectId && (stageHasTracks || availableTracks.length > 0) && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-gray-600 text-sm font-medium">
                          المسارات {stageHasTracks ? '*' : ''}
                          {stageHasTracks && <span className="text-xs text-gray-400 font-normal mr-2">(يمكنك اختيار أكثر من مسار للمواد المشتركة)</span>}
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const allIds = stageHasTracks
                              ? filteredTracksForStage.map(t => t.id)
                              : availableTracks.map(t => t.track_id);
                            setSelectedTrackIds(prev => prev.length === allIds.length ? [] : allIds);
                          }}
                          className="text-xs text-emerald-600 hover:text-emerald-800"
                        >
                          {selectedTrackIds.length === (stageHasTracks ? filteredTracksForStage.length : availableTracks.length) ? 'إلغاء الكل' : 'تحديد الكل'}
                        </button>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-gray-100">
                        <div className="flex flex-wrap gap-2">
                          {stageHasTracks
                            ? filteredTracksForStage.map(t => (
                                <label
                                  key={t.id}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm cursor-pointer transition-all border ${
                                    selectedTrackIds.includes(t.id)
                                      ? 'bg-emerald-100 border-emerald-300 text-emerald-800 shadow-sm'
                                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedTrackIds.includes(t.id)}
                                    onChange={() => toggleTrack(t.id)}
                                    className="hidden"
                                  />
                                  {t.icon ? t.icon + ' ' : ''}{t.name}
                                </label>
                              ))
                            : availableTracks.map(t => (
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
                              ))
                          }
                        </div>
                      </div>
                    </div>
                  )}

                  {/* تحذير عدم وجود صفوف */}
                  {selectedSubjectId && !stageHasTracks && availableGrades.length === 0 && availableTracks.length === 0 && (
                    <Alert variant="warning">
                      هذه المادة غير مرتبطة بأي صفوف أو مسارات. أضف صفوف/مسارات من صفحة المواد أولاً.
                    </Alert>
                  )}

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

                  {/* الوصف + نصوص جاهزة */}
                  <FormField label="الوصف (اختياري)">
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="وصف مختصر للدرس..."
                      rows={2}
                    />
                    <div className="mt-2">
                      <p className="text-xs text-gray-500 mb-1.5">نصوص جاهزة — اضغط لاستخدام النص:</p>
                      <div className="flex flex-wrap gap-2">
                        {descriptionOptions.map((text, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setDescription(text)}
                            title={text}
                            className={`text-right text-xs px-3 py-1.5 rounded-lg border transition-colors max-w-full truncate ${
                              description === text
                                ? 'bg-blue-100 border-blue-300 text-blue-800'
                                : 'bg-white border-gray-200 text-gray-600 hover:bg-blue-50 hover:border-blue-200'
                            }`}
                          >
                            {text}
                          </button>
                        ))}
                      </div>
                    </div>
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
                    {/* مرادفات الفصل الدراسي — تُضاف بنقرة واحدة */}
                    {semester !== 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-500 mb-1.5">كلمات مقترحة:</p>
                        <div className="flex flex-wrap gap-2">
                          {keywordSuggestions.map(word => {
                            const added = keywordList.includes(word);
                            return (
                              <button
                                key={word}
                                type="button"
                                onClick={() => toggleKeyword(word)}
                                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                                  added
                                    ? 'bg-purple-100 border-purple-300 text-purple-800'
                                    : 'bg-white border-gray-200 text-gray-600 hover:bg-purple-50 hover:border-purple-200'
                                }`}
                              >
                                {added ? '✓ ' : '+ '}{word}
                              </button>
                            );
                          })}
                          <button
                            type="button"
                            onClick={addAllKeywordSuggestions}
                            className="text-xs px-3 py-1.5 rounded-lg border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors"
                          >
                            إضافة الكل
                          </button>
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-1">افصل بين الكلمات بفاصلة (,)</p>
                  </FormField>

                  {/* SEO */}
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

// === اختيار مصدر الدرس — قائمة تُدار من الإعدادات + خيار مصدر مكتوب يدوياً ===
function SourcePicker({ options, source, setSource, customSource, setCustomSource }) {
  const hasOptions = options.length > 0;

  const CheckBox = ({ checked }) => (
    <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
      checked ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-300'
    }`}>
      {checked && (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </span>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-gray-600 text-sm font-medium">المصدر</label>
        {source && (
          <button
            type="button"
            onClick={() => setSource('')}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            بدون مصدر
          </button>
        )}
      </div>

      {!hasOptions && (
        <p className="text-xs text-gray-400 mb-2">
          لا توجد مصادر محفوظة — أضفها من الإعدادات ← إعدادات الموقع ← مصادر الدروس.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => setSource(source === opt ? '' : opt)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border transition-all ${
              source === opt
                ? 'bg-blue-50 border-blue-300 text-blue-800 shadow-sm'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
            }`}
          >
            <CheckBox checked={source === opt} />
            {opt}
          </button>
        ))}

        <button
          type="button"
          onClick={() => setSource(source === '__custom__' ? '' : '__custom__')}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border transition-all ${
            source === '__custom__'
              ? 'bg-blue-50 border-blue-300 text-blue-800 shadow-sm'
              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
          }`}
        >
          <CheckBox checked={source === '__custom__'} />
          مصدر آخر
        </button>
      </div>

      {source === '__custom__' && (
        <Input
          type="text"
          value={customSource}
          onChange={(e) => setCustomSource(e.target.value)}
          placeholder="اكتب اسم المصدر..."
          className="mt-2"
        />
      )}
    </div>
  );
}
