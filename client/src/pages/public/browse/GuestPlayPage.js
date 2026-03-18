import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { API_BASE } from '../../../lib/api';
import QuestionOptions, { formatCorrectAnswer } from '../../../components/public/QuestionOptions';

const DIFF_LABELS = { easy: 'سهل', medium: 'متوسط', hard: 'صعب' };
const DIFF_COLORS = { easy: 'text-emerald-600', medium: 'text-amber-600', hard: 'text-red-500' };
const DIFF_BG = { easy: 'bg-emerald-100', medium: 'bg-amber-100', hard: 'bg-red-100' };

const CONFETTI_COLORS = ['#58CC02', '#1CB0F6', '#FF9600', '#FF4B4B', '#CE82FF', '#00CD9C', '#FFD900', '#FF86D0'];

function ConfettiPiece({ delay, color, style }) {
  return (
    <span
      className="absolute text-2xl animate-confetti pointer-events-none"
      style={{ animationDelay: `${delay}ms`, color, ...style }}
    >
      {['✦', '●', '▲', '★', '◆'][Math.floor(Math.random() * 5)]}
    </span>
  );
}

export default function GuestPlayPage() {
  const { exerciseId } = useParams();
  const navigate = useNavigate();

  const [exercise, setExercise] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // حالات اللعب
  const [gameState, setGameState] = useState('intro');
  const [currentIdx, setCurrentIdx] = useState(0);
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [feedbackData, setFeedbackData] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // حالات أنواع الأسئلة
  const [selectedOption, setSelectedOption] = useState(null);
  const [fillAnswer, setFillAnswer] = useState('');
  const [matchingPairs, setMatchingPairs] = useState([]);
  const [matchLeft, setMatchLeft] = useState(null);
  const [orderingItems, setOrderingItems] = useState([]);
  const [classifyGroups, setClassifyGroups] = useState({});
  const [wordBuildPlaced, setWordBuildPlaced] = useState([]);

  // جلب التمرين (بدون auth)
  useEffect(() => {
    fetch(`${API_BASE}/public/browse/exercise/${exerciseId}/play`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => {
        setExercise(data);
        setQuestions(data.questions || []);
      })
      .catch(() => setError('التمرين غير موجود'))
      .finally(() => setLoading(false));
  }, [exerciseId]);

  // إعادة ضبط عند تغيير السؤال
  const resetQuestionState = useCallback(() => {
    setSelectedOption(null);
    setFillAnswer('');
    setMatchingPairs([]);
    setMatchLeft(null);
    setOrderingItems([]);
    setClassifyGroups({});
    setWordBuildPlaced([]);
  }, []);

  // بدء اللعب
  const startGame = () => {
    setGameState('playing');
    setCurrentIdx(0);
    setLives(3);
    setScore(0);
    setAnswers([]);
    setFeedbackData(null);
    resetQuestionState();
  };

  // الانتقال للسؤال التالي
  const goNext = () => {
    if (!feedbackData) return;
    const wasCorrect = feedbackData.correct;

    if (!wasCorrect && lives <= 0) {
      setGameState('gameover');
    } else if (currentIdx + 1 >= questions.length) {
      setGameState('complete');
    } else {
      setCurrentIdx(i => i + 1);
      resetQuestionState();
      setGameState('playing');
    }
    setFeedbackData(null);
  };

  // إرسال إجابة (فحص بدون حفظ)
  const submitAnswer = async (answer) => {
    if (submitting) return;
    const q = questions[currentIdx];
    if (!q) return;

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/public/browse/exercise/${exerciseId}/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_id: q.id, answer })
      });
      const data = await res.json();

      const isCorrect = data.correct;
      setAnswers(prev => [...prev, { correct: isCorrect }]);
      if (isCorrect) {
        setScore(s => s + 1);
      } else {
        setLives(l => l - 1);
      }

      setFeedbackData({ correct: isCorrect, correctAnswer: data.correct_answer });
      setGameState('feedback');
    } catch {
      // خطأ صامت
    } finally {
      setSubmitting(false);
    }
  };

  // ═══ Loading ═══
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-500 font-medium">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  // ═══ Error ═══
  if (error || !exercise) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center text-center p-6">
        <div className="animate-fade-slide-up">
          <span className="text-6xl block mb-4">😕</span>
          <h2 className="text-xl font-bold text-gray-800 mb-2">{error || 'التمرين غير موجود'}</h2>
          <Link to="/اختبارات" className="text-emerald-600 hover:text-emerald-700 font-bold">العودة للاختبارات</Link>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIdx];
  const totalQ = questions.length;

  // ═══════════════════════════════════════
  // شاشة المقدمة — Intro
  // ═══════════════════════════════════════
  if (gameState === 'intro') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50/50 via-[#F8F9FA] to-white flex items-center justify-center p-6" dir="rtl">
        <div className="max-w-md w-full text-center animate-fade-slide-up">
          {/* رجوع */}
          <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-8 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            رجوع
          </button>

          {/* أيقونة */}
          <div className="text-7xl mb-6 animate-float">🧩</div>

          {/* العنوان */}
          <h1 className="text-2xl font-bold text-gray-800 mb-2">{exercise.title}</h1>
          {exercise.subject_name && (
            <p className="text-sm text-gray-500 mb-1">{exercise.subject_name}</p>
          )}

          {/* الصعوبة */}
          <span className={`inline-block text-xs font-bold px-3 py-1 rounded-full mb-6 ${DIFF_BG[exercise.difficulty] || 'bg-gray-100'} ${DIFF_COLORS[exercise.difficulty] || 'text-gray-600'}`}>
            {DIFF_LABELS[exercise.difficulty] || 'متوسط'}
          </span>

          {/* بطاقة المعلومات */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-8">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mx-auto mb-2">
                  <span className="text-xl">📝</span>
                </div>
                <span className="text-2xl font-bold text-gray-800 block">{totalQ}</span>
                <span className="text-[10px] text-gray-400 font-medium">سؤال</span>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-2">
                  <span className="text-xl">❤️</span>
                </div>
                <span className="text-2xl font-bold text-red-500 block">3</span>
                <span className="text-[10px] text-gray-400 font-medium">محاولات</span>
              </div>
            </div>
          </div>

          {/* تنويه: بدون حساب */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6 text-xs text-amber-700">
            <span className="font-bold">💡 تنبيه:</span> هذا تمرين تجريبي. سجّل حساب مجاني لحفظ تقدمك وكسب النقاط!
          </div>

          {/* زر البدء */}
          <button
            onClick={startGame}
            className="w-full max-w-xs mx-auto bg-gradient-to-l from-emerald-600 to-teal-600 text-white py-4 rounded-2xl text-lg font-bold hover:shadow-xl hover:shadow-emerald-600/30 transition-all active:scale-[0.98]"
          >
            🚀 ابدأ التمرين
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════
  // شاشة النتيجة — Complete / Game Over
  // ═══════════════════════════════════════
  if (gameState === 'complete' || gameState === 'gameover') {
    const accuracy = totalQ > 0 ? Math.round((score / totalQ) * 100) : 0;
    const isGameOver = gameState === 'gameover';
    const stars = accuracy >= 100 ? 3 : accuracy >= 70 ? 2 : 1;

    return (
      <div className="min-h-screen bg-gradient-to-b from-[#F8F9FA] to-white flex items-center justify-center p-6 relative overflow-hidden" dir="rtl">
        {/* Confetti */}
        {!isGameOver && (
          <>
            {CONFETTI_COLORS.map((color, i) => (
              <ConfettiPiece
                key={i}
                delay={i * 150}
                color={color}
                style={{
                  top: `${10 + (i * 7) % 40}%`,
                  left: `${5 + (i * 13) % 90}%`,
                  fontSize: `${16 + (i % 3) * 8}px`,
                }}
              />
            ))}
          </>
        )}

        <div className="max-w-md w-full text-center relative z-10">
          {/* أيقونة */}
          <div className="text-[80px] mb-4 animate-xp-pop">
            {isGameOver ? '💔' : '🏆'}
          </div>

          {/* العنوان */}
          <h1 className="text-2xl font-bold text-gray-800 mb-1 animate-fade-slide-up">
            {isGameOver ? 'انتهت المحاولات!' : '🎉 أحسنت!'}
          </h1>

          {/* النجوم */}
          {!isGameOver && (
            <div className="flex items-center justify-center gap-2 my-4">
              {[1, 2, 3].map(i => (
                <span
                  key={i}
                  className="text-4xl animate-star-pop"
                  style={{ animationDelay: `${300 + i * 200}ms`, opacity: 0, animationFillMode: 'forwards' }}
                >
                  {i <= stars ? '⭐' : '☆'}
                </span>
              ))}
            </div>
          )}

          {/* بطاقة النتيجة */}
          <div className={`rounded-2xl shadow-lg border p-6 mb-6 animate-fade-slide-up ${
            isGameOver ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'
          }`} style={{ animationDelay: '400ms', opacity: 0, animationFillMode: 'forwards' }}>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <span className={`text-3xl font-bold block ${isGameOver ? 'text-[#FF4B4B]' : 'text-[#58CC02]'}`}>
                  {score}/{totalQ}
                </span>
                <p className="text-xs text-gray-400 mt-1 font-medium">إجابة صحيحة</p>
              </div>
              <div className="text-center">
                <span className={`text-3xl font-bold block ${accuracy >= 70 ? 'text-emerald-600' : 'text-gray-600'}`}>
                  {accuracy}%
                </span>
                <p className="text-xs text-gray-400 mt-1 font-medium">الدقة</p>
              </div>
            </div>
          </div>

          {/* CTA: سجّل مجاناً */}
          <div className="bg-gradient-to-l from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-2xl p-5 mb-6 animate-fade-slide-up"
            style={{ animationDelay: '600ms', opacity: 0, animationFillMode: 'forwards' }}>
            <p className="font-bold text-gray-800 text-base mb-2">سجّل مجاناً واحصل على:</p>
            <div className="text-sm text-gray-600 space-y-1.5 text-right">
              <p className="flex items-center gap-2"><span className="text-emerald-500">✓</span> حفظ تقدمك ومتابعته</p>
              <p className="flex items-center gap-2"><span className="text-emerald-500">✓</span> كسب النقاط والشارات</p>
              <p className="flex items-center gap-2"><span className="text-emerald-500">✓</span> متابعة مسار التعلم الذكي</p>
            </div>
            <Link
              to="/auth/register"
              className="block w-full text-center mt-4 py-3 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
            >
              📝 سجّل الآن مجاناً
            </Link>
          </div>

          {/* الأزرار */}
          <div className="flex gap-3 animate-fade-slide-up" style={{ animationDelay: '800ms', opacity: 0, animationFillMode: 'forwards' }}>
            <button
              onClick={startGame}
              className={`flex-1 py-3.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                isGameOver
                  ? 'bg-[#FF4B4B] text-white hover:shadow-lg hover:shadow-[#FF4B4B]/30'
                  : 'border-2 border-emerald-500 text-emerald-600 bg-white hover:bg-emerald-50'
              }`}
            >
              🔄 {isGameOver ? 'أعد المحاولة' : 'العب مرة أخرى'}
            </button>
            <button
              onClick={() => navigate(-1)}
              className="flex-1 py-3.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 bg-white border-2 border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              ↩ تمرين آخر
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════
  // شاشة السؤال + التغذية الراجعة
  // ═══════════════════════════════════════
  const isFeedback = gameState === 'feedback';
  const progressPercent = ((currentIdx + (isFeedback ? 1 : 0)) / totalQ) * 100;

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-32" dir="rtl">
      {/* ═══ شريط علوي ═══ */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-20 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            {/* زر الإغلاق */}
            <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 transition-colors">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            {/* القلوب */}
            <div className="flex items-center gap-0.5">
              {[1, 2, 3].map(i => (
                <span
                  key={i}
                  className={`text-[28px] transition-all duration-300 ${
                    i <= lives ? 'animate-heart-beat' : 'grayscale opacity-20 scale-75'
                  }`}
                  style={i <= lives ? { animationDelay: `${i * 100}ms` } : {}}
                >
                  ❤️
                </span>
              ))}
            </div>

            {/* شريط التقدم */}
            <div className="flex-1 relative">
              <div className="w-full bg-gray-200 rounded-full h-[12px] overflow-hidden">
                <div
                  className="h-[12px] rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${progressPercent}%`,
                    background: '#58CC02',
                    boxShadow: '0 0 8px #58CC02',
                  }}
                />
              </div>
            </div>

            {/* عداد الأسئلة (بدل XP) */}
            <div className="flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-full min-w-[70px] justify-center">
              <span className="text-sm font-bold text-emerald-600">{currentIdx + 1}/{totalQ}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ محتوى السؤال ═══ */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* رقم السؤال */}
        <div className="text-center mb-4">
          <span className="inline-block bg-gradient-to-l from-emerald-600 to-teal-600 text-white text-xs font-bold px-4 py-1.5 rounded-full">
            السؤال {currentIdx + 1} من {totalQ}
          </span>
        </div>

        {/* بطاقة السؤال */}
        {currentQuestion && (
          <div
            key={currentIdx}
            className={`bg-white rounded-[20px] shadow-md border border-gray-100 p-6 mb-4 relative ${
              isFeedback
                ? feedbackData?.correct
                  ? 'animate-pulse-correct border-[#58CC02]/30'
                  : 'animate-shake-wrong border-[#FF4B4B]/30'
                : 'animate-fade-slide-up'
            }`}
          >
            {/* صورة السؤال */}
            {currentQuestion.question_image && (
              <img src={currentQuestion.question_image} alt="صورة السؤال" className="w-full max-h-48 object-contain rounded-xl mb-4" />
            )}
            {/* نص السؤال */}
            <h2 className="text-xl font-bold text-gray-800 text-center leading-relaxed">
              {currentQuestion.question_text}
            </h2>
          </div>
        )}

        {/* خيارات الإجابة */}
        {!isFeedback && currentQuestion && (
          <div key={`opts-${currentIdx}`} className="animate-fade-slide-up" style={{ animationDelay: '150ms' }}>
            <QuestionOptions
              type={exercise.type}
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
              wordBuildPlaced={wordBuildPlaced}
              setWordBuildPlaced={setWordBuildPlaced}
              onSubmit={submitAnswer}
              submitting={submitting}
            />
          </div>
        )}
      </div>

      {/* ═══ شريط التغذية الراجعة — Bottom Bar ═══ */}
      {isFeedback && feedbackData && (
        <div
          className="fixed bottom-0 left-0 right-0 z-30 animate-slide-up-bottom"
          style={{
            background: feedbackData.correct ? '#D7FFB8' : '#FFDFE0',
            borderTop: `3px solid ${feedbackData.correct ? '#58CC02' : '#FF4B4B'}`,
          }}
        >
          <div className="max-w-2xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">{feedbackData.correct ? '✅' : '❌'}</span>
                  <span className={`font-bold text-lg ${feedbackData.correct ? 'text-[#58A700]' : 'text-[#EA2B2B]'}`}>
                    {feedbackData.correct ? 'إجابة صحيحة!' : 'إجابة خاطئة'}
                  </span>
                </div>
                {!feedbackData.correct && feedbackData.correctAnswer && (
                  <p className="text-[#EA2B2B]/80 text-sm">
                    الإجابة الصحيحة: {formatCorrectAnswer(exercise.type, feedbackData.correctAnswer, currentQuestion)}
                  </p>
                )}
              </div>
              <button
                onClick={goNext}
                className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 text-white ${
                  feedbackData.correct
                    ? 'bg-[#58CC02] hover:bg-[#4CAF00]'
                    : 'bg-[#FF4B4B] hover:bg-[#E53935]'
                }`}
              >
                التالي ←
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
