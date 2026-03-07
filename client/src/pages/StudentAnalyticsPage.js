import { useState, useEffect } from 'react';
import api from '../lib/api';
import DashboardLayout from './DashboardLayout';
import { Card, LoadingState } from '../components/ui';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart,
} from 'recharts';

// ═══════════════════════════════════════
// ثوابت
// ═══════════════════════════════════════
const BADGE_LABELS = {
  streak_3: '🔥 3 أيام متتالية',
  streak_7: '⚡ أسبوع كامل',
  streak_30: '🏆 شهر كامل',
  first_exercise: '🧩 أول تمرين',
  points_100: '💯 100 نقطة',
  points_500: '🌟 500 نقطة',
  accuracy_90: '🎯 دقة 90%',
};

const BADGE_COLORS = {
  streak_3: 'bg-orange-100 text-orange-700',
  streak_7: 'bg-yellow-100 text-yellow-700',
  streak_30: 'bg-amber-100 text-amber-700',
  first_exercise: 'bg-blue-100 text-blue-700',
  points_100: 'bg-emerald-100 text-emerald-700',
  points_500: 'bg-violet-100 text-violet-700',
  accuracy_90: 'bg-rose-100 text-rose-700',
};

const TYPE_LABELS = {
  true_false: 'صح وخطأ',
  mcq: 'اختيار من متعدد',
  fill_blank: 'إكمال الفراغ',
  matching: 'توصيل',
  ordering: 'ترتيب',
  classify: 'تصنيف',
  speed: 'سرعة',
  read_answer: 'اقرأ وأجب',
  image_match: 'مطابقة صور',
};

const DIFF_LABELS = { easy: 'سهل', medium: 'متوسط', hard: 'صعب' };
const DIFF_COLORS = {
  easy: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  hard: 'bg-red-100 text-red-700',
};

const SOURCE_LABELS = {
  daily_login: 'تسجيل يومي',
  exercise_answer: 'إجابة تمرين',
  community_question: 'سؤال مجتمع',
  community_answer: 'إجابة مجتمع',
  best_answer: 'أفضل إجابة',
  vote_received: 'تصويت',
};

const CHART_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316', '#14B8A6',
];

const MEDALS = ['🥇', '🥈', '🥉'];

