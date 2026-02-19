import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api, { SERVER_URL } from '../lib/api';
import DashboardLayout from './DashboardLayout';
import { Alert, Button, Input, FormField, PageHeader, Card, LoadingState, EmptyState } from '../components/ui';
import { useToast } from '../components/ui/Toast';
import EmojiPicker from '../components/EmojiPicker';
import subjectTemplates from '../data/subjectTemplates';

export default function SubjectsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlGradeId = searchParams.get('grade_id');
  const { toast } = useToast();

  const [subjects, setSubjects] = useState([]);
  const [grades, setGrades] = useState([]);
  const [stages, setStages] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [name, setName] = useState('');
  const [selectedGradeIds, setSelectedGradeIds] = useState([]);
  const [selectedTrackIds, setSelectedTrackIds] = useState([]);
  const [selectedIcon, setSelectedIcon] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [useImage, setUseImage] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  // فلترة وترتيب
  const [filterStage, setFilterStage] = useState('');
  const [filterTrack, setFilterTrack] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [sortBy, setSortBy] = useState('default');

  const fetchSubjects = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterGrade) params.set('grade_id', filterGrade);
      else if (filterTrack) params.set('track_id', filterTrack);
      else if (filterStage) params.set('stage_id', filterStage);
      if (sortBy !== 'default') params.set('sort', sortBy);

      const url = `/subjects${params.toString() ? '?' + params.toString() : ''}`;
      const res = await api.get(url);
      setSubjects(res.data);
    } catch {
      setError('خطأ في جلب المواد');
    } finally {
      setLoading(false);
    }
  }, [filterStage, filterTrack, filterGrade, sortBy]);

  const fetchGrades = async () => {
    try {
      const res = await api.get('/grades');
      setGrades(res.data);
    } catch {}
  };

  const fetchStages = async () => {
    try {
      const res = await api.get('/stages');
      setStages(res.data);
    } catch {}
  };

  const fetchTracks = async () => {
    try {
      const res = await api.get('/tracks');
      setTracks(res.data);
    } catch {}
  };

  useEffect(() => {
    fetchGrades();
    fetchStages();
    fetchTracks();
  }, []);

  // تطبيق فلتر الصف تلقائياً من URL
  useEffect(() => {
    if (urlGradeId && grades.length > 0) {
      const grade = grades.find(g => g.id === urlGradeId);
      if (grade) {
        setFilterStage(grade.stage_id);
        setFilterGrade(grade.id);
      }
    }
  }, [urlGradeId, grades]);

  useEffect(() => {
    setLoading(true);
    fetchSubjects();
  }, [fetchSubjects]);

  // عند تغيير فلتر المرحلة، نمسح فلتر المسار والصف
  const handleStageFilter = (stageId) => {
    setFilterStage(stageId);
    setFilterTrack('');
    setFilterGrade('');
  };

  // عند تغيير فلتر المسار، نمسح فلتر الصف
  const handleTrackFilter = (trackId) => {
    setFilterTrack(trackId);
    setFilterGrade('');
  };

  // المسارات المتاحة للمرحلة المحددة
  const filteredTracks = filterStage
    ? tracks.filter((t) => t.stage_id === filterStage)
    : [];

  // الصفوف المتاحة للمرحلة المحددة
  const filteredGrades = filterStage
    ? grades.filter((g) => g.stage_id === filterStage)
    : [];

  // تجميع الصفوف حسب المرحلة (للفورم)
  const groupedGrades = {};
  grades.forEach((grade) => {
    const key = grade.stage_id;
    if (!groupedGrades[key]) {
      groupedGrades[key] = {
        stageName: grade.stage_name,
        stageId: key,
        grades: []
      };
    }
    groupedGrades[key].grades.push(grade);
  });

  // تجميع المسارات حسب المرحلة (للفورم)
  const groupedTracks = {};
  tracks.forEach((track) => {
    const key = track.stage_id;
    if (!groupedTracks[key]) {
      groupedTracks[key] = {
        stageName: track.stage_name,
        stageId: key,
        tracks: []
      };
    }
    groupedTracks[key].tracks.push(track);
  });

  const handleGradeToggle = (gradeId) => {
    setSelectedGradeIds((prev) =>
      prev.includes(gradeId)
        ? prev.filter((id) => id !== gradeId)
        : [...prev, gradeId]
    );
  };

  const handleStageGradesToggle = (stageGrades) => {
    const stageGradeIds = stageGrades.map((g) => g.id);
    const allSelected = stageGradeIds.every((id) => selectedGradeIds.includes(id));
    if (allSelected) {
      setSelectedGradeIds((prev) => prev.filter((id) => !stageGradeIds.includes(id)));
    } else {
      setSelectedGradeIds((prev) => [...new Set([...prev, ...stageGradeIds])]);
    }
  };

  const handleTrackToggle = (trackId) => {
    setSelectedTrackIds((prev) =>
      prev.includes(trackId)
        ? prev.filter((id) => id !== trackId)
        : [...prev, trackId]
    );
  };

  const handleStageTracksToggle = (stageTracks) => {
    const stageTrackIds = stageTracks.map((t) => t.id);
    const allSelected = stageTrackIds.every((id) => selectedTrackIds.includes(id));
    if (allSelected) {
      setSelectedTrackIds((prev) => prev.filter((id) => !stageTrackIds.includes(id)));
    } else {
      setSelectedTrackIds((prev) => [...new Set([...prev, ...stageTrackIds])]);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
      setUseImage(true);
      setSelectedIcon('');
    }
  };

  const handleIconSelect = (icon) => {
    setSelectedIcon(icon);
    setImage(null);
    setImagePreview(null);
    setUseImage(false);
  };

  const resetForm = () => {
    setName('');
    setSelectedGradeIds([]);
    setSelectedTrackIds([]);
    setSelectedIcon('');
    setImage(null);
    setImagePreview(null);
    setUseImage(false);
    setEditingId(null);
    setShowForm(false);
    setShowTemplates(false);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('اسم المادة مطلوب');
      return;
    }

    if (selectedGradeIds.length === 0 && selectedTrackIds.length === 0) {
      setError('يجب تحديد صف أو مسار واحد على الأقل');
      return;
    }

    const formData = new FormData();
    formData.append('name', name);
    formData.append('grade_ids', JSON.stringify(selectedGradeIds));
    formData.append('track_ids', JSON.stringify(selectedTrackIds));
    if (selectedIcon) formData.append('icon', selectedIcon);
    if (image) formData.append('image', image);

    try {
      const config = { headers: { 'Content-Type': 'multipart/form-data' } };

      if (editingId) {
        await api.put(`/subjects/${editingId}`, formData, config);
        toast.success('تم تحديث المادة بنجاح');
      } else {
        await api.post('/subjects', formData, config);
        toast.success('تم إضافة المادة بنجاح');
      }

      resetForm();
      fetchSubjects();
    } catch (err) {
      setError(err.response?.data?.message || 'حدث خطأ');
      toast.error('حدث خطأ في حفظ المادة');
    }
  };

  const handleEdit = (subject) => {
    setName(subject.name);
    setSelectedGradeIds(subject.grades ? subject.grades.map((g) => g.grade_id) : []);
    setSelectedTrackIds(subject.tracks ? subject.tracks.map((t) => t.track_id) : []);
    setSelectedIcon(subject.icon || '');
    setEditingId(subject.id);
    setShowForm(true);
    setShowTemplates(false);
    setImage(null);
    if (subject.image_url) {
      setImagePreview(`${SERVER_URL}${subject.image_url}`);
      setUseImage(true);
    } else {
      setImagePreview(null);
      setUseImage(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه المادة؟')) return;

    try {
      await api.delete(`/subjects/${id}`);
      fetchSubjects();
      toast.success('تم حذف المادة بنجاح');
    } catch {
      setError('خطأ في حذف المادة');
      toast.error('خطأ في حذف المادة');
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-6">
        <PageHeader
          title="إدارة المواد الدراسية"
          action={!showForm && (
            <Button icon="+" onClick={() => setShowForm(true)}>إضافة مادة</Button>
          )}
        />

        {error && <Alert>{error}</Alert>}

        {showForm && (
          <Card className="p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">
              {editingId ? 'تعديل المادة' : 'إضافة مادة جديدة'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* اختيار من المواد الجاهزة */}
              {!editingId && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowTemplates(!showTemplates)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1.5"
                  >
                    <span>{showTemplates ? '▲' : '▼'}</span>
                    {showTemplates ? 'إخفاء المواد الجاهزة' : 'اختر من المواد الجاهزة'}
                  </button>

                  {showTemplates && (
                    <div className="mt-3 grid grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-2">
                      {subjectTemplates.map((template) => (
                        <button
                          key={template.name}
                          type="button"
                          onClick={() => {
                            setName(template.name);
                            setSelectedIcon(template.icon);
                            setUseImage(false);
                            setImage(null);
                            setImagePreview(null);
                            setShowTemplates(false);
                          }}
                          className="p-3 rounded-lg border border-gray-200 text-center hover:border-blue-300 hover:bg-blue-50 transition-all"
                        >
                          <span className="text-2xl block mb-1">{template.icon}</span>
                          <span className="text-xs text-gray-600 leading-tight block">{template.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <FormField label="اسم المادة">
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: الرياضيات"
                  required
                />
              </FormField>

              {/* أيقونة أو صورة */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-600 text-sm font-medium mb-3">اختر أيقونة</label>
                  <EmojiPicker
                    selectedEmoji={selectedIcon}
                    onSelect={handleIconSelect}
                    compact
                  />
                </div>
                <div>
                  <label className="block text-gray-600 text-sm font-medium mb-2">أو ارفع صورة</label>
                  <div className="flex items-center gap-4">
                    <label className="cursor-pointer bg-gray-100 text-gray-700 px-5 py-2.5 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium">
                      اختيار صورة
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                    </label>
                    {imagePreview && useImage && (
                      <div className="relative">
                        <img
                          src={imagePreview}
                          alt="معاينة"
                          className="w-16 h-16 object-cover rounded-lg border"
                        />
                        <button
                          type="button"
                          onClick={() => { setImage(null); setImagePreview(null); setUseImage(false); }}
                          className="absolute -top-2 -left-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                        >
                          x
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* اختيار المسارات */}
              {Object.values(groupedTracks).length > 0 && (
                <div>
                  <label className="block text-gray-600 text-sm font-medium mb-3">
                    المسارات الدراسية
                    {selectedTrackIds.length > 0 && (
                      <span className="text-emerald-600 mr-2">({selectedTrackIds.length} مسار محدد)</span>
                    )}
                  </label>
                  <div className="space-y-4">
                    {Object.values(groupedTracks).map((group) => {
                      const stageTrackIds = group.tracks.map((t) => t.id);
                      const allSelected = stageTrackIds.every((id) => selectedTrackIds.includes(id));
                      const someSelected = stageTrackIds.some((id) => selectedTrackIds.includes(id));

                      return (
                        <div key={group.stageId} className="border border-emerald-200 rounded-lg p-4 bg-emerald-50/30">
                          <label className="flex items-center gap-2 mb-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={allSelected}
                              ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                              onChange={() => handleStageTracksToggle(group.tracks)}
                              className="w-4 h-4 text-emerald-600 rounded"
                            />
                            <span className="font-semibold text-gray-700 flex items-center gap-1.5">
                              {stages.find(s => s.id === group.stageId)?.icon || ''}
                              {group.stageName} - المسارات
                            </span>
                          </label>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mr-6">
                            {group.tracks.map((track) => (
                              <label
                                key={track.id}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm ${
                                  selectedTrackIds.includes(track.id)
                                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedTrackIds.includes(track.id)}
                                  onChange={() => handleTrackToggle(track.id)}
                                  className="w-4 h-4 text-emerald-600 rounded"
                                />
                                <span>{track.icon || ''}</span>
                                {track.name}
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* اختيار الصفوف */}
              <div>
                <label className="block text-gray-600 text-sm font-medium mb-3">
                  الصفوف الدراسية
                  {selectedGradeIds.length > 0 && (
                    <span className="text-blue-600 mr-2">({selectedGradeIds.length} صف محدد)</span>
                  )}
                </label>
                {Object.values(groupedGrades).length === 0 ? (
                  <p className="text-gray-400 text-sm">لا توجد صفوف دراسية بعد</p>
                ) : (
                  <div className="space-y-4">
                    {Object.values(groupedGrades).map((group) => {
                      const stageGradeIds = group.grades.map((g) => g.id);
                      const allSelected = stageGradeIds.every((id) => selectedGradeIds.includes(id));
                      const someSelected = stageGradeIds.some((id) => selectedGradeIds.includes(id));

                      return (
                        <div key={group.stageId} className="border rounded-lg p-4">
                          <label className="flex items-center gap-2 mb-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={allSelected}
                              ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                              onChange={() => handleStageGradesToggle(group.grades)}
                              className="w-4 h-4 text-blue-600 rounded"
                            />
                            <span className="font-semibold text-gray-700 flex items-center gap-1.5">
                              {stages.find(s => s.id === group.stageId)?.icon || ''}
                              {group.stageName}
                            </span>
                          </label>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mr-6">
                            {group.grades.map((grade) => (
                              <label
                                key={grade.id}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm ${
                                  selectedGradeIds.includes(grade.id)
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                    : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedGradeIds.includes(grade.id)}
                                  onChange={() => handleGradeToggle(grade.id)}
                                  className="w-4 h-4 text-blue-600 rounded"
                                />
                                {grade.name}
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit">{editingId ? 'تحديث' : 'إضافة'}</Button>
                <Button variant="secondary" onClick={resetForm}>إلغاء</Button>
              </div>
            </form>
          </Card>
        )}

        {/* شريط الفلترة والترتيب */}
        {!showForm && (
          <Card className="p-4 mb-6 space-y-3">
            {/* فلتر المراحل */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-gray-500 ml-2">المرحلة:</span>
              <button
                onClick={() => handleStageFilter('')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  !filterStage
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                الكل ({subjects.length})
              </button>
              {stages.map((stage) => (
                <button
                  key={stage.id}
                  onClick={() => handleStageFilter(stage.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                    filterStage === stage.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <span>{stage.icon || ''}</span>
                  {stage.name}
                </button>
              ))}
            </div>

            {/* فلتر المسارات - يظهر عند اختيار مرحلة لها مسارات */}
            {filterStage && filteredTracks.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-emerald-600 ml-2">المسار:</span>
                <button
                  onClick={() => handleTrackFilter('')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    !filterTrack
                      ? 'bg-emerald-600 text-white'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  }`}
                >
                  كل المسارات
                </button>
                {filteredTracks.map((track) => (
                  <button
                    key={track.id}
                    onClick={() => handleTrackFilter(track.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                      filterTrack === track.id
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    <span>{track.icon || ''}</span>
                    {track.name}
                  </button>
                ))}
              </div>
            )}

            {/* فلتر الصفوف - يظهر عند اختيار مرحلة لها صفوف */}
            {filterStage && filteredGrades.length > 0 && !filterTrack && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-indigo-600 ml-2">الصف:</span>
                <button
                  onClick={() => setFilterGrade('')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    !filterGrade
                      ? 'bg-indigo-600 text-white'
                      : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                  }`}
                >
                  كل الصفوف
                </button>
                {filteredGrades.map((grade) => (
                  <button
                    key={grade.id}
                    onClick={() => setFilterGrade(grade.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      filterGrade === grade.id
                        ? 'bg-indigo-600 text-white'
                        : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                    }`}
                  >
                    {grade.name}
                  </button>
                ))}
              </div>
            )}

            {/* ترتيب */}
            <div className="flex items-center gap-2 border-t pt-3">
              <span className="text-sm font-medium text-gray-500 ml-2">ترتيب:</span>
              {[
                { value: 'default', label: 'الافتراضي' },
                { value: 'name', label: 'الاسم' },
                { value: 'newest', label: 'الأحدث' },
                { value: 'oldest', label: 'الأقدم' }
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSortBy(opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    sortBy === opt.value
                      ? 'bg-gray-800 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Card>
        )}

        {loading ? (
          <LoadingState />
        ) : subjects.length === 0 ? (
          <EmptyState
            icon="📚"
            message={filterStage || filterTrack || filterGrade
              ? 'لا توجد مواد دراسية لهذا الفلتر'
              : 'لا توجد مواد دراسية بعد'}
          />
        ) : (filterStage || filterTrack || filterGrade) ? (
          /* عرض مسطح عند وجود فلتر محدد */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {subjects.map((subject) => (
              <SubjectCard
                key={subject.id}
                subject={subject}
                onNavigate={() => navigate(`/admin/lessons/${subject.id}`)}
                onEdit={() => handleEdit(subject)}
                onDelete={() => handleDelete(subject.id)}
              />
            ))}
          </div>
        ) : (
          /* عرض مجمع حسب المرحلة → الصف عند عدم وجود فلتر */
          <GroupedSubjectsView
            subjects={subjects}
            stages={stages}
            grades={grades}
            tracks={tracks}
            onNavigate={(id) => navigate(`/admin/lessons/${id}`)}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onRefresh={fetchSubjects}
            toast={toast}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

// ======================== بطاقة مادة ========================

function SubjectCard({ subject, onNavigate, onEdit, onDelete }) {
  return (
    <Card
      className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
      onClick={onNavigate}
    >
      {subject.image_url ? (
        <img
          src={`${SERVER_URL}${subject.image_url}`}
          alt={subject.name}
          className="w-full h-32 object-cover"
        />
      ) : (
        <div className="w-full h-32 bg-gradient-to-bl from-purple-50 to-violet-100 flex items-center justify-center">
          <span className="text-4xl group-hover:scale-110 transition-transform">{subject.icon || '📚'}</span>
        </div>
      )}

      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-bold text-gray-800 text-sm leading-snug">{subject.name}</h3>
          {subject.lessons_count > 0 && (
            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">
              {subject.lessons_count} درس
            </span>
          )}
        </div>

        {/* عرض المسارات */}
        {subject.tracks && subject.tracks.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {subject.tracks.map((t) => (
              <span
                key={t.track_id}
                className="text-xs bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full flex items-center gap-1"
              >
                <span>{t.icon || ''}</span>
                {t.track_name}
              </span>
            ))}
          </div>
        )}

        {/* عرض الصفوف */}
        {subject.grades && subject.grades.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {subject.grades.map((g) => (
              <span
                key={g.grade_id}
                className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
              >
                {g.grade_name}
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-2 mt-2">
          <Button variant="edit" className="flex-1 !py-1.5 !text-xs" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
            تعديل
          </Button>
          <Button variant="danger" className="flex-1 !py-1.5 !text-xs" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
            حذف
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ======================== عرض مجمع حسب المرحلة → الصف ========================

const STAGE_COLORS = [
  { bg: 'bg-blue-50', border: 'border-blue-200', heading: 'text-blue-800', badge: 'bg-blue-100 text-blue-700', gradeBg: 'bg-blue-50/50', gradeBorder: 'border-blue-100' },
  { bg: 'bg-emerald-50', border: 'border-emerald-200', heading: 'text-emerald-800', badge: 'bg-emerald-100 text-emerald-700', gradeBg: 'bg-emerald-50/50', gradeBorder: 'border-emerald-100' },
  { bg: 'bg-purple-50', border: 'border-purple-200', heading: 'text-purple-800', badge: 'bg-purple-100 text-purple-700', gradeBg: 'bg-purple-50/50', gradeBorder: 'border-purple-100' },
  { bg: 'bg-amber-50', border: 'border-amber-200', heading: 'text-amber-800', badge: 'bg-amber-100 text-amber-700', gradeBg: 'bg-amber-50/50', gradeBorder: 'border-amber-100' },
];

function GroupedSubjectsView({ subjects, stages, grades, tracks, onNavigate, onEdit, onDelete, onRefresh, toast }) {
  // حالات السحب والإفلات
  const [draggedSubject, setDraggedSubject] = useState(null);
  const [dragOverSubjectId, setDragOverSubjectId] = useState(null);
  const [dragGroupKey, setDragGroupKey] = useState(null); // grade_X أو track_X
  const [savingOrder, setSavingOrder] = useState(false);
  const [localSubjects, setLocalSubjects] = useState(subjects);

  // تحديث المواد المحلية عند تغير المواد من الخارج
  useEffect(() => {
    setLocalSubjects(subjects);
  }, [subjects]);

  const handleDragStart = (e, subject, groupKey) => {
    setDraggedSubject(subject);
    setDragGroupKey(groupKey);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', subject.id);
  };

  const handleDragOver = (e, subject) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedSubject && subject.id !== draggedSubject.id) {
      setDragOverSubjectId(subject.id);
    }
  };

  const handleDragLeave = () => {
    setDragOverSubjectId(null);
  };

  const handleDrop = async (e, targetSubject, groupSubjects, groupKey) => {
    e.preventDefault();
    setDragOverSubjectId(null);

    if (!draggedSubject || draggedSubject.id === targetSubject.id || groupKey !== dragGroupKey) {
      setDraggedSubject(null);
      setDragGroupKey(null);
      return;
    }

    // إعادة ترتيب المصفوفة محلياً
    const currentList = [...groupSubjects];
    const dragIndex = currentList.findIndex(s => s.id === draggedSubject.id);
    const dropIndex = currentList.findIndex(s => s.id === targetSubject.id);

    if (dragIndex === -1 || dropIndex === -1) return;

    currentList.splice(dragIndex, 1);
    currentList.splice(dropIndex, 0, draggedSubject);

    // تحديث sort_order لكل مادة
    const orders = currentList.map((s, i) => ({ id: s.id, sort_order: i + 1 }));

    // تحديث محلي فوري
    const updatedSubjects = localSubjects.map(s => {
      const order = orders.find(o => o.id === s.id);
      return order ? { ...s, sort_order: order.sort_order } : s;
    });
    setLocalSubjects(updatedSubjects);

    setDraggedSubject(null);
    setDragGroupKey(null);

    // حفظ في الخادم
    try {
      setSavingOrder(true);
      await api.put('/subjects/reorder/batch', { orders });
      if (onRefresh) onRefresh();
      if (toast) toast.success('تم حفظ الترتيب');
    } catch (err) {
      console.error('خطأ في حفظ الترتيب:', err);
      if (toast) toast.error('خطأ في حفظ الترتيب');
    } finally {
      setSavingOrder(false);
    }
  };

  const handleDragEnd = () => {
    setDraggedSubject(null);
    setDragOverSubjectId(null);
    setDragGroupKey(null);
  };

  // تجميع المواد حسب المرحلة ثم الصف/المسار
  const grouped = {};

  localSubjects.forEach(subject => {
    // تجميع حسب الصفوف
    if (subject.grades && subject.grades.length > 0) {
      subject.grades.forEach(g => {
        const stageId = g.stage_id;
        const gradeId = g.grade_id;
        if (!grouped[stageId]) grouped[stageId] = { grades: {}, tracks: {} };
        if (!grouped[stageId].grades[gradeId]) grouped[stageId].grades[gradeId] = { name: g.grade_name, subjects: [] };
        // تجنب التكرار
        if (!grouped[stageId].grades[gradeId].subjects.find(s => s.id === subject.id)) {
          grouped[stageId].grades[gradeId].subjects.push(subject);
        }
      });
    }

    // تجميع حسب المسارات
    if (subject.tracks && subject.tracks.length > 0) {
      subject.tracks.forEach(t => {
        const stageId = t.stage_id;
        const trackId = t.track_id;
        if (!grouped[stageId]) grouped[stageId] = { grades: {}, tracks: {} };
        if (!grouped[stageId].tracks[trackId]) grouped[stageId].tracks[trackId] = { name: t.track_name, icon: t.icon, subjects: [] };
        if (!grouped[stageId].tracks[trackId].subjects.find(s => s.id === subject.id)) {
          grouped[stageId].tracks[trackId].subjects.push(subject);
        }
      });
    }
  });

  // ترتيب المواد داخل كل مجموعة حسب sort_order
  Object.values(grouped).forEach(stageData => {
    Object.values(stageData.grades).forEach(gradeData => {
      gradeData.subjects.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    });
    Object.values(stageData.tracks).forEach(trackData => {
      trackData.subjects.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    });
  });

  // ترتيب المراحل
  const sortedStages = stages.filter(s => grouped[s.id]).sort((a, b) => a.sort_order - b.sort_order);

  // مواد بدون تصنيف
  const unlinkedSubjects = localSubjects.filter(s =>
    (!s.grades || s.grades.length === 0) && (!s.tracks || s.tracks.length === 0)
  );

  return (
    <div className="space-y-8">
      {/* مؤشر حفظ الترتيب */}
      {savingOrder && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm flex items-center gap-2">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          جاري حفظ الترتيب...
        </div>
      )}

      {sortedStages.map((stage, stageIndex) => {
        const stageData = grouped[stage.id];
        const color = STAGE_COLORS[stageIndex % STAGE_COLORS.length];
        const stageGrades = grades.filter(g => g.stage_id === stage.id).sort((a, b) => a.sort_order - b.sort_order);
        const stageTracks = tracks.filter(t => t.stage_id === stage.id).sort((a, b) => a.sort_order - b.sort_order);

        return (
          <div key={stage.id} className={`rounded-2xl border-2 ${color.border} overflow-hidden`}>
            {/* عنوان المرحلة */}
            <div className={`${color.bg} px-5 py-4 flex items-center gap-3`}>
              <span className="text-2xl">{stage.icon || '📚'}</span>
              <div>
                <h3 className={`text-lg font-bold ${color.heading}`}>{stage.name}</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {Object.keys(stageData.grades).length > 0 && `${Object.keys(stageData.grades).length} صف`}
                  {Object.keys(stageData.grades).length > 0 && Object.keys(stageData.tracks).length > 0 && ' · '}
                  {Object.keys(stageData.tracks).length > 0 && `${Object.keys(stageData.tracks).length} مسار`}
                </p>
              </div>
            </div>

            <div className="p-4 space-y-5">
              {/* الصفوف */}
              {stageGrades.filter(g => stageData.grades[g.id]).map(grade => {
                const gradeGroupKey = `grade_${grade.id}`;
                const gradeSubjects = stageData.grades[grade.id].subjects;
                return (
                  <div key={grade.id} className={`rounded-xl border ${color.gradeBorder} ${color.gradeBg} p-4`}>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${color.badge.split(' ')[0]}`}></span>
                        {grade.name}
                      </h4>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400">اسحب للترتيب</span>
                        <span className={`text-xs px-2.5 py-1 rounded-full ${color.badge}`}>
                          {gradeSubjects.length} مادة
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {gradeSubjects.map(subject => (
                        <SubjectMiniCard
                          key={subject.id}
                          subject={subject}
                          onNavigate={() => onNavigate(subject.id)}
                          onEdit={() => onEdit(subject)}
                          onDelete={() => onDelete(subject.id)}
                          draggable
                          isDragging={draggedSubject?.id === subject.id}
                          isDragOver={dragOverSubjectId === subject.id}
                          onDragStart={(e) => handleDragStart(e, subject, gradeGroupKey)}
                          onDragOver={(e) => handleDragOver(e, subject)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, subject, gradeSubjects, gradeGroupKey)}
                          onDragEnd={handleDragEnd}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* المسارات */}
              {stageTracks.filter(t => stageData.tracks[t.id]).map(track => {
                const trackGroupKey = `track_${track.id}`;
                const trackSubjects = stageData.tracks[track.id].subjects;
                return (
                  <div key={track.id} className={`rounded-xl border ${color.gradeBorder} ${color.gradeBg} p-4`}>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                        <span className="text-lg">{track.icon || ''}</span>
                        {track.name}
                      </h4>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400">اسحب للترتيب</span>
                        <span className={`text-xs px-2.5 py-1 rounded-full ${color.badge}`}>
                          {trackSubjects.length} مادة
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {trackSubjects.map(subject => (
                        <SubjectMiniCard
                          key={subject.id}
                          subject={subject}
                          onNavigate={() => onNavigate(subject.id)}
                          onEdit={() => onEdit(subject)}
                          onDelete={() => onDelete(subject.id)}
                          draggable
                          isDragging={draggedSubject?.id === subject.id}
                          isDragOver={dragOverSubjectId === subject.id}
                          onDragStart={(e) => handleDragStart(e, subject, trackGroupKey)}
                          onDragOver={(e) => handleDragOver(e, subject)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, subject, trackSubjects, trackGroupKey)}
                          onDragEnd={handleDragEnd}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* مواد بدون تصنيف */}
      {unlinkedSubjects.length > 0 && (
        <div className="rounded-2xl border-2 border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-5 py-4">
            <h3 className="text-lg font-bold text-gray-600">مواد بدون تصنيف</h3>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {unlinkedSubjects.map(subject => (
                <SubjectMiniCard
                  key={subject.id}
                  subject={subject}
                  onNavigate={() => onNavigate(subject.id)}
                  onEdit={() => onEdit(subject)}
                  onDelete={() => onDelete(subject.id)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ======================== بطاقة مادة مصغرة ========================

function SubjectMiniCard({ subject, onNavigate, onEdit, onDelete, draggable, isDragging, isDragOver, onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd }) {
  return (
    <div
      className={`bg-white rounded-xl border p-3 hover:shadow-md transition-all cursor-pointer group flex items-center gap-3
        ${isDragging ? 'opacity-40 scale-95 border-blue-300 bg-blue-50' : 'hover:border-blue-200'}
        ${isDragOver ? 'border-blue-400 border-dashed bg-blue-50/50 shadow-md' : 'border-gray-200'}
      `}
      onClick={onNavigate}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      {/* مقبض السحب */}
      {draggable && (
        <div
          className="shrink-0 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 transition-colors"
          onMouseDown={(e) => e.stopPropagation()}
          title="اسحب لتغيير الترتيب"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="5" r="1.5" />
            <circle cx="15" cy="5" r="1.5" />
            <circle cx="9" cy="12" r="1.5" />
            <circle cx="15" cy="12" r="1.5" />
            <circle cx="9" cy="19" r="1.5" />
            <circle cx="15" cy="19" r="1.5" />
          </svg>
        </div>
      )}

      {/* أيقونة */}
      <div className="w-12 h-12 rounded-lg bg-gradient-to-bl from-purple-50 to-violet-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
        {subject.image_url ? (
          <img src={`${SERVER_URL}${subject.image_url}`} alt="" className="w-full h-full object-cover rounded-lg" />
        ) : (
          <span className="text-2xl">{subject.icon || '📚'}</span>
        )}
      </div>

      {/* المعلومات */}
      <div className="flex-1 min-w-0">
        <h5 className="font-bold text-gray-800 text-sm truncate">{subject.name}</h5>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-xs ${subject.lessons_count > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
            {subject.lessons_count > 0 ? `${subject.lessons_count} درس` : 'لا دروس'}
          </span>
        </div>
      </div>

      {/* أزرار */}
      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors"
        >
          تعديل
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition-colors"
        >
          حذف
        </button>
      </div>
    </div>
  );
}
