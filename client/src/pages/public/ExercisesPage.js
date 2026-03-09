import { useState, useEffect, useCallback } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useUserAuth } from '../../context/UserAuthContext';
import { API_BASE } from '../../lib/api';
import AdUnit from '../../components/public/AdUnit';

export default function ExercisesPage() {
  const { user, token, updateUser } = useUserAuth();

  // بيانات المواد
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // اختيار الصف (للمستخدم بدون صف أو لتغيير الصف)
  const [stages, setStages] = useState([]);
  const [grades, setGrades] = useState([]);
  const [selectedStage, setSelectedStage] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [savingGrade, setSavingGrade] = useState(false);
  const [showGradeChanger, setShowGradeChanger] = useState(false);

  // جلب المواد حسب الصف
  const fetchSubjects = useCallback((gradeId) => {
    if (!token || !gradeId) {
      setSubjects([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`${API_BASE}/exercises/student/list?grade_id=${gradeId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        const arr = Array.isArray(data) ? data : [];
        const subjectMap = new Map();
        arr.forEach(ex => {
          if (ex.subject_id && !subjectMap.has(ex.subject_id)) {
            subjectMap.set(ex.subject_id, {
              id: ex.subject_id,
              name: ex.subject_name,
              icon: ex.subject_icon,
              exercisesCount: 0,
            });
          }
          if (ex.subject_id) {
            subjectMap.get(ex.subject_id).exercisesCount++;
          }
        });
        setSubjects(Array.from(subjectMap.values()));
      })
      .catch(() => setSubjects([]))
      .finally(() => setLoading(false));
  }, [token]);

  // جلب المواد عند التحميل
  useEffect(() => {
    if (user?.grade_id) {
      fetchSubjects(user.grade_id);
    } else {
      setLoading(false);
    }
  }, [user?.grade_id, fetchSubjects]);

  // جلب المراحل (لشاشة اختيار الصف)
  useEffect(() => {
    if (!user || user.grade_id) return;
    fetch(`${API_BASE}/public/browse/stages`)
      .then(r => r.json())
      .then(data => setStages(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [user]);

  // جلب الصفوف عند اختيار مرحلة
  useEffect(() => {
    if (!selectedStage) {
      setGrades([]);
      setSelectedGrade('');
      return;
    }
    const stage = stages.find(s => s.id === selectedStage);
    if (!stage) return;
    fetch(`${API_BASE}/public/browse/grades?stage_slug=${stage.slug}`)
      .then(r => r.json())
      .then(data => {
        setGrades(Array.isArray(data.grades) ? data.grades : []);
        setSelectedGrade('');
      })
      .catch(() => setGrades([]));
  }, [selectedStage, stages]);

  // حفظ الصف
  const saveGrade = async (stageId, gradeId) => {
    if (!gradeId) return;
    setSavingGrade(true);
    try {
      const res = await fetch(`${API_BASE}/user/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ stage_id: stageId, grade_id: gradeId })
      });
      if (res.ok) {
        const updated = await res.json();
        updateUser({ stage_id: updated.stage_id, grade_id: updated.grade_id });
        setShowGradeChanger(false);
        setSelectedStage('');
        setSelectedGrade('');
      }
    } catch (err) {
      console.error('Error saving grade:', err);
    } finally {
      setSavingGrade(false);
    }
  };

  // جلب المراحل لتغيير الصف
  const openGradeChanger = () => {
    setShowGradeChanger(true);
    if (stages.length === 0) {
      fetch(`${API_BASE}/public/browse/stages`)
        .then(r => r.json())
        .then(data => setStages(Array.isArray(data) ? data : []))
        .catch(() => {});
    }
  };

  // غير مسجل → اختبارات عامة
  if (!user) {
    return <Navigate to="/اختبارات" replace />;
  }

  // مسجل بدون صف → شاشة اختيار الصف
  if (!user.grade_id) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-gradient-to-l from-indigo-600 to-blue-700 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
            <h1 className="text-2xl sm:text-3xl font-bold">تمارين & تحديات</h1>
            <p className="text-blue-100 text-sm sm:text-base mt-1">اختر صفك الدراسي لتبدأ</p>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
          <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm text-center">
            <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-indigo-100 to-blue-200 flex items-center justify-center">
              <svg className="w-10 h-10 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">مرحباً {user.name}!</h2>
            <p className="text-sm text-gray-500 mb-8">اختر مرحلتك وصفك الدراسي لنعرض لك التمارين المناسبة</p>

            {/* المراحل */}
            {!selectedStage ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {stages.map(stage => (
                  <button
                    key={stage.id}
                    onClick={() => setSelectedStage(stage.id)}
                    className="flex items-center gap-3 p-4 border-2 border-gray-100 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/50 transition-all text-right group"
                  >
                    <span className="text-2xl">{stage.icon || '🎓'}</span>
                    <div>
                      <p className="font-bold text-gray-800 group-hover:text-indigo-600 transition-colors">{stage.name}</p>
                      <p className="text-xs text-gray-400">{stage.grades_count} صف</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div>
                {/* زر رجوع */}
                <button
                  onClick={() => { setSelectedStage(''); setGrades([]); setSelectedGrade(''); }}
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  رجوع للمراحل
                </button>

                <p className="text-sm font-medium text-gray-600 mb-3">اختر الصف:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {grades.map(grade => (
                    <button
                      key={grade.id}
                      onClick={() => saveGrade(selectedStage, grade.id)}
                      disabled={savingGrade}
                      className="p-4 border-2 border-gray-100 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/50 transition-all font-bold text-gray-800 hover:text-indigo-600 disabled:opacity-50"
                    >
                      {grade.name}
                    </button>
                  ))}
                </div>
                {grades.length === 0 && (
                  <p className="text-sm text-gray-400 py-4">جاري تحميل الصفوف...</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // مسجل مع grade_id → الصفحة الرئيسية
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-l from-indigo-600 to-blue-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-1">تمارين & تحديات</h1>
              <p className="text-blue-100 text-sm sm:text-base">
                مرحباً {user.name}! اختبر معلوماتك وتحدَّ نفسك
              </p>
            </div>
            {/* زر تغيير الصف */}
            <button
              onClick={openGradeChanger}
              className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm rounded-xl px-3 py-2 text-sm font-medium transition-colors mt-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              تغيير الصف
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Modal تغيير الصف */}
        {showGradeChanger && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowGradeChanger(false)}>
            <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-gray-800">تغيير الصف الدراسي</h3>
                <button onClick={() => setShowGradeChanger(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {!selectedStage ? (
                <div className="space-y-2">
                  <p className="text-sm text-gray-500 mb-3">اختر المرحلة:</p>
                  {stages.map(stage => (
                    <button
                      key={stage.id}
                      onClick={() => setSelectedStage(stage.id)}
                      className="w-full flex items-center gap-3 p-3 border border-gray-100 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/50 transition-all text-right"
                    >
                      <span className="text-xl">{stage.icon || '🎓'}</span>
                      <span className="font-medium text-gray-700">{stage.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div>
                  <button
                    onClick={() => { setSelectedStage(''); setGrades([]); }}
                    className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    رجوع
                  </button>
                  <p className="text-sm text-gray-500 mb-3">اختر الصف:</p>
                  <div className="space-y-2">
                    {grades.map(grade => (
                      <button
                        key={grade.id}
                        onClick={() => saveGrade(selectedStage, grade.id)}
                        disabled={savingGrade}
                        className="w-full p-3 border border-gray-100 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/50 transition-all font-medium text-gray-700 text-right disabled:opacity-50"
                      >
                        {grade.name}
                      </button>
                    ))}
                    {grades.length === 0 && (
                      <p className="text-sm text-gray-400 text-center py-3">جاري التحميل...</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <AdUnit position="exercises_after_header" className="mb-6" />

        {/* بانر التحدي اليومي */}
        <Link
          to="/learn/daily-challenge"
          className="block bg-gradient-to-l from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-5 mb-6 hover:border-amber-400 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-200/50">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-gray-800 text-base">التحدي اليومي</p>
                <p className="text-xs text-gray-500">أجب على أسئلة جديدة كل يوم واكسب نقاط</p>
              </div>
            </div>
            <svg className="w-5 h-5 text-amber-400 group-hover:text-amber-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </div>
        </Link>

        {/* المواد المتاحة */}
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">المواد المتاحة</h2>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-xl border border-gray-100 p-6 animate-pulse">
                  <div className="w-14 h-14 bg-gray-200 rounded-xl mx-auto mb-3" />
                  <div className="h-5 bg-gray-200 rounded w-3/4 mx-auto mb-2" />
                  <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto" />
                </div>
              ))}
            </div>
          ) : subjects.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-gray-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-gray-700 mb-2">لا توجد تمارين لهذا الصف بعد</h3>
              <p className="text-sm text-gray-500 mb-4">جرب تغيير الصف أو تصفح الاختبارات العامة</p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={openGradeChanger}
                  className="text-indigo-600 hover:text-indigo-700 text-sm font-medium hover:underline"
                >
                  تغيير الصف
                </button>
                <span className="text-gray-300">|</span>
                <Link to="/اختبارات" className="text-emerald-600 hover:text-emerald-700 text-sm font-medium hover:underline">
                  تصفح الاختبارات
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {subjects.map(subject => (
                <Link
                  key={subject.id}
                  to={`/learn/path/${subject.id}`}
                  className="group bg-white rounded-xl border-2 border-gray-100 p-6 hover:shadow-lg hover:border-indigo-200 transition-all duration-300"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-50 to-blue-100 flex items-center justify-center group-hover:from-indigo-100 group-hover:to-blue-200 transition-colors flex-shrink-0">
                      <span className="text-2xl">{subject.icon || '📘'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold text-gray-800 group-hover:text-indigo-600 transition-colors truncate">
                        {subject.name}
                      </h3>
                      <p className="text-xs text-gray-400 mt-0.5">{subject.exercisesCount} تمرين</p>
                    </div>
                    <svg className="w-5 h-5 text-gray-300 group-hover:text-indigo-400 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <div className="h-2 flex-1 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-l from-indigo-500 to-blue-500 rounded-full" style={{ width: '0%' }} />
                    </div>
                    <span className="text-xs text-indigo-500 font-bold mr-2 group-hover:text-indigo-600">ابدأ</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <AdUnit position="exercises_between_cards" className="mb-6" />

        {/* بانر المراجعة */}
        <Link
          to="/learn/review"
          className="block bg-gradient-to-l from-purple-50 to-violet-50 border-2 border-purple-200 rounded-2xl p-5 mb-6 hover:border-purple-400 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-400 to-violet-500 flex items-center justify-center shadow-lg shadow-purple-200/50">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-gray-800 text-base">مراجعة التمارين</p>
                <p className="text-xs text-gray-500">راجع ما تعلمته وعزز فهمك</p>
              </div>
            </div>
            <svg className="w-5 h-5 text-purple-400 group-hover:text-purple-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </div>
        </Link>

        {/* رابط الاختبارات العامة */}
        <Link
          to="/اختبارات"
          className="flex items-center justify-between bg-gradient-to-l from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-xl p-4 hover:border-emerald-400 hover:shadow-sm transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-gray-800 text-sm">تصفح كل الاختبارات</p>
              <p className="text-xs text-gray-500">اختبارات مجانية لجميع المراحل والمواد</p>
            </div>
          </div>
          <svg className="w-5 h-5 text-emerald-400 group-hover:text-emerald-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
