import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import DashboardLayout from './DashboardLayout';

const STAT_CARDS = [
  {
    key: 'stages',
    label: 'المراحل',
    to: '/admin/stages',
    gradient: 'from-blue-500 to-blue-600',
    shadowColor: 'shadow-blue-500/25',
    icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'
  },
  {
    key: 'tracks',
    label: 'المسارات',
    to: '/admin/tracks',
    gradient: 'from-emerald-500 to-teal-600',
    shadowColor: 'shadow-emerald-500/25',
    icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7'
  },
  {
    key: 'grades',
    label: 'الصفوف',
    to: '/admin/grades',
    gradient: 'from-violet-500 to-purple-600',
    shadowColor: 'shadow-violet-500/25',
    icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z'
  },
  {
    key: 'subjects',
    label: 'المواد',
    to: '/admin/subjects',
    gradient: 'from-amber-500 to-orange-600',
    shadowColor: 'shadow-amber-500/25',
    icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253'
  },
  {
    key: 'lessons',
    label: 'الدروس',
    to: '/admin/lessons',
    gradient: 'from-rose-500 to-pink-600',
    shadowColor: 'shadow-rose-500/25',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
  },
  {
    key: 'quizzes',
    label: 'الاختبارات',
    to: '/admin/quizzes',
    gradient: 'from-cyan-500 to-sky-600',
    shadowColor: 'shadow-cyan-500/25',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4'
  },
  {
    key: 'faqs',
    label: 'سؤال وجواب',
    to: '/admin/faqs',
    gradient: 'from-yellow-500 to-amber-600',
    shadowColor: 'shadow-yellow-500/25',
    icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
  },
  {
    key: 'users',
    label: 'المستخدمين',
    to: '/admin/users',
    gradient: 'from-indigo-500 to-purple-600',
    shadowColor: 'shadow-indigo-500/25',
    icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z'
  },
  {
    key: 'community_questions',
    label: 'أسئلة الطلاب',
    to: '/admin/community',
    gradient: 'from-orange-500 to-red-600',
    shadowColor: 'shadow-orange-500/25',
    icon: 'M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z'
  },
  {
    key: 'exercises',
    label: 'التمارين',
    to: '/admin/exercises',
    gradient: 'from-teal-500 to-emerald-600',
    shadowColor: 'shadow-teal-500/25',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01'
  },
];

const QUICK_ACTIONS = [
  {
    label: 'إضافة درس جديد',
    description: 'أضف درساً مع ملفات PDF ومحتوى تعليمي',
    to: '/admin/lessons',
    icon: 'M12 6v6m0 0v6m0-6h6m-6 0H6',
    color: 'text-blue-600 bg-blue-50 border-blue-100 hover:bg-blue-100',
  },
  {
    label: 'إضافة مادة دراسية',
    description: 'أضف مادة جديدة وأربطها بالصفوف والمسارات',
    to: '/admin/subjects',
    icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
    color: 'text-emerald-600 bg-emerald-50 border-emerald-100 hover:bg-emerald-100',
  },
  {
    label: 'أدوات PDF',
    description: 'ضغط، دمج، تقسيم، وترتيب صفحات PDF',
    to: '/admin/pdf-tools',
    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
    color: 'text-violet-600 bg-violet-50 border-violet-100 hover:bg-violet-100',
  },
  {
    label: 'إضافة تمرين تفاعلي',
    description: 'أنشئ تمارين متنوعة مرتبطة بالدروس',
    to: '/admin/exercises/create',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
    color: 'text-teal-600 bg-teal-50 border-teal-100 hover:bg-teal-100',
  },
  {
    label: 'الإعدادات',
    description: 'إدارة الحساب والمعلومات الشخصية',
    to: '/admin/settings',
    icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4',
    color: 'text-gray-600 bg-gray-50 border-gray-100 hover:bg-gray-100',
  },
];

export default function DashboardPage() {
  const { admin } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/stats');
        setStats(res.data);
      } catch {
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
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

        {/* الإحصائيات */}
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
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.gradient} ${card.shadowColor} shadow-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={card.icon} />
                  </svg>
                </div>
                <p className="text-3xl font-bold text-gray-800 mb-0.5">{stats[card.key]}</p>
                <p className="text-sm text-gray-400 font-medium">{card.label}</p>
              </div>
            ))}
          </div>
        ) : null}

        {/* إجراءات سريعة */}
        <div>
          <h2 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
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
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={action.icon} />
                    </svg>
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
