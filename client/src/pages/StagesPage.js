import { useState, useEffect } from 'react';
import api, { SERVER_URL } from '../lib/api';
import DashboardLayout from './DashboardLayout';
import { Alert, Button, Input, FormField, PageHeader, Card, LoadingState, EmptyState } from '../components/ui';
import EmojiPicker from '../components/EmojiPicker';

export default function StagesPage() {
  const [stages, setStages] = useState([]);
  const [name, setName] = useState('');
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
    } catch {
      setError('خطأ في جلب البيانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStages();
  }, []);

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

    const formData = new FormData();
    formData.append('name', name);
    if (selectedIcon) formData.append('icon', selectedIcon);
    if (image) formData.append('image', image);

    try {
      if (editingId) {
        await api.put(`/stages/${editingId}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await api.post('/stages', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      }

      resetForm();
      fetchStages();
    } catch (err) {
      setError(err.response?.data?.message || 'حدث خطأ');
    }
  };

  const handleEdit = (stage) => {
    setName(stage.name);
    setEditingId(stage.id);
    setSelectedIcon(stage.icon || '');
    setShowForm(true);

    if (stage.image_url) {
      setImagePreview(`${SERVER_URL}${stage.image_url}`);
      setUseImage(true);
    } else {
      setImage(null);
      setImagePreview(null);
      setUseImage(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه المرحلة؟')) return;

    try {
      await api.delete(`/stages/${id}`);
      fetchStages();
    } catch {
      setError('خطأ في حذف المرحلة');
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-6">
        <PageHeader
          title="إدارة المراحل الدراسية"
          action={!showForm && (
            <Button icon="+" onClick={() => setShowForm(true)}>إضافة مرحلة</Button>
          )}
        />

        {error && <Alert>{error}</Alert>}

        {showForm && (
          <Card className="p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">
              {editingId ? 'تعديل المرحلة' : 'إضافة مرحلة جديدة'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              <FormField label="اسم المرحلة">
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: المرحلة الابتدائية"
                  required
                />
              </FormField>

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

        {loading ? (
          <LoadingState />
        ) : stages.length === 0 ? (
          <EmptyState icon="🎓" message="لا توجد مراحل دراسية بعد" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {stages.map((stage) => (
              <Card key={stage.id} className="overflow-hidden hover:shadow-md transition-shadow">
                {stage.image_url ? (
                  <img
                    src={`${SERVER_URL}${stage.image_url}`}
                    alt={stage.name}
                    className="w-full h-44 object-cover"
                  />
                ) : (
                  <div className="w-full h-44 bg-gradient-to-bl from-blue-50 to-blue-100 flex items-center justify-center">
                    <span className="text-6xl">{stage.icon || '🎓'}</span>
                  </div>
                )}

                <div className="p-5">
                  <h3 className="font-bold text-gray-800 text-lg mb-1">{stage.name}</h3>
                  <p className="text-gray-400 text-sm mb-4">
                    الترتيب: {stage.sort_order}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="edit" className="flex-1" onClick={() => handleEdit(stage)}>
                      تعديل
                    </Button>
                    <Button variant="danger" className="flex-1" onClick={() => handleDelete(stage.id)}>
                      حذف
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
