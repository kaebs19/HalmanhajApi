import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API_BASE } from '../../lib/api';
import { useUserAuth } from '../../context/UserAuthContext';
import SEO from '../../components/public/SEO';

export default function QuestionDetailPage() {
  const { id } = useParams();
  const { user, token } = useUserAuth();
  const [question, setQuestion] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [answerBody, setAnswerBody] = useState('');
  const [answerImage, setAnswerImage] = useState(null);
  const [answerImagePreview, setAnswerImagePreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    fetchQuestion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchQuestion = async () => {
    try {
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/community/questions/${id}`, { headers });
      if (!res.ok) throw new Error('not found');
      const data = await res.json();
      setQuestion(data.question);
      setAnswers(data.answers || []);
    } catch {
      setQuestion(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAnswer = async (e) => {
    e.preventDefault();
    if (!answerBody.trim()) return;
    setSubmitting(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('body', answerBody);
      if (answerImage) formData.append('image', answerImage);

      const res = await fetch(`${API_BASE}/community/questions/${id}/answers`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      if (!res.ok) { const data = await res.json(); throw new Error(data.message); }
      const newAnswer = await res.json();
      setAnswers([...answers, newAnswer]);
      setAnswerBody('');
      setAnswerImage(null);
      setAnswerImagePreview(null);
      if (fileRef.current) fileRef.current.value = '';
      setQuestion(prev => ({ ...prev, answers_count: (prev.answers_count || 0) + 1 }));
    } catch (err) {
      setError(err.message || 'خطأ في إرسال الإجابة');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (answerId, voteType) => {
    if (!user) return;
    try {
      const res = await fetch(`${API_BASE}/community/answers/${answerId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ vote_type: voteType })
      });
      const data = await res.json();
      setAnswers(answers.map(a => {
        if (a.id !== answerId) return a;
        const oldVote = a.user_vote || 0;
        const newVote = data.vote;
        let upvotes = a.upvotes, downvotes = a.downvotes;
        if (oldVote === 1) upvotes--;
        if (oldVote === -1) downvotes--;
        if (newVote === 1) upvotes++;
        if (newVote === -1) downvotes++;
        return { ...a, upvotes, downvotes, user_vote: newVote };
      }));
    } catch {}
  };

  const handleBestAnswer = async (answerId) => {
    if (!user || question?.user_id !== user.id) return;
    try {
      await fetch(`${API_BASE}/community/answers/${answerId}/best`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      });
      setAnswers(answers.map(a => ({ ...a, is_best: a.id === answerId })));
      setQuestion(prev => ({ ...prev, best_answer_id: answerId }));
    } catch {}
  };

  const timeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'الآن';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `منذ ${minutes} دقيقة`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `منذ ${hours} ساعة`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `منذ ${days} يوم`;
    const months = Math.floor(days / 30);
    return `منذ ${months} شهر`;
  };

  const getPointsBadge = (points) => {
    if (points >= 100) return { label: 'خبير', color: 'bg-amber-100 text-amber-700' };
    if (points >= 50) return { label: 'متميز', color: 'bg-blue-100 text-blue-700' };
    if (points >= 20) return { label: 'نشيط', color: 'bg-emerald-100 text-emerald-700' };
    return null;
  };

  const handleAnswerImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAnswerImage(file);
      setAnswerImagePreview(URL.createObjectURL(file));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        {/* صفحة غير موجودة: تُستثنى من الأرشفة (كانت تُرجع 200 فتُحسب soft 404) */}
        <SEO title="السؤال غير موجود" noIndex />
        <p className="text-gray-500 mb-4">السؤال غير موجود</p>
        <Link to="/faq" className="text-blue-600 hover:text-blue-700 text-sm font-medium">العودة لسؤال وجواب</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <SEO title={question.title} />

      <Link to="/faq" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 mb-6 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        العودة لسؤال وجواب
      </Link>

      {/* السؤال */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6 shadow-sm">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-800 mb-3 leading-relaxed">{question.title}</h1>
          {question.body && <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap mb-4">{question.body}</p>}
          {question.image_url && (
            <div className="mb-4">
              <img src={`${API_BASE.replace('/api', '')}${question.image_url}`} alt="صورة السؤال" className="max-h-96 rounded-xl border border-gray-200" />
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap mb-4">
            {question.stage_name && <span className="text-[10px] bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full font-medium">{question.stage_name}</span>}
            {question.grade_name && <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">{question.grade_name}</span>}
            {question.subject_name && <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-medium">{question.subject_name}</span>}
            {question.best_answer_id && (
              <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                تم الحل
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-400">
            <Link to={`/profile/${question.user_id}`} className="flex items-center gap-1.5 hover:text-blue-600 transition-colors">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-[10px] font-bold">
                {question.user_name?.charAt(0)}
              </div>
              <span className="font-medium text-gray-600">{question.user_name}</span>
            </Link>
            {question.user_points > 0 && (
              <span className="text-[9px] bg-yellow-50 text-yellow-600 px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                {question.user_points}
              </span>
            )}
            {getPointsBadge(question.user_points) && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${getPointsBadge(question.user_points).color}`}>
                {getPointsBadge(question.user_points).label}
              </span>
            )}
            <span>·</span>
            <span>{timeAgo(question.created_at)}</span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              {question.views}
            </span>
          </div>
        </div>
      </div>

      {/* الإجابات */}
      <div className="mb-6">
        <h2 className="text-base font-bold text-gray-700 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
          {answers.length} إجابة
        </h2>

        {answers.length > 0 ? (
          <div className="space-y-4">
            {answers.map(answer => (
              <div key={answer.id} className={`bg-white rounded-xl border p-5 transition-all ${answer.is_best ? 'border-emerald-200 bg-emerald-50/30 shadow-sm' : 'border-gray-100'}`}>
                <div className="flex gap-4">
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <button onClick={() => handleVote(answer.id, 1)} disabled={!user} className={`p-1 rounded-lg transition-colors ${answer.user_vote === 1 ? 'text-blue-600 bg-blue-50' : 'text-gray-300 hover:text-blue-600 hover:bg-blue-50'} ${!user ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                    </button>
                    <span className={`text-sm font-bold ${(answer.upvotes - answer.downvotes) > 0 ? 'text-blue-600' : (answer.upvotes - answer.downvotes) < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                      {answer.upvotes - answer.downvotes}
                    </span>
                    <button onClick={() => handleVote(answer.id, -1)} disabled={!user} className={`p-1 rounded-lg transition-colors ${answer.user_vote === -1 ? 'text-red-500 bg-red-50' : 'text-gray-300 hover:text-red-500 hover:bg-red-50'} ${!user ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                    </button>
                  </div>

                  <div className="flex-1 min-w-0">
                    {answer.is_best && (
                      <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-bold mb-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        أفضل إجابة (+15 نقطة)
                      </div>
                    )}

                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap mb-3">{answer.body}</p>

                    {answer.image_url && (
                      <div className="mb-3">
                        <img src={`${API_BASE.replace('/api', '')}${answer.image_url}`} alt="صورة الإجابة" className="max-h-64 rounded-xl border border-gray-200" />
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Link to={`/profile/${answer.user_id}`} className="flex items-center gap-1.5 hover:text-blue-600 transition-colors">
                          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center text-white text-[9px] font-bold">
                            {answer.user_name?.charAt(0)}
                          </div>
                          <span className="font-medium text-gray-600">{answer.user_name}</span>
                        </Link>
                        {answer.user_points > 0 && (
                          <span className="text-[9px] bg-yellow-50 text-yellow-600 px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                            {answer.user_points}
                          </span>
                        )}
                        <span>·</span>
                        <span>{timeAgo(answer.created_at)}</span>
                      </div>

                      {user && question.user_id === user.id && !answer.is_best && (
                        <button onClick={() => handleBestAnswer(answer.id)} className="text-xs text-gray-400 hover:text-emerald-600 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-emerald-50 transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          اختر كأفضل إجابة
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400 bg-white rounded-xl border border-gray-100">
            <p className="text-sm">لا توجد إجابات بعد. كن أول من يجيب!</p>
          </div>
        )}
      </div>

      {/* نموذج إضافة إجابة */}
      {user ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            أضف إجابتك
            <span className="text-[10px] text-gray-400 font-normal">(+5 نقاط)</span>
          </h3>

          {error && <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>}

          <form onSubmit={handleSubmitAnswer}>
            <textarea value={answerBody} onChange={e => setAnswerBody(e.target.value)} placeholder="اكتب إجابتك هنا..." rows={4} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-none mb-3" required />

            {/* رفع صورة للإجابة */}
            <div className="mb-3">
              {answerImagePreview ? (
                <div className="relative inline-block">
                  <img src={answerImagePreview} alt="معاينة" className="max-h-32 rounded-lg" />
                  <button type="button" onClick={() => { setAnswerImage(null); setAnswerImagePreview(null); if(fileRef.current) fileRef.current.value = ''; }} className="absolute -top-2 -left-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ) : (
                <label className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-600 cursor-pointer transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  إرفاق صورة
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAnswerImageChange} className="hidden" />
                </label>
              )}
            </div>

            <div className="flex justify-end">
              <button type="submit" disabled={submitting || !answerBody.trim()} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                {submitting ? (<div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                )}
                إرسال الإجابة
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-2xl border border-gray-100 p-6 text-center">
          <p className="text-sm text-gray-500 mb-3">سجل دخولك للإجابة على هذا السؤال</p>
          <Link to="/auth/login" className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">تسجيل الدخول</Link>
        </div>
      )}
    </div>
  );
}
