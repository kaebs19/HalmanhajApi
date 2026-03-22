import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { SERVER_URL } from '../lib/api';
import DashboardLayout from './DashboardLayout';
import AddLessonForm from '../components/AddLessonForm';
import { Button, LoadingState, EmptyState, PageHeader, Card } from '../components/ui';

export default function LessonsSubjectsPage() {
  const [subjects, setSubjects] = useState([]);
  const [stages, setStages] = useState([]);
  const [grades, setGrades] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [filterStage, setFilterStage] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [filterTrack, setFilterTrack] = useState('');
  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      const [subjectsRes, stagesRes, gradesRes, tracksRes] = await Promise.allSettled([
        api.get('/subjects'),
        api.get('/stages'),
        api.get('/grades'),
        api.get('/tracks'),
      ]);
      if (subjectsRes.status === 'fulfilled') setSubjects(subjectsRes.value.data);
      if (stagesRes.status === 'fulfilled') setStages(stagesRes.value.data);
      if (gradesRes.status === 'fulfilled') setGrades(gradesRes.value.data);
      if (tracksRes.status === 'fulfilled') setTracks(tracksRes.value.data);

      if (tracksRes.status === 'rejected') {
        console.error('[LessonsSubjectsPage] فشل جلب المسارات:', tracksRes.reason?.message);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // الصفوف المُفلترة حسب المرحلة
  const filteredGrades = filterStage
    ? grades.filter(g => String(g.stage_id) === String(filterStage))
    : [];

  // مسارات الصف المحدد (من grade_tracks)
  const selectedGradeTracks = filterGrade
    ? (grades.find(g => String(g.id) === String(filterGrade))?.tracks || [])
    : [];

  // المواد المُفلترة — يجب اختيار مرحلة على الأقل
  const filteredSubjects = subjects.filter(s => {
    if (filterTrack) {
      // فلترة بالمسار + الصف معاً لمنع خلط مواد صفوف مختلفة
      const hasTrack = s.tracks?.some(t => String(t.track_id) === String(filterTrack));
      if (!hasTrack) return false;
      if (filterGrade) {
        return s.grades?.some(g => String(g.grade_id) === String(filterGrade));
      }
      return true;
    }
    if (filterGrade) {
      if (selectedGradeTracks.length > 0) {
        // صف ثانوي: عرض مواد كل مسارات الصف مع فلترة بالصف
        const trackIds = selectedGradeTracks.map(t => String(t.track_id));
        return s.tracks?.some(t => trackIds.includes(String(t.track_id))) &&
               s.grades?.some(g => String(g.grade_id) === String(filterGrade));
      }
      return s.grades?.some(g => String(g.grade_id) === String(filterGrade));
    }
    if (filterStage) {
      return s.grades?.some(g => String(g.stage_id) === String(filterStage)) ||
             s.tracks?.some(t => String(t.stage_id) === String(filterStage));
    }
    return false;
  });

  // تحديد نوع الرسالة التوجيهية
  const needsStageSelection = !filterStage;
  const needsGradeSelection = filterStage && !filterGrade && filteredGrades.length > 0;

  return (
    <DashboardLayout>
      <div className="mb-6">
        <PageHeader
          title="الدروس والمحتوى"
          subtitle="اختر المرحلة والصف لعرض المواد وإدارة دروسها"
          action={!showAddForm && filterStage && (
            <Button icon="+" onClick={() => setShowAddForm(true)}>إضافة درس</Button>
          )}
        />

        {showAddForm && (
          <AddLessonForm
            subjects={subjects}
            stages={stages}
            grades={grades}
            tracks={tracks}
            preSelectedStageId={filterStage}
            preSelectedGradeId={filterGrade}
            onClose={() => setShowAddForm(false)}
            onSuccess={() => {
              setShowAddForm(false);
              fetchData();
            }}
          />
        )}

        {/* شريط الفلاتر */}
        {!loading && subjects.length > 0 && (
          <div className="mb-5 space-y-3">
            {/* فلتر المراحل */}
            <div className="flex flex-wrap gap-2">
              {stages.map(s => (
                <button
                  key={s.id}
                  onClick={() => { setFilterStage(s.id); setFilterGrade(''); setFilterTrack(''); }}
                  className={`text-sm px-4 py-2 rounded-lg font-medium transition-colors border ${
                    String(filterStage) === String(s.id)
                      ? 'bg-blue-100 border-blue-300 text-blue-800'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {s.icon && <span className="ml-1">{s.icon}</span>}
                  {s.name}
                </button>
              ))}
            </div>

            {/* فلتر الصفوف (يظهر عند اختيار مرحلة) */}
            {filterStage && filteredGrades.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => { setFilterGrade(''); setFilterTrack(''); }}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors border ${
                    !filterGrade
                      ? 'bg-violet-100 border-violet-300 text-violet-800'
                      : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  كل الصفوف
                </button>
                {filteredGrades.map(g => (
                  <button
                    key={g.id}
                    onClick={() => { setFilterGrade(g.id); setFilterTrack(''); }}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors border ${
                      String(filterGrade) === String(g.id)
                        ? 'bg-violet-100 border-violet-300 text-violet-800'
                        : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            )}

            {/* فلتر المسارات (يظهر عند اختيار صف له مسارات) */}
            {filterGrade && selectedGradeTracks.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setFilterTrack('')}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors border ${
                    !filterTrack
                      ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                      : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  كل المسارات
                </button>
                {selectedGradeTracks.map(t => (
                  <button
                    key={t.track_id}
                    onClick={() => setFilterTrack(t.track_id)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors border ${
                      String(filterTrack) === String(t.track_id)
                        ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                        : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {t.track_name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {loading ? (
          <LoadingState />
        ) : subjects.length === 0 ? (
          <EmptyState icon="📖" message="لا توجد مواد دراسية بعد" subMessage="أضف مواد من صفحة المواد الدراسية أولاً" />
        ) : needsStageSelection ? (
          <EmptyState icon="📋" message="اختر المرحلة لعرض المواد" subMessage="حدد المرحلة الدراسية من الأعلى للبدء" />
        ) : needsGradeSelection ? (
          <EmptyState icon="📋" message="اختر الصف لعرض المواد" subMessage="حدد الصف الدراسي من الأعلى لتصفية المواد" />
        ) : filteredSubjects.length === 0 ? (
          <EmptyState icon="🔍" message="لا توجد مواد لهذا الفلتر" subMessage="جرّب اختيار مرحلة أو صف آخر" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredSubjects.map((subject) => (
              <Card
                key={subject.id}
                className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
                onClick={() => navigate(
                  filterTrack
                    ? `/admin/lessons/${subject.id}/track/${filterTrack}`
                    : filterGrade
                    ? `/admin/lessons/${subject.id}/grade/${filterGrade}`
                    : `/admin/lessons/${subject.id}`
                )}
              >
                {subject.image_url ? (
                  <img
                    src={`${SERVER_URL}${subject.image_url}`}
                    alt={subject.name}
                    className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-40 bg-gradient-to-bl from-purple-50 to-violet-100 flex items-center justify-center group-hover:from-purple-100 group-hover:to-violet-200 transition-colors">
                    <span className="text-5xl">{subject.icon || '📚'}</span>
                  </div>
                )}

                <div className="p-4">
                  <h3 className="font-bold text-gray-800 text-lg mb-2">{subject.name}</h3>

                  <div className="flex flex-wrap gap-1">
                    {subject.grades && subject.grades.length > 0 && subject.grades.map(g => (
                      <span key={g.grade_id} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">
                        {g.grade_name}
                      </span>
                    ))}
                    {subject.tracks && subject.tracks.length > 0 && subject.tracks.map(t => (
                      <span key={t.track_id} className="text-[10px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-full">
                        {t.track_name}
                      </span>
                    ))}
                  </div>

                  {subject.lessons_count > 0 && (
                    <span className="text-[10px] text-gray-400 mt-1 block">
                      {subject.lessons_count} درس
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
