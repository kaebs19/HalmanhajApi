import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useUserAuth } from '../../context/UserAuthContext';
import { API_BASE } from '../../lib/api';

const TYPE_LABELS = {
  mcq: 'اختيار من متعدد', true_false: 'صح وخطأ', fill_blank: 'أكمل الفراغ',
  matching: 'توصيل', ordering: 'ترتيب', classify: 'تصنيف',
  speed: 'سرعة', read_answer: 'اقرأ وأجب', image_match: 'مطابقة صور'
};
const TYPE_ICONS = {
  mcq: '🔤', true_false: '✅', fill_blank: '✏️', matching: '🔗',
  ordering: '🔢', classify: '📂', speed: '⚡', read_answer: '📖', image_match: '🖼️'
};
const DIFF_LABELS = { easy: 'سهل', medium: 'متوسط', hard: 'صعب' };
const DIFF_COLORS = {
  easy: 'bg-green-100 text-green-700',
  medium: 'bg-amber-100 text-amber-700',
  hard: 'bg-red-100 text-red-700'
};

export default function ExercisesPage() {
  const { user, token } = useUserAuth();
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [navigation, setNavigation] = useState({ stages: [] });

  // فلاتر
  const [selectedStage, setSelectedStage] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('');

  // جلب بيانات التنقل (المراحل والصفوف)
  useEffect(() => {
    fetch(`${API_BASE}/public/navigation`)
      .then(r => r.json())
      .then(data => {
        setNavigation(data);
        // فلتر تلقائي حسب صف الطالب
        if (user?.grade_id && data.stages) {
          for (const stage of data.stages) {
            const grade = stage.grades?.find(g => g.id === user.grade_id);
            if (grade) {
              setSelectedStage(stage.id);
              setSelectedGrade(grade.id);
              break;
            }
          }
        }
      })
      .catch(() => {});
  }, [user]);

  // جلب التمارين
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedGrade) params.set('grade_id', selectedGrade);
    else if (selectedStage) params.set('stage_id', selectedStage);
    if (selectedSubject) params.set('subject_id', selectedSubject);
    if (selectedType) params.set('type', selectedType);
    if (selectedDifficulty) params.set('difficulty', selectedDifficulty);

    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    fetch(`${API_BASE}/exercises/student/list?${params}`, { headers })
      .then(r => r.json())
      .then(data => setExercises(Array.isArray(data) ? data : []))
      .catch(() => setExercises([]))
      .finally(() => setLoading(false));
  }, [selectedStage, selectedGrade, selectedSubject, selectedType, selectedDifficulty, token]);

  // صفوف المرحلة المختارة
  const currentStage = navigation.stages?.find(s => s.id === selectedStage);
  const stageGrades = currentStage?.grades || [];

  // مواد فريدة من التمارين المحملة (للفلتر)
  const uniqueSubjects = [];
  const subjectIds = new Set();
  exercises.forEach(e => {
    if (e.subject_id && !subjectIds.has(e.subject_id)) {
      subjectIds.add(e.subject_id);
      uniqueSubjects.push({ id: e.subject_id, name: e.subject_name, icon: e.subject_icon });
    }
  });

  const getProgress = (ex) => {
    if (!user || !ex.solved_count) return 0;
    const total = parseInt(ex.questions_count) || 1;
    return Math.round((parseInt(ex.solved_count) / total) * 100);
  };

  const getStatus = (ex) => {
    if (!user) return 'new';
    const attempted = parseInt(ex.attempted_count) || 0;
    const solved = parseInt(ex.solved_count) || 0;
    const total = parseInt(ex.questions_count) || 1;
    if (attempted === 0) return 'new';
    if (solved >= total) return 'completed';
    return 'in_progress';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-l from-blue-600 to-indigo-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">🧩</span>
            <h1 className="text-2xl sm:text-3xl font-bold">التمارين التفاعلية</h1>
          </div>
          <p className="text-blue-100 text-sm sm:text-base">تدرّب على المنهج واكسب نقاط XP</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* فلاتر */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
          {/* المراحل */}
          <div className="flex flex-wrap gap-2 mb-3">
            <button
              onClick={() => { setSelectedStage(''); setSelectedGrade(''); setSelectedSubject(''); }}
              className={`text-sm px-4 py-2 rounded-lg font-medium transition-colors ${
                !selectedStage ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              الكل
            </button>
            {navigation.stages?.map(stage => (
              <button
                key={stage.id}
                onClick={() => { setSelectedStage(stage.id); setSelectedGrade(''); setSelectedSubject(''); }}
                className={`text-sm px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedStage === stage.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {stage.icon && <span className="ml-1">{stage.icon}</span>}
                {stage.name}
              </button>
            ))}
          </div>

          {/* الصفوف */}
          {selectedStage && stageGrades.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              <button
                onClick={() => { setSelectedGrade(''); setSelectedSubject(''); }}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  !selectedGrade ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                كل الصفوف
              </button>
              {stageGrades.map(grade => (
                <button
                  key={grade.id}
                  onClick={() => { setSelectedGrade(grade.id); setSelectedSubject(''); }}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    selectedGrade === grade.id ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {grade.name}
                </button>
              ))}
            </div>
          )}

          {/* فلاتر إضافية */}
          <div className="flex flex-wrap gap-2">
            {uniqueSubjects.length > 0 && (
              <select
                value={selectedSubject}
                onChange={e => setSelectedSubject(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="">كل المواد</option>
                {uniqueSubjects.map(s => (
                  <option key={s.id} value={s.id}>{s.icon} {s.name}</option>
                ))}
              </select>
            )}
            <select
              value={selectedType}
              onChange={e => setSelectedType(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              <option value="">كل الأنواع</option>
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{TYPE_ICONS[k]} {v}</option>
              ))}
            </select>
            <select
              value={selectedDifficulty}
              onChange={e => setSelectedDifficulty(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              <option value="">كل المستويات</option>
              {Object.entries(DIFF_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        {/* نتائج */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gray-200 rounded-xl" />
                  <div className="flex-1"><div className="h-4 bg-gray-200 rounded w-3/4" /></div>
                  <div className="w-14 h-5 bg-gray-200 rounded-full" />
                </div>
                <div className="h-3 bg-gray-200 rounded w-1/2 mb-3" />
                <div className="h-2 bg-gray-200 rounded w-full mb-4" />
                <div className="h-9 bg-gray-200 rounded-lg" />
              </div>
            ))}
          </div>
        ) : exercises.length === 0 ? (
          <div className="text-center py-20">
            <span className="text-5xl block mb-4">🧩</span>
            <h3 className="text-lg font-bold text-gray-700 mb-2">لا توجد تمارين</h3>
            <p className="text-sm text-gray-500">جرّب تغيير الفلاتر أو اختيار مرحلة أخرى</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-4">{exercises.length} تمرين</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {exercises.map(ex => {
                const status = getStatus(ex);
                const progress = getProgress(ex);
                const questionsCount = parseInt(ex.questions_count) || 0;

                return (
                  <div
                    key={ex.id}
                    className={`bg-white rounded-xl border-2 transition-all hover:shadow-md ${
                      status === 'completed' ? 'border-green-300 bg-green-50/30' :
                      status === 'in_progress' ? 'border-blue-300' : 'border-gray-200'
                    }`}
                  >
                    <div className="p-5">
                      {/* Header: icon + title + difficulty */}
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-lg flex-shrink-0">
                          {ex.subject_icon || TYPE_ICONS[ex.type] || '🧩'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-gray-800 text-sm leading-tight truncate">{ex.title}</h3>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {ex.subject_name && <span>{ex.subject_name}</span>}
                            {ex.grade_name && <span className="text-gray-400"> • {ex.grade_name}</span>}
                          </p>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${DIFF_COLORS[ex.difficulty] || DIFF_COLORS.medium}`}>
                          {DIFF_LABELS[ex.difficulty] || 'متوسط'}
                        </span>
                      </div>

                      {/* Meta */}
                      <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                        <span>{TYPE_ICONS[ex.type]} {TYPE_LABELS[ex.type]}</span>
                        <span className="text-gray-300">|</span>
                        <span>{questionsCount} سؤال</span>
                        <span className="text-gray-300">|</span>
                        <span className="text-amber-600 font-medium">{ex.xp_reward} XP</span>
                      </div>

                      {/* Progress bar (if logged in) */}
                      {user && status !== 'new' && (
                        <div className="mb-3">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className={status === 'completed' ? 'text-green-600 font-medium' : 'text-blue-600'}>
                              {status === 'completed' ? '✅ مكتمل' : `${progress}%`}
                            </span>
                            <span className="text-gray-400">{ex.solved_count || 0}/{questionsCount}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full transition-all ${status === 'completed' ? 'bg-green-500' : 'bg-blue-500'}`}
                              style={{ width: `${Math.min(progress, 100)}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* CTA */}
                      {user ? (
                        <Link
                          to={`/exercises/${ex.id}/play`}
                          className={`block w-full text-center py-2.5 rounded-xl text-sm font-bold transition-colors ${
                            status === 'completed'
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : status === 'in_progress'
                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                        >
                          {status === 'completed' ? 'أعد المحاولة' : status === 'in_progress' ? 'أكمل' : '🚀 ابدأ'}
                        </Link>
                      ) : (
                        <Link
                          to="/auth/login"
                          className="block w-full text-center py-2.5 rounded-xl text-sm font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                        >
                          سجّل دخولك للبدء
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
