import { useState, useEffect } from 'react';
import api from '../lib/api';
import DashboardLayout from './DashboardLayout';
import { Alert, Button, Input, LoadingState } from '../components/ui';

export default function SemestersPage() {
  const [semesters, setSemesters] = useState([]);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchSemesters = async () => {
    try {
      const res = await api.get('/semesters');
      setSemesters(res.data);
    } catch {
      setError('خطأ في جلب البيانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSemesters();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (editingId) {
        await api.put(`/semesters/${editingId}`, { name });
      } else {
        await api.post('/semesters', { name });
      }
      setName('');
      setEditingId(null);
      fetchSemesters();
    } catch (err) {
      setError(err.response?.data?.message || 'حدث خطأ');
    }
  };

  const handleEdit = (semester) => {
    setName(semester.name);
    setEditingId(semester.id);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الفصل؟')) return;

    try {
      await api.delete(`/semesters/${id}`);
      fetchSemesters();
    } catch {
      setError('خطأ في حذف الفصل');
    }
  };

  const handleCancel = () => {
    setName('');
    setEditingId(null);
  };

  return (
    <DashboardLayout>
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">إدارة الفصول الدراسية</h1>

        {error && <Alert>{error}</Alert>}

        <form onSubmit={handleSubmit} className="flex gap-3 mb-6">
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="اسم الفصل الدراسي"
            className="flex-1 !w-auto py-2"
            required
          />
          <Button type="submit" className="px-6 py-2">
            {editingId ? 'تحديث' : 'إضافة'}
          </Button>
          {editingId && (
            <Button variant="secondary" onClick={handleCancel} className="px-6 py-2">
              إلغاء
            </Button>
          )}
        </form>

        {loading ? (
          <LoadingState />
        ) : semesters.length === 0 ? (
          <p className="text-gray-500 text-center py-8">لا توجد فصول دراسية</p>
        ) : (
          <div className="space-y-3">
            {semesters.map((semester) => (
              <div
                key={semester.id}
                className="flex items-center justify-between border border-gray-200 rounded-lg p-4"
              >
                <span className="text-gray-800 font-medium">{semester.name}</span>
                <div className="flex gap-2">
                  <Button variant="edit" size="sm" onClick={() => handleEdit(semester)}>
                    تعديل
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => handleDelete(semester.id)}>
                    حذف
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
