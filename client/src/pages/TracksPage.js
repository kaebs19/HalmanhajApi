import { useState, useEffect } from 'react';
import api, { SERVER_URL } from '../lib/api';
import DashboardLayout from './DashboardLayout';
import { Alert, Button, Input, Select, FormField, PageHeader, Card, LoadingState, EmptyState } from '../components/ui';
import EmojiPicker from '../components/EmojiPicker';

export default function TracksPage() {
  const [tracks, setTracks] = useState([]);
  const [stages, setStages] = useState([]);
  const [selectedStage, setSelectedStage] = useState('');
  const [name, setName] = useState('');
  const [stageId, setStageId] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [useImage, setUseImage] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const fetchStages = async () => {
    try {
      const res = await api.get('/stages');
      setStages(res.data);
    } catch {}
  };

  const fetchTracks = async (filterStageId) => {
    try {
      let url = '/tracks';
      if (filterStageId) url += `?stage_id=${filterStageId}`;
      const res = await api.get(url);
      setTracks(res.data);
    } catch {
      setError('خطأ في جلب البيانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStages();
    fetchTracks();
  }, []);

  const handleFilter = (stageIdValue) => {
    setSelectedStage(stageIdValue);
    setLoading(true);
    fetchTracks(stageIdValue);
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
    setStageId('');
    setSelectedIcon('');
    setImage(null);
    setImagePreview(null);
    setUseImage(false);
    setEditingId(null);
    setShowForm(false);
    setError('');
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
    if (selectedIcon) formData.append('icon', selectedIcon);
    if (image) formData.append('image', image);

    try {
      const config = { headers: { 'Content-Type': 'multipart/form-data' } };

      if (editingId) {
        await api.put(`/tracks/${editingId}`, formData, config);
      } else {
        await api.post('/tracks', formData, config);
      }

      resetForm();
      fetchTracks(selectedStage);
    } catch (err) {
      setError(err.response?.data?.message || 'حدث خطأ');
    }
  };

  const handleEdit = (track) => {
    setName(track.name);
    setStageId(track.stage_id);
    setEditingId(track.id);
    setSelectedIcon(track.icon || '');
    setShowForm(true);

    if (track.image_url) {
      setImagePreview(`${SERVER_URL}${track.image_url}`);
      setUseImage(true);
    } else {
      setImage(null);
      setImagePreview(null);
      setUseImage(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المسار؟')) return;

    try {
      await api.delete(`/tracks/${id}`);
      fetchTracks(selectedStage);
    } catch {
      setError('خطأ في حذف المسار');
    }
  };

  // تجميع المسارات حسب المرحلة
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

  return (
    <DashboardLayout>
      <div className="mb-6">
        <PageHeader
          title="إدارة المسارات الدراسية"
          action={!showForm && (
            <Button icon="+" onClick={() => setShowForm(true)}>إضافة مسار</Button>
          )}
        />

        {error && <Alert>{error}</Alert>}

        {showForm && (
          <Card className="p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">
              {editingId ? 'تعديل المسار' : 'إضافة مسار جديد'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="المرحلة الدراسية">
                  <Select value={stageId} onChange={(e) => setStageId(e.target.value)} required>
                    <option value="">اختر المرحلة</option>
                    {stages.map((stage) => (
                      <option key={stage.id} value={stage.id}>{stage.name}</option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="اسم المسار">
                  <Input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثال: المسار العلمي"
                    required
                  />
                </FormField>
              </div>

              <div>
                <label className="block text-gray-600 text-sm font-medium mb-3">اختر أيقونة</label>
                <EmojiPicker
                  selectedEmoji={selectedIcon}
                  onSelect={handleIconSelect}
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

              <div className="flex gap-3 pt-2">
                <Button type="submit">{editingId ? 'تحديث' : 'إضافة'}</Button>
                <Button variant="secondary" onClick={resetForm}>إلغاء</Button>
              </div>
            </form>
          </Card>
        )}

        {/* فلتر حسب المرحلة */}
        <div className="flex flex-wrap gap-2 mb-6">
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

        {loading ? (
          <LoadingState />
        ) : tracks.length === 0 ? (
          <EmptyState icon="🛤️" message={`لا توجد مسارات دراسية ${selectedStage ? 'لهذه المرحلة' : 'بعد'}`} />
        ) : (
          <div className="space-y-6">
            {Object.values(groupedTracks).map((group) => (
              <div key={group.stageId}>
                <h2 className="text-lg font-bold text-gray-700 mb-3 flex items-center gap-2">
                  {stages.find(s => s.id === group.stageId)?.icon || '🎓'}
                  {group.stageName}
                  <span className="text-sm font-normal text-gray-400">({group.tracks.length} مسار)</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {group.tracks.map((track) => (
                    <Card key={track.id} className="overflow-hidden hover:shadow-md transition-shadow">
                      {track.image_url ? (
                        <img
                          src={`${SERVER_URL}${track.image_url}`}
                          alt={track.name}
                          className="w-full h-32 object-cover"
                        />
                      ) : (
                        <div className="w-full h-32 bg-gradient-to-bl from-indigo-50 to-purple-100 flex items-center justify-center">
                          <span className="text-5xl">{track.icon || '🛤️'}</span>
                        </div>
                      )}

                      <div className="p-4">
                        <h3 className="font-bold text-gray-800 mb-1">{track.name}</h3>
                        <p className="text-gray-400 text-xs mb-3">{group.stageName}</p>
                        <div className="flex gap-2">
                          <Button variant="edit" className="flex-1" onClick={() => handleEdit(track)}>
                            تعديل
                          </Button>
                          <Button variant="danger" className="flex-1" onClick={() => handleDelete(track.id)}>
                            حذف
                          </Button>
                        </div>
                      </div>
                    </Card>
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
