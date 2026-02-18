import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { SERVER_URL } from '../lib/api';
import DashboardLayout from './DashboardLayout';
import { Alert, Button, Input, Select, FormField, Card, LoadingState, EmptyState } from '../components/ui';

export default function GradesPage() {
  const navigate = useNavigate();
  const [grades, setGrades] = useState([]);
  const [stages, setStages] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [selectedStage, setSelectedStage] = useState('');
  const [selectedTrack, setSelectedTrack] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [name, setName] = useState('');
  const [stageId, setStageId] = useState('');
  const [trackId, setTrackId] = useState('');
  const [formTracks, setFormTracks] = useState([]);
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [copyFromGradeId, setCopyFromGradeId] = useState('');
  const [expandedGrade, setExpandedGrade] = useState(null);
  const [gradeSubjects, setGradeSubjects] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  const fetchStages = async () => {
    try {
      const res = await api.get('/stages');
      setStages(res.data);
    } catch {}
  };

  const fetchTracks = async (stageIdVal) => {
    if (!stageIdVal) {
      setTracks([]);
      return;
    }
    try {
      const res = await api.get(`/tracks?stage_id=${stageIdVal}`);
      setTracks(res.data);
    } catch {
      setTracks([]);
    }
  };

  const fetchFormTracks = async (stageIdVal) => {
    if (!stageIdVal) {
      setFormTracks([]);
      return;
    }
    try {
      const res = await api.get(`/tracks?stage_id=${stageIdVal}`);
      setFormTracks(res.data);
    } catch {
      setFormTracks([]);
    }
  };

  const fetchGrades = async (filterStageId, filterTrackId) => {
    try {
      let url = '/grades';
      const params = [];
      if (filterStageId) params.push(`stage_id=${filterStageId}`);
      if (filterTrackId) params.push(`track_id=${filterTrackId}`);
      if (params.length > 0) url += '?' + params.join('&');
      const res = await api.get(url);
      setGrades(res.data);
    } catch {
      setError('خطأ في جلب البيانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStages();
    fetchGrades();
  }, []);

  const handleFilter = (stageIdValue) => {
    setSelectedStage(stageIdValue);
    setSelectedTrack('');
    setLoading(true);
    fetchGrades(stageIdValue, '');
    fetchTracks(stageIdValue);
  };

  const handleTrackFilter = (trackIdValue) => {
    setSelectedTrack(trackIdValue);
    setLoading(true);
    fetchGrades(selectedStage, trackIdValue);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const resetForm = () => {
    setName('');
    setStageId('');
    setTrackId('');
    setFormTracks([]);
    setImage(null);
    setImagePreview(null);
    setEditingId(null);
    setCopyFromGradeId('');
    setShowForm(false);
    setError('');
  };

  const handleStageChange = (newStageId) => {
    setStageId(newStageId);
    setTrackId('');
    fetchFormTracks(newStageId);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!stageId) {
      setError('اختر المرحلة الدراسية');
      return;
    }

    const formData = new FormData();
    formData.append('name', name);
    formData.append('stage_id', stageId);
    if (trackId) formData.append('track_id', trackId);
    if (image) formData.append('image', image);
    if (!editingId && copyFromGradeId) formData.append('copy_from_grade_id', copyFromGradeId);

    try {
      const config = { headers: { 'Content-Type': 'multipart/form-data' } };

      if (editingId) {
        await api.put(`/grades/${editingId}`, formData, config);
      } else {
        await api.post('/grades', formData, config);
      }

      resetForm();
      fetchGrades(selectedStage, selectedTrack);
    } catch (err) {
      setError(err.response?.data?.message || 'حدث خطأ');
    }
  };

  const handleEdit = (grade) => {
    setName(grade.name);
    setStageId(grade.stage_id);
    setTrackId(grade.track_id || '');
    setEditingId(grade.id);
    setShowForm(true);
    setImage(null);
    setImagePreview(grade.image_url ? `${SERVER_URL}${grade.image_url}` : null);
    fetchFormTracks(grade.stage_id);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الصف؟')) return;

    try {
      await api.delete(`/grades/${id}`);
      fetchGrades(selectedStage, selectedTrack);
    } catch {
      setError('خطأ في حذف الصف');
    }
  };

  const fetchGradeSubjects = async (gradeId) => {
    if (expandedGrade === gradeId) {
      setExpandedGrade(null);
      setGradeSubjects([]);
      return;
    }
    setLoadingSubjects(true);
    setExpandedGrade(gradeId);
    try {
      const res = await api.get(`/subjects?grade_id=${gradeId}`);
      setGradeSubjects(res.data);
    } catch {
      setGradeSubjects([]);
    } finally {
      setLoadingSubjects(false);
    }
  };

  // تجميع الصفوف حسب المرحلة
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

  return (
    <DashboardLayout>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">إدارة الصفوف الدراسية</h1>
          <div className="flex items-center gap-3">
            {/* تبديل العرض */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                شبكة
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                قائمة
              </button>
            </div>
            {!showForm && (
              <Button icon="+" onClick={() => setShowForm(true)}>إضافة صف</Button>
            )}
          </div>
        </div>

        {error && <Alert>{error}</Alert>}

        {showForm && (
          <Card className="p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">
              {editingId ? 'تعديل الصف' : 'إضافة صف جديد'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FormField label="المرحلة الدراسية">
                  <Select value={stageId} onChange={(e) => handleStageChange(e.target.value)} required>
                    <option value="">اختر المرحلة</option>
                    {stages.map((stage) => (
                      <option key={stage.id} value={stage.id}>{stage.name}</option>
                    ))}
                  </Select>
                </FormField>
                {formTracks.length > 0 && (
                  <FormField label="المسار (اختياري)">
                    <Select value={trackId} onChange={(e) => setTrackId(e.target.value)}>
                      <option value="">بدون مسار</option>
                      {formTracks.map((track) => (
                        <option key={track.id} value={track.id}>{track.icon} {track.name}</option>
                      ))}
                    </Select>
                  </FormField>
                )}
                <FormField label="اسم الصف">
                  <Input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثال: الصف الأول"
                    required
                  />
                </FormField>
              </div>

              <div>
                <label className="block text-gray-600 text-sm font-medium mb-2">صورة الصف (اختياري)</label>
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
                  {imagePreview && (
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt="معاينة"
                        className="w-16 h-16 object-cover rounded-lg border"
                      />
                      <button
                        type="button"
                        onClick={() => { setImage(null); setImagePreview(null); }}
                        className="absolute -top-2 -left-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                      >
                        x
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {!editingId && stageId && (
                <FormField label="نسخ المواد من صف آخر (اختياري)">
                  <Select value={copyFromGradeId} onChange={(e) => setCopyFromGradeId(e.target.value)}>
                    <option value="">بدون نسخ</option>
                    {grades.filter(g => String(g.stage_id) === String(stageId)).map((g) => (
                      <option key={g.id} value={g.id}>{g.name}{g.track_name ? ` - ${g.track_name}` : ''}</option>
                    ))}
                  </Select>
                </FormField>
              )}

              <div className="flex gap-3 pt-2">
                <Button type="submit">{editingId ? 'تحديث' : 'إضافة'}</Button>
                <Button variant="secondary" onClick={resetForm}>إلغاء</Button>
              </div>
            </form>
          </Card>
        )}

        {/* فلتر حسب المرحلة */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => handleFilter('')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              !selectedStage
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 border hover:bg-gray-50'
            }`}
          >
            الكل
          </button>
          {stages.map((stage) => (
            <button
              key={stage.id}
              onClick={() => handleFilter(stage.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                selectedStage === stage.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 border hover:bg-gray-50'
              }`}
            >
              <span>{stage.icon || '🎓'}</span>
              {stage.name}
            </button>
          ))}
        </div>

        {/* زر رجوع للمسارات عند اختيار مسار محدد */}
        {selectedTrack && tracks.length > 0 && (
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => handleTrackFilter('')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
            >
              <span>←</span>
              رجوع للمسارات
            </button>
            <span className="text-gray-400">|</span>
            <span className="text-sm text-gray-600 font-medium flex items-center gap-1.5">
              <span>{tracks.find(t => t.id === selectedTrack)?.icon || '🛤️'}</span>
              {tracks.find(t => t.id === selectedTrack)?.name}
            </span>
          </div>
        )}

        {/* عرض المسارات بدل الصفوف عند اختيار مرحلة لها مسارات (الثانوية) */}
        {loading ? (
          <LoadingState />
        ) : selectedStage && tracks.length > 0 && !selectedTrack ? (
          /* عرض المسارات كبطاقات */
          <div>
            <h2 className="text-lg font-bold text-gray-700 mb-3 flex items-center gap-2">
              {stages.find(s => s.id === selectedStage)?.icon || '🎓'}
              {stages.find(s => s.id === selectedStage)?.name} - المسارات
              <span className="text-sm font-normal text-gray-400">({tracks.length} مسار)</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {tracks.map((track) => (
                <Card
                  key={track.id}
                  className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
                >
                  <div onClick={() => handleTrackFilter(track.id)}>
                    {track.image_url ? (
                      <img
                        src={`${SERVER_URL}${track.image_url}`}
                        alt={track.name}
                        className="w-full h-36 object-cover"
                      />
                    ) : (
                      <div className="w-full h-36 bg-gradient-to-bl from-blue-50 to-indigo-100 flex items-center justify-center group-hover:from-blue-100 group-hover:to-indigo-200 transition-colors">
                        <span className="text-5xl">{track.icon || '🛤️'}</span>
                      </div>
                    )}
                    <div className="p-4">
                      <h3 className="font-bold text-gray-800 text-center">{track.name}</h3>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ) : grades.length === 0 ? (
          <EmptyState icon="📋" message={`لا توجد صفوف دراسية ${selectedStage ? 'لهذه المرحلة' : 'بعد'}`} />
        ) : viewMode === 'list' ? (
          /* عرض القائمة */
          <Card className="overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">الصورة</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">اسم الصف</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">المرحلة</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">المسار</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {grades.map((grade) => (
                  <tr
                    key={grade.id}
                    className="border-b last:border-b-0 hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/admin/subjects?grade_id=${grade.id}`)}
                  >
                    <td className="px-4 py-3">
                      {grade.image_url ? (
                        <img src={`${SERVER_URL}${grade.image_url}`} alt={grade.name} className="w-10 h-10 object-cover rounded-lg" />
                      ) : (
                        <div className="w-10 h-10 bg-gradient-to-bl from-green-50 to-emerald-100 rounded-lg flex items-center justify-center">
                          <span className="text-lg">📖</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">{grade.name}</td>
                    <td className="px-4 py-3 text-gray-500 text-sm">{grade.stage_name}</td>
                    <td className="px-4 py-3 text-gray-500 text-sm">{grade.track_name || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEdit(grade); }}
                          className="text-yellow-600 hover:text-yellow-700 text-sm font-medium"
                        >
                          تعديل
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(grade.id); }}
                          className="text-red-600 hover:text-red-700 text-sm font-medium"
                        >
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ) : (
          /* عرض الشبكة */
          <div className="space-y-6">
            {Object.values(groupedGrades).map((group) => (
              <div key={group.stageId}>
                <h2 className="text-lg font-bold text-gray-700 mb-3 flex items-center gap-2">
                  {stages.find(s => s.id === group.stageId)?.icon || '🎓'}
                  {group.stageName}
                  <span className="text-sm font-normal text-gray-400">({group.grades.length} صف)</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {group.grades.map((grade) => (
                    <div key={grade.id}>
                      <Card
                        className={`overflow-hidden hover:shadow-md transition-shadow cursor-pointer group ${
                          expandedGrade === grade.id ? 'ring-2 ring-blue-400' : ''
                        }`}
                        onClick={() => fetchGradeSubjects(grade.id)}
                      >
                        {grade.image_url ? (
                          <img
                            src={`${SERVER_URL}${grade.image_url}`}
                            alt={grade.name}
                            className="w-full h-36 object-cover"
                          />
                        ) : (
                          <div className="w-full h-36 bg-gradient-to-bl from-green-50 to-emerald-100 flex items-center justify-center group-hover:from-green-100 group-hover:to-emerald-200 transition-colors">
                            <span className="text-5xl">📖</span>
                          </div>
                        )}

                        <div className="p-4">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="font-bold text-gray-800">{grade.name}</h3>
                            <span className={`text-xs transition-transform ${expandedGrade === grade.id ? 'text-blue-500' : 'text-gray-400'}`}>
                              {expandedGrade === grade.id ? '▲ إخفاء المواد' : '▼ عرض المواد'}
                            </span>
                          </div>
                          <p className="text-gray-400 text-xs mb-3">
                            {group.stageName}
                            {grade.track_name && ` - ${grade.track_name}`}
                          </p>
                          <div className="flex gap-2">
                            <Button variant="edit" className="flex-1" onClick={(e) => { e.stopPropagation(); handleEdit(grade); }}>
                              تعديل
                            </Button>
                            <Button variant="danger" className="flex-1" onClick={(e) => { e.stopPropagation(); handleDelete(grade.id); }}>
                              حذف
                            </Button>
                          </div>
                        </div>
                      </Card>

                      {/* قسم المواد القابل للطي */}
                      {expandedGrade === grade.id && (
                        <div className="mt-2 p-4 bg-blue-50 rounded-xl border border-blue-100 animate-in">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-bold text-blue-800">
                              مواد {grade.name}
                              {!loadingSubjects && ` (${gradeSubjects.length})`}
                            </h4>
                            <button
                              onClick={(e) => { e.stopPropagation(); navigate(`/admin/subjects?grade_id=${grade.id}`); }}
                              className="text-xs text-blue-600 hover:underline font-medium"
                            >
                              عرض الكل في صفحة المواد ←
                            </button>
                          </div>

                          {loadingSubjects ? (
                            <div className="text-center py-4">
                              <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
                            </div>
                          ) : gradeSubjects.length === 0 ? (
                            <p className="text-sm text-gray-400 text-center py-4">لا توجد مواد لهذا الصف</p>
                          ) : (
                            <div className="grid grid-cols-2 gap-2">
                              {gradeSubjects.map((subject) => (
                                <button
                                  key={subject.id}
                                  onClick={(e) => { e.stopPropagation(); navigate(`/admin/lessons/${subject.id}`); }}
                                  className="flex items-center gap-2 p-3 bg-white rounded-lg border border-blue-100 hover:border-blue-300 hover:shadow-sm transition-all text-right"
                                >
                                  <span className="text-xl">{subject.icon || '📚'}</span>
                                  <span className="text-sm font-medium text-gray-700 truncate">{subject.name}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
