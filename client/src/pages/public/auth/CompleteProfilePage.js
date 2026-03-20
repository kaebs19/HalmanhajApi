import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserAuth } from '../../../context/UserAuthContext';
import { API_BASE } from '../../../lib/api';

export default function CompleteProfilePage() {
  const { user, token, updateUser } = useUserAuth();
  const navigate = useNavigate();
  const [stages, setStages] = useState([]);
  const [grades, setGrades] = useState([]);
  const [stageId, setStageId] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [loading, setLoading] = useState(false);

  // لو ما في مستخدم، رجع لصفحة الدخول
  useEffect(() => {
    if (!user && !token) navigate('/auth/login');
  }, [user, token, navigate]);

  // جلب المراحل
  useEffect(() => {
    fetch(`${API_BASE}/public/browse/stages`)
      .then(r => r.json())
      .then(data => setStages(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // جلب الصفوف عند اختيار مرحلة
  useEffect(() => {
    if (!stageId) {
      setGrades([]);
      setGradeId('');
      return;
    }
    const stage = stages.find(s => s.id === stageId);
    if (!stage) return;
    fetch(`${API_BASE}/public/browse/grades?stage_slug=${stage.slug}`)
      .then(r => r.json())
      .then(data => {
        setGrades(Array.isArray(data.grades) ? data.grades : []);
        setGradeId('');
      })
      .catch(() => setGrades([]));
  }, [stageId, stages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/user/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: user?.name,
          stage_id: stageId || null,
          grade_id: gradeId || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        updateUser(data);
      }
      navigate('/');
    } catch {
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => navigate('/');

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">
            مرحباً {user?.name || ''}!
          </h1>
          <p className="text-sm text-gray-500">اختر مرحلتك وصفك الدراسي لتجربة أفضل</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">المرحلة الدراسية</label>
              <select
                value={stageId}
                onChange={(e) => setStageId(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white"
              >
                <option value="">اختر المرحلة</option>
                {stages.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {stageId && grades.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">الصف الدراسي</label>
                <select
                  value={gradeId}
                  onChange={(e) => setGradeId(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white"
                >
                  <option value="">اختر الصف</option>
                  {grades.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'جاري الحفظ...' : 'حفظ والمتابعة'}
            </button>

            <button
              type="button"
              onClick={handleSkip}
              className="w-full text-gray-500 text-sm py-2 hover:text-gray-700 transition-colors"
            >
              تخطي الآن
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
