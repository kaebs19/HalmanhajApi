import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE } from '../../lib/api';
import SEO from '../../components/public/SEO';

export default function QuizzesPage() {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/public/quizzes`)
      .then(res => res.json())
      .then(setQuizzes)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <SEO title="الاختبارات" />
      <h1 className="text-2xl font-bold text-gray-800 mb-6">الاختبارات</h1>

      {quizzes.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {quizzes.map(quiz => (
            <Link
              key={quiz.id}
              to={`/quizzes/${quiz.id}`}
              className="group bg-white rounded-xl border border-gray-100 p-6 hover:shadow-lg hover:border-blue-100 transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-gray-800 group-hover:text-blue-600 transition-colors mb-2">
                {quiz.title}
              </h3>
              {quiz.description && (
                <p className="text-xs text-gray-400 mb-3 line-clamp-2">{quiz.description}</p>
              )}
              <div className="flex items-center gap-3 text-xs text-gray-400">
                {quiz.subject_name && <span>{quiz.subject_name}</span>}
                <span>{quiz.questions_count} سؤال</span>
                <span>{quiz.duration_minutes} دقيقة</span>
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
        </div>
      )}
    </div>
  );
}
