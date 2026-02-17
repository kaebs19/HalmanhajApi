import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import DashboardLayout from './DashboardLayout';
import { Alert, Input } from '../components/ui';

export default function UsersManagePage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sort, setSort] = useState('latest');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

  // تفاصيل المستخدم
  const [expandedId, setExpandedId] = useState(null);
  const [expandedData, setExpandedData] = useState(null);
  const [expandLoading, setExpandLoading] = useState(false);

  // نافذة الحظر
  const [banModal, setBanModal] = useState(null);
  const [banReason, setBanReason] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/admin/users?page=${page}&sort=${sort}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (filter === 'active') url += '&status=active';
      if (filter === 'banned') url += '&status=banned';
      const res = await api.get(url);
      setUsers(res.data.users || res.data);
      if (res.data.pagination) setPagination(res.data.pagination);
    } catch {
      setError('خطأ في تحميل المستخدمين');
    } finally {
      setLoading(false);
    }
  }, [page, sort, search, filter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const fetchUserDetail = async (id) => {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedData(null);
      return;
    }
    setExpandedId(id);
    setExpandLoading(true);
    try {
      const res = await api.get(`/admin/users/${id}`);
      setExpandedData(res.data);
    } catch {
      setError('خطأ في تحميل بيانات المستخدم');
    } finally {
      setExpandLoading(false);
    }
  };

  const handleBan = async (userId) => {
    try {
      await api.put(`/admin/users/${userId}/ban`, { reason: banReason });
      setUsers(users.map(u => u.id === userId ? { ...u, is_banned: true, ban_reason: banReason } : u));
      setBanModal(null);
      setBanReason('');
      setSuccess('تم حظر المستخدم');
      setTimeout(() => setSuccess(''), 2000);
    } catch {
      setError('خطأ في حظر المستخدم');
    }
  };

  const handleUnban = async (userId) => {
    try {
      await api.put(`/admin/users/${userId}/ban`, { unban: true });
      setUsers(users.map(u => u.id === userId ? { ...u, is_banned: false, ban_reason: null } : u));
      setSuccess('تم رفع الحظر عن المستخدم');
      setTimeout(() => setSuccess(''), 2000);
    } catch {
      setError('خطأ في رفع الحظر');
    }
  };

  const toggleActive = async (userId, currentStatus) => {
    try {
      await api.put(`/admin/users/${userId}/toggle-active`);
      setUsers(users.map(u => u.id === userId ? { ...u, is_active: !currentStatus } : u));
      setSuccess(currentStatus ? 'تم تعطيل الحساب' : 'تم تفعيل الحساب');
      setTimeout(() => setSuccess(''), 2000);
    } catch {
      setError('خطأ في تحديث الحالة');
    }
  };

  const deleteUser = async (userId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المستخدم نهائياً؟ هذا الإجراء لا يمكن التراجع عنه.')) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      setUsers(users.filter(u => u.id !== userId));
      if (expandedId === userId) { setExpandedId(null); setExpandedData(null); }
      setSuccess('تم حذف المستخدم');
      setTimeout(() => setSuccess(''), 2000);
    } catch {
      setError('خطأ في حذف المستخدم');
    }
  };

  const getPointsBadge = (points) => {
    if (points >= 100) return { label: 'خبير', color: 'bg-amber-100 text-amber-700', ring: 'ring-amber-200' };
    if (points >= 50) return { label: 'متميز', color: 'bg-blue-100 text-blue-700', ring: 'ring-blue-200' };
    if (points >= 20) return { label: 'نشيط', color: 'bg-emerald-100 text-emerald-700', ring: 'ring-emerald-200' };
    return null;
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const timeAgo = (date) => {
    if (!date) return '-';
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* الرأس */}
        <div>
          <h1 className="text-xl font-bold text-gray-800">إدارة المستخدمين</h1>
          <p className="text-sm text-gray-500 mt-0.5">{pagination.total || users.length} مستخدم مسجل</p>
        </div>

        {error && <Alert>{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        {/* البحث والفلاتر */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
              <div className="relative">
                <Input
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  placeholder="ابحث بالاسم أو البريد الإلكتروني..."
                  className="pr-4 pl-10"
                />
                <button type="submit" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              </div>
            </form>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* ترتيب */}
            <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-0.5">
              {[
                { key: 'latest', label: 'الأحدث' },
                { key: 'points', label: 'النقاط' },
                { key: 'active', label: 'الأنشط' },
                { key: 'name', label: 'الاسم' },
              ].map(s => (
                <button
                  key={s.key}
                  onClick={() => { setSort(s.key); setPage(1); }}
                  className={`text-xs px-3 py-1.5 rounded-md transition-all ${sort === s.key ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* فلتر الحالة */}
            <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-0.5">
              {[
                { key: 'all', label: 'الكل' },
                { key: 'active', label: 'نشط' },
                { key: 'banned', label: 'محظور' },
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
        </div>

        {/* قائمة المستخدمين */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-sm">لا يوجد مستخدمون</p>
          </div>
        ) : (
          <div className="space-y-3">
            {users.map(u => (
              <div key={u.id} className={`bg-white rounded-xl border overflow-hidden transition-all ${u.is_banned ? 'border-red-200 bg-red-50/20' : 'border-gray-200'}`}>
                {/* بطاقة المستخدم */}
                <div className="p-4">
                  <div className="flex items-center gap-4">
                    {/* الأفاتار */}
                    <div className="flex-shrink-0">
                      <div className={`w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-lg font-bold shadow-sm ${u.is_banned ? 'opacity-50' : ''}`}>
                        {u.name?.charAt(0) || '?'}
                      </div>
                    </div>

                    {/* المعلومات الأساسية */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-sm font-bold text-gray-800">{u.name}</h3>
                        {u.role && u.role !== 'user' && (
                          <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold">{u.role}</span>
                        )}
                        {u.is_banned && (
                          <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">محظور</span>
                        )}
                        {u.is_active === false && !u.is_banned && (
                          <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">معطل</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 truncate">{u.email}</p>
                    </div>

                    {/* إحصائيات */}
                    <div className="hidden md:flex items-center gap-4 flex-shrink-0">
                      {/* النقاط */}
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-0.5">
                          <svg className="w-3.5 h-3.5 text-yellow-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                          <span className="text-sm font-bold text-gray-700">{u.points || 0}</span>
                        </div>
                        {getPointsBadge(u.points || 0) && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${getPointsBadge(u.points || 0).color}`}>
                            {getPointsBadge(u.points || 0).label}
                          </span>
                        )}
                      </div>

                      {/* أسئلة */}
                      <div className="text-center px-3 border-r border-gray-100">
                        <p className="text-sm font-bold text-gray-700">{u.questions_count || 0}</p>
                        <p className="text-[10px] text-gray-400">سؤال</p>
                      </div>

                      {/* إجابات */}
                      <div className="text-center px-3 border-r border-gray-100">
                        <p className="text-sm font-bold text-gray-700">{u.answers_count || 0}</p>
                        <p className="text-[10px] text-gray-400">إجابة</p>
                      </div>

                      {/* أفضل إجابات */}
                      <div className="text-center px-3 border-r border-gray-100">
                        <p className="text-sm font-bold text-emerald-600">{u.best_answers_count || 0}</p>
                        <p className="text-[10px] text-gray-400">أفضل إجابة</p>
                      </div>

                      {/* تاريخ التسجيل */}
                      <div className="text-center px-3 border-r border-gray-100">
                        <p className="text-xs text-gray-500">{formatDate(u.created_at)}</p>
                        <p className="text-[10px] text-gray-400">تسجيل</p>
                      </div>

                      {/* آخر نشاط */}
                      <div className="text-center">
                        <p className="text-xs text-gray-500">{timeAgo(u.last_active_at || u.updated_at)}</p>
                        <p className="text-[10px] text-gray-400">آخر نشاط</p>
                      </div>
                    </div>

                    {/* أزرار الإجراءات */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => fetchUserDetail(u.id)}
                        title="عرض التفاصيل"
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <svg className={`w-4 h-4 transition-transform ${expandedId === u.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => toggleActive(u.id, u.is_active !== false)}
                        title={u.is_active !== false ? 'تعطيل' : 'تفعيل'}
                        className={`p-2 rounded-lg transition-colors ${u.is_active !== false ? 'text-emerald-500 hover:bg-emerald-50' : 'text-gray-300 hover:bg-gray-50'}`}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                      {u.is_banned ? (
                        <button
                          onClick={() => handleUnban(u.id)}
                          title="رفع الحظر"
                          className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                          </svg>
                        </button>
                      ) : (
                        <button
                          onClick={() => { setBanModal(u); setBanReason(''); }}
                          title="حظر"
                          className="p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={() => deleteUser(u.id)}
                        title="حذف المستخدم"
                        className="p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* إحصائيات للموبايل */}
                  <div className="md:hidden flex items-center gap-3 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400 flex-wrap">
                    <span className="flex items-center gap-1">
                      <svg className="w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                      {u.points || 0} نقطة
                    </span>
                    {getPointsBadge(u.points || 0) && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${getPointsBadge(u.points || 0).color}`}>
                        {getPointsBadge(u.points || 0).label}
                      </span>
                    )}
                    <span>{u.questions_count || 0} سؤال</span>
                    <span>{u.answers_count || 0} إجابة</span>
                    <span className="text-emerald-500">{u.best_answers_count || 0} أفضل</span>
                    <span className="mr-auto">{formatDate(u.created_at)}</span>
                  </div>
                </div>

                {/* التفاصيل الموسعة */}
                {expandedId === u.id && (
                  <div className="border-t border-gray-100 bg-gray-50/50 p-5">
                    {expandLoading ? (
                      <div className="flex justify-center py-6">
                        <div className="w-6 h-6 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                      </div>
                    ) : expandedData ? (
                      <div className="space-y-5">
                        {/* الملف الشخصي */}
                        <div className="bg-white rounded-lg border border-gray-200 p-4">
                          <p className="text-xs font-bold text-gray-500 mb-3">الملف الشخصي</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-xs text-gray-400">الاسم</span>
                              <p className="font-medium text-gray-700">{expandedData.name || expandedData.user?.name}</p>
                            </div>
                            <div>
                              <span className="text-xs text-gray-400">البريد الإلكتروني</span>
                              <p className="font-medium text-gray-700">{expandedData.email || expandedData.user?.email}</p>
                            </div>
                            <div>
                              <span className="text-xs text-gray-400">النقاط</span>
                              <p className="font-medium text-gray-700 flex items-center gap-1">
                                <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                                {expandedData.points || expandedData.user?.points || 0}
                                {getPointsBadge(expandedData.points || expandedData.user?.points || 0) && (
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold mr-1 ${getPointsBadge(expandedData.points || expandedData.user?.points || 0).color}`}>
                                    {getPointsBadge(expandedData.points || expandedData.user?.points || 0).label}
                                  </span>
                                )}
                              </p>
                            </div>
                            {(expandedData.bio || expandedData.user?.bio) && (
                              <div className="sm:col-span-2 md:col-span-3">
                                <span className="text-xs text-gray-400">النبذة</span>
                                <p className="font-medium text-gray-700">{expandedData.bio || expandedData.user?.bio}</p>
                              </div>
                            )}
                            {(expandedData.stage_name || expandedData.user?.stage_name) && (
                              <div>
                                <span className="text-xs text-gray-400">المرحلة</span>
                                <p className="font-medium text-gray-700">{expandedData.stage_name || expandedData.user?.stage_name}</p>
                              </div>
                            )}
                            {(expandedData.grade_name || expandedData.user?.grade_name) && (
                              <div>
                                <span className="text-xs text-gray-400">الصف</span>
                                <p className="font-medium text-gray-700">{expandedData.grade_name || expandedData.user?.grade_name}</p>
                              </div>
                            )}
                            <div>
                              <span className="text-xs text-gray-400">تاريخ التسجيل</span>
                              <p className="font-medium text-gray-700">{formatDate(expandedData.created_at || expandedData.user?.created_at)}</p>
                            </div>
                            {u.is_banned && u.ban_reason && (
                              <div className="sm:col-span-2 md:col-span-3">
                                <span className="text-xs text-red-500">سبب الحظر</span>
                                <p className="font-medium text-red-600">{u.ban_reason}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* الإحصائيات */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
                            <p className="text-lg font-bold text-blue-600">{expandedData.questions_count || expandedData.user?.questions_count || u.questions_count || 0}</p>
                            <p className="text-xs text-gray-400">أسئلة</p>
                          </div>
                          <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
                            <p className="text-lg font-bold text-violet-600">{expandedData.answers_count || expandedData.user?.answers_count || u.answers_count || 0}</p>
                            <p className="text-xs text-gray-400">إجابات</p>
                          </div>
                          <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
                            <p className="text-lg font-bold text-emerald-600">{expandedData.best_answers_count || expandedData.user?.best_answers_count || u.best_answers_count || 0}</p>
                            <p className="text-xs text-gray-400">أفضل إجابة</p>
                          </div>
                          <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
                            <p className="text-lg font-bold text-amber-600 flex items-center justify-center gap-1">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                              {expandedData.points || expandedData.user?.points || u.points || 0}
                            </p>
                            <p className="text-xs text-gray-400">نقطة</p>
                          </div>
                        </div>

                        {/* آخر الأسئلة */}
                        {(expandedData.recent_questions || expandedData.questions || []).length > 0 && (
                          <div>
                            <p className="text-xs font-bold text-gray-500 mb-2">آخر الأسئلة</p>
                            <div className="space-y-2">
                              {(expandedData.recent_questions || expandedData.questions || []).slice(0, 5).map(q => (
                                <div key={q.id} className="bg-white rounded-lg border border-gray-200 p-3 flex items-center justify-between">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-700 truncate">{q.title}</p>
                                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                                      <span>{q.answers_count || 0} إجابة</span>
                                      <span>{q.views || 0} مشاهدة</span>
                                      <span>{timeAgo(q.created_at)}</span>
                                    </div>
                                  </div>
                                  {q.best_answer_id && (
                                    <span className="text-[10px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded flex-shrink-0 mr-2">محلول</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* آخر الإجابات */}
                        {(expandedData.recent_answers || expandedData.answers || []).length > 0 && (
                          <div>
                            <p className="text-xs font-bold text-gray-500 mb-2">آخر الإجابات</p>
                            <div className="space-y-2">
                              {(expandedData.recent_answers || expandedData.answers || []).slice(0, 5).map(a => (
                                <div key={a.id} className={`bg-white rounded-lg border p-3 ${a.is_best ? 'border-emerald-200' : 'border-gray-200'}`}>
                                  <p className="text-xs text-gray-400 mb-1">{a.question_title || 'سؤال'}</p>
                                  <p className="text-sm text-gray-700 line-clamp-2">{a.body}</p>
                                  <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                                    <span>{(a.upvotes || 0) - (a.downvotes || 0)} صوت</span>
                                    {a.is_best && (
                                      <span className="text-emerald-600 font-bold flex items-center gap-0.5">
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                        أفضل إجابة
                                      </span>
                                    )}
                                    <span>{timeAgo(a.created_at)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
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

      {/* نافذة الحظر */}
      {banModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">حظر المستخدم</h3>
                <p className="text-sm text-gray-500">{banModal.name}</p>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">سبب الحظر</label>
              <textarea
                value={banReason}
                onChange={e => setBanReason(e.target.value)}
                placeholder="اكتب سبب حظر هذا المستخدم..."
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400 resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleBan(banModal.id)}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-red-700 transition-colors"
              >
                تأكيد الحظر
              </button>
              <button
                onClick={() => { setBanModal(null); setBanReason(''); }}
                className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
