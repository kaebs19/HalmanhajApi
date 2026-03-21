import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import DashboardLayout from './DashboardLayout';

const STAT_CARDS = [
  { key: 'stages', label: 'المراحل', to: '/admin/stages', gradient: 'from-blue-500 to-blue-600', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
  { key: 'tracks', label: 'المسارات', to: '/admin/tracks', gradient: 'from-emerald-500 to-teal-600', icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' },
  { key: 'grades', label: 'الصفوف', to: '/admin/grades', gradient: 'from-violet-500 to-purple-600', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
  { key: 'subjects', label: 'المواد', to: '/admin/subjects', gradient: 'from-amber-500 to-orange-600', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  { key: 'lessons', label: 'الدروس', to: '/admin/lessons', gradient: 'from-rose-500 to-pink-600', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { key: 'exercises', label: 'التمارين', to: '/admin/exercises', gradient: 'from-teal-500 to-emerald-600', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
  { key: 'quizzes', label: 'الاختبارات', to: '/admin/quizzes', gradient: 'from-cyan-500 to-sky-600', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
  { key: 'users', label: 'المستخدمين', to: '/admin/users', gradient: 'from-indigo-500 to-purple-600', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
  { key: 'community_questions', label: 'أسئلة الطلاب', to: '/admin/community', gradient: 'from-orange-500 to-red-600', icon: 'M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z' },
  { key: 'faqs', label: 'سؤال وجواب', to: '/admin/faqs', gradient: 'from-yellow-500 to-amber-600', icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
];

const QUICK_ACTIONS = [
  { label: 'إضافة درس جديد', description: 'أضف درساً مع ملفات PDF ومحتوى تعليمي', to: '/admin/lessons', icon: 'M12 6v6m0 0v6m0-6h6m-6 0H6', color: 'text-blue-600 bg-blue-50 border-blue-100 hover:bg-blue-100' },
  { label: 'إضافة تمرين تفاعلي', description: 'أنشئ تمارين متنوعة مرتبطة بالدروس', to: '/admin/exercises/create', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01', color: 'text-teal-600 bg-teal-50 border-teal-100 hover:bg-teal-100' },
  { label: 'إرسال إشعار', description: 'أرسل إشعار push للطلاب', to: '/admin/notifications', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9', color: 'text-violet-600 bg-violet-50 border-violet-100 hover:bg-violet-100' },
  { label: 'أدوات PDF', description: 'ضغط، دمج، تقسيم، وترتيب صفحات PDF', to: '/admin/pdf-tools', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z', color: 'text-gray-600 bg-gray-50 border-gray-100 hover:bg-gray-100' },
];

const DIFF_LABEL = { easy: 'سهل', medium: 'متوسط', hard: 'صعب' };
const TYPE_LABEL = { true_false: 'صح/خطأ', mcq: 'اختيار', fill_blank: 'فراغ', matching: 'توصيل', ordering: 'ترتيب', classify: 'تصنيف', speed: 'سرعة', read_answer: 'قراءة', image_match: 'صور' };

function Svg({ d, className = 'w-5 h-5' }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d={d} /></svg>;
}

function timeAgo(date) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `منذ ${hrs} ساعة`;
  const days = Math.floor(hrs / 24);
  return `منذ ${days} يوم`;
}

export default function DashboardPage() {
  const { admin } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [enhanced, setEnhanced] = useState(null);
  const [alerts, setAlerts] = useState(null);
  const [weekly, setWeekly] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAlerts, setShowAlerts] = useState(false);

  useEffect(() => {
    Promise.allSettled([
      api.get('/stats'),
      api.get('/stats/enhanced'),
      api.get('/stats/alerts'),
      api.get('/stats/weekly'),
    ]).then(([statsRes, enhancedRes, alertsRes, weeklyRes]) => {
      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
      if (enhancedRes.status === 'fulfilled') setEnhanced(enhancedRes.value.data);
      if (alertsRes.status === 'fulfilled') setAlerts(alertsRes.value.data);
      if (weeklyRes.status === 'fulfilled') setWeekly(weeklyRes.value.data);
      setLoading(false);
    });
  }, []);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'صباح الخير';
    return 'مساء الخير';
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto">
        {/* ترحيب */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-1">
            {greeting()}، {admin?.display_name || admin?.username}
          </h1>
          <p className="text-gray-400 text-sm">إليك نظرة عامة على المحتوى التعليمي</p>
        </div>

        {/* تنبيهات ذكية */}
        {alerts && (() => {
          const alertItems = [];
          if (alerts.pending_reports > 0)
            alertItems.push({ color: 'red', icon: '🚨', text: `${alerts.pending_reports} بلاغ بانتظار المراجعة`, to: '/admin/question-reports' });
          if (alerts.published_no_questions.length > 0)
            alertItems.push({ color: 'red', icon: '⚠️', text: `${alerts.published_no_questions.length} تمرين منشور بدون أسئلة`, to: '/admin/exercise-path' });
          if (alerts.exercises_no_questions.length > 0)
            alertItems.push({ color: 'amber', icon: '📝', text: `${alerts.exercises_no_questions.length} تمرين بدون أسئلة` });
          if (alerts.single_question_exercises.length > 0)
            alertItems.push({ color: 'amber', icon: '1️⃣', text: `${alerts.single_question_exercises.length} تمرين منشور بسؤال واحد فقط` });
          if (alerts.empty_units.length > 0)
            alertItems.push({ color: 'blue', icon: '📚', text: `${alerts.empty_units.length} وحدة فارغة` });
          if (alerts.subjects_no_exercises.length > 0)
            alertItems.push({ color: 'blue', icon: '📖', text: `${alerts.subjects_no_exercises.length} مادة بدون تمارين` });
          if (alerts.low_accuracy_exercises.length > 0)
            alertItems.push({ color: 'violet', icon: '📉', text: `${alerts.low_accuracy_exercises.length} تمرين بنسبة صحيحة أقل من 20%` });

          if (alertItems.length === 0) return null;

          const colorMap = { red: 'bg-red-50 text-red-700 border-red-200', amber: 'bg-amber-50 text-amber-700 border-amber-200', blue: 'bg-blue-50 text-blue-700 border-blue-200', violet: 'bg-violet-50 text-violet-700 border-violet-200' };
          const shown = showAlerts ? alertItems : alertItems.slice(0, 3);

          return (
            <div className="mb-6">
              <div className="flex flex-wrap gap-2">
                {shown.map((a, i) => (
                  <div key={i} onClick={() => a.to && navigate(a.to)}
                    className={`flex items-center gap-2 border rounded-xl px-3 py-2 text-xs font-medium transition-colors ${colorMap[a.color]} ${a.to ? 'cursor-pointer hover:opacity-80' : ''}`}>
                    <span>{a.icon}</span>{a.text}
                  </div>
                ))}
                {alertItems.length > 3 && (
                  <button onClick={() => setShowAlerts(!showAlerts)}
                    className="text-xs text-gray-500 hover:text-gray-700 px-2 py-2 font-medium">
                    {showAlerts ? 'عرض أقل' : `+${alertItems.length - 3} تنبيهات أخرى`}
                  </button>
                )}
              </div>
            </div>
          );
        })()}

        {/* مقارنة أسبوعية */}
        {weekly && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'مستخدمين جدد', value: weekly.this_week.new_users, change: weekly.changes.new_users, color: 'blue' },
              { label: 'نشطين', value: weekly.this_week.active_users, change: weekly.changes.active_users, color: 'emerald' },
              { label: 'تمارين جديدة', value: weekly.this_week.new_exercises, change: weekly.changes.new_exercises, color: 'violet' },
              { label: 'محاولات حل', value: weekly.this_week.attempts, change: weekly.changes.attempts, color: 'amber' },
            ].map(item => (
              <div key={item.label} className="bg-white rounded-xl border border-gray-100 p-4">
                <p className="text-xs text-gray-400 mb-1">{item.label} (هذا الأسبوع)</p>
                <div className="flex items-end gap-2">
                  <span className={`text-2xl font-bold text-${item.color}-600`}>{item.value}</span>
                  {item.change !== 0 && (
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                      item.change > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {item.change > 0 ? '+' : ''}{item.change}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* الإحصائيات الأساسية */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="bg-white rounded-2xl p-5 border animate-pulse">
                <div className="w-10 h-10 bg-gray-200 rounded-xl mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-12 mb-2"></div>
                <div className="h-4 bg-gray-100 rounded w-20"></div>
              </div>
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
            {STAT_CARDS.map((card) => (
              <div
                key={card.key}
                onClick={() => navigate(card.to)}
                className="bg-white rounded-2xl border border-gray-100 p-5 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group"
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.gradient} shadow-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <Svg d={card.icon} className="w-5 h-5 text-white" />
                </div>
                <p className="text-3xl font-bold text-gray-800 mb-0.5">{stats[card.key]}</p>
                <p className="text-sm text-gray-400 font-medium">{card.label}</p>
              </div>
            ))}
          </div>
        ) : null}

        {/* إحصائيات متقدمة */}
        {enhanced && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {/* المستخدمين */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="text-sm font-bold text-gray-500 mb-4 flex items-center gap-2">
                <Svg d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" className="w-4 h-4" />
                المستخدمين
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">جدد اليوم</span>
                  <span className="text-lg font-bold text-blue-600">{enhanced.users.new_today}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">جدد هذا الأسبوع</span>
                  <span className="text-lg font-bold text-emerald-600">{enhanced.users.new_week}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">نشطين اليوم</span>
                  <span className="text-lg font-bold text-violet-600">{enhanced.users.active_today}</span>
                </div>
              </div>
            </div>

            {/* التمارين */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="text-sm font-bold text-gray-500 mb-4 flex items-center gap-2">
                <Svg d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" className="w-4 h-4" />
                التمارين
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">منشورة</span>
                  <span className="text-lg font-bold text-emerald-600">{enhanced.exercises.published}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">مسودة</span>
                  <span className="text-lg font-bold text-amber-600">{enhanced.exercises.unpublished}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">نسبة الإجابات الصحيحة</span>
                  <span className="text-lg font-bold text-blue-600">{enhanced.exercises.overall_accuracy}%</span>
                </div>
              </div>
            </div>

            {/* الإشعارات */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="text-sm font-bold text-gray-500 mb-4 flex items-center gap-2">
                <Svg d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" className="w-4 h-4" />
                الإشعارات
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">أجهزة مسجلة</span>
                  <span className="text-lg font-bold text-blue-600">{enhanced.alerts.fcm_devices}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">مرسلة اليوم</span>
                  <span className="text-lg font-bold text-emerald-600">{enhanced.alerts.notifs_sent_today}</span>
                </div>
                <div className="flex justify-between items-center">
                  <Link to="/admin/notifications" className="text-sm text-blue-500 hover:text-blue-700 font-medium">
                    إرسال إشعار جديد &larr;
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* الأقسام السفلية */}
        {enhanced && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* أنشط الطلاب */}
            {enhanced.top_students.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="text-sm font-bold text-gray-500 mb-4">أنشط الطلاب</h3>
                <div className="space-y-3">
                  {enhanced.top_students.map((s, i) => (
                    <div key={s.id} className="flex items-center gap-3">
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        i === 0 ? 'bg-yellow-100 text-yellow-700' :
                        i === 1 ? 'bg-gray-100 text-gray-600' :
                        i === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-50 text-gray-400'
                      }`}>{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{s.name || 'بدون اسم'}</p>
                        <p className="text-xs text-gray-400">{s.exercises_solved} تمرين محلول</p>
                      </div>
                      <span className="text-sm font-bold text-blue-600">{s.points} XP</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* أصعب التمارين */}
            {enhanced.hardest_exercises.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="text-sm font-bold text-gray-500 mb-4">أصعب التمارين</h3>
                <div className="space-y-3">
                  {enhanced.hardest_exercises.map((ex) => (
                    <Link key={ex.id} to={`/admin/exercises/${ex.id}/edit`} className="flex items-center gap-3 hover:bg-gray-50 rounded-lg p-1 -m-1 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{ex.title}</p>
                        <p className="text-xs text-gray-400">
                          {TYPE_LABEL[ex.type] || ex.type} · {DIFF_LABEL[ex.difficulty] || ex.difficulty} · {ex.total_attempts} محاولة
                        </p>
                      </div>
                      <span className={`text-sm font-bold ${ex.accuracy < 30 ? 'text-red-600' : ex.accuracy < 60 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {ex.accuracy}%
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* آخر التمارين المضافة */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="text-sm font-bold text-gray-500 mb-4">آخر التمارين المضافة</h3>
              {enhanced.recent_exercises.length === 0 ? (
                <p className="text-sm text-gray-400">لا توجد تمارين بعد</p>
              ) : (
                <div className="space-y-3">
                  {enhanced.recent_exercises.map((ex) => (
                    <Link key={ex.id} to={`/admin/exercises/${ex.id}/edit`} className="flex items-center gap-3 hover:bg-gray-50 rounded-lg p-1 -m-1 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{ex.title}</p>
                        <p className="text-xs text-gray-400">{TYPE_LABEL[ex.type] || ex.type} · {timeAgo(ex.created_at)}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ex.is_published ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {ex.is_published ? 'منشور' : 'مسودة'}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* آخر المستخدمين المسجلين */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="text-sm font-bold text-gray-500 mb-4">آخر المستخدمين المسجلين</h3>
              {enhanced.recent_users.length === 0 ? (
                <p className="text-sm text-gray-400">لا يوجد مستخدمين بعد</p>
              ) : (
                <div className="space-y-3">
                  {enhanced.recent_users.map((u) => (
                    <div key={u.id} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold">
                        {(u.name || u.email || '?')[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{u.name || 'بدون اسم'}</p>
                        <p className="text-xs text-gray-400">{u.email}</p>
                      </div>
                      <span className="text-xs text-gray-400">{timeAgo(u.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* إجراءات سريعة */}
        <div>
          <h2 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
            <Svg d="M13 10V3L4 14h7v7l9-11h-7z" className="w-5 h-5 text-gray-400" />
            إجراءات سريعة
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {QUICK_ACTIONS.map((action) => (
              <div
                key={action.label}
                onClick={() => navigate(action.to)}
                className={`rounded-2xl border p-5 cursor-pointer transition-all duration-200 ${action.color}`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/80 flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Svg d={action.icon} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm mb-1">{action.label}</h3>
                    <p className="text-xs opacity-70 leading-relaxed">{action.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
