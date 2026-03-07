import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useUserAuth } from '../../context/UserAuthContext';
import { API_BASE } from '../../lib/api';

const TYPE_LABELS = {
  mcq: 'اختيار من متعدد', true_false: 'صح وخطأ', fill_blank: 'أكمل الفراغ',
  matching: 'توصيل', ordering: 'ترتيب', classify: 'تصنيف',
  speed: 'سرعة', read_answer: 'اقرأ وأجب', image_match: 'مطابقة صور'
};
const DIFF_LABELS = { easy: 'سهل', medium: 'متوسط', hard: 'صعب' };
const DIFF_COLORS = { easy: 'text-green-600', medium: 'text-amber-600', hard: 'text-red-600' };

export default function ExercisePlayPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, token } = useUserAuth();

  const [exercise, setExercise] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // حالات اللعب
  const [gameState, setGameState] = useState('intro'); // intro | playing | feedback | complete | gameover
  const [currentIdx, setCurrentIdx] = useState(0);
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [totalXP, setTotalXP] = useState(0);
  const [answers, setAnswers] = useState([]); // [{correct, xp}]
  const [feedbackData, setFeedbackData] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // حالات أنواع الأسئلة
  const [selectedOption, setSelectedOption] = useState(null);
  const [fillAnswer, setFillAnswer] = useState('');
  const [matchingPairs, setMatchingPairs] = useState([]);
  const [matchLeft, setMatchLeft] = useState(null);
  const [orderingItems, setOrderingItems] = useState([]);
  const [classifyGroups, setClassifyGroups] = useState({});

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

  // بدء اللعب
  const startGame = () => {
    setGameState('playing');
    setCurrentIdx(0);
    setLives(3);
    setScore(0);
    setTotalXP(0);
    setAnswers([]);
    resetQuestionState();
  };

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

      // عرض التغذية الراجعة
      setFeedbackData({ correct: isCorrect, correctAnswer: data.correct_answer, xp: xpGained });
      setGameState('feedback');

      setTimeout(() => {
        if (!isCorrect && lives - 1 <= 0) {
          setGameState('gameover');
        } else if (currentIdx + 1 >= questions.length) {
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
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }
  if (error || !exercise) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-center p-6">
        <div>
          <span className="text-5xl block mb-4">😕</span>
          <h2 className="text-xl font-bold text-gray-800 mb-2">{error || 'التمرين غير موجود'}</h2>
          {!token ? (
            <Link to="/auth/login" className="text-blue-600 hover:text-blue-700 font-medium">تسجيل الدخول</Link>
          ) : (
            <Link to="/exercises" className="text-blue-600 hover:text-blue-700 font-medium">العودة للتمارين</Link>
          )}
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIdx];
  const totalQ = questions.length;

  // ═══ شاشة المقدمة ═══
  if (gameState === 'intro') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-6" dir="rtl">
        <div className="max-w-md w-full text-center">
          <Link to="/exercises" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-8">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            رجوع
          </Link>

          <div className="text-6xl mb-6">🧩</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">{exercise.title}</h1>
          <div className="h-px bg-gray-200 w-20 mx-auto my-4" />

          <div className="flex items-center justify-center gap-4 text-sm text-gray-500 mb-6">
            {exercise.subject_name && <span>{exercise.subject_name}</span>}
            <span className={`font-medium ${DIFF_COLORS[exercise.difficulty] || ''}`}>
              {DIFF_LABELS[exercise.difficulty] || 'متوسط'}
            </span>
          </div>

          <div className="flex items-center justify-center gap-6 text-sm text-gray-600 mb-8">
            <div className="text-center">
              <span className="text-2xl font-bold text-gray-800 block">{totalQ}</span>
              <span className="text-xs text-gray-400">سؤال</span>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div className="text-center">
              <span className="text-2xl font-bold text-amber-600 block">{exercise.xp_reward}</span>
              <span className="text-xs text-gray-400">XP</span>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div className="text-center">
              <span className="text-2xl font-bold text-red-500 block">❤️ 3</span>
              <span className="text-xs text-gray-400">محاولات</span>
            </div>
          </div>

          <button
            onClick={startGame}
            className="w-full max-w-xs mx-auto bg-blue-600 text-white py-4 rounded-2xl text-lg font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/25"
          >
            🚀 ابدأ التمرين
          </button>
        </div>
      </div>
    );
  }

  // ═══ شاشة النتيجة ═══
  if (gameState === 'complete' || gameState === 'gameover') {
    const accuracy = totalQ > 0 ? Math.round((score / totalQ) * 100) : 0;
    const isGameOver = gameState === 'gameover';

    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-6" dir="rtl">
        <div className="max-w-md w-full text-center">
          <div className="text-6xl mb-4">{isGameOver ? '💔' : accuracy >= 80 ? '🎉' : accuracy >= 50 ? '👍' : '💪'}</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">
            {isGameOver ? 'انتهت المحاولات!' : 'أكملت التمرين!'}
          </h1>
          <div className="h-px bg-gray-200 w-20 mx-auto my-4" />

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <span className="text-3xl font-bold text-gray-800">{score}/{totalQ}</span>
                <p className="text-xs text-gray-400 mt-1">إجابة صحيحة</p>
              </div>
              <div className="text-center">
                <span className="text-3xl font-bold text-amber-600">+{totalXP}</span>
                <p className="text-xs text-gray-400 mt-1">XP</p>
              </div>
              <div className="text-center">
                <span className="text-3xl font-bold text-blue-600">{accuracy}%</span>
                <p className="text-xs text-gray-400 mt-1">الدقة</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Link
              to="/exercises"
              className="flex-1 py-3 rounded-xl text-sm font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
            >
              رجوع
            </Link>
            <button
              onClick={startGame}
              className="flex-1 py-3 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              {isGameOver ? 'أعد المحاولة' : 'مرة أخرى'}
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
          {/* التقدم */}
          <div className="flex items-center gap-3 flex-1">
            <button onClick={() => navigate('/exercises')} className="text-gray-400 hover:text-gray-600">
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

          {/* القلوب */}
          <div className="flex items-center gap-1 mr-4">
            {[1,2,3].map(i => (
              <span key={i} className={`text-lg transition-all ${i <= lives ? '' : 'grayscale opacity-30'}`}>
                ❤️
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* محتوى السؤال */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Feedback overlay */}
        {isFeedback && feedbackData && (
          <div className={`text-center py-4 mb-6 rounded-2xl ${feedbackData.correct ? 'bg-green-100' : 'bg-red-100'}`}>
            <span className="text-3xl block mb-2">{feedbackData.correct ? '🎉' : '😔'}</span>
            <p className={`text-lg font-bold ${feedbackData.correct ? 'text-green-700' : 'text-red-700'}`}>
              {feedbackData.correct ? 'ممتاز!' : 'إجابة خاطئة'}
            </p>
            {!feedbackData.correct && feedbackData.correctAnswer && (
              <p className="text-sm text-red-600 mt-1">
                الإجابة الصحيحة: {formatCorrectAnswer(exercise.type, feedbackData.correctAnswer, currentQuestion)}
              </p>
            )}
          </div>
        )}

        {/* نص السؤال */}
        {currentQuestion && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            {currentQuestion.question_image && (
              <img src={currentQuestion.question_image} alt="" className="w-full max-h-48 object-contain rounded-xl mb-4" />
            )}
            <h2 className="text-lg font-bold text-gray-800 text-center leading-relaxed">
              {currentQuestion.question_text}
            </h2>
          </div>
        )}

        {/* خيارات الإجابة */}
        {!isFeedback && currentQuestion && (
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
        )}
      </div>
    </div>
  );
}

