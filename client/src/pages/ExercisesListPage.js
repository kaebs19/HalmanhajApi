import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import DashboardLayout from './DashboardLayout';
import { useToast } from '../components/ui/Toast';
import QuickAddExerciseModal from '../components/QuickAddExerciseModal';
import QuickImportModal from '../components/QuickImportModal';
import {
  EXERCISE_TYPES, TYPE_LABEL, TYPE_ICON, TYPE_COLORS,
  DIFFICULTY_OPTIONS, DIFF_LABEL, DIFF_COLORS,
} from '../components/ExerciseQuestionForm';

const selectClass = 'text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none';

export default function ExercisesListPage() {
  const { toast } = useToast();
  const navigate = useNavigate();

  // بيانات التصنيف
  const [stages, setStages] = useState([]);
  const [grades, setGrades] = useState([]);
  const [subjects, setSubjects] = useState([]);

  // الفلاتر
  const [filterStage, setFilterStage] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('');
  const [filterPublished, setFilterPublished] = useState('');

  // البيانات
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showQuickImport, setShowQuickImport] = useState(false);

  // جلب بيانات التصنيف
  useEffect(() => {
    const fetchMeta = async () => {
      const [stagesRes, gradesRes, subjectsRes] = await Promise.allSettled([
        api.get('/stages'),
        api.get('/grades'),
        api.get('/subjects'),
      ]);
      if (stagesRes.status === 'fulfilled') setStages(stagesRes.value.data);
      if (gradesRes.status === 'fulfilled') setGrades(gradesRes.value.data);
      if (subjectsRes.status === 'fulfilled') setSubjects(subjectsRes.value.data);
    };
    fetchMeta();
  }, []);

  // جلب التمارين مع الفلاتر
  const fetchExercises = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStage) params.append('stage_id', filterStage);
      if (filterGrade) params.append('grade_id', filterGrade);
      if (filterSubject) params.append('subject_id', filterSubject);
      if (filterType) params.append('type', filterType);
      if (filterDifficulty) params.append('difficulty', filterDifficulty);
      if (filterPublished) params.append('is_published', filterPublished);
      const res = await api.get(`/exercises?${params.toString()}`);
      setExercises(res.data);
    } catch {
      toast.error('خطأ في تحميل التمارين');
    } finally {
      setLoading(false);
    }
  }, [filterStage, filterGrade, filterSubject, filterType, filterDifficulty, filterPublished, toast]);

  useEffect(() => {
    fetchExercises();
  }, [fetchExercises]);

  // فلاتر متتالية
  const filteredGrades = filterStage
    ? grades.filter(g => String(g.stage_id) === String(filterStage))
    : [];

  const filteredSubjects = filterGrade
    ? subjects.filter(s => s.grades?.some(g => String(g.grade_id) === String(filterGrade)))
    : filterStage
      ? subjects.filter(s =>
          s.grades?.some(g => String(g.stage_id) === String(filterStage)) ||
          s.tracks?.some(t => String(t.stage_id) === String(filterStage))
        )
      : subjects;

  // أحداث الفلاتر
  const handleStageChange = (id) => {
    setFilterStage(prev => prev === id ? '' : id);
    setFilterGrade('');
    setFilterSubject('');
  };

  const handleGradeChange = (id) => {
    setFilterGrade(prev => prev === id ? '' : id);
    setFilterSubject('');
  };

  // الأحداث
  const handleDelete = async (id) => {
    if (!window.confirm('هل تريد حذف هذا التمرين؟')) return;
    try {
      await api.delete(`/exercises/${id}`);
      setExercises(prev => prev.filter(e => e.id !== id));
      toast.success('تم حذف التمرين');
    } catch {
      toast.error('خطأ في الحذف');
    }
  };

  const handleTogglePublish = async (id) => {
    try {
      const res = await api.patch(`/exercises/${id}/publish`);
      setExercises(prev => prev.map(e =>
        e.id === id ? { ...e, is_published: res.data.is_published } : e
      ));
      toast.success(res.data.is_published ? 'تم النشر' : 'تم إلغاء النشر');
    } catch {
      toast.error('خطأ في تغيير حالة النشر');
    }
  };

  const handleDuplicate = async (id) => {
    try {
      const res = await api.post(`/exercises/${id}/duplicate`);
      setExercises(prev => [res.data, ...prev]);
      toast.success('تم نسخ التمرين');
    } catch {
      toast.error('خطأ في نسخ التمرين');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">إدارة التمارين</h1>
            <p className="text-sm text-gray-500 mt-0.5">{exercises.length} تمرين</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowQuickAdd(true)}
              className="bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              إضافة سريعة
            </button>
            <button
              onClick={() => setShowQuickImport(true)}
              className="bg-white border border-emerald-300 text-emerald-700 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-50 transition-all duration-200 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              استيراد سريع
            </button>
            <button
              onClick={() => navigate('/admin/exercises/create')}
              className="bg-gradient-to-l from-blue-600 to-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              إضافة تمرين
            </button>
          </div>
        </div>

        {/* فلاتر المراحل */}
        {stages.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {stages.map(stage => (
              <button
                key={stage.id}
                onClick={() => handleStageChange(stage.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                  filterStage === stage.id
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300 hover:text-blue-600'
                }`}
              >
                {stage.icon || stage.emoji || ''} {stage.name}
              </button>
            ))}
          </div>
        )}

        {/* فلاتر الصفوف */}
        {filterStage && filteredGrades.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {filteredGrades.map(grade => (
              <button
                key={grade.id}
                onClick={() => handleGradeChange(grade.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                  filterGrade === grade.id
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'bg-white text-gray-500 border border-gray-200 hover:border-violet-300 hover:text-violet-600'
                }`}
              >
                {grade.name}
              </button>
            ))}
          </div>
        )}

        {/* فلاتر إضافية */}
        <div className="flex flex-wrap gap-3">
          {filteredSubjects.length > 0 && (
            <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)} className={selectClass}>
              <option value="">كل المواد</option>
              {filteredSubjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className={selectClass}>
            <option value="">كل الأنواع</option>
            {EXERCISE_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
            ))}
          </select>
          <select value={filterDifficulty} onChange={e => setFilterDifficulty(e.target.value)} className={selectClass}>
            <option value="">كل المستويات</option>
            {DIFFICULTY_OPTIONS.map(d => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
          <select value={filterPublished} onChange={e => setFilterPublished(e.target.value)} className={selectClass}>
            <option value="">الكل</option>
            <option value="true">منشور</option>
            <option value="false">مسودة</option>
          </select>
        </div>

        {/* القائمة */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : exercises.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <svg className="w-16 h-16 text-gray-200 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-gray-400 text-sm mb-3">لا توجد تمارين</p>
            <button onClick={() => navigate('/admin/exercises/create')} className="text-sm text-blue-600 hover:underline font-medium">
              إنشاء أول تمرين
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {exercises.map(exercise => (
              <div key={exercise.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between hover:border-gray-200 hover:shadow-sm transition-all duration-200">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${TYPE_COLORS[exercise.type] || 'bg-gray-50 text-gray-600'}`}>
                      {TYPE_ICON[exercise.type]} {TYPE_LABEL[exercise.type]}
                    </span>
                    {exercise.difficulty && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${DIFF_COLORS[exercise.difficulty] || ''}`}>
                        {DIFF_LABEL[exercise.difficulty]}
                      </span>
                    )}
                    <h3 className="text-sm font-bold text-gray-800 truncate">{exercise.title}</h3>
                    {!exercise.is_published && (
                      <span className="text-[10px] bg-yellow-50 text-yellow-600 px-1.5 py-0.5 rounded font-medium">مسودة</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
                    {exercise.stage_name && <span>{exercise.stage_name}</span>}
                    {exercise.grade_name && <span>{exercise.grade_name}</span>}
                    {exercise.subject_name && (
                      <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded text-[10px] font-medium">
                        {exercise.subject_name}
                      </span>
                    )}
                    {exercise.lesson_title && <span>الدرس: {exercise.lesson_title}</span>}
                    <span>{exercise.questions_count} سؤال</span>
                    <span>{exercise.xp_reward} XP</span>
                    {parseInt(exercise.solved_count) > 0 && (
                      <span className="text-emerald-500">{exercise.solved_count} طالب حلّها</span>
                    )}
                    {parseInt(exercise.avg_accuracy) > 0 && (
                      <span className="text-blue-500">{exercise.avg_accuracy}% دقة</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 mr-4">
                  <button
                    onClick={() => handleTogglePublish(exercise.id)}
                    className={`p-2 rounded-lg transition-colors ${exercise.is_published ? 'text-emerald-500 hover:bg-emerald-50' : 'text-gray-400 hover:bg-gray-50'}`}
                    title={exercise.is_published ? 'إلغاء النشر' : 'نشر'}
                  >
                    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      {exercise.is_published ? (
                        <>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </>
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      )}
                    </svg>
                  </button>
                  <Link
                    to={`/admin/exercises/${exercise.id}/edit`}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="تعديل"
                  >
                    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </Link>
                  <button
                    onClick={() => handleDuplicate(exercise.id)}
                    className="p-2 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                    title="نسخ"
                  >
                    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(exercise.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="حذف"
                  >
                    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showQuickAdd && (
        <QuickAddExerciseModal onClose={() => setShowQuickAdd(false)} />
      )}

      {showQuickImport && (
        <QuickImportModal
          onClose={() => setShowQuickImport(false)}
          onImported={fetchExercises}
        />
      )}
    </DashboardLayout>
  );
}
