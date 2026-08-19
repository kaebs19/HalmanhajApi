import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API_BASE } from '../../lib/api';
import SEO from '../../components/public/SEO';
import { useUserAuth } from '../../context/UserAuthContext';

export default function QuizDetailPage() {
  const { slug } = useParams();
  const { token } = useUserAuth();
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState('info'); // info | quiz | results
  const [answers, setAnswers] = useState({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const timerRef = useRef(null);

  // جلب الاختبار
  useEffect(() => {
    fetch(`${API_BASE}/public/quizzes/${slug}`)
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(setQuiz)
      .catch(() => setQuiz(null))
      .finally(() => setLoading(false));
  }, [slug]);

  // مؤقت العد التنازلي
  useEffect(() => {
    if (phase !== 'quiz' || timeLeft <= 0) return;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // تسليم الاختبار
  const handleSubmit = useCallback(async () => {
    if (submitting || !quiz) return;
    setSubmitting(true);
    clearInterval(timerRef.current);

    const timeSpent = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/public/quizzes/${quiz.id}/submit`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ answers, time_spent: timeSpent })
      });

      if (!res.ok) throw new Error();
      const data = await res.json();
      setResults(data);
      setPhase('results');

      // جلب المتصدرين
      fetchLeaderboard();
    } catch {
      alert('حدث خطأ أثناء تسليم الاختبار');
    } finally {
      setSubmitting(false);
    }
  }, [submitting, quiz, answers, startTime, token]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchLeaderboard = async () => {
    if (!quiz) return;
    setLoadingLeaderboard(true);
    try {
      const res = await fetch(`${API_BASE}/public/quizzes/${quiz.id}/leaderboard`);
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data);
      }
    } catch {} // eslint-disable-line no-empty
    setLoadingLeaderboard(false);
  };

  // بدء الاختبار
  const handleStart = () => {
    const timeLimit = quiz.time_limit || quiz.duration_minutes || 30;
    setTimeLeft(timeLimit * 60);
    setStartTime(Date.now());
    setAnswers({});
    setCurrentIdx(0);
    setResults(null);
    setPhase('quiz');
  };

  // إعادة المحاولة
  const handleRetry = () => {
    handleStart();
  };

  // تنسيق الوقت
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatTimeSpent = (seconds) => {
    if (!seconds) return '-';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s} ثانية`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // التحقق من اكتمال إجابة السؤال
  const isQuestionAnswered = (question) => {
    const answer = answers[question.id];
    if (answer === undefined || answer === null) return false;
    if (question.type === 'matching') {
      if (!answer || typeof answer !== 'object') return false;
      const leftItems = question.left_items || [];
      return leftItems.every(left => answer[left] && answer[left] !== '');
    }
    if (question.type === 'ordering') {
      return Array.isArray(answer) && answer.length > 0;
    }
    if (question.type === 'fill_blank') {
      return typeof answer === 'string' && answer.trim() !== '';
    }
    return true;
  };

  // ═══════════════════════════════════════
  // حالة التحميل
  // ═══════════════════════════════════════
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
        {/* صفحة غير موجودة: تُستثنى من الأرشفة (كانت تُرجع 200 فتُحسب soft 404) */}
        <SEO title="الاختبار غير موجود" noIndex />
        <h2 className="text-xl font-bold text-gray-600 mb-2">الاختبار غير موجود</h2>
        <Link to="/quizzes" className="text-blue-600 hover:underline text-sm">العودة للاختبارات</Link>
      </div>
    );
  }

  const questions = quiz.questions || [];
  const totalQuestions = questions.length;
  const answeredCount = questions.filter(q => isQuestionAnswered(q)).length;

  // Schema.org
  const quizSchema = {
    '@context': 'https://schema.org',
    '@type': 'Quiz',
    name: quiz.title,
    description: quiz.description || '',
    about: quiz.subject_name || undefined,
    educationalLevel: quiz.grade_name || undefined,
    numberOfQuestions: totalQuestions,
    timeRequired: quiz.time_limit ? `PT${quiz.time_limit}M` : undefined,
  };

  // ═══════════════════════════════════════
  // المرحلة أ: معلومات الاختبار
  // ═══════════════════════════════════════
  if (phase === 'info') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 sm:py-16">
        <SEO title={quiz.title} description={quiz.description} structuredData={quizSchema} />

        <div className="bg-white rounded-2xl border border-gray-100 p-6 sm:p-8 text-center">
          {/* أيقونة */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-50 to-green-100 flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">{quiz.title}</h1>
          {quiz.description && <p className="text-sm text-gray-500 mb-5 max-w-md mx-auto">{quiz.description}</p>}

          {/* بيانات الاختبار */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 max-w-lg mx-auto">
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-lg font-bold text-gray-800">{totalQuestions}</div>
              <div className="text-xs text-gray-400">سؤال</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-lg font-bold text-gray-800">{quiz.time_limit || quiz.duration_minutes}</div>
              <div className="text-xs text-gray-400">دقيقة</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-lg font-bold text-gray-800">{quiz.passing_score || 60}%</div>
              <div className="text-xs text-gray-400">درجة النجاح</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-lg font-bold text-gray-800">
                {questions.reduce((s, q) => s + (q.points || 1), 0)}
              </div>
              <div className="text-xs text-gray-400">نقطة</div>
            </div>
          </div>

          {/* المادة والصف */}
          <div className="flex items-center justify-center gap-2 mb-6 flex-wrap">
            {quiz.subject_name && (
              <span className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg">{quiz.subject_name}</span>
            )}
            {quiz.grade_name && (
              <span className="text-xs bg-purple-50 text-purple-600 px-2.5 py-1 rounded-lg">{quiz.grade_name}</span>
            )}
            {quiz.stage_name && (
              <span className="text-xs bg-amber-50 text-amber-600 px-2.5 py-1 rounded-lg">{quiz.stage_name}</span>
            )}
          </div>

          <button
            onClick={handleStart}
            disabled={totalQuestions === 0}
            className="bg-emerald-600 text-white px-10 py-3.5 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {totalQuestions === 0 ? 'لا توجد أسئلة' : 'ابدأ الاختبار'}
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════
  // المرحلة ب: تقديم الاختبار
  // ═══════════════════════════════════════
  if (phase === 'quiz') {
    const currentQuestion = questions[currentIdx];
    const isLowTime = timeLeft <= 60;

    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <SEO title={`${quiz.title} - الاختبار`} />

        {/* شريط المؤقت والتقدم */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 sticky top-2 z-10 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-700 truncate ml-3">{quiz.title}</h2>
            <div className={`flex items-center gap-1.5 text-sm font-mono font-bold ${isLowTime ? 'text-red-600 animate-pulse' : 'text-gray-700'}`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {formatTime(timeLeft)}
            </div>
          </div>

          {/* شريط التقدم */}
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
              style={{ width: `${(answeredCount / totalQuestions) * 100}%` }}
            />
          </div>

          {/* أزرار التنقل */}
          <div className="flex flex-wrap gap-1.5">
            {questions.map((q, i) => {
              const isAnswered = isQuestionAnswered(q);
              const isCurrent = i === currentIdx;
              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentIdx(i)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                    isCurrent
                      ? 'bg-blue-600 text-white shadow-md'
                      : isAnswered
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>

        {/* السؤال الحالي */}
        {currentQuestion && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6">
            {/* رأس السؤال */}
            <div className="flex items-center gap-2 mb-4">
              <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-lg">
                {currentIdx + 1}/{totalQuestions}
              </span>
              <span className="text-xs text-gray-400">
                {currentQuestion.type === 'multiple_choice' && 'اختيار متعدد'}
                {currentQuestion.type === 'true_false' && 'صح أو خطأ'}
                {currentQuestion.type === 'fill_blank' && 'إملاء فراغ'}
                {currentQuestion.type === 'matching' && 'توصيل'}
                {currentQuestion.type === 'ordering' && 'ترتيب'}
              </span>
              {currentQuestion.points > 1 && (
                <span className="text-xs text-gray-400 mr-auto">{currentQuestion.points} نقاط</span>
              )}
            </div>

            {/* نص السؤال */}
            <p className="text-base sm:text-lg font-bold text-gray-800 mb-5 leading-relaxed">
              {currentQuestion.question_text}
            </p>

            {/* صورة السؤال */}
            {currentQuestion.question_image && (
              <img
                src={currentQuestion.question_image}
                alt="صورة السؤال"
                className="max-w-full h-auto rounded-xl mb-5 border border-gray-100"
              />
            )}

            {/* الخيارات */}
            <div className="space-y-2.5">
              {currentQuestion.type === 'fill_blank' ? (
                <div>
                  <input
                    type="text"
                    value={answers[currentQuestion.id] || ''}
                    onChange={e => setAnswers(prev => ({ ...prev, [currentQuestion.id]: e.target.value }))}
                    placeholder="اكتب الإجابة هنا..."
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-400 outline-none text-sm transition-colors"
                    dir="auto"
                  />
                </div>
              ) : currentQuestion.type === 'true_false' ? (
                <div className="grid grid-cols-2 gap-3">
                  {currentQuestion.options?.map(opt => {
                    const isSelected = answers[currentQuestion.id] === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setAnswers(prev => ({ ...prev, [currentQuestion.id]: opt.id }))}
                        className={`py-4 rounded-xl text-sm font-bold transition-all border-2 ${
                          isSelected
                            ? 'bg-blue-50 border-blue-400 text-blue-700 shadow-md'
                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 hover:border-gray-300'
                        }`}
                      >
                        {opt.option_text}
                      </button>
                    );
                  })}
                </div>
              ) : currentQuestion.type === 'matching' ? (
                <MatchingQuestion
                  question={currentQuestion}
                  answer={answers[currentQuestion.id] || {}}
                  onChange={val => setAnswers(prev => ({ ...prev, [currentQuestion.id]: val }))}
                />
              ) : currentQuestion.type === 'ordering' ? (
                <OrderingQuestion
                  question={currentQuestion}
                  answer={answers[currentQuestion.id] || currentQuestion.items || []}
                  onChange={val => setAnswers(prev => ({ ...prev, [currentQuestion.id]: val }))}
                  isFirstInteraction={!answers[currentQuestion.id]}
                />
              ) : (
                currentQuestion.options?.map(opt => {
                  const isSelected = answers[currentQuestion.id] === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setAnswers(prev => ({ ...prev, [currentQuestion.id]: opt.id }))}
                      className={`w-full text-right px-4 py-3.5 rounded-xl text-sm transition-all border-2 ${
                        isSelected
                          ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium shadow-sm'
                          : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100 hover:border-gray-300'
                      }`}
                    >
                      {opt.option_text}
                    </button>
                  );
                })
              )}
            </div>

            {/* أزرار التالي/السابق */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-50">
              <button
                onClick={() => setCurrentIdx(prev => Math.max(0, prev - 1))}
                disabled={currentIdx === 0}
                className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <svg className="w-4 h-4 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
                السابق
              </button>

              {currentIdx < totalQuestions - 1 ? (
                <button
                  onClick={() => setCurrentIdx(prev => Math.min(totalQuestions - 1, prev + 1))}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                >
                  التالي
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="bg-emerald-600 text-white px-5 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {submitting ? 'جاري التسليم...' : `تسليم الاختبار (${answeredCount}/${totalQuestions})`}
                </button>
              )}
            </div>
          </div>
        )}

        {/* زر التسليم الثابت */}
        {answeredCount === totalQuestions && currentIdx < totalQuestions - 1 && (
          <div className="mt-4">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full bg-emerald-600 text-white py-3.5 rounded-xl font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-lg shadow-emerald-500/20"
            >
              {submitting ? 'جاري التسليم...' : 'تسليم الاختبار'}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════
  // المرحلة ج: النتائج
  // ═══════════════════════════════════════
  if (phase === 'results' && results) {
    const isPassed = results.passed;
    const percentage = results.percentage;

    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <SEO title={`نتيجة: ${quiz.title}`} />

        {/* النتيجة الرئيسية */}
        <div className={`rounded-2xl p-6 sm:p-8 text-center mb-6 ${
          isPassed ? 'bg-gradient-to-b from-emerald-50 to-white border border-emerald-200' : 'bg-gradient-to-b from-red-50 to-white border border-red-200'
        }`}>
          {/* الدائرة */}
          <div className={`w-28 h-28 sm:w-32 sm:h-32 mx-auto rounded-full flex items-center justify-center mb-4 ${
            isPassed ? 'bg-emerald-100' : 'bg-red-100'
          }`}>
            <div className="text-center">
              <div className={`text-3xl sm:text-4xl font-black ${isPassed ? 'text-emerald-600' : 'text-red-600'}`}>
                {Math.round(percentage)}%
              </div>
            </div>
          </div>

          <h2 className={`text-xl sm:text-2xl font-bold mb-1 ${isPassed ? 'text-emerald-700' : 'text-red-700'}`}>
            {isPassed ? 'ناجح! أحسنت' : 'لم تنجح'}
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            {results.score} / {results.total_points} نقطة
            {' '}({results.passing_score}% درجة النجاح)
          </p>

          <div className="flex items-center justify-center gap-4">
            <button
              onClick={handleRetry}
              className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors"
            >
              إعادة المحاولة
            </button>
            <Link
              to="/quizzes"
              className="bg-gray-100 text-gray-700 px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              اختبارات أخرى
            </Link>
          </div>
        </div>

        {/* مراجعة الإجابات */}
        <div className="space-y-4 mb-8">
          <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            مراجعة الإجابات
          </h3>

          {questions.map((q, i) => {
            const correctData = results.correct_answers?.[q.id];
            if (!correctData) return null;
            const isCorrect = correctData.is_correct;

            return (
              <div key={q.id} className={`rounded-xl border-2 p-4 sm:p-5 ${
                isCorrect ? 'border-emerald-200 bg-emerald-50/50' : 'border-red-200 bg-red-50/50'
              }`}>
                <div className="flex items-start gap-2 mb-3">
                  <span className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {isCorrect ? '\u2713' : '\u2717'}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-gray-800">
                      <span className="text-gray-400 ml-1">{i + 1}.</span>
                      {q.question_text}
                    </p>
                  </div>
                </div>

                {/* مراجعة حسب النوع */}
                {q.type === 'fill_blank' ? (
                  <div className="mr-8 space-y-1.5">
                    <div className={`text-sm ${isCorrect ? 'text-emerald-700' : 'text-red-700'}`}>
                      <span className="font-medium">إجابتك: </span>
                      {correctData.user_answer || '(فارغ)'}
                    </div>
                    {!isCorrect && (
                      <div className="text-sm text-emerald-700">
                        <span className="font-medium">الإجابة الصحيحة: </span>
                        {correctData.correct_text}
                      </div>
                    )}
                  </div>
                ) : q.type === 'matching' ? (
                  <div className="mr-8 space-y-1.5">
                    {correctData.pairs?.map((pair, j) => {
                      const pairResult = correctData.pair_results?.[pair.left];
                      const pairCorrect = pairResult?.is_correct;
                      return (
                        <div key={j} className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-gray-700">{pair.left}</span>
                          <svg className="w-3 h-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                          </svg>
                          <span className={`px-2 py-0.5 rounded ${
                            pairCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700 line-through'
                          }`}>
                            {pairResult?.user || '(فارغ)'}
                          </span>
                          {!pairCorrect && (
                            <>
                              <svg className="w-3 h-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                              </svg>
                              <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">
                                {pair.right}
                              </span>
                            </>
                          )}
                        </div>
                      );
                    })}
                    {!isCorrect && (
                      <p className="text-xs text-gray-400 mt-1">
                        {correctData.correct_count}/{correctData.total_pairs} صحيح
                      </p>
                    )}
                  </div>
                ) : q.type === 'ordering' ? (
                  <div className="mr-8 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <span className={`text-xs font-medium mb-1 block ${isCorrect ? 'text-emerald-600' : 'text-red-600'}`}>
                          ترتيبك:
                        </span>
                        <div className="space-y-1">
                          {(correctData.user_order || []).map((item, j) => {
                            const correctAtPos = correctData.correct_order?.[j] === item;
                            return (
                              <div key={j} className={`text-xs px-2.5 py-1.5 rounded-lg ${
                                correctAtPos ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                              }`}>
                                {j + 1}. {item}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      {!isCorrect && (
                        <div>
                          <span className="text-xs font-medium text-emerald-600 mb-1 block">الترتيب الصحيح:</span>
                          <div className="space-y-1">
                            {(correctData.correct_order || []).map((item, j) => (
                              <div key={j} className="text-xs px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700">
                                {j + 1}. {item}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mr-8 space-y-1.5">
                    {q.options?.map(opt => {
                      const isUserAnswer = opt.id === correctData.user_answer;
                      const isCorrectOpt = opt.id === correctData.correct_option_id;
                      return (
                        <div
                          key={opt.id}
                          className={`text-sm px-3 py-2 rounded-lg ${
                            isCorrectOpt
                              ? 'bg-emerald-100 text-emerald-700 font-medium'
                              : isUserAnswer && !isCorrect
                                ? 'bg-red-100 text-red-700 line-through'
                                : 'text-gray-500'
                          }`}
                        >
                          {isCorrectOpt && '\u2713 '}
                          {isUserAnswer && !isCorrect && '\u2717 '}
                          {opt.option_text}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* الشرح */}
                {correctData.explanation && (
                  <div className="mr-8 mt-3 pt-3 border-t border-gray-200/50">
                    <p className="text-xs text-gray-600 flex items-start gap-1.5">
                      <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                      </svg>
                      {correctData.explanation}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* جدول المتصدرين */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6">
          <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.003 6.003 0 01-5.54 0" />
            </svg>
            جدول المتصدرين
          </h3>

          {loadingLeaderboard ? (
            <div className="text-center py-6">
              <div className="w-6 h-6 border-2 border-amber-200 border-t-amber-500 rounded-full animate-spin mx-auto" />
            </div>
          ) : leaderboard.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">لا توجد محاولات سابقة بعد</p>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry, i) => (
                <div
                  key={entry.id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${
                    i === 0 ? 'bg-amber-50' : i === 1 ? 'bg-gray-50' : i === 2 ? 'bg-orange-50/50' : ''
                  }`}
                >
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                    i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-gray-200 text-gray-600' : i === 2 ? 'bg-orange-100 text-orange-600' : 'text-gray-400'
                  }`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-700 truncate block">
                      {entry.user_name || 'زائر'}
                    </span>
                  </div>
                  <div className="text-left flex items-center gap-3">
                    <span className={`text-sm font-bold ${entry.passed ? 'text-emerald-600' : 'text-red-500'}`}>
                      {Math.round(entry.percentage)}%
                    </span>
                    <span className="text-xs text-gray-400">{formatTimeSpent(entry.time_spent)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}

// ═══════════════════════════════════════
// سؤال توصيل (Matching) - Dropdown
// ═══════════════════════════════════════
function MatchingQuestion({ question, answer, onChange }) {
  const leftItems = question.left_items || [];
  const rightItems = question.right_items || [];

  const handleChange = (leftItem, rightItem) => {
    onChange({ ...answer, [leftItem]: rightItem });
  };

  // حساب العناصر المستخدمة لمنع التكرار
  const usedRight = Object.values(answer).filter(Boolean);

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400 mb-2">اختر العنصر المناسب لكل مصطلح</p>
      {leftItems.map((left, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700 bg-teal-50 px-3 py-2 rounded-lg min-w-[100px] text-center">
            {left}
          </span>
          <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
          <select
            value={answer[left] || ''}
            onChange={e => handleChange(left, e.target.value)}
            className="flex-1 px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-teal-400 outline-none text-sm bg-white transition-colors"
          >
            <option value="">اختر...</option>
            {rightItems.map((right, j) => {
              const isUsedByOther = usedRight.includes(right) && answer[left] !== right;
              return (
                <option key={j} value={right} disabled={isUsedByOther}>
                  {right}
                </option>
              );
            })}
          </select>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════
// سؤال ترتيب (Ordering) - أزرار أعلى/أسفل
// ═══════════════════════════════════════
function OrderingQuestion({ question, answer, onChange, isFirstInteraction }) {
  // عند أول تفاعل، نأخذ العناصر المخلوطة من السؤال
  const items = isFirstInteraction ? (question.items || []) : (answer || []);

  const moveUp = (idx) => {
    if (idx <= 0) return;
    const newItems = [...items];
    [newItems[idx - 1], newItems[idx]] = [newItems[idx], newItems[idx - 1]];
    onChange(newItems);
  };

  const moveDown = (idx) => {
    if (idx >= items.length - 1) return;
    const newItems = [...items];
    [newItems[idx], newItems[idx + 1]] = [newItems[idx + 1], newItems[idx]];
    onChange(newItems);
  };

  // تسجيل التفاعل الأول
  const handleFirstInteraction = (idx, direction) => {
    if (isFirstInteraction) {
      // تسجيل العناصر الأولية ثم تحريك
      const initialItems = [...(question.items || [])];
      if (direction === 'up' && idx > 0) {
        [initialItems[idx - 1], initialItems[idx]] = [initialItems[idx], initialItems[idx - 1]];
      } else if (direction === 'down' && idx < initialItems.length - 1) {
        [initialItems[idx], initialItems[idx + 1]] = [initialItems[idx + 1], initialItems[idx]];
      }
      onChange(initialItems);
    } else {
      if (direction === 'up') moveUp(idx);
      else moveDown(idx);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400 mb-2">رتب العناصر بالترتيب الصحيح باستخدام الأسهم</p>
      {items.map((item, i) => (
        <div key={`${item}-${i}`} className="flex items-center gap-2 bg-orange-50/50 border border-orange-100 rounded-xl px-3 py-2.5">
          <span className="text-xs font-bold text-orange-400 w-5 text-center">{i + 1}</span>
          <span className="flex-1 text-sm text-gray-700">{item}</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleFirstInteraction(i, 'up')}
              disabled={i === 0}
              className="p-1 text-gray-400 hover:text-orange-600 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => handleFirstInteraction(i, 'down')}
              disabled={i === items.length - 1}
              className="p-1 text-gray-400 hover:text-orange-600 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