// ═══════════════════════════════════════
// بطاقة إحصائية
// ═══════════════════════════════════════
function StatCard({ label, value, icon, gradient }) {
  return (
    <div className={`rounded-2xl p-4 bg-gradient-to-br ${gradient} text-white shadow-lg`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
      </div>
      <div className="text-2xl font-bold">{typeof value === 'number' ? value.toLocaleString('ar-SA') : value}</div>
      <div className="text-xs opacity-80 mt-1">{label}</div>
    </div>
  );
}

// ═══════════════════════════════════════
// عنوان قسم
// ═══════════════════════════════════════
function SectionTitle({ children, icon }) {
  return (
    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-4">
      {icon && <span>{icon}</span>}
      {children}
    </h3>
  );
}

// ═══════════════════════════════════════
// Custom Tooltip للرسوم البيانية
// ═══════════════════════════════════════
function CustomTooltip({ active, payload, label, labelFormatter, valueFormatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white shadow-xl rounded-lg p-3 border text-sm" dir="rtl">
      <p className="text-gray-500 text-xs mb-1">{labelFormatter ? labelFormatter(label) : label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="font-medium" style={{ color: entry.color }}>
          {entry.name}: {valueFormatter ? valueFormatter(entry.value) : entry.value}
        </p>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════
// تنسيق التاريخ
// ═══════════════════════════════════════
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

// ═══════════════════════════════════════
// الصفحة الرئيسية
// ═══════════════════════════════════════
export default function StudentAnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.get('/student-analytics')
      .then(res => setData(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <DashboardLayout>
        <LoadingState message="جاري تحميل الإحصائيات..." />
      </DashboardLayout>
    );
  }

  if (error || !data) {
    return (
      <DashboardLayout>
        <div className="text-center py-16">
          <span className="text-4xl block mb-4">📊</span>
          <p className="text-gray-500">خطأ في تحميل الإحصائيات</p>
          <button
            onClick={() => { setLoading(true); setError(false); api.get('/student-analytics').then(res => setData(res.data)).catch(() => setError(true)).finally(() => setLoading(false)); }}
            className="mt-4 text-sm text-blue-600 hover:text-blue-800"
          >
            إعادة المحاولة
          </button>
        </div>
      </DashboardLayout>
    );
  }

  const { overview, charts, exercise_analytics, top_students, badge_distribution } = data;

  // تحضير بيانات الرسوم
  const dailyData = (charts.daily_active_users || []).map(d => ({
    date: formatDate(d.date),
    count: parseInt(d.count),
  }));

  const exerciseTypeData = (charts.exercises_by_type || []).map(d => ({
    name: TYPE_LABELS[d.type] || d.type,
    answers: parseInt(d.answers_count),
    correct: parseInt(d.correct_count),
  }));

  const pointsSourceData = (charts.points_by_source || []).map(d => ({
    name: SOURCE_LABELS[d.source] || d.source,
    value: parseInt(d.total),
  }));

  const accuracyHistData = (charts.accuracy_distribution || []).map(d => ({
    bucket: d.bucket + '%',
    count: parseInt(d.student_count),
  }));

  const accuracyByTypeData = (exercise_analytics.accuracy_by_type || []).map(d => ({
    name: TYPE_LABELS[d.type] || d.type,
    accuracy: parseInt(d.accuracy || 0),
  }));

  const accuracyByDiffData = (exercise_analytics.accuracy_by_difficulty || []).map(d => ({
    name: DIFF_LABELS[d.difficulty] || d.difficulty,
    accuracy: parseInt(d.accuracy || 0),
  }));

  const completionRate = exercise_analytics.completion_rate || {};
  const totalEx = parseInt(completionRate.total_exercises || 0);
  const attemptedEx = parseInt(completionRate.attempted_exercises || 0);
  const completionPct = totalEx > 0 ? Math.round((attemptedEx / totalEx) * 100) : 0;

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 mb-8">
        {/* العنوان */}
        <div>
          <h1 className="text-2xl font-bold text-gray-800">إحصائيات الطلاب</h1>
          <p className="text-sm text-gray-500 mt-1">نظرة شاملة على نشاط الطلاب والتمارين والنقاط</p>
        </div>

        {/* ═══════════════════════════════════════ */}
        {/* القسم 1: بطاقات النظرة العامة */}
        {/* ═══════════════════════════════════════ */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard
            label="إجمالي الطلاب"
            value={overview.total_students}
            icon="👥"
            gradient="from-blue-500 to-blue-600"
          />
          <StatCard
            label="نشط (7 أيام)"
            value={overview.active_7_days}
            icon="🟢"
            gradient="from-green-500 to-green-600"
          />
          <StatCard
            label="نشط (30 يوم)"
            value={overview.active_30_days}
            icon="📅"
            gradient="from-emerald-500 to-emerald-600"
          />
          <StatCard
            label="متوسط الحضور اليومي"
            value={overview.avg_daily_logins}
            icon="📊"
            gradient="from-amber-500 to-amber-600"
          />
          <StatCard
            label="إجمالي النقاط"
            value={overview.total_points}
            icon="⭐"
            gradient="from-violet-500 to-violet-600"
          />
          <StatCard
            label="أكثر شارة حصولاً"
            value={overview.popular_badge ? (BADGE_LABELS[overview.popular_badge.badge_type] || overview.popular_badge.badge_type) : 'لا يوجد'}
            icon="🏅"
            gradient="from-rose-500 to-rose-600"
          />
        </div>

        {/* ═══════════════════════════════════════ */}
        {/* القسم 2: الرسوم البيانية */}
        {/* ═══════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* المستخدمون النشطون يومياً */}
          <Card className="p-6">
            <SectionTitle icon="📈">المستخدمون النشطون يومياً (آخر 30 يوم)</SectionTitle>
            {dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={dailyData}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" fontSize={11} tick={{ fill: '#9CA3AF' }} />
                  <YAxis fontSize={11} tick={{ fill: '#9CA3AF' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    name="المستخدمون"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    fill="url(#colorCount)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-400 text-sm">لا توجد بيانات</div>
            )}
          </Card>

          {/* التمارين حسب النوع */}
          <Card className="p-6">
            <SectionTitle icon="🧩">الإجابات حسب نوع التمرين</SectionTitle>
            {exerciseTypeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={exerciseTypeData} layout="vertical" margin={{ right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" fontSize={11} tick={{ fill: '#9CA3AF' }} />
                  <YAxis dataKey="name" type="category" fontSize={11} tick={{ fill: '#6B7280' }} width={100} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="correct" name="صحيحة" fill="#10B981" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="answers" name="إجمالي" fill="#93C5FD" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-400 text-sm">لا توجد بيانات</div>
            )}
          </Card>

          {/* مصادر النقاط */}
          <Card className="p-6">
            <SectionTitle icon="💰">مصادر النقاط</SectionTitle>
            {pointsSourceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={pointsSourceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                    fontSize={11}
                  >
                    {pointsSourceData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip valueFormatter={v => `${v.toLocaleString('ar-SA')} نقطة`} />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-400 text-sm">لا توجد بيانات</div>
            )}
          </Card>

          {/* توزيع الدقة */}
          <Card className="p-6">
            <SectionTitle icon="🎯">توزيع نسب الدقة</SectionTitle>
            {accuracyHistData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={accuracyHistData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="bucket" fontSize={11} tick={{ fill: '#9CA3AF' }} />
                  <YAxis fontSize={11} tick={{ fill: '#9CA3AF' }} />
                  <Tooltip content={<CustomTooltip valueFormatter={v => `${v} طالب`} />} />
                  <Bar dataKey="count" name="عدد الطلاب" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-400 text-sm">لا توجد بيانات كافية</div>
            )}
          </Card>
        </div>

        {/* ═══════════════════════════════════════ */}
        {/* القسم 3: تحليلات التمارين */}
        {/* ═══════════════════════════════════════ */}
        <div>
          <SectionTitle icon="📝">تحليلات التمارين</SectionTitle>

          {/* نسبة الإتمام */}
          <Card className="p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">نسبة إتمام التمارين</span>
              <span className="text-sm text-gray-500">{attemptedEx} من {totalEx} تمرين</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-gradient-to-l from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500"
                style={{ width: `${completionPct}%` }}
              />
            </div>
            <span className="text-xs text-gray-400 mt-1 block">{completionPct}%</span>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* الدقة حسب نوع التمرين */}
            <Card className="p-6">
              <h4 className="text-sm font-bold text-gray-700 mb-4">الدقة حسب نوع التمرين</h4>
              {accuracyByTypeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={accuracyByTypeData} layout="vertical" margin={{ right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" domain={[0, 100]} fontSize={11} tick={{ fill: '#9CA3AF' }} unit="%" />
                    <YAxis dataKey="name" type="category" fontSize={11} tick={{ fill: '#6B7280' }} width={100} />
                    <Tooltip content={<CustomTooltip valueFormatter={v => `${v}%`} />} />
                    <Bar dataKey="accuracy" name="الدقة" fill="#10B981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-gray-400 text-sm">لا توجد بيانات</div>
              )}
            </Card>

            {/* الدقة حسب الصعوبة */}
            <Card className="p-6">
              <h4 className="text-sm font-bold text-gray-700 mb-4">الدقة حسب مستوى الصعوبة</h4>
              {accuracyByDiffData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={accuracyByDiffData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" fontSize={12} tick={{ fill: '#6B7280' }} />
                    <YAxis domain={[0, 100]} fontSize={11} tick={{ fill: '#9CA3AF' }} unit="%" />
                    <Tooltip content={<CustomTooltip valueFormatter={v => `${v}%`} />} />
                    <Bar dataKey="accuracy" name="الدقة" radius={[4, 4, 0, 0]}>
                      {accuracyByDiffData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.name === 'سهل' ? '#22C55E' : entry.name === 'متوسط' ? '#F59E0B' : '#EF4444'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-gray-400 text-sm">لا توجد بيانات</div>
              )}
            </Card>
          </div>

          {/* أكثر 10 تمارين حلاً */}
          {(exercise_analytics.top_exercises || []).length > 0 && (
            <Card className="p-6">
              <h4 className="text-sm font-bold text-gray-700 mb-4">أكثر التمارين حلاً</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-right border-b border-gray-200">
                      <th className="pb-3 pr-2 text-gray-500 font-medium">#</th>
                      <th className="pb-3 text-gray-500 font-medium">التمرين</th>
                      <th className="pb-3 text-gray-500 font-medium">النوع</th>
                      <th className="pb-3 text-gray-500 font-medium">الصعوبة</th>
                      <th className="pb-3 text-gray-500 font-medium">الحالّون</th>
                      <th className="pb-3 text-gray-500 font-medium">الدقة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(exercise_analytics.top_exercises || []).map((ex, i) => (
                      <tr key={ex.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="py-3 pr-2 text-gray-400 font-bold">{i + 1}</td>
                        <td className="py-3 font-medium text-gray-800">{ex.title}</td>
                        <td className="py-3">
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-lg">
                            {TYPE_LABELS[ex.type] || ex.type}
                          </span>
                        </td>
                        <td className="py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-lg ${DIFF_COLORS[ex.difficulty] || 'bg-gray-100'}`}>
                            {DIFF_LABELS[ex.difficulty] || ex.difficulty}
                          </span>
                        </td>
                        <td className="py-3 text-gray-600">{parseInt(ex.solvers).toLocaleString('ar-SA')}</td>
                        <td className="py-3">
                          <span className={`font-medium ${parseInt(ex.accuracy || 0) >= 70 ? 'text-green-600' : parseInt(ex.accuracy || 0) >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {ex.accuracy || 0}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>

        {/* ═══════════════════════════════════════ */}
        {/* القسم 4: أفضل 20 طالب */}
        {/* ═══════════════════════════════════════ */}
        {top_students?.length > 0 && (
          <div>
            <SectionTitle icon="🏆">أفضل الطلاب</SectionTitle>
            <Card className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-right border-b border-gray-200">
                      <th className="pb-3 pr-2 text-gray-500 font-medium w-12">#</th>
                      <th className="pb-3 text-gray-500 font-medium">الطالب</th>
                      <th className="pb-3 text-gray-500 font-medium">النقاط</th>
                      <th className="pb-3 text-gray-500 font-medium">أيام متتالية</th>
                      <th className="pb-3 text-gray-500 font-medium">الشارات</th>
                      <th className="pb-3 text-gray-500 font-medium">تمارين محلولة</th>
                      <th className="pb-3 text-gray-500 font-medium">الدقة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top_students.map((student, i) => (
                      <tr key={student.id} className={`border-b border-gray-50 ${i < 3 ? 'bg-amber-50/30' : 'hover:bg-gray-50/50'}`}>
                        <td className="py-3 pr-2">
                          {i < 3 ? (
                            <span className="text-lg">{MEDALS[i]}</span>
                          ) : (
                            <span className="text-gray-400 font-bold text-xs">{i + 1}</span>
                          )}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            {student.avatar_url ? (
                              <img src={student.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
                                {(student.name || '؟')[0]}
                              </div>
                            )}
                            <span className={`font-medium ${i < 3 ? 'text-gray-900' : 'text-gray-700'}`}>
                              {student.name || 'طالب'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3">
                          <span className="font-bold text-violet-600">{parseInt(student.points).toLocaleString('ar-SA')}</span>
                        </td>
                        <td className="py-3">
                          {parseInt(student.current_streak) > 0 ? (
                            <span className="text-orange-600 font-medium">🔥 {student.current_streak}</span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="py-3">
                          <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-lg font-medium">
                            {student.badges_count}
                          </span>
                        </td>
                        <td className="py-3 text-gray-600">{parseInt(student.exercises_solved).toLocaleString('ar-SA')}</td>
                        <td className="py-3">
                          <span className={`font-medium ${parseInt(student.accuracy) >= 70 ? 'text-green-600' : parseInt(student.accuracy) >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {student.accuracy}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* ═══════════════════════════════════════ */}
        {/* القسم 5: توزيع الشارات */}
        {/* ═══════════════════════════════════════ */}
        {badge_distribution?.length > 0 && (
          <div>
            <SectionTitle icon="🏅">توزيع الشارات</SectionTitle>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {badge_distribution.map(badge => (
                <Card key={badge.badge_type} className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${BADGE_COLORS[badge.badge_type] || 'bg-gray-100'}`}>
                      {(BADGE_LABELS[badge.badge_type] || '🏅').split(' ')[0]}
                    </div>
                    <div>
                      <div className="text-xl font-bold text-gray-800">{parseInt(badge.count).toLocaleString('ar-SA')}</div>
                      <div className="text-xs text-gray-500">
                        {BADGE_LABELS[badge.badge_type]?.replace(/^[^\s]+\s/, '') || badge.badge_type}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* حالة فارغة */}
        {!top_students?.length && !badge_distribution?.length && !charts.daily_active_users?.length && (
          <Card className="p-12 text-center">
            <span className="text-4xl block mb-4">📭</span>
            <p className="text-gray-500 font-medium">لا توجد بيانات طلاب بعد</p>
            <p className="text-gray-400 text-sm mt-1">ستظهر الإحصائيات عندما يبدأ الطلاب باستخدام المنصة</p>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
