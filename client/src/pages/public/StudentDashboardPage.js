import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE } from '../../lib/api';
import { useUserAuth } from '../../context/UserAuthContext';
import { useToast } from '../../components/ui/Toast';
import SEO from '../../components/public/SEO';

// ─── تعريف الشارات ───
const BADGE_DEFS = {
  first_exercise: { icon: '🧩', label: 'أول تمرين', desc: 'أكملت أول تمرين بنجاح', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  streak_3:       { icon: '🔥', label: '3 أيام متتالية', desc: 'سجّلت 3 أيام متتالية', color: 'bg-orange-100 text-orange-700 border-orange-300' },
  streak_7:       { icon: '⚡', label: 'أسبوع كامل', desc: 'سجّلت 7 أيام متتالية', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  streak_30:      { icon: '🏆', label: 'شهر كامل', desc: 'سجّلت 30 يوم متتالي', color: 'bg-purple-100 text-purple-700 border-purple-300' },
  points_100:     { icon: '💯', label: '100 نقطة', desc: 'وصلت لـ 100 نقطة', color: 'bg-green-100 text-green-700 border-green-300' },
  points_500:     { icon: '🌟', label: '500 نقطة', desc: 'وصلت لـ 500 نقطة', color: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
  accuracy_90:    { icon: '🎯', label: 'دقة 90%', desc: 'حققت دقة 90% في 10+ تمارين', color: 'bg-red-100 text-red-700 border-red-300' },
};

const ALL_BADGE_TYPES = Object.keys(BADGE_DEFS);

export default function StudentDashboardPage() {
  const { user, token, loading: authLoading } = useUserAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [checkinResult, setCheckinResult] = useState(null);
  const [newBadges, setNewBadges] = useState([]);
  const [subjectProgress, setSubjectProgress] = useState([]);
  const [dailyChallenge, setDailyChallenge] = useState(null);
  const [reviewDue, setReviewDue] = useState(null);
  const [continueLearning, setContinueLearning] = useState(null);
  const autoCheckinRef = useRef(false);

  const fetchStats = useCallback(async () => {
    if (!user || !token) return;
    try {
      setLoading(true);
      const headers = { 'Authorization': `Bearer ${token}` };
      const [statsRes, spRes, dcRes, reviewRes] = await Promise.all([
        fetch(`${API_BASE}/students/${user.id}/stats`, { headers }),
        fetch(`${API_BASE}/students/${user.id}/subject-progress`, { headers }),
        fetch(`${API_BASE}/daily-challenge`, { headers }).catch(() => null),
        fetch(`${API_BASE}/review/due`, { headers }).catch(() => null),
      ]);
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      } else {
        setStats(null);
      }
      if (spRes.ok) {
        const spData = await spRes.json();
        setSubjectProgress(spData);
      }
      if (dcRes && dcRes.ok) {
        try { const dcData = await dcRes.json(); setDailyChallenge(dcData.challenge); } catch {}
      }
      if (reviewRes && reviewRes.ok) {
        try { const rvData = await reviewRes.json(); setReviewDue(rvData); } catch {}
      }
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [user, token]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchStats();
    } else if (!authLoading && !user) {
      setLoading(false);
    }
  }, [authLoading, user, fetchStats]);

  // ─── جلب مسار التعلم للاستمرار ───
  useEffect(() => {
    if (!subjectProgress.length || !token) return;
    const activeSubject = subjectProgress.find(sp => sp.progress_pct < 100);
    if (!activeSubject) return;

    fetch(`${API_BASE}/learning-paths/${activeSubject.subject_id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && data.path && data.nodes?.length > 0) {
          setContinueLearning({
            subjectId: activeSubject.subject_id,
            subjectName: activeSubject.subject_name,
            progress: data.progress,
            currentNode: data.nodes.find(n => n.status === 'current'),
          });
        }
      })
      .catch(() => {});
  }, [subjectProgress, token]);

  // ─── تسجيل حضور تلقائي عند فتح الصفحة ───
  useEffect(() => {
    if (!user || !token || authLoading || autoCheckinRef.current) return;
    autoCheckinRef.current = true;

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/students/daily-checkin`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        setCheckinResult(data);

        if (!data.already_checked && data.points_earned) {
          toast.success(`🌅 +${data.points_earned} نقاط يومية!`);
        }
        if (data.badges_earned && data.badges_earned.length > 0) {
          setNewBadges(data.badges_earned);
          setTimeout(() => setNewBadges([]), 5000);
        }
        // تحديث الإحصائيات
        fetchStats();
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, token, authLoading]);

  // ─── تسجيل الحضور اليومي ───
  const handleCheckin = async () => {
    if (!user || !token || checkinLoading) return;
    try {
      setCheckinLoading(true);
      const res = await fetch(`${API_BASE}/students/daily-checkin`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      setCheckinResult(data);

      // شارات جديدة
      if (data.badges_earned && data.badges_earned.length > 0) {
        setNewBadges(data.badges_earned);
        setTimeout(() => setNewBadges([]), 5000);
      }

      // تحديث الإحصائيات
      fetchStats();
    } catch {
      setCheckinResult({ error: true });
    } finally {
      setCheckinLoading(false);
    }
  };

  // ─── حالة عدم تسجيل الدخول ───
  if (!authLoading && !user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <SEO title="إحصائياتي" description="سجّل دخول لعرض إحصائياتك" />
        <div className="text-6xl mb-4">📊</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">إحصائياتي</h1>
        <p className="text-gray-500 mb-6">سجّل دخول لعرض إحصائياتك ونقاطك وشاراتك</p>
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
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <SEO title="إحصائياتي" />
        <div className="animate-spin text-4xl mb-4">⏳</div>
        <p className="text-gray-500">جاري تحميل الإحصائيات...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <SEO title="إحصائياتي" />
        <div className="text-6xl mb-4">😕</div>
        <p className="text-gray-500">تعذر تحميل الإحصائيات</p>
        <button onClick={fetchStats} className="mt-4 text-blue-600 hover:underline">
          إعادة المحاولة
        </button>
      </div>
    );
  }

  const earnedBadgeTypes = (stats.badges || []).map(b => b.badge_type);
  const isCheckedToday = checkinResult?.already_checked || (checkinResult && !checkinResult.error && !checkinResult.already_checked);
  const currentStreak = checkinResult?.streak || stats.current_streak || 0;

  // حساب أيام آخر 30 يوم
  const activityDays = buildActivityGrid(stats.activity_last_30_days || []);

  // تفصيل النقاط
  const breakdown = stats.points_breakdown || {};
  const totalBreakdown = (breakdown.daily_login || 0) + (breakdown.exercise_correct || 0) + (breakdown.streak_bonus || 0);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <SEO title="إحصائياتي" description="إحصائياتك ونقاطك وشاراتك" />

      {/* ═══ إشعار شارات جديدة ═══ */}
      {newBadges.length > 0 && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center animate-bounce">
          <p className="text-yellow-800 font-bold mb-1">🎉 شارة جديدة!</p>
          {newBadges.map(b => (
            <span key={b.badge_type} className="inline-block mx-1 text-lg">
              {BADGE_DEFS[b.badge_type]?.icon} {BADGE_DEFS[b.badge_type]?.label}
            </span>
          ))}
        </div>
      )}

      {/* ═══ التحدي اليومي ═══ */}
      {dailyChallenge && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-2xl">
                {dailyChallenge.is_completed ? '✅' : '⚡'}
              </div>
              <div>
                <h3 className="font-bold text-gray-800">تحدي اليوم</h3>
                <p className="text-sm text-gray-500">
                  {dailyChallenge.is_completed
                    ? `أكملت التحدي! +${dailyChallenge.xp_earned || 20} XP`
                    : `${dailyChallenge.completed_count || 0}/${dailyChallenge.total_questions || 5} أسئلة`
                  }
                </p>
              </div>
            </div>
            {!dailyChallenge.is_completed && (
              <Link
                to="/learn/daily-challenge"
                className="bg-amber-500 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-amber-600 transition"
              >
                أكمل التحدي
              </Link>
            )}
          </div>
          {!dailyChallenge.is_completed && dailyChallenge.total_questions > 0 && (
            <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all"
                style={{ width: `${((dailyChallenge.completed_count || 0) / dailyChallenge.total_questions) * 100}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* ═══ واصل التعلم ═══ */}
      {continueLearning && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-2xl">📚</div>
              <div>
                <h3 className="font-bold text-gray-800">واصل التعلم</h3>
                <p className="text-sm text-gray-500">
                  {continueLearning.subjectName} — {continueLearning.progress?.completion_percentage || 0}%
                </p>
                {continueLearning.currentNode && (
                  <p className="text-xs text-blue-600 mt-0.5">
                    المحطة التالية: {continueLearning.currentNode.exercise_title}
                  </p>
                )}
              </div>
            </div>
            <Link
              to={`/learn/path/${continueLearning.subjectId}`}
              className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 transition"
            >
              أكمل
            </Link>
          </div>
          <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${continueLearning.progress?.completion_percentage || 0}%` }}
            />
          </div>
        </div>
      )}

      {/* ═══ مراجعة مستحقة ═══ */}
      {reviewDue && reviewDue.due_count > 0 && (
        <div className="bg-white rounded-2xl border border-orange-200 p-5 mb-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center text-2xl">🔁</div>
              <div>
                <h3 className="font-bold text-gray-800">للمراجعة اليوم</h3>
                <p className="text-sm text-gray-500">{reviewDue.due_count} سؤال بحاجة لمراجعتك</p>
              </div>
            </div>
            <Link
              to="/learn/review"
              className="bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-orange-600 transition"
            >
              ابدأ المراجعة
            </Link>
          </div>
        </div>
      )}

      {/* ═══ Section 1: Check-in + Streak ═══ */}
      <div className="bg-gradient-to-l from-blue-600 to-indigo-700 rounded-2xl p-6 sm:p-8 text-white mb-6 shadow-lg">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          {/* Streak */}
          <div className="text-center sm:text-right">
            <div className="text-5xl sm:text-6xl font-extrabold mb-1">
              {currentStreak} <span className="text-3xl">🔥</span>
            </div>
            <p className="text-blue-100 text-sm">
              {currentStreak === 1 ? 'يوم متتالي' : currentStreak < 11 ? 'أيام متتالية' : 'يوم متتالي'}
            </p>
          </div>

          {/* Check-in Button */}
          <div className="text-center">
            {isCheckedToday ? (
              <div>
                <div className="text-4xl mb-2">✅</div>
                <p className="font-medium">سجّلت حضورك اليوم</p>
                {checkinResult && !checkinResult.already_checked && (
                  <p className="text-blue-200 text-sm mt-1">
                    +{checkinResult.points_earned} نقطة
                  </p>
                )}
              </div>
            ) : (
              <button
                onClick={handleCheckin}
                disabled={checkinLoading}
                className="bg-white text-blue-700 px-8 py-3 rounded-xl font-bold text-lg hover:bg-blue-50 transition disabled:opacity-50 shadow-md"
              >
                {checkinLoading ? 'جاري التسجيل...' : '📅 سجّل حضورك اليوم'}
              </button>
            )}
          </div>

          {/* النقاط */}
          <div className="text-center sm:text-left">
            <div className="text-4xl sm:text-5xl font-extrabold mb-1">
              {stats.total_points}
            </div>
            <p className="text-blue-100 text-sm">نقطة إجمالية 💰</p>
          </div>
        </div>
      </div>

      {/* ═══ Section 2: إحصائيات سريعة ═══ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard icon="💰" label="إجمالي النقاط" value={stats.total_points} color="bg-amber-50 text-amber-700" />
        <StatCard icon="🔥" label="أطول streak" value={stats.longest_streak} suffix="يوم" color="bg-orange-50 text-orange-700" />
        <StatCard icon="🧩" label="تمارين مُنجزة" value={stats.total_exercises} color="bg-blue-50 text-blue-700" />
        <StatCard icon="🎯" label="نسبة الدقة" value={stats.accuracy_rate} suffix="%" color="bg-green-50 text-green-700" />
      </div>

      {/* ═══ Section 3: الشارات ═══ */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">🏅 الشارات</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {ALL_BADGE_TYPES.map(type => {
            const def = BADGE_DEFS[type];
            const earned = earnedBadgeTypes.includes(type);
            const badge = earned ? stats.badges.find(b => b.badge_type === type) : null;
            return (
              <div
                key={type}
                className={`rounded-xl border p-4 text-center transition ${
                  earned
                    ? `${def.color} border-current shadow-sm`
                    : 'bg-gray-50 text-gray-400 border-gray-200 opacity-60'
                }`}
              >
                <div className={`text-3xl mb-2 ${!earned ? 'grayscale' : ''}`}>{def.icon}</div>
                <p className="font-bold text-sm">{def.label}</p>
                <p className={`text-xs mt-1 ${earned ? 'opacity-80' : 'opacity-50'}`}>{def.desc}</p>
                {badge && (
                  <p className="text-xs mt-2 opacity-60">
                    {new Date(badge.earned_at).toLocaleDateString('ar-SA')}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ Section 4: تفصيل النقاط ═══ */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">📊 مصادر النقاط</h2>
        <div className="space-y-4">
          <BreakdownBar
            label="🌅 دخول يومي"
            value={breakdown.daily_login || 0}
            total={totalBreakdown}
            color="bg-blue-500"
          />
          <BreakdownBar
            label="🧩 تمارين صحيحة"
            value={breakdown.exercise_correct || 0}
            total={totalBreakdown}
            color="bg-green-500"
          />
          <BreakdownBar
            label="🔥 مكافآت streak"
            value={breakdown.streak_bonus || 0}
            total={totalBreakdown}
            color="bg-orange-500"
          />
        </div>
      </div>

      {/* ═══ Section 5: نشاط آخر 30 يوم ═══ */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">📅 نشاط آخر 30 يوم</h2>
        <div className="grid grid-cols-7 sm:grid-cols-10 gap-2">
          {activityDays.map((day, i) => (
            <div
              key={i}
              title={`${day.date}${day.active ? ` — ${day.points} نقطة` : ''}`}
              className={`aspect-square rounded-lg flex items-center justify-center text-xs font-medium transition ${
                day.active
                  ? day.streak >= 7
                    ? 'bg-green-600 text-white'
                    : day.streak >= 3
                      ? 'bg-green-500 text-white'
                      : 'bg-green-400 text-white'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {day.dayNum}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-100 inline-block" /> لم يسجّل</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-400 inline-block" /> سجّل</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-600 inline-block" /> streak 7+</span>
        </div>
      </div>

      {/* ═══ Section 6: تقدمي بالمواد ═══ */}
      {subjectProgress.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">📚 تقدمي بالمواد</h2>
          <div className="space-y-4">
            {subjectProgress.map(sp => (
              <div key={sp.subject_id}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-600">{sp.subject_name}</span>
                  <span className="text-sm font-bold text-gray-800">{sp.correct_answers}/{sp.total_questions} ({sp.progress_pct}%)</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500 bg-blue-500"
                    style={{ width: `${sp.progress_pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── رابط لوحة الترتيب ─── */}
      <div className="text-center">
        <Link
          to="/leaderboard"
          className="inline-flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-6 py-3 rounded-xl font-medium hover:bg-gray-50 transition"
        >
          🏆 لوحة الترتيب
        </Link>
      </div>
    </div>
  );
}

// ─── مكونات مساعدة ───

function StatCard({ icon, label, value, suffix = '', color }) {
  return (
    <div className={`rounded-xl p-4 text-center ${color}`}>
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-2xl font-extrabold">
        {value}{suffix}
      </div>
      <p className="text-xs mt-1 opacity-70">{label}</p>
    </div>
  );
}

function BreakdownBar({ label, value, total, color }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm text-gray-600">{label}</span>
        <span className="text-sm font-bold text-gray-800">{value} نقطة</span>
      </div>
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── بناء شبكة 30 يوم ───
function buildActivityGrid(activityData) {
  const days = [];
  const today = new Date();
  const activityMap = {};

  // بناء map للنشاط
  activityData.forEach(a => {
    const d = new Date(a.login_date).toISOString().split('T')[0];
    activityMap[d] = { points: a.points_earned, streak: a.streak_day };
  });

  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const activity = activityMap[key];
    days.push({
      date: d.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' }),
      dayNum: d.getDate(),
      active: !!activity,
      points: activity?.points || 0,
      streak: activity?.streak || 0,
    });
  }

  return days;
}
