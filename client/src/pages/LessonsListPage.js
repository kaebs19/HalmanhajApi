import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api, { SERVER_URL } from '../lib/api';
import DashboardLayout from './DashboardLayout';
import { Alert, Button, Input, Select, FormField, Card, LoadingState, EmptyState, Textarea } from '../components/ui';
import FileUploadProgress from '../components/FileUploadProgress';

const FILE_ICONS = {
  pdf: '📄',
  image: '🖼️',
  video: '🎬',
  document: '📝'
};

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function LessonsListPage() {
  const { subjectId, gradeId, trackId } = useParams();
  const [lessons, setLessons] = useState([]);
  const [subject, setSubject] = useState(null);
  const [contextName, setContextName] = useState('');
  const [semester, setSemester] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // نموذج الدرس
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [formSemester, setFormSemester] = useState(1);
  const [source, setSource] = useState('');
  const [sourceOptions, setSourceOptions] = useState([]);
  const [files, setFiles] = useState(null);

  // إضافة ملفات لدرس موجود
  const [addingFilesTo, setAddingFilesTo] = useState(null);
  const [additionalFiles, setAdditionalFiles] = useState(null);

  // progress bar
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  // ضغط ملف PDF
  const [compressingFileId, setCompressingFileId] = useState(null);

  const navigate = useNavigate();
  const isShared = !gradeId && !trackId;

  // جلب معلومات المادة والسياق (صف/مسار)
  useEffect(() => {
    const fetchContext = async () => {
      try {
        const res = await api.get('/subjects');
        const found = res.data.find((s) => s.id === subjectId);
        setSubject(found || null);

        if (found) {
          if (isShared) {
            setContextName('مشترك لجميع الصفوف/المسارات');
          } else if (gradeId) {
            const grade = found.grades?.find((g) => g.grade_id === gradeId);
            setContextName(grade ? grade.grade_name : 'صف غير محدد');
          } else if (trackId) {
            const track = found.tracks?.find((t) => t.track_id === trackId);
            setContextName(track ? track.track_name : 'مسار غير محدد');
          }
        }
      } catch {}
    };
    fetchContext();
  }, [subjectId, gradeId, trackId, isShared]);

  // جلب مصادر الدروس من الإعدادات
  useEffect(() => {
    api.get('/settings')
      .then(res => {
        const raw = res.data?.lesson_sources;
        let list = [];
        if (Array.isArray(raw)) list = raw;
        else if (typeof raw === 'string') { try { list = JSON.parse(raw) || []; } catch { list = []; } }
        setSourceOptions(list.filter(x => x && String(x).trim()));
      })
      .catch(() => {});
  }, []);

  // جلب الدروس
  const fetchLessons = useCallback(async () => {
    try {
      const params = new URLSearchParams({ subject_id: subjectId });
      if (!isShared) {
        params.set('semester', semester);
      }
      if (gradeId) params.set('grade_id', gradeId);
      if (trackId) params.set('track_id', trackId);
      if (isShared) {
        params.set('shared_only', 'true');
      }

      const res = await api.get(`/lessons?${params.toString()}`);
      setLessons(res.data);
    } catch {
      setError('خطأ في جلب الدروس');
    } finally {
      setLoading(false);
    }
  }, [subjectId, gradeId, trackId, semester, isShared]);

  useEffect(() => {
    setLoading(true);
    fetchLessons();
  }, [fetchLessons]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setFormSemester(semester);
    setSource('');
    setFiles(null);
    setEditingId(null);
    setShowForm(false);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('عنوان الدرس مطلوب');
      return;
    }

    try {
      const progressConfig = {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        },
      };

      setIsUploading(true);
      setUploadProgress(0);

      if (editingId) {
        await api.put(`/lessons/${editingId}`, {
          title,
          description,
          semester: formSemester,
          source
        });

        if (files && files.length > 0) {
          const formData = new FormData();
          for (const file of files) {
            formData.append('files', file);
          }
          await api.post(`/lessons/${editingId}/files`, formData, progressConfig);
        }
      } else {
        const formData = new FormData();
        formData.append('subject_id', subjectId);
        formData.append('title', title);
        formData.append('description', description);
        formData.append('semester', formSemester);
        formData.append('source', source);
        if (gradeId) formData.append('grade_id', gradeId);
        if (trackId) formData.append('track_id', trackId);
        if (isShared) formData.append('shared', 'true');
        if (files) {
          for (const file of files) {
            formData.append('files', file);
          }
        }
        await api.post('/lessons', formData, progressConfig);
      }

      resetForm();
      fetchLessons();
    } catch (err) {
      setError(err.response?.data?.message || 'حدث خطأ');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleEdit = (lesson) => {
    setTitle(lesson.title);
    setDescription(lesson.description || '');
    setFormSemester(lesson.semester);
    setSource(lesson.source || '');
    setEditingId(lesson.id);
    setFiles(null);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الدرس وجميع ملفاته؟')) return;
    try {
      await api.delete(`/lessons/${id}`);
      fetchLessons();
    } catch {
      setError('خطأ في حذف الدرس');
    }
  };

  const handleDeleteFile = async (lessonId, fileId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الملف؟')) return;
    try {
      await api.delete(`/lessons/${lessonId}/files/${fileId}`);
      fetchLessons();
    } catch {
      setError('خطأ في حذف الملف');
    }
  };

  const handleCompressFile = async (file) => {
    setCompressingFileId(file.id);
    try {
      const res = await fetch(`${SERVER_URL}${file.file_url}`);
      const blob = await res.blob();
      const formData = new FormData();
      formData.append('file', blob, file.original_name);
      const result = await api.post('/pdf-tools/compress', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const link = document.createElement('a');
      link.href = `${SERVER_URL}${result.data.downloadUrl}`;
      link.download = `compressed-${file.original_name}`;
      link.click();
      alert(`تم الضغط! الحجم الأصلي: ${result.data.originalSizeFormatted} → الجديد: ${result.data.compressedSizeFormatted} (توفير ${result.data.savedPercent}%)`);
    } catch {
      setError('خطأ في ضغط الملف');
    } finally {
      setCompressingFileId(null);
    }
  };

  const handleAddFiles = async (lessonId) => {
    if (!additionalFiles || additionalFiles.length === 0) return;

    try {
      setIsUploading(true);
      setUploadProgress(0);
      const formData = new FormData();
      const fileList = Array.isArray(additionalFiles) ? additionalFiles : Array.from(additionalFiles);
      for (const file of fileList) {
        formData.append('files', file);
      }
      await api.post(`/lessons/${lessonId}/files`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        },
      });
      setAddingFilesTo(null);
      setAdditionalFiles(null);
      fetchLessons();
    } catch {
      setError('خطأ في رفع الملفات');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
          <Link to="/admin/lessons" className="hover:text-blue-600 transition-colors">الدروس</Link>
          <span>/</span>
          <Link to={`/admin/lessons/${subjectId}`} className="hover:text-blue-600 transition-colors">
            {subject?.name || '...'}
          </Link>
          <span>/</span>
          <span className="text-gray-800 font-medium">{contextName}</span>
        </div>

        {/* العنوان وزر الإضافة */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-800">
            {subject?.name} - {contextName}
          </h1>
          {!showForm && (
            <Button icon="+" onClick={() => { setShowForm(true); setFormSemester(semester); }}>
              إضافة درس
            </Button>
          )}
        </div>

        {/* تبويبات الفصول */}
        {!isShared && (
          <div className="flex gap-2 mb-6">
            {[1, 2].map((sem) => (
              <button
                key={sem}
                onClick={() => setSemester(sem)}
                className={`px-6 py-2.5 rounded-lg font-medium transition-colors ${
                  semester === sem
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-gray-600 border hover:bg-gray-50'
                }`}
              >
                الفصل {sem === 1 ? 'الأول' : 'الثاني'}
              </button>
            ))}
          </div>
        )}

        {error && <Alert>{error}</Alert>}

        {/* نموذج الإضافة/التعديل */}
        {showForm && (
          <Card className="p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">
              {editingId ? 'تعديل الدرس' : 'إضافة درس جديد'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="عنوان الدرس">
                  <Input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="مثال: الفصل الأول - الأعداد الصحيحة"
                    required
                  />
                </FormField>
                <FormField label="الفصل الدراسي">
                  <Select
                    value={formSemester}
                    onChange={(e) => setFormSemester(parseInt(e.target.value))}
                  >
                    <option value={1}>الفصل الأول</option>
                    <option value={2}>الفصل الثاني</option>
                    <option value={0}>مشترك للفصلين</option>
                  </Select>
                </FormField>
              </div>

              <FormField label="الوصف (اختياري)">
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="وصف مختصر للدرس..."
                  rows={2}
                />
              </FormField>

              <FormField label="المصدر (اختياري)">
                <Select value={source} onChange={(e) => setSource(e.target.value)}>
                  <option value="">بدون مصدر</option>
                  {sourceOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                  {source && !sourceOptions.includes(source) && (
                    <option value={source}>{source}</option>
                  )}
                </Select>
              </FormField>

              <FormField label="الملفات (PDF, صور, فيديو, مستندات)">
                <FileUploadProgress
                  files={files ? Array.from(files) : []}
                  onFilesChange={(newFiles) => setFiles(newFiles)}
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.mp4,.webm,.doc,.docx,.ppt,.pptx"
                  multiple={true}
                  maxFiles={10}
                  uploadProgress={uploadProgress}
                  isUploading={isUploading}
                />
              </FormField>

              <div className="flex gap-3 pt-2">
                <Button type="submit">{editingId ? 'تحديث' : 'إضافة'}</Button>
                <Button variant="secondary" onClick={resetForm}>إلغاء</Button>
              </div>
            </form>
          </Card>
        )}

        {/* قائمة الدروس */}
        {loading ? (
          <LoadingState />
        ) : lessons.length === 0 ? (
          <EmptyState
            icon="📖"
            message={isShared
              ? 'لا توجد دروس مشتركة بعد'
              : `لا توجد دروس في الفصل ${semester === 1 ? 'الأول' : 'الثاني'}`
            }
          >
            {!showForm && (
              <button
                onClick={() => { setShowForm(true); setFormSemester(semester); }}
                className="mt-3 text-blue-600 hover:underline text-sm"
              >
                إضافة أول درس
              </button>
            )}
          </EmptyState>
        ) : (
          <div className="space-y-4">
            {lessons.map((lesson, index) => (
              <Card
                key={lesson.id}
                className="p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {lesson.thumbnail_url ? (
                      <img
                        src={`${SERVER_URL}${lesson.thumbnail_url}`}
                        alt={lesson.title}
                        className="w-10 h-14 object-cover rounded-lg border shadow-sm flex-shrink-0"
                      />
                    ) : (
                      <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                        {index + 1}
                      </span>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-800">{lesson.title}</h3>
                        {lesson.semester === 0 && !isShared && (
                          <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full">مشترك للفصلين</span>
                        )}
                        {!lesson.grade_id && !lesson.track_id && !isShared && (
                          <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">مشترك</span>
                        )}
                      </div>
                      {lesson.description && (
                        <p className="text-gray-500 text-sm mt-0.5">{lesson.description}</p>
                      )}
                      {lesson.seo_title && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-xs text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">SEO</span>
                          <span className="text-xs text-gray-400 truncate max-w-xs">{lesson.seo_title}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="edit" onClick={() => handleEdit(lesson)}>تعديل</Button>
                    <Button variant="danger" onClick={() => handleDelete(lesson.id)}>حذف</Button>
                  </div>
                </div>

                {/* الملفات */}
                {lesson.files && lesson.files.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-3 mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-500">الملفات ({lesson.files.length})</span>
                    </div>
                    <div className="space-y-2">
                      {lesson.files.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border"
                        >
                          <a
                            href={`${SERVER_URL}${file.file_url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-gray-700 hover:text-blue-600 transition-colors flex-1 min-w-0"
                          >
                            <span>{FILE_ICONS[file.file_type] || '📎'}</span>
                            <span className="truncate">{file.original_name}</span>
                            <span className="text-xs text-gray-400 flex-shrink-0">{formatFileSize(file.file_size)}</span>
                          </a>
                          <div className="flex items-center gap-2 mr-2 flex-shrink-0">
                            {file.file_type === 'pdf' && (
                              <button
                                onClick={() => handleCompressFile(file)}
                                disabled={compressingFileId === file.id}
                                className="text-blue-400 hover:text-blue-600 text-xs disabled:opacity-50"
                              >
                                {compressingFileId === file.id ? 'جاري...' : '📦 ضغط'}
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteFile(lesson.id, file.id)}
                              className="text-red-400 hover:text-red-600 text-xs"
                            >
                              حذف
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* إضافة ملفات */}
                {addingFilesTo === lesson.id ? (
                  <div className="space-y-3">
                    <FileUploadProgress
                      files={additionalFiles ? Array.from(additionalFiles) : []}
                      onFilesChange={(newFiles) => setAdditionalFiles(newFiles)}
                      accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.mp4,.webm,.doc,.docx,.ppt,.pptx"
                      multiple={true}
                      maxFiles={10}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleAddFiles(lesson.id)}>رفع</Button>
                      <Button variant="secondary" size="sm" onClick={() => { setAddingFilesTo(null); setAdditionalFiles(null); }}>إلغاء</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setAddingFilesTo(lesson.id)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
                    >
                      <span>+</span> إضافة ملفات
                    </button>
                    <button
                      onClick={() => navigate(`/admin/exercises/create?lesson_id=${lesson.id}`)}
                      className="text-purple-600 hover:text-purple-800 text-sm font-medium flex items-center gap-1"
                    >
                      🧩 التمارين التفاعلية
                    </button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
