import { useState, useEffect } from 'react';
import api from '../lib/api';
import DashboardLayout from './DashboardLayout';
import { useToast } from '../components/ui/Toast';

export default function NotificationsManagePage() {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [target, setTarget] = useState('all');
  const [userSearch, setUserSearch] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [sending, setSending] = useState(false);
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyPage, setHistoryPage] = useState(1);

  // جلب الإحصائيات
  useEffect(() => {
    api.get('/push/admin/stats').then(r => setStats(r.data)).catch(() => {});
  }, []);

  // بحث المستخدمين
  useEffect(() => {
    if (target !== 'specific' || userSearch.length < 2) { setUsers([]); return; }
    const timer = setTimeout(() => {
      api.get('/admin/users', { params: { search: userSearch, limit: 10 } })
        .then(r => setUsers(r.data.users || r.data || []))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [userSearch, target]);

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error('العنوان والنص مطلوبان');
      return;
    }
    if (target === 'specific' && selectedUsers.length === 0) {
      toast.error('اختر مستخدم واحد على الأقل');
      return;
    }

    setSending(true);
    try {
      const payload = { title, body, target };
      if (target === 'specific') {
        payload.user_ids = selectedUsers.map(u => u.id);
      }
      const res = await api.post('/push/admin/send', payload);
      toast.success(res.data.message || 'تم الإرسال');
      setTitle('');
      setBody('');
      setSelectedUsers([]);
      // تحديث الإحصائيات
      api.get('/push/admin/stats').then(r => setStats(r.data)).catch(() => {});
    } catch (err) {
      toast.error(err.response?.data?.message || 'خطأ في الإرسال');
    } finally {
      setSending(false);
    }
  };

  const toggleUser = (user) => {
    setSelectedUsers(prev => {
      const exists = prev.find(u => u.id === user.id);
      if (exists) return prev.filter(u => u.id !== user.id);
      return [...prev, user];
    });
  };

  // قوالب جاهزة
  const templates = [
    { title: '📚 وقت المراجعة!', body: '5 دقائق تكفي لتتقدم اليوم' },
    { title: '🎯 لا تنسى تحدي اليوم!', body: 'جرب حظك وحل التحدي الآن' },
    { title: '📢 تحديث جديد!', body: 'تم إضافة دروس وتمارين جديدة' },
    { title: '🏆 مبروك!', body: 'أنت ضمن أفضل الطلاب هذا الأسبوع' },
    { title: '👋 وحشتنا!', body: 'تعال نكمل من وين وقفنا' },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">إرسال الإشعارات</h1>

        {/* إحصائيات */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{stats.total_users_with_tokens}</p>
              <p className="text-xs text-gray-400 mt-1">مستخدم مسجل</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
              <p className="text-2xl font-bold text-emerald-600">{stats.total_devices}</p>
              <p className="text-xs text-gray-400 mt-1">جهاز مسجل</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
              <p className="text-2xl font-bold text-violet-600">{stats.sent_today}</p>
              <p className="text-xs text-gray-400 mt-1">مرسلة اليوم</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
              <p className="text-2xl font-bold text-amber-600">{stats.total_sent}</p>
              <p className="text-xs text-gray-400 mt-1">إجمالي المرسلة</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          {/* قوالب جاهزة */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-600 mb-2">قوالب جاهزة</label>
            <div className="flex flex-wrap gap-2">
              {templates.map((t, i) => (
                <button
                  key={i}
                  onClick={() => { setTitle(t.title); setBody(t.body); }}
                  className="text-xs bg-gray-50 hover:bg-blue-50 hover:text-blue-700 text-gray-600 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
                >
                  {t.title}
                </button>
              ))}
            </div>
          </div>

          {/* العنوان */}
          <div className="mb-4">
            <label className="block text-sm font-bold text-gray-600 mb-2">عنوان الإشعار</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="مثال: تحديث جديد!"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
            />
          </div>

          {/* النص */}
          <div className="mb-4">
            <label className="block text-sm font-bold text-gray-600 mb-2">نص الإشعار</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="مثال: تم إضافة دروس جديدة في الرياضيات"
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none resize-none"
            />
          </div>

          {/* الهدف */}
          <div className="mb-4">
            <label className="block text-sm font-bold text-gray-600 mb-2">إرسال إلى</label>
            <div className="flex gap-3">
              <button
                onClick={() => setTarget('all')}
                className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-all ${
                  target === 'all'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                }`}
              >
                جميع المستخدمين
              </button>
              <button
                onClick={() => setTarget('specific')}
                className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-all ${
                  target === 'specific'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                }`}
              >
                مستخدمين محددين
              </button>
            </div>
          </div>

          {/* بحث المستخدمين */}
          {target === 'specific' && (
            <div className="mb-4">
              <input
                type="text"
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                placeholder="ابحث بالاسم أو البريد..."
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none mb-3"
              />

              {/* المستخدمين المحددين */}
              {selectedUsers.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {selectedUsers.map(u => (
                    <span key={u.id} className="bg-blue-100 text-blue-700 text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5">
                      {u.name || u.email}
                      <button onClick={() => toggleUser(u)} className="hover:text-red-600">&times;</button>
                    </span>
                  ))}
                </div>
              )}

              {/* نتائج البحث */}
              {users.length > 0 && (
                <div className="border border-gray-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                  {users.map(u => (
                    <button
                      key={u.id}
                      onClick={() => toggleUser(u)}
                      className={`w-full text-right px-4 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-b-0 flex items-center justify-between ${
                        selectedUsers.find(s => s.id === u.id) ? 'bg-blue-50' : ''
                      }`}
                    >
                      <span>{u.name || 'بدون اسم'} <span className="text-gray-400 text-xs">{u.email}</span></span>
                      {selectedUsers.find(s => s.id === u.id) && (
                        <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* معاينة */}
          {(title || body) && (
            <div className="mb-6 bg-gray-50 rounded-xl p-4 border border-gray-200">
              <p className="text-xs text-gray-400 mb-2">معاينة الإشعار</p>
              <div className="bg-white rounded-lg p-3 shadow-sm border">
                <p className="font-bold text-sm text-gray-800">{title || 'العنوان'}</p>
                <p className="text-xs text-gray-500 mt-1">{body || 'نص الإشعار'}</p>
              </div>
            </div>
          )}

          {/* زر الإرسال */}
          <button
            onClick={handleSend}
            disabled={sending || !title.trim() || !body.trim()}
            className="w-full bg-gradient-to-l from-blue-600 to-blue-700 text-white py-3.5 rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-blue-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {sending ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                جاري الإرسال...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                إرسال الإشعار {target === 'all' ? 'للجميع' : `لـ ${selectedUsers.length} مستخدم`}
              </>
            )}
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
