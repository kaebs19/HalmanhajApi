import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE } from '../../lib/api';
import { useUserAuth } from '../../context/UserAuthContext';
import SEO from '../../components/public/SEO';

export default function FaqPage() {
  const { user } = useUserAuth();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('latest');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

  // فلاتر
  const [stages, setStages] = useState([]);
  const [filterStage, setFilterStage] = useState('');
  const [stageGrades, setStageGrades] = useState([]);
  const [filterGrade, setFilterGrade] = useState('');
  const [openFaqId, setOpenFaqId] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/public/navigation`)
      .then(res => res.json())
      .then(data => setStages(data.stages || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (filterStage) {
      const stage = stages.find(s => s.id === filterStage);
      setStageGrades(stage?.grades || []);
    } else {
      setStageGrades([]);
      setFilterGrade('');
    }
  }, [filterStage, stages]);

  const fetchQuestions = useCallback(() => {
    setLoading(true);
    let url = `${API_BASE}/community/questions?sort=${sort}&page=${pagination.page}`;
    if (filterStage) url += `&stage_id=${filterStage}`;
    if (filterGrade) url += `&grade_id=${filterGrade}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;

    fetch(url)
      .then(res => res.json())
      .then(data => {
        setQuestions(data.questions || []);
        setPagination(prev => ({ ...prev, ...data.pagination }));
      })
      .catch(() => setQuestions([]))
      .finally(() => setLoading(false));
  }, [sort, filterStage, filterGrade, search, pagination.page]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    setPagination(prev => ({ ...prev, page: 1 }));
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

  const getSemesterLabel = (val) => {
    if (val === 1) return 'الفصل الأول';
    if (val === 2) return 'الفصل الثاني';
    return null;
  };

  const getPointsBadge = (points) => {
    if (points >= 100) return { label: 'خبير', color: 'bg-amber-100 text-amber-700' };
    if (points >= 50) return { label: 'متميز', color: 'bg-blue-100 text-blue-700' };
    if (points >= 20) return { label: 'نشيط', color: 'bg-emerald-100 text-emerald-700' };
    return null;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <SEO title="سؤال وجواب" description="اسأل وأجب عن أسئلة المنهج الدراسي" structuredData={{
        '@context': 'https://schema.org',
        '@type': 'QAPage',
        name: 'سؤال وجواب',
        description: 'مجتمع أسئلة وأجوبة حول المنهج الدراسي'
      }} />

      {/* العنوان */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">سؤال وجواب</h1>
          <p className="text-sm text-gray-500">أسئلة وأجوبة حول المناهج الدراسية</p>
        </div>
        {user && (
          <Link
            to="/faq/ask"
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            اطرح سؤالاً
          </Link>
        )}
      </div>

      {/* البحث */}
      <form onSubmit={handleSearch} className="mb-4">
        <div className="relative">
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="ابحث في الأسئلة..."
            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
          />
          <button type="submit" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </div>
      </form>

      {/* ترتيب + فلاتر */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200 p-0.5">
          {[
            { key: 'latest', label: 'الأحدث' },
            { key: 'popular', label: 'الأكثر مشاهدة' },
            { key: 'unanswered', label: 'بدون إجابة' },
            { key: 'solved', label: 'تم حلها' },
          ].map(s => (
            <button
              key={s.key}
              onClick={() => { setSort(s.key); setPagination(prev => ({ ...prev, page: 1 })); }}
              className={`text-xs px-3 py-1.5 rounded-md transition-all ${sort === s.key ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterStage}
            onChange={e => { setFilterStage(e.target.value); setFilterGrade(''); setPagination(prev => ({ ...prev, page: 1 })); }}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
          >
            <option value="">كل المراحل</option>
            {stages.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {stageGrades.length > 0 && (
            <select
              value={filterGrade}
              onChange={e => { setFilterGrade(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
            >
              <option value="">كل الصفوف</option>
              {stageGrades.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* رسالة للمستخدم غير المسجل */}
      {!user && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 flex items-center gap-3">
          <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-blue-700">
            <Link to="/auth/login" className="font-bold hover:underline">سجل دخولك</Link> لطرح سؤال أو الإجابة على أسئلة الطلاب الآخرين
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
      ) : questions.length > 0 ? (
        <div className="space-y-3">
          {questions.map(q => (
            q.question_type === 'admin' ? (
              <div key={`faq-${q.id}`} className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                <button onClick={() => setOpenFaqId(openFaqId === `faq-${q.id}` ? null : `faq-${q.id}`)} className="w-full text-right px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                          إجابة رسمية
                        </span>
                        <span className="text-sm font-bold text-gray-800 leading-relaxed">{q.title}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {q.grade_name && (
                          <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                            {q.stage_name ? `${q.stage_name} - ` : ''}{q.grade_name}
                          </span>
                        )}
                        {q.subject_name && (
                          <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-medium">{q.subject_name}</span>
                        )}
                        {getSemesterLabel(q.semester) && (
                          <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-medium">{getSemesterLabel(q.semester)}</span>
                        )}
                      </div>
                    </div>
                    <svg className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 mt-0.5 ${openFaqId === `faq-${q.id}` ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
                {openFaqId === `faq-${q.id}` && (
                  <div className="px-5 pb-5">
                    <div className="bg-gradient-to-br from-indigo-50/50 to-blue-50/30 rounded-xl p-4 border border-indigo-100/50">
                      <div className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{q.body}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                key={q.id}
                to={`/faq/question/${q.id}`}
                className="block bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md hover:border-gray-200 transition-all group"
              >
                <div className="flex gap-4">
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center text-xs font-bold ${
                      q.best_answer_id
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                        : q.answers_count > 0
                        ? 'bg-blue-50 text-blue-600 border border-blue-200'
                        : 'bg-gray-50 text-gray-400 border border-gray-200'
                    }`}>
                      <span className="text-lg leading-none">{q.answers_count}</span>
                      <span className="text-[9px] mt-0.5">إجابة</span>
                    </div>
                    <span className="text-[10px] text-gray-400">{q.views} مشاهدة</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                        </svg>
                        سؤال طالب
                      </span>
                      {q.best_answer_id && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          تم الحل
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-gray-800 mb-1.5 group-hover:text-blue-600 transition-colors line-clamp-2">
                      {q.title}
                    </h3>

                    {q.body && (
                      <p className="text-xs text-gray-500 line-clamp-1 mb-2">{q.body}</p>
                    )}

                    {q.image_url && (
                      <div className="mb-2">
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          يحتوي صورة
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-3 flex-wrap">
                      {q.stage_name && (
                        <span className="text-[10px] bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full font-medium">{q.stage_name}</span>
                      )}
                      {q.grade_name && (
                        <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">{q.grade_name}</span>
                      )}
                      {q.subject_name && (
                        <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-medium">{q.subject_name}</span>
                      )}

                      <span className="text-[10px] text-gray-400 mr-auto flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-[9px] font-bold text-white">
                          {q.user_name?.charAt(0)}
                        </span>
                        <span className="font-medium">{q.user_name}</span>
                        {q.user_points > 0 && (
                          <span className="text-[9px] bg-yellow-50 text-yellow-600 px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                            {q.user_points}
                          </span>
                        )}
                        {getPointsBadge(q.user_points) && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${getPointsBadge(q.user_points).color}`}>
                            {getPointsBadge(q.user_points).label}
                          </span>
                        )}
                        <span className="text-gray-300">·</span>
                        <span>{timeAgo(q.created_at)}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            )
          ))}

          {pagination.pages > 1 && (
            <div className="flex justify-center gap-2 pt-4">
              {Array.from({ length: Math.min(pagination.pages, 5) }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setPagination(prev => ({ ...prev, page: p }))}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                    pagination.page === p
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-16 text-gray-400">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm mb-2">لا توجد أسئلة بعد</p>
          {user && (
            <Link to="/faq/ask" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              كن أول من يطرح سؤالاً!
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
