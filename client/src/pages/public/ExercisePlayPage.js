import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useUserAuth } from '../../context/UserAuthContext';
import { API_BASE } from '../../lib/api';
import QuestionOptions, { formatCorrectAnswer } from '../../components/public/QuestionOptions';
import { useToast } from '../../components/ui/Toast';

const DIFF_LABELS = { easy: 'سهل', medium: 'متوسط', hard: 'صعب' };
const DIFF_COLORS = { easy: 'text-emerald-600', medium: 'text-amber-600', hard: 'text-red-500' };
const DIFF_BG = { easy: 'bg-emerald-100', medium: 'bg-amber-100', hard: 'bg-red-100' };

// ═══ Confetti pieces for completion screen ═══
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

export default function ExercisePlayPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useUserAuth();

  // بيانات مسار التعلم (إن أتى من مسار)
  const nodeId = location.state?.nodeId;
  const autoNextRef = useRef(null);
  const [completionData, setCompletionData] = useState(null);

  const [exercise, setExercise] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // حالات اللعب
  const [gameState, setGameState] = useState('intro');
  const [currentIdx, setCurrentIdx] = useState(0);
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [totalXP, setTotalXP] = useState(0);
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

  // تخطي + بلاغ
  const [skipsRemaining, setSkipsRemaining] = useState(0);
  const [showAdModal, setShowAdModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportedQuestions, setReportedQuestions] = useState(new Set());
  const { toast } = useToast();

  // جلب التمرين
  useEffect(() => {
    if (!token) {
      setError('يجب تسجيل الدخول');
      setLoading(false);
      return;
    }
    fetch(`${API_BASE}/exercises/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => {
        setExercise(data);
        setQuestions(data.questions || []);
      })
      .catch(() => setError('التمرين غير موجود'))
      .finally(() => setLoading(false));
  }, [id, token]);

  // إعادة ضبط عند تغيير السؤال
  const resetQuestionState = useCallback(() => {
    setSelectedOption(null);
    setFillAnswer('');
    setMatchingPairs([]);
    setMatchLeft(null);
    setOrderingItems([]);
    setClassifyGroups({});
  }, []);

  // جلب عدد التخطيات المتبقية
  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/exercises/skips/today`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setSkipsRemaining(d.skips_remaining || 0))
      .catch(() => {});
  }, [token]);

  // تخطي السؤال
  const handleSkip = async () => {
    if (skipsRemaining > 0) {
      try {
        const res = await fetch(`${API_BASE}/exercises/skips/use`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        setSkipsRemaining(data.skips_remaining);
        // انتقل للتالي بدون خسارة قلب
        if (currentIdx + 1 >= questions.length) {
          setGameState('complete');
        } else {
          setCurrentIdx(i => i + 1);
          resetQuestionState();
        }
        toast.success(`تم التخطي ⏭️ (متبقي: ${data.skips_remaining})`);
      } catch {
        toast.error('حدث خطأ');
      }
    } else {
      setShowAdModal(true);
    }
  };

  // بدء اللعب
  const startGame = () => {
    setGameState('playing');
    setCurrentIdx(0);
    setLives(3);
    setScore(0);
    setTotalXP(0);
    setAnswers([]);
    setFeedbackData(null);
    resetQuestionState();
  };

  // الانتقال للسؤال التالي
  const goNext = useCallback(() => {
    // تنظيف أي timer سابق
    if (autoNextRef.current) {
      clearTimeout(autoNextRef.current);
      autoNextRef.current = null;
    }

    if (!feedbackData) return;

    if (lives <= 0) {
      setGameState('gameover');
    } else if (currentIdx + 1 >= questions.length) {
      setGameState('complete');
    } else {
      setCurrentIdx(i => i + 1);
      resetQuestionState();
      setGameState('playing');
    }
    setFeedbackData(null);
  }, [feedbackData, lives, currentIdx, questions.length, resetQuestionState]);

  // إرسال إجابة
  const submitAnswer = async (answer) => {
    if (submitting) return;
    const q = questions[currentIdx];
    if (!q) return;

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/exercises/${id}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question_id: q.id, answer })
      });
      const data = await res.json();

      const isCorrect = data.correct;
      const xpGained = data.xp_gained || 0;

      setAnswers(prev => [...prev, { correct: isCorrect, xp: xpGained }]);
      if (isCorrect) {
        setScore(s => s + 1);
        setTotalXP(x => x + xpGained);
      } else {
        setLives(l => l - 1);
      }

      // عرض التغذية الراجعة + انتقال تلقائي
      setFeedbackData({ correct: isCorrect, correctAnswer: data.correct_answer, xp: xpGained });
      setGameState('feedback');

      // انتقال تلقائي — وقت أطول للخطأ ليرى الإجابة الصحيحة
      const delay = isCorrect ? 1200 : 2200;
      autoNextRef.current = setTimeout(() => {
        autoNextRef.current = null;
        // نحتاج استدعاء goNext عبر التأثير لأنها تعتمد على feedbackData
        setGameState(prev => {
          if (prev !== 'feedback') return prev;
          // تنفيذ الانتقال
          if ((lives - (isCorrect ? 0 : 1)) <= 0 && !isCorrect) {
            return 'gameover';
          } else if (currentIdx + 1 >= questions.length) {
            return 'complete';
          }
          return 'auto-next';
        });
      }, delay);
    } catch {
      // خطأ صامت
    } finally {
      setSubmitting(false);
    }
  };

  // معالجة الانتقال التلقائي
  useEffect(() => {
    if (gameState === 'auto-next') {
      setCurrentIdx(i => i + 1);
      resetQuestionState();
      setFeedbackData(null);
      setGameState('playing');
    }
  }, [gameState, resetQuestionState]);

  // استدعاء complete-node عند إكمال التمرين (إذا أتى من مسار التعلم)
  useEffect(() => {
    if (gameState === 'complete' && nodeId && token) {
      fetch(`${API_BASE}/learning-paths/complete-node`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ node_id: nodeId })
      })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data) setCompletionData(data);
        })
        .catch(() => {});
    }
  }, [gameState, nodeId, token]);

  // تنظيف الـ timer عند الخروج
  useEffect(() => {
    return () => {
      if (autoNextRef.current) clearTimeout(autoNextRef.current);
    };
  }, []);

  // ═══ Loading ═══
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#5C6BC0]/20 border-t-[#5C6BC0] rounded-full animate-spin mx-auto mb-4" />
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
          {!token ? (
            <Link to="/auth/login" className="text-[#5C6BC0] hover:text-[#3F51B5] font-bold">تسجيل الدخول</Link>
          ) : (
            <Link to="/exercises" className="text-[#5C6BC0] hover:text-[#3F51B5] font-bold">العودة للتمارين</Link>
          )}
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
      <div className="min-h-screen bg-gradient-to-b from-[#5C6BC0]/5 via-[#F8F9FA] to-white flex items-center justify-center p-6" dir="rtl">
        <div className="max-w-md w-full text-center animate-fade-slide-up">
          {/* رجوع */}
          <Link to="/exercises" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-8 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            رجوع للتمارين
          </Link>

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
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="w-12 h-12 bg-[#5C6BC0]/10 rounded-xl flex items-center justify-center mx-auto mb-2">
                  <span className="text-xl">📝</span>
                </div>
                <span className="text-2xl font-bold text-gray-800 block">{totalQ}</span>
                <span className="text-[10px] text-gray-400 font-medium">سؤال</span>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-[#FF9600]/10 rounded-xl flex items-center justify-center mx-auto mb-2">
                  <span className="text-xl">⚡</span>
                </div>
                <span className="text-2xl font-bold text-[#FF9600] block">{exercise.xp_reward}</span>
                <span className="text-[10px] text-gray-400 font-medium">XP</span>
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

          {/* زر البدء */}
          <button
            onClick={startGame}
            className="w-full max-w-xs mx-auto bg-gradient-to-l from-[#5C6BC0] to-[#3F51B5] text-white py-4 rounded-2xl text-lg font-bold hover:shadow-xl hover:shadow-[#5C6BC0]/30 transition-all active:scale-[0.98]"
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
    const pathComplete = completionData?.path_complete;

    return (
      <div className="min-h-screen bg-gradient-to-b from-[#F8F9FA] to-white flex items-center justify-center p-6 relative overflow-hidden" dir="rtl">
        {/* Confetti — أكبر وأكثر */}
        {!isGameOver && (
          <>
            {[...CONFETTI_COLORS, ...CONFETTI_COLORS].map((color, i) => (
              <ConfettiPiece
                key={i}
                delay={i * 100}
                color={color}
                style={{
                  top: `${5 + (i * 5) % 50}%`,
                  left: `${2 + (i * 11) % 96}%`,
                  fontSize: `${14 + (i % 4) * 8}px`,
                }}
              />
            ))}
          </>
        )}

        <div className="max-w-md w-full text-center relative z-10">
          {/* أيقونة */}
          <div className="text-[80px] mb-4 animate-xp-pop">
            {isGameOver ? '💔' : pathComplete ? '🏆' : '🎉'}
          </div>

          {/* العنوان */}
          <h1 className="text-2xl font-bold text-gray-800 mb-1 animate-fade-slide-up">
            {isGameOver
              ? 'انتهت المحاولات!'
              : pathComplete
                ? 'أكملت المسار بالكامل! 🏆'
                : 'أحسنت! أكملت التمرين 🎉'}
          </h1>

          {/* معلومات إكمال المسار */}
          {completionData && !isGameOver && (
            <p className="text-sm text-gray-500 animate-fade-slide-up" style={{ animationDelay: '200ms' }}>
              {completionData.completed_count}/{completionData.total_nodes} محطة مكتملة
              {completionData.xp_earned > 0 && ` • +${completionData.xp_earned} XP`}
            </p>
          )}

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
            <div className="grid grid-cols-3 gap-4">
              {/* النتيجة */}
              <div className="text-center">
                <span className={`text-3xl font-bold block ${isGameOver ? 'text-[#FF4B4B]' : 'text-[#58CC02]'}`}>
                  {score}/{totalQ}
                </span>
                <p className="text-xs text-gray-400 mt-1 font-medium">إجابة صحيحة</p>
              </div>
              {/* XP */}
              <div className="text-center">
                <span className="text-3xl font-bold text-[#FF9600] block animate-xp-pop" style={{ animationDelay: '600ms' }}>
                  +{totalXP}
                </span>
                <p className="text-xs text-gray-400 mt-1 font-medium">⚡ XP</p>
              </div>
              {/* الدقة */}
              <div className="text-center">
                <span className={`text-3xl font-bold block ${accuracy >= 70 ? 'text-[#5C6BC0]' : 'text-gray-600'}`}>
                  {accuracy}%
                </span>
                <p className="text-xs text-gray-400 mt-1 font-medium">الدقة</p>
              </div>
            </div>
          </div>

          {/* الأزرار */}
          <div className="flex flex-col gap-3 animate-fade-slide-up" style={{ animationDelay: '600ms', opacity: 0, animationFillMode: 'forwards' }}>
            {/* زر المحطة التالية (إذا أتى من مسار تعلم وفيه محطة تالية) */}
            {completionData?.next_node_id && !isGameOver && !pathComplete && (
              <button
                onClick={() => {
                  // الرجوع لصفحة المسار ليتم تحميل البيانات المحدثة
                  navigate(-1);
                }}
                className="w-full py-3.5 rounded-xl text-sm font-bold bg-[#58CC02] text-white hover:shadow-lg hover:shadow-[#58CC02]/30 transition-all flex items-center justify-center gap-2"
              >
                ▶ المحطة التالية
              </button>
            )}

            <div className="flex gap-3">
              <button
                onClick={startGame}
                className={`flex-1 py-3.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  isGameOver
                    ? 'bg-[#FF4B4B] text-white hover:shadow-lg hover:shadow-[#FF4B4B]/30'
                    : 'border-2 border-[#58CC02] text-[#58CC02] bg-white hover:bg-[#58CC02]/5'
                }`}
              >
                🔄 {isGameOver ? 'أعد المحاولة' : 'العب مرة أخرى'}
              </button>
              <Link
                to="/exercises"
                className={`flex-1 py-3.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  isGameOver
                    ? 'bg-white border-2 border-gray-200 text-gray-600 hover:bg-gray-50'
                    : 'border-2 border-gray-200 text-gray-600 bg-white hover:bg-gray-50'
                }`}
              >
                🏠 رجوع للتمارين
              </Link>
            </div>
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
            <button onClick={() => navigate('/exercises')} className="text-gray-400 hover:text-gray-600 transition-colors">
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

            {/* عداد XP */}
            <div className="flex items-center gap-1 bg-[#FF9600]/10 px-3 py-1.5 rounded-full min-w-[70px] justify-center">
              <span className="text-sm">⚡</span>
              <span className="text-sm font-bold text-[#FF9600]">{totalXP}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ محتوى السؤال ═══ */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* رقم السؤال */}
        <div className="text-center mb-4">
          <span className="inline-block bg-gradient-to-l from-[#5C6BC0] to-[#7986CB] text-white text-xs font-bold px-4 py-1.5 rounded-full">
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
            {/* زر البلاغ — أعلى يسار */}
            {!isFeedback && (
              <button
                onClick={() => setShowReportModal(true)}
                disabled={reportedQuestions.has(currentQuestion.id)}
                className={`absolute top-3 left-3 w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all ${
                  reportedQuestions.has(currentQuestion.id)
                    ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                    : 'bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-500'
                }`}
                title="الإبلاغ عن سؤال"
              >
                🚩
              </button>
            )}

            {/* صورة السؤال */}
            {currentQuestion.question_image && (
              <img src={currentQuestion.question_image} alt="" className="w-full max-h-48 object-contain rounded-xl mb-4" />
            )}
            {/* نص السؤال */}
            <h2 className="text-xl font-bold text-gray-800 text-center leading-relaxed">
              {currentQuestion.question_text}
            </h2>
          </div>
        )}

        {/* زر التخطي — بعد بطاقة السؤال */}
        {!isFeedback && currentQuestion && (
          <div className="flex justify-start mb-4">
            <button
              onClick={handleSkip}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border border-gray-200 bg-white text-gray-500 hover:border-[#1CB0F6] hover:text-[#1CB0F6] transition-all active:scale-95"
            >
              <span>تخطي ⏭️</span>
              <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                {skipsRemaining}
              </span>
            </button>
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
              onSubmit={submitAnswer}
              submitting={submitting}
            />
          </div>
        )}
      </div>

      {/* ═══ شريط التغذية الراجعة — Bottom Bar (Duolingo style) ═══ */}
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
                  {feedbackData.correct && feedbackData.xp > 0 && (
                    <span className="bg-[#58CC02]/20 text-[#58A700] text-xs font-bold px-2 py-0.5 rounded-full">
                      +{feedbackData.xp} XP ⚡
                    </span>
                  )}
                </div>
                {!feedbackData.correct && feedbackData.correctAnswer && (
                  <p className="text-[#EA2B2B]/80 text-sm">
                    الإجابة الصحيحة: {formatCorrectAnswer(exercise.type, feedbackData.correctAnswer, currentQuestion)}
                  </p>
                )}
              </div>
              <button
                onClick={goNext}
                className={`relative px-6 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 text-white overflow-hidden ${
                  feedbackData.correct
                    ? 'bg-[#58CC02] hover:bg-[#4CAF00]'
                    : 'bg-[#FF4B4B] hover:bg-[#E53935]'
                }`}
              >
                {/* شريط عد تنازلي */}
                <span
                  className="absolute bottom-0 left-0 h-1 bg-white/40 rounded-full"
                  style={{
                    animation: `shrinkBar ${feedbackData.correct ? '1.2s' : '2.2s'} linear forwards`,
                  }}
                />
                التالي ←
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ AdModal — مشاهدة إعلان للتخطي ═══ */}
      {showAdModal && (
        <AdModal
          onClose={() => setShowAdModal(false)}
          token={token}
          onAdComplete={async () => {
            try {
              const res = await fetch(`${API_BASE}/exercises/skips/add-from-ad`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
              });
              const data = await res.json();
              setSkipsRemaining(data.skips_remaining);
              setShowAdModal(false);
              // تخطي السؤال تلقائياً
              if (currentIdx + 1 >= questions.length) {
                setGameState('complete');
              } else {
                setCurrentIdx(i => i + 1);
                resetQuestionState();
              }
              toast.success('تم التخطي ⏭️');
            } catch {
              toast.error('حدث خطأ');
            }
          }}
        />
      )}

      {/* ═══ ReportModal — الإبلاغ عن سؤال ═══ */}
      {showReportModal && currentQuestion && (
        <ReportModal
          onClose={() => setShowReportModal(false)}
          token={token}
          questionId={currentQuestion.id}
          onReported={() => {
            setReportedQuestions(prev => new Set([...prev, currentQuestion.id]));
            setShowReportModal(false);
            toast.success('شكراً! تم إرسال البلاغ ✅');
          }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// AdModal — مشاهدة إعلان للحصول على تخطي
// ═══════════════════════════════════════
function AdModal({ onClose, onAdComplete }) {
  const [stage, setStage] = useState('prompt'); // prompt | watching | done
  const [countdown, setCountdown] = useState(5);
  const intervalRef = useRef(null);

  const startAd = () => {
    setStage('watching');
    setCountdown(5);
    intervalRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          setStage('done');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  useEffect(() => {
    if (stage === 'done') {
      const t = setTimeout(() => onAdComplete(), 800);
      return () => clearTimeout(t);
    }
  }, [stage, onAdComplete]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <span className="text-xl">⏭️</span>
            <h3 className="text-base font-bold text-gray-800">تخطي السؤال</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-6 text-center">
          {stage === 'prompt' && (
            <>
              <div className="text-5xl mb-4">🎬</div>
              <p className="text-gray-600 text-sm mb-6">
                انتهت التخطيات اليومية!<br />
                شاهد إعلاناً قصيراً للحصول على تخطي إضافي
              </p>
              <button
                onClick={startAd}
                className="w-full bg-[#1CB0F6] text-white py-3 rounded-xl font-bold hover:bg-[#0A9FE0] transition-all active:scale-95"
              >
                🎬 شاهد إعلان
              </button>
            </>
          )}
          {stage === 'watching' && (
            <>
              <div className="text-5xl mb-4 animate-pulse">📺</div>
              <p className="text-gray-500 text-sm mb-3">جارٍ تحميل الإعلان...</p>
              <div className="text-6xl font-bold text-[#1CB0F6] mb-2">{countdown}</div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="h-2 bg-[#1CB0F6] rounded-full transition-all duration-1000"
                  style={{ width: `${((5 - countdown) / 5) * 100}%` }}
                />
              </div>
            </>
          )}
          {stage === 'done' && (
            <>
              <div className="text-5xl mb-4">✅</div>
              <p className="text-[#58A700] font-bold text-lg">تم! حصلت على تخطي إضافي</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// ReportModal — الإبلاغ عن سؤال
// ═══════════════════════════════════════
const REPORT_REASONS = [
  { value: 'wrong_answer', label: 'الإجابة الصحيحة خاطئة' },
  { value: 'spelling_error', label: 'خطأ إملائي في السؤال' },
  { value: 'unclear', label: 'السؤال غير واضح' },
  { value: 'other', label: 'سبب آخر' },
];

function ReportModal({ onClose, token, questionId, onReported }) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    if (!reason) return;
    setSending(true);
    try {
      await fetch(`${API_BASE}/exercises/questions/${questionId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason, details: details.trim() || null })
      });
      onReported();
    } catch {
      // silent
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <span className="text-xl">🚩</span>
            <h3 className="text-base font-bold text-gray-800">الإبلاغ عن سؤال</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-4">
          <p className="text-sm font-medium text-gray-700">ما المشكلة؟</p>
          <div className="space-y-2">
            {REPORT_REASONS.map(r => (
              <label
                key={r.value}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  reason === r.value
                    ? 'border-[#1CB0F6] bg-[#1CB0F6]/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="reason"
                  value={r.value}
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                  className="accent-[#1CB0F6]"
                />
                <span className="text-sm text-gray-700">{r.label}</span>
              </label>
            ))}
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">تفاصيل إضافية (اختياري)</label>
            <textarea
              value={details}
              onChange={e => setDetails(e.target.value)}
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#1CB0F6] resize-none"
              placeholder="اكتب تفاصيل المشكلة هنا..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t bg-gray-50 flex items-center gap-3">
          <button
            onClick={handleSubmit}
            disabled={!reason || sending}
            className="flex-1 bg-[#FF4B4B] text-white py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-[#E53935] transition-all active:scale-95"
          >
            {sending ? 'جارٍ الإرسال...' : 'إرسال البلاغ 🚩'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-500 border border-gray-200 hover:bg-gray-100 transition-all"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
