import { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useUserAuth } from '../../context/UserAuthContext';
import { API_BASE } from '../../lib/api';

export default function ExercisesPage() {
  const { user, token } = useUserAuth();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // جلب المواد المتاحة للطالب (حسب صفه)
  useEffect(() => {
    if (!token || !user?.grade_id) {
      setLoading(false);
      return;
    }

    fetch(`${API_BASE}/exercises/student/list?grade_id=${user.grade_id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        const arr = Array.isArray(data) ? data : [];
        // استخراج مواد فريدة
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
  }, [token, user?.grade_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // إذا المستخدم غير مسجل → وجّهه لصفحة الاختبارات العامة
  if (!user) {
    return <Navigate to="/اختبارات" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-l from-indigo-600 to-blue-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">🗺️</span>
            <h1 className="text-2xl sm:text-3xl font-bold">مسارات التعلم</h1>
          </div>
          <p className="text-blue-100 text-sm sm:text-base">تابع تقدمك في كل مادة خطوة بخطوة</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* رابط التمارين العامة */}
        <Link
          to="/اختبارات"
          className="flex items-center justify-between bg-gradient-to-l from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-xl p-4 mb-6 hover:border-emerald-400 hover:shadow-sm transition-all group"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">📝</span>
            <div>
              <p className="font-bold text-gray-800 text-sm">تصفح كل التمارين</p>
              <p className="text-xs text-gray-500">تمارين تفاعلية مجانية لجميع المراحل والمواد</p>
            </div>
          </div>
          <svg className="w-5 h-5 text-emerald-400 group-hover:text-emerald-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>

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
          <div className="text-center py-20">
            <span className="text-5xl block mb-4">🗺️</span>
            <h3 className="text-lg font-bold text-gray-700 mb-2">لا توجد مسارات تعلم بعد</h3>
            <p className="text-sm text-gray-500 mb-4">ستتوفر مسارات جديدة قريباً</p>
            <Link to="/اختبارات" className="text-emerald-600 hover:underline text-sm font-medium">
              تصفح التمارين المتاحة →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {subjects.map(subject => (
              <Link
                key={subject.id}
                to={`/learn/path/${subject.id}`}
                className="group bg-white rounded-xl border-2 border-gray-100 p-6 text-center hover:shadow-lg hover:border-indigo-200 transition-all duration-300"
              >
                <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-gradient-to-br from-indigo-50 to-blue-100 flex items-center justify-center group-hover:from-indigo-100 group-hover:to-blue-200 transition-colors">
                  <span className="text-3xl">{subject.icon || '📘'}</span>
                </div>
                <h3 className="text-base font-bold text-gray-800 group-hover:text-indigo-600 transition-colors mb-1">
                  مسار {subject.name}
                </h3>
                <p className="text-xs text-gray-400">{subject.exercisesCount} تمرين</p>
                <div className="mt-3 text-xs font-bold text-indigo-500 group-hover:text-indigo-600">
                  عرض المسار →
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
