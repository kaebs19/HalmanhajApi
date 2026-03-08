import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUserAuth } from '../../context/UserAuthContext';
import { API_BASE } from '../../lib/api';
import QuestionOptions, { formatCorrectAnswer } from '../../components/public/QuestionOptions';

export default function DailyChallengePage() {
  const navigate = useNavigate();
  const { token } = useUserAuth();

  const [challenge, setChallenge] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // حالات اللعب
  const [gameState, setGameState] = useState('intro'); // intro | playing | feedback | complete
  const [currentIdx, setCurrentIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [feedbackData, setFeedbackData] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [xpEarned, setXpEarned] = useState(0);

  // حالات أنواع الأسئلة
  const [selectedOption, setSelectedOption] = useState(null);
  const [fillAnswer, setFillAnswer] = useState('');
  const [matchingPairs, setMatchingPairs] = useState([]);
  const [matchLeft, setMatchLeft] = useState(null);
  const [orderingItems, setOrderingItems] = useState([]);
  const [classifyGroups, setClassifyGroups] = useState({});

  // جلب التحدي اليومي
  const fetchChallenge = useCallback(async () => {
    if (!token) {
      setError('يجب تسجيل الدخول');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/daily-challenge`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setChallenge(data.challenge);
      setQuestions(data.questions || []);

      // إذا التحدي مكتمل بالفعل
      if (data.challenge?.is_completed) {
        setGameState('complete');
        setScore(data.challenge.completed_count || 0);
        setXpEarned(data.challenge.xp_earned || 0);
      }
    } catch {
      setError('تعذر تحميل التحدي اليومي');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchChallenge(); }, [fetchChallenge]);

  // إعادة ضبط حالة السؤال
  const resetQuestionState = useCallback(() => {
    setSelectedOption(null);
    setFillAnswer('');
    setMatchingPairs([]);
    setMatchLeft(null);
    setOrderingItems([]);
    setClassifyGroups({});
  }, []);

  // بدء التحدي
  const startChallenge = () => {
    // استمر من حيث توقف (إذا كان أجاب بعض الأسئلة)
    const startFrom = challenge?.completed_count || 0;
    setGameState('playing');
    setCurrentIdx(startFrom);
    setScore(startFrom);
    resetQuestionState();
  };

  // إرسال إجابة
  const submitAnswer = async (answer) => {
    if (submitting) return;
    const q = questions[currentIdx];
    if (!q) return;

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/daily-challenge/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question_id: q.id, answer })
      });
      const data = await res.json();

      const isCorrect = data.correct;
      if (isCorrect) setScore(s => s + 1);

      // عرض التغذية الراجعة
      setFeedbackData({
        correct: isCorrect,
        correctAnswer: data.correct_answer,
        isCompleted: data.is_completed,
        xpEarned: data.xp_earned || 0,
      });
      setGameState('feedback');

      if (data.is_completed) {
        setXpEarned(data.xp_earned || 20);
      }

      setTimeout(() => {
        if (data.is_completed || currentIdx + 1 >= questions.length) {
          setGameState('complete');
        } else {
          setCurrentIdx(i => i + 1);
          resetQuestionState();
          setGameState('playing');
        }
        setFeedbackData(null);
      }, 1500);
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
        <div className="w-10 h-10 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
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
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white flex items-center justify-center p-6" dir="rtl">
        <div className="max-w-md w-full text-center">
          <Link to="/my-dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-8">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            رجوع
          </Link>

          <div className="text-6xl mb-6">⚡</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">تحدي اليوم!</h1>
          <div className="h-px bg-gray-200 w-20 mx-auto my-4" />

          {totalQ > 0 ? (
            <>
              <div className="flex items-center justify-center gap-6 text-sm text-gray-600 mb-8">
                <div className="text-center">
                  <span className="text-2xl font-bold text-gray-800 block">{totalQ}</span>
                  <span className="text-xs text-gray-400">سؤال</span>
                </div>
                <div className="w-px h-8 bg-gray-200" />
                <div className="text-center">
                  <span className="text-2xl font-bold text-amber-600 block">+20</span>
                  <span className="text-xs text-gray-400">XP</span>
                </div>
              </div>

              <p className="text-sm text-gray-400 mb-6">أكمل التحدي واحصل على مكافأة يومية!</p>

              {/* إذا أجاب بعض الأسئلة مسبقاً */}
              {challenge?.completed_count > 0 && !challenge.is_completed && (
                <div className="bg-amber-50 rounded-xl p-3 mb-4">
                  <p className="text-sm text-amber-700">أكملت {challenge.completed_count}/{totalQ} — واصل من حيث توقفت!</p>
                </div>
              )}

              <button
                onClick={startChallenge}
                className="w-full max-w-xs mx-auto bg-amber-500 text-white py-4 rounded-2xl text-lg font-bold hover:bg-amber-600 transition-colors shadow-lg shadow-amber-500/25"
              >
                🚀 {challenge?.completed_count > 0 ? 'أكمل التحدي' : 'ابدأ التحدي'}
              </button>
            </>
          ) : (
            <>
              <p className="text-gray-500 mb-6">لا توجد أسئلة متاحة لتحدي اليوم</p>
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

  // ═══ شاشة الإكمال ═══
  if (gameState === 'complete') {
    const isFullyCompleted = challenge?.is_completed || xpEarned > 0;

    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white flex items-center justify-center p-6" dir="rtl">
        <div className="max-w-md w-full text-center">
          <div className="text-6xl mb-4">{isFullyCompleted ? '🎉' : '💪'}</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">
            {isFullyCompleted ? 'أكملت تحدي اليوم!' : 'انتهى التحدي'}
          </h1>
          <div className="h-px bg-gray-200 w-20 mx-auto my-4" />

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <span className="text-3xl font-bold text-green-600">{score}/{totalQ}</span>
                <p className="text-xs text-gray-400 mt-1">إجابة صحيحة</p>
              </div>
              <div className="text-center">
                <span className="text-3xl font-bold text-amber-600">+{xpEarned}</span>
                <p className="text-xs text-gray-400 mt-1">XP مكتسبة</p>
              </div>
            </div>
          </div>

          {isFullyCompleted && (
            <p className="text-sm text-gray-500 mb-6">عد غداً للتحدي الجديد 🌅</p>
          )}

          <Link
            to="/my-dashboard"
            className="inline-block w-full max-w-xs bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors"
          >
            رجوع للرئيسية
          </Link>
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
                  className="bg-amber-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${((currentIdx + (isFeedback ? 1 : 0)) / totalQ) * 100}%` }}
                />
              </div>
            </div>
            <span className="text-xs text-gray-500 font-medium">{currentIdx + 1}/{totalQ}</span>
          </div>

          <span className="text-xs bg-amber-100 text-amber-600 px-2 py-1 rounded-lg font-medium mr-3">⚡ تحدي</span>
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
            {!feedbackData.correct && feedbackData.correctAnswer && currentQuestion && (
              <p className="text-sm text-red-600 mt-1">
                الإجابة الصحيحة: {formatCorrectAnswer(currentQuestion.exercise_type, feedbackData.correctAnswer, currentQuestion)}
              </p>
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
