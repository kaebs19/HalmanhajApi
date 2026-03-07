import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE } from '../../lib/api';
import { useUserAuth } from '../../context/UserAuthContext';
import SEO from '../../components/public/SEO';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function LeaderboardPage() {
  const { user, token, loading: authLoading } = useUserAuth();
  const [leaderboard, setLeaderboard] = useState([]);
  const [currentUserRank, setCurrentUserRank] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('my_grade'); // my_grade | all

  // تحديد التبويب الافتراضي حسب grade_id
  useEffect(() => {
    if (!authLoading && user) {
      setActiveTab(user.grade_id ? 'my_grade' : 'all');
    }
  }, [authLoading, user]);

  // جلب الترتيب
  useEffect(() => {
    if (authLoading) return;
    if (!user || !token) {
      setLoading(false);
      return;
    }
    fetchLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, token, activeTab]);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      let url = `${API_BASE}/leaderboard?limit=10`;
      if (activeTab === 'my_grade' && user?.grade_id) {
        url += `&grade_id=${user.grade_id}`;
      }
      if (user?.id) {
        url += `&user_id=${user.id}`;
      }

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      setLeaderboard(data.leaderboard || []);
      setCurrentUserRank(data.current_user || null);
    } catch {
      setLeaderboard([]);
      setCurrentUserRank(null);
    } finally {
      setLoading(false);
    }
  };

  // ─── حالة عدم تسجيل الدخول ───
  if (!authLoading && !user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <SEO title="لوحة الترتيب" description="تنافس مع زملائك واحصل على أعلى ترتيب" />
        <div className="text-6xl mb-4">🏆</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">لوحة الترتيب</h1>
        <p className="text-gray-500 mb-6">سجّل دخول لعرض ترتيبك بين الطلاب</p>
        <Link
          to="/auth/login"
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition"
        >
          تسجيل الدخول
        </Link>
      </div>
    );
  }

  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <SEO title="لوحة الترتيب" description="تنافس مع زملائك واحصل على أعلى ترتيب" />

      {/* العنوان */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-black text-gray-800 mb-2">🏆 لوحة الترتيب</h1>
        <p className="text-gray-500">أفضل الطلاب نشاطاً وتميّزاً</p>
      </div>

      {/* تبويبات الفلتر */}
      <div className="flex gap-2 mb-6 justify-center">
        <button
          onClick={() => setActiveTab('my_grade')}
          className={`px-6 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === 'my_grade'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          صفي
        </button>
        <button
          onClick={() => setActiveTab('all')}
          className={`px-6 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === 'all'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          كل الصفوف
        </button>
      </div>

      {/* تحميل */}
      {loading ? (
        <div className="text-center py-16">
          <div className="animate-spin text-4xl mb-4">⏳</div>
          <p className="text-gray-500">جاري تحميل الترتيب...</p>
        </div>
      ) : leaderboard.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">📭</div>
          <p className="text-gray-500">لا يوجد طلاب في الترتيب حالياً</p>
        </div>
      ) : (
        <>
          {/* ═══ المنصة — Top 3 ═══ */}
          {top3.length > 0 && (
            <div className="flex items-end justify-center gap-3 sm:gap-6 mb-8">
              {/* المركز الثاني */}
              {top3.length > 1 && (
                <PodiumCard
                  player={top3[1]}
                  rank={2}
                  medal={MEDALS[1]}
                  height="h-32"
                  bgColor="bg-gray-100"
                  borderColor="border-gray-300"
                  isCurrentUser={user && user.id === top3[1].id}
                />
              )}
              {/* المركز الأول */}
              <PodiumCard
                player={top3[0]}
                rank={1}
                medal={MEDALS[0]}
                height="h-40"
                bgColor="bg-yellow-50"
                borderColor="border-yellow-400"
                isCurrentUser={user && user.id === top3[0].id}
              />
              {/* المركز الثالث */}
              {top3.length > 2 && (
                <PodiumCard
                  player={top3[2]}
                  rank={3}
                  medal={MEDALS[2]}
                  height="h-28"
                  bgColor="bg-orange-50"
                  borderColor="border-orange-300"
                  isCurrentUser={user && user.id === top3[2].id}
                />
              )}
            </div>
          )}

          {/* ═══ باقي الترتيب (4-10) ═══ */}
          {rest.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {rest.map((player, i) => (
                <div
                  key={player.id}
                  className={`flex items-center gap-4 px-4 sm:px-6 py-4 ${
                    i < rest.length - 1 ? 'border-b border-gray-100' : ''
                  } ${user && user.id === player.id ? 'bg-blue-50' : ''}`}
                >
                  {/* الترتيب */}
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600 shrink-0">
                    {player.rank}
                  </div>

                  {/* الصورة */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm shrink-0 overflow-hidden">
                    {player.avatar_url ? (
                      <img src={player.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      player.name?.charAt(0) || '?'
                    )}
                  </div>

                  {/* الاسم */}
                  <div className="flex-1 min-w-0">
                    <Link to={`/profile/${player.id}`} className="font-bold text-gray-800 hover:text-blue-600 truncate block">
                      {player.name}
                      {user && user.id === player.id && (
                        <span className="text-blue-500 text-xs mr-1">(أنت)</span>
                      )}
                    </Link>
                  </div>

                  {/* الإحصائيات */}
                  <div className="flex items-center gap-3 text-sm text-gray-500 shrink-0">
                    <span title="Streak">🔥 {player.current_streak}</span>
                    <span title="الدقة">🎯 {player.accuracy_rate}%</span>
                    <span className="font-bold text-gray-800">{player.points} 💰</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ═══ ترتيبك ═══ */}
          {currentUserRank && user && (
            <div className="mt-4 bg-blue-50 rounded-2xl border-2 border-blue-300 px-4 sm:px-6 py-4">
              <p className="text-xs text-blue-600 font-bold mb-2">📍 ترتيبك</p>
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-blue-200 flex items-center justify-center text-sm font-bold text-blue-700 shrink-0">
                  #{currentUserRank.rank}
                </div>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm shrink-0 overflow-hidden">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (user.name?.charAt(0) || '?')}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-gray-800">{currentUserRank.name} <span className="text-blue-500 text-xs">(أنت)</span></span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-500 shrink-0">
                  <span>🔥 {currentUserRank.current_streak}</span>
                  <span>🎯 {currentUserRank.accuracy_rate}%</span>
                  <span className="font-bold text-gray-800">{currentUserRank.points} 💰</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── رابط إحصائياتي ─── */}
      <div className="text-center mt-8">
        <Link
          to="/my-dashboard"
          className="inline-flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-6 py-3 rounded-xl font-medium hover:bg-gray-50 transition"
        >
          📊 إحصائياتي
        </Link>
      </div>
    </div>
  );
}

// ─── بطاقة المنصة (Top 3) ───
function PodiumCard({ player, rank, medal, height, bgColor, borderColor, isCurrentUser }) {
  return (
    <div className={`flex flex-col items-center w-28 sm:w-36`}>
      {/* الميدالية */}
      <div className="text-3xl sm:text-4xl mb-2">{medal}</div>

      {/* الصورة */}
      <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-lg mb-2 overflow-hidden border-4 ${borderColor}`}>
        {player.avatar_url ? (
          <img src={player.avatar_url} alt="" className="w-full h-full object-cover" />
        ) : (
          player.name?.charAt(0) || '?'
        )}
      </div>

      {/* الاسم */}
      <Link to={`/profile/${player.id}`} className="font-bold text-gray-800 text-sm text-center truncate w-full hover:text-blue-600">
        {player.name}
      </Link>
      {isCurrentUser && <span className="text-blue-500 text-xs">(أنت)</span>}

      {/* المنصة */}
      <div className={`w-full ${height} ${bgColor} rounded-t-xl mt-2 flex flex-col items-center justify-center border ${borderColor}`}>
        <span className="text-xl sm:text-2xl font-black text-gray-800">{player.points}</span>
        <span className="text-xs text-gray-500">نقطة</span>
        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
          <span>🔥 {player.current_streak}</span>
          <span>🎯 {player.accuracy_rate}%</span>
        </div>
      </div>
    </div>
  );
}
