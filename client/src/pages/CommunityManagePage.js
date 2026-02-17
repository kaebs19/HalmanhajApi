import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import DashboardLayout from './DashboardLayout';
import { Alert, Button, Input } from '../components/ui';

export default function CommunityManagePage() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [expandedId, setExpandedId] = useState(null);
  const [expandedData, setExpandedData] = useState(null);
  const [expandLoading, setExpandLoading] = useState(false);

  // نموذج إضافة سؤال
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/admin/community/questions?page=${page}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (filter === 'published') url += '&published=true';
      if (filter === 'unpublished') url += '&published=false';
      const res = await api.get(url);
      setQuestions(res.data.questions || res.data);
      if (res.data.pagination) setPagination(res.data.pagination);
    } catch {
      setError('خطأ في تحميل الأسئلة');
    } finally {
      setLoading(false);
    }
  }, [page, search, filter]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const fetchQuestionDetail = async (id) => {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedData(null);
      return;
    }
    setExpandedId(id);
    setExpandLoading(true);
    try {
      const res = await api.get(`/admin/community/questions/${id}`);
      setExpandedData(res.data);
    } catch {
      setError('خطأ في تحميل تفاصيل السؤال');
    } finally {
      setExpandLoading(false);
    }
  };

  const togglePublished = async (q) => {
    try {
      await api.put(`/admin/community/questions/${q.id}`, { is_published: !q.is_published });
      setQuestions(questions.map(item => item.id === q.id ? { ...item, is_published: !item.is_published } : item));
      setSuccess(q.is_published ? 'تم إلغاء النشر' : 'تم النشر');
      setTimeout(() => setSuccess(''), 2000);
    } catch {
      setError('خطأ في تحديث الحالة');
    }
  };

  const toggleClosed = async (q) => {
    try {
      await api.put(`/admin/community/questions/${q.id}`, { is_closed: !q.is_closed });
      setQuestions(questions.map(item => item.id === q.id ? { ...item, is_closed: !item.is_closed } : item));
      setSuccess(q.is_closed ? 'تم فتح السؤال' : 'تم إغلاق السؤال');
      setTimeout(() => setSuccess(''), 2000);
    } catch {
      setError('خطأ في تحديث الحالة');
    }
  };

  const deleteQuestion = async (id) => {
    if (!window.confirm('هل تريد حذف هذا السؤال نهائياً؟')) return;
    try {
      await api.delete(`/admin/community/questions/${id}`);
      setQuestions(questions.filter(q => q.id !== id));
      if (expandedId === id) { setExpandedId(null); setExpandedData(null); }
      setSuccess('تم حذف السؤال');
      setTimeout(() => setSuccess(''), 2000);
    } catch {
      setError('خطأ في الحذف');
    }
  };

  const deleteAnswer = async (answerId) => {
    if (!window.confirm('هل تريد حذف هذه الإجابة؟')) return;
    try {
      await api.delete(`/admin/community/answers/${answerId}`);
      if (expandedData) {
        const updatedAnswers = (expandedData.answers || []).filter(a => a.id !== answerId);
        setExpandedData({ ...expandedData, answers: updatedAnswers });
      }
      setQuestions(questions.map(q => {
        if (q.id === expandedId) return { ...q, answers_count: Math.max(0, (q.answers_count || 0) - 1) };
        return q;
      }));
      setSuccess('تم حذف الإجابة');
      setTimeout(() => setSuccess(''), 2000);
    } catch {
      setError('خطأ في حذف الإجابة');
    }
  };

  const handleAddQuestion = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) { setError('عنوان السؤال مطلوب'); return; }
    setFormSubmitting(true);
    setError('');
    try {
      await api.post('/admin/community/questions', { title: newTitle.trim(), body: newBody.trim() });
      setSuccess('تم إضافة السؤال');
      setNewTitle('');
      setNewBody('');
      setShowForm(false);
      fetchQuestions();
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'خطأ في إضافة السؤال');
    } finally {
      setFormSubmitting(false);
    }
  };

  const timeAgo = (date) => {
    if (!date) return '';
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

  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* الرأس */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">إدارة مجتمع الأسئلة</h1>
            <p className="text-sm text-gray-500 mt-0.5">{pagination.total || questions.length} سؤال</p>
          </div>
          <Button onClick={() => { setShowForm(!showForm); setError(''); }}>
            {showForm ? 'إلغاء' : '+ إضافة سؤال'}
          </Button>
        </div>

        {error && <Alert>{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        {/* نموذج إضافة سؤال */}
        {showForm && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-800">سؤال جديد</h2>
            <form onSubmit={handleAddQuestion} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">عنوان السؤال <span className="text-red-500">*</span></label>
                <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="اكتب عنوان السؤال..." required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">تفاصيل السؤال</label>
                <textarea
                  value={newBody}
                  onChange={e => setNewBody(e.target.value)}
                  placeholder="أضف تفاصيل السؤال (اختياري)..."
                  rows={4}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-none"
                />
              </div>
              <div className="flex gap-3 pt-3 border-t">
                <Button type="submit" disabled={formSubmitting}>
                  {formSubmitting ? 'جاري الإضافة...' : 'إضافة السؤال'}
                </Button>
                <Button variant="secondary" onClick={() => { setShowForm(false); setNewTitle(''); setNewBody(''); }}>
                  إلغاء
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* البحث والفلاتر */}
        <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-gray-200 p-4">
          <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
            <div className="relative">
              <Input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="ابحث في الأسئلة..."
                className="pr-4 pl-10"
              />
              <button type="submit" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </form>

          <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-0.5">
            {[
              { key: 'all', label: 'الكل' },
              { key: 'published', label: 'منشور' },
              { key: 'unpublished', label: 'غير منشور' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => { setFilter(f.key); setPage(1); }}
                className={`text-xs px-3 py-1.5 rounded-md transition-all ${filter === f.key ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* قائمة الأسئلة */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        ) : questions.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm">لا توجد أسئلة</p>
          </div>
        ) : (
          <div className="space-y-3">
            {questions.map(q => (
              <div key={q.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* صف السؤال */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => fetchQuestionDetail(q.id)}>
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <h3 className="text-sm font-bold text-gray-800 hover:text-blue-600 transition-colors">{q.title}</h3>
                        {!q.is_published && (
                          <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">مسودة</span>
                        )}
                        {q.is_closed && (
                          <span className="text-[10px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded">مغلق</span>
                        )}
                        {q.best_answer_id && (
                          <span className="text-[10px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            محلول
                          </span>
                        )}
                      </div>

                      {/* معلومات المستخدم والتاريخ */}
                      <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                        <span className="flex items-center gap-1">
                          <div className="w-4 h-4 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-[8px] font-bold">
                            {q.user_name?.charAt(0)}
                          </div>
                          <span className="font-medium text-gray-500">{q.user_name || 'مجهول'}</span>
                        </span>
                        <span className="text-gray-300">|</span>
                        <span>{formatDate(q.created_at)}</span>
                      </div>

                      {/* تصنيفات */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {q.stage_name && (
                          <span className="text-[10px] bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full font-medium">{q.stage_name}</span>
                        )}
                        {q.grade_name && (
                          <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">{q.grade_name}</span>
                        )}
                        {q.subject_name && (
                          <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-medium">{q.subject_name}</span>
                        )}

                        <span className="text-[10px] text-gray-400 flex items-center gap-1 mr-2">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
                          {q.answers_count || 0} إجابة
                        </span>
                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          {q.views || 0}
                        </span>
                      </div>
                    </div>

                    {/* أزرار الإجراءات */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => togglePublished(q)}
                        title={q.is_published ? 'إلغاء النشر' : 'نشر'}
                        className={`p-2 rounded-lg transition-colors ${q.is_published ? 'text-emerald-500 hover:bg-emerald-50' : 'text-gray-300 hover:bg-gray-50'}`}
                      >
                        <svg className="w-4 h-4" fill={q.is_published ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => toggleClosed(q)}
                        title={q.is_closed ? 'فتح السؤال' : 'إغلاق السؤال'}
                        className={`p-2 rounded-lg transition-colors ${q.is_closed ? 'text-red-500 hover:bg-red-50' : 'text-gray-300 hover:bg-gray-50'}`}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => fetchQuestionDetail(q.id)}
                        title="عرض التفاصيل"
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <svg className={`w-4 h-4 transition-transform ${expandedId === q.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => deleteQuestion(q.id)}
                        title="حذف السؤال"
                        className="p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                {/* التفاصيل الموسعة */}
                {expandedId === q.id && (
                  <div className="border-t border-gray-100 bg-gray-50/50 p-5">
                    {expandLoading ? (
                      <div className="flex justify-center py-6">
                        <div className="w-6 h-6 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                      </div>
                    ) : expandedData ? (
                      <div className="space-y-4">
                        {/* نص السؤال */}
                        {(expandedData.question?.body || expandedData.body) && (
                          <div className="bg-white rounded-lg border border-gray-200 p-4">
                            <p className="text-xs font-bold text-gray-500 mb-2">نص السؤال:</p>
                            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                              {expandedData.question?.body || expandedData.body}
                            </p>
                          </div>
                        )}

                        {/* قائمة الإجابات */}
                        <div>
                          <p className="text-xs font-bold text-gray-500 mb-3">
                            الإجابات ({(expandedData.answers || []).length})
                          </p>
                          {(expandedData.answers || []).length === 0 ? (
                            <p className="text-xs text-gray-400 text-center py-4">لا توجد إجابات</p>
                          ) : (
                            <div className="space-y-3">
                              {(expandedData.answers || []).map(answer => (
                                <div
                                  key={answer.id}
                                  className={`bg-white rounded-lg border p-4 ${answer.is_best ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-200'}`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                      {answer.is_best && (
                                        <div className="flex items-center gap-1 text-emerald-600 text-xs font-bold mb-2">
                                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                          أفضل إجابة
                                        </div>
                                      )}
                                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap mb-2">{answer.body}</p>
                                      <div className="flex items-center gap-2 text-xs text-gray-400">
                                        <span className="flex items-center gap-1">
                                          <div className="w-4 h-4 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center text-white text-[8px] font-bold">
                                            {answer.user_name?.charAt(0)}
                                          </div>
                                          <span className="font-medium text-gray-500">{answer.user_name}</span>
                                        </span>
                                        <span className="text-gray-300">|</span>
                                        <span className="flex items-center gap-0.5">
                                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                                          {(answer.upvotes || 0) - (answer.downvotes || 0)} صوت
                                        </span>
                                        <span className="text-gray-300">|</span>
                                        <span>{timeAgo(answer.created_at)}</span>
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => deleteAnswer(answer.id)}
                                      title="حذف الإجابة"
                                      className="p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                                    >
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            ))}

            {/* الترقيم */}
            {pagination.pages > 1 && (
              <div className="flex justify-center gap-2 pt-4">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="w-8 h-8 rounded-lg text-sm font-medium bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <svg className="w-4 h-4 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </button>
                {Array.from({ length: Math.min(pagination.pages, 7) }, (_, i) => {
                  let p;
                  if (pagination.pages <= 7) {
                    p = i + 1;
                  } else if (page <= 4) {
                    p = i + 1;
                  } else if (page >= pagination.pages - 3) {
                    p = pagination.pages - 6 + i;
                  } else {
                    p = page - 3 + i;
                  }
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                        page === p
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                  disabled={page === pagination.pages}
                  className="w-8 h-8 rounded-lg text-sm font-medium bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <svg className="w-4 h-4 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
