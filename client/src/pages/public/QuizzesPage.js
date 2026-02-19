import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE } from '../../lib/api';
import SEO from '../../components/public/SEO';
import { useSemester } from '../../context/SemesterContext';
import { SkeletonQuizCard } from '../../components/ui/Skeleton';

export default function QuizzesPage() {
  const { selectedSemester } = useSemester();
  const [quizzes, setQuizzes] = useState([]);
  const [stages, setStages] = useState([]);
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);

  // فلاتر
  const [filterStage, setFilterStage] = useState('');
  const [filterGrade, setFilterGrade] = useState('');

  // جلب البيانات
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedSemester && selectedSemester !== '0') params.set('semester', selectedSemester);

        const [quizzesRes, navRes] = await Promise.all([
          fetch(`${API_BASE}/public/quizzes?${params}`).then(r => r.json()),
          fetch(`${API_BASE}/public/navigation`).then(r => r.json()),
        ]);

        setQuizzes(quizzesRes);

        // استخراج المراحل والصفوف من بيانات التنقل
        if (navRes.stages) {
          setStages(navRes.stages);
          const allGrades = [];
          navRes.stages.forEach(s => {
            (s.grades || []).forEach(g => {
              allGrades.push({ ...g, stage_id: s.id });
            });
          });
          setGrades(allGrades);
        }
      } catch {}
      setLoading(false);
    };
    fetchData();
  }, [selectedSemester]);

  // فلترة محلية
  const filteredQuizzes = quizzes.filter(q => {
    if (filterStage && q.stage_id !== filterStage) return false;
    if (filterGrade && q.grade_id !== filterGrade) return false;
    return true;
  });

  const filteredGrades = filterStage ? grades.filter(g => g.stage_id === filterStage) : grades;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <SEO title="الاختبارات" description="اختبارات تفاعلية في جميع المواد الدراسية" />

      {/* الهيدر */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">الاختبارات</h1>
          <p className="text-sm text-gray-400 mt-0.5">{filteredQuizzes.length} اختبار متاح</p>
        </div>

        {/* الفلاتر */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={filterStage}
            onChange={e => { setFilterStage(e.target.value); setFilterGrade(''); }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:border-blue-400 outline-none"
          >
            <option value="">كل المراحل</option>
            {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          {filteredGrades.length > 0 && (
            <select
              value={filterGrade}
              onChange={e => setFilterGrade(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:border-blue-400 outline-none"
            >
              <option value="">كل الصفوف</option>
              {filteredGrades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          )}

          {(filterStage || filterGrade) && (
            <button
              onClick={() => { setFilterStage(''); setFilterGrade(''); }}
              className="text-xs text-red-500 hover:text-red-700 px-2 py-1"
            >
              مسح الفلاتر
            </button>
          )}
        </div>
      </div>

      {/* القائمة */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonQuizCard key={i} />)}
        </div>
      ) : filteredQuizzes.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredQuizzes.map(quiz => (
            <Link
              key={quiz.id}
              to={`/quizzes/${quiz.slug || quiz.id}`}
              className="group bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg hover:border-emerald-100 transition-all"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-50 to-green-100 flex items-center justify-center shrink-0">
                  {quiz.subject_icon ? (
                    <span className="text-lg">{quiz.subject_icon}</span>
                  ) : (
                    <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-gray-800 group-hover:text-emerald-600 transition-colors line-clamp-2">
                    {quiz.title}
                  </h3>
                  {quiz.description && (
                    <p className="text-xs text-gray-400 mt-1 line-clamp-1">{quiz.description}</p>
                  )}
                </div>
              </div>

              {/* التصنيفات */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {quiz.subject_name && (
                  <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">{quiz.subject_name}</span>
                )}
                {quiz.grade_name && (
                  <span className="text-[10px] bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full font-medium">{quiz.grade_name}</span>
                )}
              </div>

              {/* المعلومات */}
              <div className="flex items-center gap-3 text-xs text-gray-400 pt-3 border-t border-gray-50">
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {quiz.questions_count} سؤال
                </span>
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {quiz.time_limit || quiz.duration_minutes} د
                </span>
                {Number(quiz.attempts_count) > 0 && (
                  <span className="flex items-center gap-1 mr-auto">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                    </svg>
                    {quiz.attempts_count}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-gray-400">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-sm">لا توجد اختبارات متاحة حالياً</p>
          {(filterStage || filterGrade) && (
            <button onClick={() => { setFilterStage(''); setFilterGrade(''); }} className="text-sm text-blue-600 mt-2 hover:underline">
              مسح الفلاتر
            </button>
          )}
        </div>
      )}
    </div>
  );
}