// ═══ تنسيق الإجابة الصحيحة ═══
function formatCorrectAnswer(type, answer, question) {
  if (!answer) return '';
  switch (type) {
    case 'true_false': return answer.value ? 'صح' : 'خطأ';
    case 'mcq': case 'speed': {
      const opts = question?.question_data?.options || [];
      return opts[answer.index] || `الخيار ${answer.index + 1}`;
    }
    case 'fill_blank': case 'read_answer':
      return (answer.values || [answer.value]).filter(Boolean).join(' أو ');
    case 'ordering':
      return (answer.items || []).join(' → ');
    case 'matching': case 'image_match':
      return (answer.pairs || []).map(p => `${p.left} ↔ ${p.right}`).join('، ');
    default: return JSON.stringify(answer);
  }
}

// ═══ مكون خيارات السؤال ═══
function QuestionOptions({
  type, question, selectedOption, setSelectedOption,
  fillAnswer, setFillAnswer, matchingPairs, setMatchingPairs,
  matchLeft, setMatchLeft, orderingItems, setOrderingItems,
  classifyGroups, setClassifyGroups, onSubmit, submitting
}) {
  const [selectedItem, setSelectedItemLocal] = useState(null);
  const data = question.question_data || {};

  // ═══ صح وخطأ ═══
  if (type === 'true_false') {
    return (
      <div className="grid grid-cols-2 gap-4">
        {[{ val: true, label: '✅ صح', color: 'green' }, { val: false, label: '❌ خطأ', color: 'red' }].map(opt => (
          <button
            key={String(opt.val)}
            onClick={() => onSubmit(opt.val)}
            disabled={submitting}
            className={`py-6 rounded-2xl text-xl font-bold transition-all border-2 ${
              opt.color === 'green'
                ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100 hover:border-green-400'
                : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-400'
            } ${submitting ? 'opacity-50' : ''}`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    );
  }

  // ═══ اختيار من متعدد / سرعة ═══
  if (type === 'mcq' || type === 'speed') {
    const options = data.options || [];
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {options.map((opt, idx) => (
          <button
            key={idx}
            onClick={() => onSubmit(idx)}
            disabled={submitting}
            className={`p-4 rounded-xl text-right font-medium transition-all border-2 ${
              submitting ? 'opacity-50' : 'hover:border-blue-400 hover:bg-blue-50'
            } border-gray-200 bg-white text-gray-800`}
          >
            <span className="inline-flex w-7 h-7 items-center justify-center bg-blue-100 text-blue-700 rounded-lg text-xs font-bold ml-2">
              {letters[idx]}
            </span>
            {opt}
          </button>
        ))}
      </div>
    );
  }

  // ═══ أكمل الفراغ / اقرأ وأجب ═══
  if (type === 'fill_blank' || type === 'read_answer') {
    return (
      <div className="space-y-3">
        {type === 'read_answer' && data.passage && (
          <div className="bg-blue-50 rounded-xl p-4 text-sm text-gray-700 leading-relaxed mb-4 max-h-40 overflow-y-auto">
            {data.passage}
          </div>
        )}
        <input
          type="text"
          value={fillAnswer}
          onChange={e => setFillAnswer(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && fillAnswer.trim() && onSubmit(fillAnswer.trim())}
          placeholder="اكتب إجابتك هنا..."
          className="w-full bg-white border-2 border-gray-200 rounded-xl px-5 py-4 text-lg text-center focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
          autoFocus
          dir="rtl"
        />
        <button
          onClick={() => fillAnswer.trim() && onSubmit(fillAnswer.trim())}
          disabled={!fillAnswer.trim() || submitting}
          className={`w-full py-3 rounded-xl text-sm font-bold transition-colors ${
            fillAnswer.trim() ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400'
          }`}
        >
          تأكيد
        </button>
      </div>
    );
  }

  // ═══ توصيل ═══
  if (type === 'matching' || type === 'image_match') {
    const pairs = data.pairs || [];
    const leftItems = pairs.map(p => p.left);
    const rightItems = [...pairs.map(p => p.right)].sort(() => Math.random() - 0.5);
    const matched = matchingPairs.map(p => p.left);
    const matchedRight = matchingPairs.map(p => p.right);

    return (
      <div className="space-y-4">
        <p className="text-xs text-gray-500 text-center">اضغط على عنصر من اليمين ثم العنصر المطابق من اليسار</p>
        <div className="grid grid-cols-2 gap-4">
          {/* العمود الأيمن */}
          <div className="space-y-2">
            {leftItems.map((item, i) => (
              <button
                key={i}
                onClick={() => !matched.includes(item) && setMatchLeft(item)}
                disabled={matched.includes(item)}
                className={`w-full p-3 rounded-xl text-sm font-medium transition-all border-2 text-right ${
                  matched.includes(item) ? 'bg-green-50 border-green-300 text-green-700' :
                  matchLeft === item ? 'bg-blue-50 border-blue-400 text-blue-700' :
                  'bg-white border-gray-200 hover:border-blue-300'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
          {/* العمود الأيسر */}
          <div className="space-y-2">
            {rightItems.map((item, i) => (
              <button
                key={i}
                onClick={() => {
                  if (matchedRight.includes(item) || !matchLeft) return;
                  const newPairs = [...matchingPairs, { left: matchLeft, right: item }];
                  setMatchingPairs(newPairs);
                  setMatchLeft(null);
                  if (newPairs.length === pairs.length) {
                    onSubmit(newPairs);
                  }
                }}
                disabled={matchedRight.includes(item)}
                className={`w-full p-3 rounded-xl text-sm font-medium transition-all border-2 text-right ${
                  matchedRight.includes(item) ? 'bg-green-50 border-green-300 text-green-700' :
                  'bg-white border-gray-200 hover:border-blue-300'
                } ${!matchLeft ? 'opacity-60' : ''}`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ═══ ترتيب ═══
  if (type === 'ordering') {
    const items = data.items || [];
    const remaining = items.filter(it => !orderingItems.includes(it));

    return (
      <div className="space-y-4">
        <p className="text-xs text-gray-500 text-center">اضغط على العناصر بالترتيب الصحيح</p>

        {/* العناصر المرتبة */}
        {orderingItems.length > 0 && (
          <div className="flex flex-wrap gap-2 p-3 bg-blue-50 rounded-xl min-h-[48px]">
            {orderingItems.map((item, i) => (
              <span key={i} className="inline-flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium">
                <span className="w-5 h-5 bg-blue-500 rounded-full text-[10px] flex items-center justify-center">{i + 1}</span>
                {item}
              </span>
            ))}
          </div>
        )}

        {/* العناصر المتبقية */}
        <div className="flex flex-wrap gap-2">
          {remaining.map((item, i) => (
            <button
              key={i}
              onClick={() => {
                const newItems = [...orderingItems, item];
                setOrderingItems(newItems);
                if (newItems.length === items.length) {
                  onSubmit(newItems);
                }
              }}
              className="bg-white border-2 border-gray-200 px-4 py-2 rounded-xl text-sm font-medium hover:border-blue-400 hover:bg-blue-50 transition-all"
            >
              {item}
            </button>
          ))}
        </div>

        {orderingItems.length > 0 && (
          <button
            onClick={() => setOrderingItems([])}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            إعادة تعيين
          </button>
        )}
      </div>
    );
  }

  // ═══ تصنيف ═══
  if (type === 'classify') {
    const categories = data.categories || [];
    const allItems = data.items || categories.flatMap(c => c.items || []);
    const usedItems = Object.values(classifyGroups).flat();
    const remaining = allItems.filter(it => !usedItems.includes(it));

    const totalExpected = allItems.length;
    const totalPlaced = usedItems.length;

    return (
      <div className="space-y-4">
        <p className="text-xs text-gray-500 text-center">اختر عنصر ثم اضغط على الفئة المناسبة</p>

        {/* العناصر المتبقية */}
        <div className="flex flex-wrap gap-2 justify-center">
          {remaining.map((item, i) => (
            <button
              key={i}
              onClick={() => setSelectedItemLocal(selectedItem === item ? null : item)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border-2 ${
                selectedItem === item ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-gray-200 hover:border-blue-300'
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        {/* الفئات */}
        <div className="grid grid-cols-2 gap-3">
          {categories.map((cat, i) => {
            const catName = cat.name || cat;
            const catItems = classifyGroups[catName] || [];
            return (
              <button
                key={i}
                onClick={() => {
                  if (!selectedItem) return;
                  const newGroups = { ...classifyGroups, [catName]: [...catItems, selectedItem] };
                  setClassifyGroups(newGroups);
                  setSelectedItemLocal(null);
                  if (totalPlaced + 1 >= totalExpected) {
                    onSubmit(newGroups);
                  }
                }}
                className={`p-4 rounded-xl border-2 text-right transition-all min-h-[80px] ${
                  selectedItem ? 'border-blue-300 hover:bg-blue-50' : 'border-gray-200'
                }`}
              >
                <p className="text-sm font-bold text-gray-700 mb-2">{catName}</p>
                <div className="flex flex-wrap gap-1">
                  {catItems.map((it, j) => (
                    <span key={j} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{it}</span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ═══ نوع غير معروف ═══
  return (
    <div className="text-center py-8 text-gray-500">
      <p>نوع السؤال غير مدعوم حالياً</p>
    </div>
  );
}
