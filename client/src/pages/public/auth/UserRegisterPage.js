import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUserAuth } from '../../../context/UserAuthContext';
import { useSettings } from '../../../context/SettingsContext';
import { API_BASE } from '../../../lib/api';

export default function UserRegisterPage() {
  const { register } = useUserAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // المراحل والصفوف
  const [stages, setStages] = useState([]);
  const [grades, setGrades] = useState([]);
  const [stageId, setStageId] = useState('');
  const [gradeId, setGradeId] = useState('');

  // جلب المراحل عند التحميل
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
    setError('');
    if (password.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    setLoading(true);
    try {
      await register(name, email, password, stageId || null, gradeId || null);
      navigate('/');
    } catch (err) {
      setError(err.message || 'حدث خطأ في التسجيل');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-1">حساب جديد</h1>
          <p className="text-sm text-gray-500">أنشئ حسابك في {settings.site_name}</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl border border-red-100">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">الاسم</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                placeholder="اسمك الكامل"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">البريد الإلكتروني</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                placeholder="example@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">كلمة المرور</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                placeholder="6 أحرف على الأقل"
                required
                minLength={6}
              />
            </div>

            {/* اختيار المرحلة */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">المرحلة الدراسية <span className="text-gray-400 font-normal">(اختياري)</span></label>
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

            {/* اختيار الصف (يظهر عند اختيار مرحلة) */}
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
              {loading ? 'جاري التسجيل...' : 'إنشاء الحساب'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            لديك حساب بالفعل؟{' '}
            <Link to="/auth/login" className="text-blue-600 hover:underline font-medium">سجل دخولك</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
