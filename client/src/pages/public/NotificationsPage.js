import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE } from '../../lib/api';
import { useUserAuth } from '../../context/UserAuthContext';
import SEO from '../../components/public/SEO';

const TYPE_ICONS = {
  answer_reply: '💬',
  new_answer: '💬',
  best_answer: '⭐',
  exercise_badge: '🏆',
  badge_earned: '🏆',
  streak_milestone: '🔥',
  new_exercise: '🧩',
  xp_earned: '🧩',
  leaderboard: '📊',
};

function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'الآن';
  if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
  if (diffHrs < 24) return diffHrs === 1 ? 'منذ ساعة' : `منذ ${diffHrs} ساعات`;
  if (diffDays === 1) return 'أمس';
  if (diffDays < 7) return `منذ ${diffDays} أيام`;
  return date.toLocaleDateString('ar-SA');
}

export default function NotificationsPage() {
  const { user, token, loading: authLoading } = useUserAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // جلب الإشعارات
  useEffect(() => {
    if (authLoading) return;
    if (!user || !token) {
      setLoading(false);
      return;
    }
    fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, token]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  // تعليم إشعار كمقروء
  const markAsRead = async (id) => {
    try {
      await fetch(`${API_BASE}/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {}
  };

  // تعليم الكل كمقروء
  const markAllRead = async () => {
    try {
      await fetch(`${API_BASE}/notifications/read-all`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {}
  };

  // ─── حالة عدم تسجيل الدخول ───
  if (!authLoading && !user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <SEO title="الإشعارات" description="سجّل دخول لعرض إشعاراتك" />
        <div className="text-6xl mb-4">🔔</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">الإشعارات</h1>
        <p className="text-gray-500 mb-6">سجّل دخول لعرض إشعاراتك</p>
        <Link
          to="/auth/login"
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition"
        >
          تسجيل الدخول
        </Link>
      </div>
    );
  }

  // ─── تحميل ───
  if (loading || authLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <SEO title="الإشعارات" />
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-gray-800 mb-2">🔔 الإشعارات</h1>
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <SEO title="الإشعارات" description="إشعاراتك وتنبيهاتك" />

      {/* العنوان */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-black text-gray-800">🔔 الإشعارات</h1>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium transition"
          >
            تعليم الكل مقروء ✓
          </button>
        )}
      </div>

      {/* قائمة الإشعارات */}
      {notifications.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">🔔</div>
          <p className="text-gray-500 text-lg">لا توجد إشعارات بعد</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => {
            const icon = TYPE_ICONS[n.type] || '🔔';
            return (
              <button
                key={n.id}
                onClick={() => !n.is_read && markAsRead(n.id)}
                className={`w-full text-right rounded-xl border p-4 transition-all ${
                  n.is_read
                    ? 'bg-white border-gray-200 opacity-70'
                    : 'bg-blue-50 border-blue-200 hover:bg-blue-100'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* أيقونة + نقطة */}
                  <div className="relative shrink-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                      n.is_read ? 'bg-gray-100' : 'bg-blue-100'
                    }`}>
                      {icon}
                    </div>
                    {!n.is_read && (
                      <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-blue-500 rounded-full border-2 border-white" />
                    )}
                  </div>

                  {/* المحتوى */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-relaxed ${
                      n.is_read ? 'text-gray-600' : 'text-gray-800 font-bold'
                    }`}>
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{n.body}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
