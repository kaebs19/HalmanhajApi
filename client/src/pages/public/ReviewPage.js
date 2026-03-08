import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUserAuth } from '../../context/UserAuthContext';
import { API_BASE } from '../../lib/api';
import QuestionOptions, { formatCorrectAnswer } from '../../components/public/QuestionOptions';

export default function ReviewPage() {
  const navigate = useNavigate();
  const { token } = useUserAuth();

  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // حالات اللعب
  const [gameState, setGameState] = useState('intro'); // intro | playing | feedback | complete
  const [currentIdx, setCurrentIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState([]); // [{correct, interval}]
  const [feedbackData, setFeedbackData] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // حالات أنواع الأسئلة
  const [selectedOption, setSelectedOption] = useState(null);
  const [fillAnswer, setFillAnswer] = useState('');
  const [matchingPairs, setMatchingPairs] = useState([]);
  const [matchLeft, setMatchLeft] = useState(null);
  const [orderingItems, setOrderingItems] = useState([]);
  const [classifyGroups, setClassifyGroups] = useState({});

  // جلب الأسئلة المستحقة
  const fetchDueQuestions = useCallback(async () => {
    if (!token) {
      setError('يجب تسجيل الدخول');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/review/due`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setQuestions(data.questions || []);
    } catch {
      setError('تعذر تحميل الأسئلة');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchDueQuestions(); }, [fetchDueQuestions]);

  // إعادة ضبط حالة السؤال
  const resetQuestionState = useCallback(() => {
    setSelectedOption(null);
    setFillAnswer('');
    setMatchingPairs([]);
    setMatchLeft(null);
    setOrderingItems([]);
    setClassifyGroups({});
  }, []);

  // بدء المراجعة
  const startReview = () => {
    setGameState('playing');
    setCurrentIdx(0);
    setScore(0);
    setAnswers([]);
    resetQuestionState();
  };

  // إعادة المراجعة
  const restartReview = async () => {
    setGameState('intro');
    setCurrentIdx(0);
    setScore(0);
    setAnswers([]);
    resetQuestionState();
    await fetchDueQuestions();
  };

  // إرسال إجابة
  const submitAnswer = async (answer) => {
    if (submitting) return;
    const q = questions[currentIdx];
    if (!q) return;

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/review/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question_id: q.question_id, answer })
      });
      const data = await res.json();

      const isCorrect = data.correct;
      setAnswers(prev => [...prev, { correct: isCorrect, interval: data.new_interval_days, mastered: data.mastered }]);
      if (isCorrect) setScore(s => s + 1);

      // عرض التغذية الراجعة
      setFeedbackData({
        correct: isCorrect,
        correctAnswer: data.correct_answer,
        newInterval: data.new_interval_days,
        mastered: data.mastered,
      });
      setGameState('feedback');

      setTimeout(() => {
        if (currentIdx + 1 >= questions.length) {
          setGameState('complete');
        } else {
          setCurrentIdx(i => i + 1);
          resetQuestionState();
          setGameState('playing');
        }
        setFeedbackData(null);
      }, 2000);
    } catch {
      // خطأ صامت
    } finally {
      setSubmitting(false);
    }
  };

  // ═══ Loading / Error ═══
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-center p-6">
        <div>
          <span className="text-5xl block mb-4">😕</span>
          <h2 className="text-xl font-bold text-gray-800 mb-2">{error}</h2>
          {!token ? (
            <Link to="/auth/login" className="text-blue-600 hover:text-blue-700 font-medium">تسجيل الدخول</Link>
          ) : (
            <Link to="/my-dashboard" className="text-blue-600 hover:text-blue-700 font-medium">العودة للرئيسية</Link>
          )}
        </div>
      </div>
    );
  }

  const totalQ = questions.length;
  const currentQuestion = questions[currentIdx];

  // ═══ شاشة المقدمة ═══
  if (gameState === 'intro') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-6" dir="rtl">
        <div className="max-w-md w-full text-center">
          <Link to="/my-dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-8">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            رجوع
          </Link>

          <div className="text-6xl mb-6">🔁</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">وقت المراجعة!</h1>
          <div className="h-px bg-gray-200 w-20 mx-auto my-4" />

          {totalQ > 0 ? (
            <>
              <p className="text-gray-500 mb-6">
                {totalQ} {totalQ === 1 ? 'سؤال يحتاج' : totalQ < 11 ? 'أسئلة تحتاج' : 'سؤال يحتاج'} مراجعتك
              </p>
              <p className="text-sm text-gray-400 mb-8">تذكّر ما تعلمته وعزّز معرفتك 💪</p>
              <button
                onClick={startReview}
                className="w-full max-w-xs mx-auto bg-blue-600 text-white py-4 rounded-2xl text-lg font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/25"
              >
                🚀 ابدأ المراجعة
              </button>
            </>
          ) : (
            <>
              <p className="text-gray-500 mb-6">لا توجد أسئلة مستحقة للمراجعة حالياً</p>
              <p className="text-sm text-gray-400 mb-8">أحسنت! كل شيء محدّث ✨</p>
              <Link
                to="/my-dashboard"
                className="inline-block bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 transition"
              >
                العودة للرئيسية
              </Link>
            </>
          )}
        </div>
      </div>
    );
  }

  // ═══ شاشة النتيجة ═══
  if (gameState === 'complete') {
    const wrongCount = totalQ - score;

    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-6" dir="rtl">
        <div className="max-w-md w-full text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">انتهت المراجعة!</h1>
          <div className="h-px bg-gray-200 w-20 mx-auto my-4" />

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <span className="text-3xl font-bold text-green-600">{score}/{totalQ}</span>
                <p className="text-xs text-gray-400 mt-1">إجابة صحيحة</p>
              </div>
              <div className="text-center">
                <span className="text-3xl font-bold text-orange-500">{wrongCount}</span>
                <p className="text-xs text-gray-400 mt-1">ستعود غداً</p>
              </div>
            </div>

            {/* أسئلة مُتقنة */}
            {answers.some(a => a.mastered) && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-sm text-green-600 font-medium">
                  🌟 أتقنت {answers.filter(a => a.mastered).length} {answers.filter(a => a.mastered).length === 1 ? 'سؤال' : 'أسئلة'}!
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Link
              to="/my-dashboard"
              className="flex-1 py-3 rounded-xl text-sm font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
            >
              رجوع للرئيسية
            </Link>
            <button
              onClick={restartReview}
              className="flex-1 py-3 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              مراجعة أخرى
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══ شاشة السؤال + التغذية الراجعة ═══
  const isFeedback = gameState === 'feedback';

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      isFeedback ? (feedbackData?.correct ? 'bg-green-50' : 'bg-red-50') : 'bg-gray-50'
    }`} dir="rtl">
      {/* شريط علوي */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <button onClick={() => navigate('/my-dashboard')} className="text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className="flex-1">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${((currentIdx + (isFeedback ? 1 : 0)) / totalQ) * 100}%` }}
                />
              </div>
            </div>
            <span className="text-xs text-gray-500 font-medium">{currentIdx + 1}/{totalQ}</span>
          </div>

          {/* شارة المراجعة */}
          <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-lg font-medium mr-3">🔁 مراجعة</span>
        </div>
      </div>

      {/* محتوى السؤال */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Feedback */}
        {isFeedback && feedbackData && (
          <div className={`text-center py-4 mb-6 rounded-2xl ${feedbackData.correct ? 'bg-green-100' : 'bg-red-100'}`}>
            <span className="text-3xl block mb-2">{feedbackData.correct ? '🎉' : '😔'}</span>
            <p className={`text-lg font-bold ${feedbackData.correct ? 'text-green-700' : 'text-red-700'}`}>
              {feedbackData.correct ? 'ممتاز!' : 'إجابة خاطئة'}
            </p>
            {feedbackData.correct ? (
              <p className="text-sm text-green-600 mt-1">
                {feedbackData.mastered
                  ? '🌟 أتقنت هذا السؤال!'
                  : `📅 سترى هذا السؤال بعد ${feedbackData.newInterval} ${feedbackData.newInterval === 1 ? 'يوم' : 'أيام'}`
                }
              </p>
            ) : (
              <>
                <p className="text-sm text-red-600 mt-1">🔁 سيعود هذا السؤال غداً</p>
                {feedbackData.correctAnswer && currentQuestion && (
                  <p className="text-xs text-red-500 mt-1">
                    الإجابة الصحيحة: {formatCorrectAnswer(currentQuestion.exercise_type, feedbackData.correctAnswer, currentQuestion)}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* نص السؤال */}
        {currentQuestion && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-800 text-center leading-relaxed">
              {currentQuestion.question_text}
            </h2>
          </div>
        )}

        {/* خيارات الإجابة */}
        {!isFeedback && currentQuestion && (
          <QuestionOptions
            type={currentQuestion.exercise_type}
            question={currentQuestion}
            selectedOption={selectedOption}
            setSelectedOption={setSelectedOption}
            fillAnswer={fillAnswer}
            setFillAnswer={setFillAnswer}
            matchingPairs={matchingPairs}
            setMatchingPairs={setMatchingPairs}
            matchLeft={matchLeft}
            setMatchLeft={setMatchLeft}
            orderingItems={orderingItems}
            setOrderingItems={setOrderingItems}
            classifyGroups={classifyGroups}
            setClassifyGroups={setClassifyGroups}
            onSubmit={submitAnswer}
            submitting={submitting}
          />
        )}
      </div>
    </div>
  );
}
