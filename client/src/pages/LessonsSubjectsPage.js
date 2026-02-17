import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { SERVER_URL } from '../lib/api';
import DashboardLayout from './DashboardLayout';
import AddLessonForm from '../components/AddLessonForm';
import { Button, LoadingState, EmptyState, PageHeader, Card } from '../components/ui';

export default function LessonsSubjectsPage() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const navigate = useNavigate();

  const fetchSubjects = async () => {
    try {
      const res = await api.get('/subjects');
      setSubjects(res.data);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  return (
    <DashboardLayout>
      <div className="mb-6">
        <PageHeader
          title="الدروس والمحتوى"
          subtitle="اختر المادة لإدارة دروسها وملفاتها"
          action={!showAddForm && (
            <Button icon="+" onClick={() => setShowAddForm(true)}>إضافة درس</Button>
          )}
        />

        {showAddForm && (
          <AddLessonForm
            subjects={subjects}
            onClose={() => setShowAddForm(false)}
            onSuccess={() => {
              setShowAddForm(false);
              fetchSubjects();
            }}
          />
        )}

        {loading ? (
          <LoadingState />
        ) : subjects.length === 0 ? (
          <EmptyState icon="📖" message="لا توجد مواد دراسية بعد" subMessage="أضف مواد من صفحة المواد الدراسية أولاً" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {subjects.map((subject) => (
              <Card
                key={subject.id}
                className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
                onClick={() => navigate(`/admin/lessons/${subject.id}`)}
              >
                {subject.image_url ? (
                  <img
                    src={`${SERVER_URL}${subject.image_url}`}
                    alt={subject.name}
                    className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-40 bg-gradient-to-bl from-purple-50 to-violet-100 flex items-center justify-center group-hover:from-purple-100 group-hover:to-violet-200 transition-colors">
                    <span className="text-5xl">📚</span>
                  </div>
                )}

                <div className="p-4">
                  <h3 className="font-bold text-gray-800 text-lg mb-2">{subject.name}</h3>

                  <div className="flex flex-wrap gap-1">
                    {subject.tracks && subject.tracks.length > 0 && (
                      <span className="text-xs bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full">
                        {subject.tracks.length} مسار
                      </span>
                    )}
                    {subject.grades && subject.grades.length > 0 && (
                      <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                        {subject.grades.length} صف
                      </span>
                    )}
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
