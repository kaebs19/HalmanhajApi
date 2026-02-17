import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api, { SERVER_URL } from '../lib/api';
import DashboardLayout from './DashboardLayout';
import { LoadingState, EmptyState, Card } from '../components/ui';

export default function LessonsGradePickerPage() {
  const { subjectId } = useParams();
  const navigate = useNavigate();
  const [subject, setSubject] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSubject = async () => {
      try {
        const res = await api.get('/subjects');
        const found = res.data.find((s) => s.id === subjectId);
        setSubject(found || null);
      } catch {
      } finally {
        setLoading(false);
      }
    };
    fetchSubject();
  }, [subjectId]);

  if (loading) {
    return (
      <DashboardLayout>
        <LoadingState />
      </DashboardLayout>
    );
  }

  if (!subject) {
    return (
      <DashboardLayout>
        <EmptyState icon="🔍" message="المادة غير موجودة">
          <Link to="/admin/lessons" className="text-blue-600 hover:underline mt-2 inline-block">
            الرجوع للمواد
          </Link>
        </EmptyState>
      </DashboardLayout>
    );
  }

  const hasTracks = subject.tracks && subject.tracks.length > 0;
  const hasGrades = subject.grades && subject.grades.length > 0;

  // تجميع الصفوف حسب المرحلة
  const gradesByStage = {};
  if (hasGrades) {
    subject.grades.forEach((g) => {
      if (!gradesByStage[g.stage_name]) {
        gradesByStage[g.stage_name] = [];
      }
      gradesByStage[g.stage_name].push(g);
    });
  }

  // تجميع المسارات حسب المرحلة
  const tracksByStage = {};
  if (hasTracks) {
    subject.tracks.forEach((t) => {
      if (!tracksByStage[t.stage_name]) {
        tracksByStage[t.stage_name] = [];
      }
      tracksByStage[t.stage_name].push(t);
    });
  }

  return (
    <DashboardLayout>
      <div className="mb-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link to="/admin/lessons" className="hover:text-blue-600 transition-colors">الدروس</Link>
          <span>/</span>
          <span className="text-gray-800 font-medium">{subject.name}</span>
        </div>

        <div className="flex items-center gap-4 mb-8">
          {subject.image_url ? (
            <img
              src={`${SERVER_URL}${subject.image_url}`}
              alt={subject.name}
              className="w-16 h-16 object-cover rounded-xl border"
            />
          ) : (
            <div className="w-16 h-16 bg-gradient-to-bl from-purple-50 to-violet-100 flex items-center justify-center rounded-xl">
              <span className="text-3xl">📚</span>
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{subject.name}</h1>
            <p className="text-gray-500">اختر الصف أو المسار لإدارة الدروس</p>
          </div>
        </div>

        {!hasTracks && !hasGrades ? (
          <EmptyState icon="📋" message="لم يتم ربط هذه المادة بأي صفوف أو مسارات" />
        ) : (
          <div className="space-y-8">
            {/* كارد مشترك لجميع الصفوف/المسارات */}
            <div>
              <h2 className="text-lg font-bold text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                دروس مشتركة
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                <Card
                  className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
                  onClick={() => navigate(`/admin/lessons/${subjectId}/shared`)}
                >
                  <div className="w-full h-28 bg-gradient-to-bl from-amber-50 to-orange-100 flex items-center justify-center group-hover:from-amber-100 group-hover:to-orange-200 transition-colors">
                    <span className="text-4xl">📌</span>
                  </div>
                  <div className="p-3">
                    <h3 className="font-semibold text-gray-800 text-center text-sm">مشترك لجميع {hasTracks ? 'المسارات' : 'الصفوف'}</h3>
                    <p className="text-xs text-gray-400 text-center mt-1">دروس تظهر في جميع {hasTracks ? 'المسارات' : 'الصفوف'}</p>
                  </div>
                </Card>
              </div>
            </div>

            {/* المسارات */}
            {Object.entries(tracksByStage).map(([stageName, stageTracks]) => (
              <div key={stageName}>
                <h2 className="text-lg font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  {stageName} - المسارات
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {stageTracks.map((track) => (
                    <Card
                      key={track.track_id}
                      className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
                      onClick={() => navigate(`/admin/lessons/${subjectId}/track/${track.track_id}`)}
                    >
                      <div className="w-full h-28 bg-gradient-to-bl from-emerald-50 to-teal-100 flex items-center justify-center group-hover:from-emerald-100 group-hover:to-teal-200 transition-colors">
                        <span className="text-4xl">{track.icon || '🛤️'}</span>
                      </div>
                      <div className="p-3">
                        <h3 className="font-semibold text-gray-800 text-center text-sm">{track.track_name}</h3>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ))}

            {/* الصفوف */}
            {Object.entries(gradesByStage).map(([stageName, stageGrades]) => (
              <div key={stageName}>
                <h2 className="text-lg font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  {stageName} - الصفوف
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {stageGrades.map((grade) => (
                    <Card
                      key={grade.grade_id}
                      className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
                      onClick={() => navigate(`/admin/lessons/${subjectId}/grade/${grade.grade_id}`)}
                    >
                      <div className="w-full h-28 bg-gradient-to-bl from-blue-50 to-indigo-100 flex items-center justify-center group-hover:from-blue-100 group-hover:to-indigo-200 transition-colors">
                        <span className="text-4xl">📋</span>
                      </div>
                      <div className="p-3">
                        <h3 className="font-semibold text-gray-800 text-center text-sm">{grade.grade_name}</h3>
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
