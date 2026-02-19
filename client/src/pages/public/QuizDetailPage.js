import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API_BASE } from '../../lib/api';
import SEO from '../../components/public/SEO';

export default function QuizDetailPage() {
  const { id } = useParams();
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/public/quizzes/${id}`)
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(setQuiz)
      .catch(() => setQuiz(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="bg-white rounded-2xl border border-gray-100 p-8 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-gray-200 animate-pulse mx-auto" />
          <div className="h-6 bg-gray-200 animate-pulse rounded w-2/3 mx-auto" />
          <div className="h-4 bg-gray-200 animate-pulse rounded w-1/2 mx-auto" />
          <div className="flex justify-center gap-4">
            <div className="h-4 bg-gray-200 animate-pulse rounded w-16" />
            <div className="h-4 bg-gray-200 animate-pulse rounded w-16" />
          </div>
          <div className="h-10 bg-gray-200 animate-pulse rounded-xl w-32 mx-auto" />
        </div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h2 className="text-xl font-bold text-gray-600 mb-2">الاختبار غير موجود</h2>
        <Link to="/quizzes" className="text-blue-600 hover:underline text-sm">العودة للاختبارات</Link>
      </div>
    );
  }

  const questions = quiz.questions || [];
  const score = submitted
    ? questions.reduce((acc, q, i) => acc + (answers[i] === q.correct ? 1 : 0), 0)
    : 0;

  // Schema.org بيانات منظمة للاختبار
  const quizSchema = {
    '@context': 'https://schema.org',
    '@type': 'Quiz',
    name: quiz.title,
    description: quiz.description || '',
    about: quiz.subject_name || undefined,
    educationalLevel: quiz.grade_name || undefined,
    numberOfQuestions: questions.length,
    timeRequired: quiz.duration_minutes ? `PT${quiz.duration_minutes}M` : undefined,
  };

  if (!started) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <SEO title={quiz.title} description={quiz.description} structuredData={quizSchema} />
        <div className="bg-white rounded-2xl border border-gray-100 p-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">{quiz.title}</h1>
          {quiz.description && <p className="text-sm text-gray-500 mb-4">{quiz.description}</p>}
          <div className="flex items-center justify-center gap-4 text-sm text-gray-400 mb-6">
            <span>{questions.length} سؤال</span>
            <span>{quiz.duration_minutes} دقيقة</span>
            {quiz.subject_name && <span>{quiz.subject_name}</span>}
          </div>
          <button
            onClick={() => setStarted(true)}
            className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors"
          >
            ابدأ الاختبار
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <SEO title={quiz.title} description={quiz.description} />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-800">{quiz.title}</h1>
        {submitted && (
          <div className={`text-lg font-bold ${score >= questions.length * 0.7 ? 'text-green-600' : score >= questions.length * 0.5 ? 'text-amber-600' : 'text-red-600'}`}>
            {score}/{questions.length}
          </div>
        )}
      </div>

      <div className="space-y-6">
        {questions.map((q, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-6">
            <p className="text-sm font-bold text-gray-800 mb-4">
              <span className="text-blue-600 ml-2">{i + 1}.</span>
              {q.text}
            </p>
            <div className="space-y-2">
              {q.options?.map((opt, j) => {
                const isSelected = answers[i] === j;
                const isCorrect = submitted && j === q.correct;
                const isWrong = submitted && isSelected && j !== q.correct;

                return (
                  <button
                    key={j}
                    disabled={submitted}
                    onClick={() => setAnswers(prev => ({ ...prev, [i]: j }))}
                    className={`w-full text-right px-4 py-3 rounded-lg text-sm transition-all border ${
                      isCorrect
                        ? 'bg-green-50 border-green-300 text-green-700'
                        : isWrong
                          ? 'bg-red-50 border-red-300 text-red-700'
                          : isSelected
                            ? 'bg-blue-50 border-blue-300 text-blue-700'
                            : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {!submitted ? (
        <button
          onClick={() => setSubmitted(true)}
          disabled={Object.keys(answers).length < questions.length}
          className="mt-8 w-full bg-emerald-600 text-white py-3.5 rounded-xl font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          تسليم الاختبار ({Object.keys(answers).length}/{questions.length})
        </button>
      ) : (
        <div className="mt-8 text-center">
          <button
            onClick={() => { setAnswers({}); setSubmitted(false); }}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors"
          >
            إعادة الاختبار
          </button>
        </div>
      )}
    </div>
  );
}
