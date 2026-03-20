import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API_BASE } from '../../lib/api';
import { useUserAuth } from '../../context/UserAuthContext';
import SEO from '../../components/public/SEO';

export default function UserProfilePage() {
  const { id } = useParams();
  const { user: currentUser, token, updateUser, logout } = useUserAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('questions');

  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);

  // تعديل الملف الشخصي
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editStageId, setEditStageId] = useState('');
  const [editGradeId, setEditGradeId] = useState('');
  const [stages, setStages] = useState([]);
  const [stageGrades, setStageGrades] = useState([]);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  // تغيير كلمة المرور
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  // رفع الصورة
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef(null);

  // حذف الحساب
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/user/profile/${id}`, { headers });
      if (!res.ok) throw new Error('not found');
      const data = await res.json();
      const userObj = data.user || data;
      if (data.stats) {
        userObj.questions_count = data.stats.questions_count;
        userObj.answers_count = data.stats.answers_count;
        userObj.best_answers_count = data.stats.best_answers_count;
      }
      setProfile(userObj);
      setQuestions(data.recent_questions || data.questions || []);
      setAnswers(data.recent_answers || data.answers || []);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch(`${API_BASE}/public/navigation`)
      .then(res => res.json())
      .then(data => setStages(data.stages || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (editStageId) {
      const stage = stages.find(s => s.id === editStageId);
      setStageGrades(stage?.grades || []);
    } else {
      setStageGrades([]);
      setEditGradeId('');
    }
  }, [editStageId, stages]);

  const isOwnProfile = currentUser && (currentUser.id === id || String(currentUser.id) === String(id));

  const startEditing = () => {
    setEditName(profile?.name || '');
    setEditBio(profile?.bio || '');
    setEditStageId(profile?.stage_id || '');
    setEditGradeId(profile?.grade_id || '');
    setEditError('');
    setEditSuccess('');
    setEditing(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editName.trim()) { setEditError('الاسم مطلوب'); return; }
    setEditSubmitting(true);
    setEditError('');
    try {
      const res = await fetch(`${API_BASE}/user/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          name: editName.trim(),
          bio: editBio.trim(),
          stage_id: editStageId || null,
          grade_id: editGradeId || null,
        })
      });
      if (!res.ok) { const data = await res.json(); throw new Error(data.message); }
      const data = await res.json();
      setProfile(prev => ({ ...prev, ...data.user, ...data }));
      updateUser({ name: data.name || editName.trim() });
      setEditSuccess('تم تحديث الملف الشخصي');
      setTimeout(() => { setEditing(false); setEditSuccess(''); }, 1500);
    } catch (err) {
      setEditError(err.message || 'خطأ في التحديث');
    } finally {
      setEditSubmitting(false);
    }
  };

  // رفع الصورة الشخصية
  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE}/user/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error('فشل رفع الصورة');
      const data = await res.json();
      setProfile(prev => ({ ...prev, avatar_url: data.avatar_url }));
      updateUser({ avatar_url: data.avatar_url });
    } catch {
      setEditError('فشل رفع الصورة');
    } finally {
      setAvatarUploading(false);
    }
  };

  // تغيير كلمة المرور
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');
    if (newPassword.length < 6) { setPasswordError('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return; }
    if (newPassword !== confirmPassword) { setPasswordError('كلمة المرور غير متطابقة'); return; }
    setPasswordSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/user/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setPasswordSuccess('تم تغيير كلمة المرور بنجاح');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      setTimeout(() => { setShowPasswordForm(false); setPasswordSuccess(''); }, 2000);
    } catch (err) {
      setPasswordError(err.message || 'خطأ في تغيير كلمة المرور');
    } finally {
      setPasswordSubmitting(false);
    }
  };

  // حذف الحساب
  const handleDeleteAccount = async () => {
    setDeleteError('');
    try {
      const res = await fetch(`${API_BASE}/user/account`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password: deletePassword || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      logout();
    } catch (err) {
      setDeleteError(err.message || 'خطأ في حذف الحساب');
    }
  };

  const timeAgo = (date) => {
    if (!date) return '';
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'الآن';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `منذ ${minutes} دقيقة`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `منذ ${hours} ساعة`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `منذ ${days} يوم`;
    const months = Math.floor(days / 30);
    if (months < 12) return `منذ ${months} شهر`;
    return `منذ ${Math.floor(months / 12)} سنة`;
  };

  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const getPointsBadge = (points) => {
    if (points >= 100) return { label: 'خبير', color: 'bg-amber-100 text-amber-700' };
    if (points >= 50) return { label: 'متميز', color: 'bg-blue-100 text-blue-700' };
    if (points >= 20) return { label: 'نشيط', color: 'bg-emerald-100 text-emerald-700' };
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <svg className="w-16 h-16 mx-auto mb-4 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <p className="text-gray-500 mb-4">المستخدم غير موجود</p>
        <Link to="/" className="text-blue-600 hover:text-blue-700 text-sm font-medium">العودة للرئيسية</Link>
      </div>
    );
  }

  const badge = getPointsBadge(profile.points || 0);
  const avatarSrc = profile.avatar_url ? (profile.avatar_url.startsWith('http') ? profile.avatar_url : `${API_BASE.replace('/api', '')}${profile.avatar_url}`) : null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <SEO title={`${profile.name} | الملف الشخصي`} />

      {/* رأس الملف الشخصي */}
      <div className="bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 rounded-2xl overflow-hidden shadow-lg mb-6">
        <div className="px-6 pt-8 pb-6">
          <div className="flex items-start gap-5">
            {/* الأفاتار */}
            <div className="flex-shrink-0 relative group">
              <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white text-3xl font-bold border-4 border-white/30 shadow-lg overflow-hidden">
                {avatarSrc ? (
                  <img src={avatarSrc} alt={profile.name} className="w-full h-full object-cover" />
                ) : (
                  profile.name?.charAt(0)
                )}
              </div>
              {isOwnProfile && (
                <>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={avatarUploading}
                    className="absolute inset-0 w-20 h-20 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    {avatarUploading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </>
              )}
            </div>

            {/* المعلومات */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <h1 className="text-xl font-bold text-white">{profile.name}</h1>
                {badge && (
                  <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${badge.color}`}>{badge.label}</span>
                )}
              </div>
              {profile.bio && (
                <p className="text-sm text-blue-100 leading-relaxed mb-3 max-w-lg">{profile.bio}</p>
              )}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5">
                  <svg className="w-4 h-4 text-yellow-300" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  <span className="text-sm font-bold text-white">{profile.points || 0}</span>
                  <span className="text-xs text-blue-200">نقطة</span>
                </div>
              </div>
              {(profile.stage_name || profile.grade_name) && (
                <div className="flex items-center gap-2 flex-wrap">
                  {profile.stage_name && <span className="text-[11px] bg-white/15 text-white px-2.5 py-1 rounded-full">{profile.stage_name}</span>}
                  {profile.grade_name && <span className="text-[11px] bg-white/15 text-white px-2.5 py-1 rounded-full">{profile.grade_name}</span>}
                </div>
              )}
            </div>

            {isOwnProfile && !editing && (
              <button onClick={startEditing} className="flex-shrink-0 bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                تعديل
              </button>
            )}
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-sm border-t border-white/10">
          <div className="flex items-center justify-around py-4 px-6">
            <div className="text-center">
              <p className="text-lg font-bold text-white">{profile.questions_count || 0}</p>
              <p className="text-xs text-blue-200">سؤال</p>
            </div>
            <div className="w-px h-8 bg-white/20"></div>
            <div className="text-center">
              <p className="text-lg font-bold text-white">{profile.answers_count || 0}</p>
              <p className="text-xs text-blue-200">إجابة</p>
            </div>
            <div className="w-px h-8 bg-white/20"></div>
            <div className="text-center">
              <p className="text-lg font-bold text-white">{profile.best_answers_count || 0}</p>
              <p className="text-xs text-blue-200">أفضل إجابة</p>
            </div>
            <div className="w-px h-8 bg-white/20"></div>
            <div className="text-center">
              <p className="text-sm font-medium text-white">{formatDate(profile.created_at)}</p>
              <p className="text-xs text-blue-200">عضو منذ</p>
            </div>
          </div>
        </div>
      </div>

      {/* نموذج تعديل الملف الشخصي */}
      {editing && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-800 mb-4">تعديل الملف الشخصي</h2>
          {editError && <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3 mb-4">{editError}</div>}
          {editSuccess && <div className="bg-green-50 border border-green-100 text-green-600 text-sm rounded-xl px-4 py-3 mb-4">{editSuccess}</div>}

          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الاسم <span className="text-red-500">*</span></label>
              <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">النبذة الشخصية</label>
              <textarea value={editBio} onChange={e => setEditBio(e.target.value)} placeholder="اكتب نبذة قصيرة عنك..." rows={3}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-none" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">المرحلة الدراسية</label>
                <select value={editStageId} onChange={e => { setEditStageId(e.target.value); setEditGradeId(''); }}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400">
                  <option value="">اختر المرحلة</option>
                  {stages.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">الصف الدراسي</label>
                <select value={editGradeId} onChange={e => setEditGradeId(e.target.value)} disabled={!editStageId}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 disabled:opacity-50">
                  <option value="">اختر الصف</option>
                  {stageGrades.map(g => (<option key={g.id} value={g.id}>{g.name}</option>))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
              <button type="submit" disabled={editSubmitting}
                className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
                {editSubmitting ? 'جاري الحفظ...' : 'حفظ التعديلات'}
              </button>
              <button type="button" onClick={() => setEditing(false)}
                className="bg-gray-100 text-gray-700 px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors">
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* إعدادات الحساب (لصاحب الملف فقط) */}
      {isOwnProfile && !editing && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-800 mb-4">إعدادات الحساب</h2>

          <div className="space-y-3">
            {/* البريد الإلكتروني */}
            <div className="flex items-center justify-between py-3 border-b border-gray-50">
              <div>
                <p className="text-sm font-medium text-gray-700">البريد الإلكتروني</p>
                <p className="text-xs text-gray-400 mt-0.5">{currentUser?.email}</p>
              </div>
            </div>

            {/* تغيير كلمة المرور */}
            <div className="py-3 border-b border-gray-50">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">كلمة المرور</p>
                <button onClick={() => { setShowPasswordForm(!showPasswordForm); setPasswordError(''); setPasswordSuccess(''); }}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                  {showPasswordForm ? 'إلغاء' : 'تغيير'}
                </button>
              </div>

              {showPasswordForm && (
                <form onSubmit={handlePasswordChange} className="mt-4 space-y-3">
                  {passwordError && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl border border-red-100">{passwordError}</div>}
                  {passwordSuccess && <div className="bg-green-50 text-green-600 text-sm p-3 rounded-xl border border-green-100">{passwordSuccess}</div>}
                  <input type="password" placeholder="كلمة المرور الحالية" value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)} required
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400" />
                  <input type="password" placeholder="كلمة المرور الجديدة (6 أحرف على الأقل)" value={newPassword}
                    onChange={e => setNewPassword(e.target.value)} required minLength={6}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400" />
                  <input type="password" placeholder="تأكيد كلمة المرور الجديدة" value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)} required
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400" />
                  <button type="submit" disabled={passwordSubmitting}
                    className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
                    {passwordSubmitting ? 'جاري التغيير...' : 'تغيير كلمة المرور'}
                  </button>
                </form>
              )}
            </div>

            {/* حذف الحساب */}
            <div className="py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-600">حذف الحساب</p>
                  <p className="text-xs text-gray-400 mt-0.5">سيتم حذف جميع بياناتك نهائياً</p>
                </div>
                <button onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
                  className="text-sm text-red-500 hover:text-red-600 font-medium border border-red-200 px-4 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
                  حذف
                </button>
              </div>

              {showDeleteConfirm && (
                <div className="mt-4 bg-red-50 border border-red-100 rounded-xl p-4">
                  <p className="text-sm text-red-700 font-bold mb-3">هل أنت متأكد؟ لا يمكن التراجع عن هذا الإجراء.</p>
                  {deleteError && <div className="bg-red-100 text-red-700 text-sm p-2 rounded-lg mb-3">{deleteError}</div>}
                  {currentUser?.auth_provider === 'local' || currentUser?.auth_provider === 'both' ? (
                    <input type="password" placeholder="أدخل كلمة المرور للتأكيد" value={deletePassword}
                      onChange={e => setDeletePassword(e.target.value)}
                      className="w-full border border-red-200 rounded-xl px-4 py-3 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-red-500/30" />
                  ) : null}
                  <div className="flex gap-3">
                    <button onClick={handleDeleteAccount}
                      className="bg-red-600 text-white px-6 py-2 rounded-xl text-sm font-medium hover:bg-red-700 transition-colors">
                      نعم، احذف حسابي
                    </button>
                    <button onClick={() => { setShowDeleteConfirm(false); setDeleteError(''); }}
                      className="bg-white text-gray-700 px-6 py-2 rounded-xl text-sm font-medium border border-gray-200 hover:bg-gray-50 transition-colors">
                      إلغاء
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* التبويبات */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="flex border-b border-gray-100">
          <button onClick={() => setActiveTab('questions')}
            className={`flex-1 text-center py-3.5 text-sm font-medium transition-all relative ${activeTab === 'questions' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              الأسئلة ({questions.length})
            </span>
            {activeTab === 'questions' && <div className="absolute bottom-0 right-0 left-0 h-0.5 bg-blue-600"></div>}
          </button>
          <button onClick={() => setActiveTab('answers')}
            className={`flex-1 text-center py-3.5 text-sm font-medium transition-all relative ${activeTab === 'answers' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              الإجابات ({answers.length})
            </span>
            {activeTab === 'answers' && <div className="absolute bottom-0 right-0 left-0 h-0.5 bg-blue-600"></div>}
          </button>
        </div>

        <div className="p-4">
          {activeTab === 'questions' && (
            questions.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm">لم يطرح أي أسئلة بعد</p>
              </div>
            ) : (
              <div className="space-y-3">
                {questions.map(q => (
                  <Link key={q.id} to={`/faq/question/${q.id}`}
                    className="block bg-gray-50 hover:bg-blue-50/50 rounded-xl p-4 transition-all group border border-transparent hover:border-blue-100">
                    <div className="flex gap-3">
                      <div className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center text-xs font-bold flex-shrink-0 ${
                        q.best_answer_id ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                          : q.answers_count > 0 ? 'bg-blue-50 text-blue-600 border border-blue-200'
                          : 'bg-gray-100 text-gray-400 border border-gray-200'}`}>
                        <span className="text-sm leading-none">{q.answers_count || 0}</span>
                        <span className="text-[8px] mt-0.5">إجابة</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="text-sm font-bold text-gray-800 group-hover:text-blue-600 transition-colors line-clamp-1">{q.title}</h3>
                          {q.best_answer_id && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                              محلول
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                          {q.stage_name && <span className="text-[10px] bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full font-medium">{q.stage_name}</span>}
                          {q.grade_name && <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">{q.grade_name}</span>}
                          {q.subject_name && <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-medium">{q.subject_name}</span>}
                          <span>{timeAgo(q.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )
          )}

          {activeTab === 'answers' && (
            answers.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                <p className="text-sm">لم يقدم أي إجابات بعد</p>
              </div>
            ) : (
              <div className="space-y-3">
                {answers.map(a => (
                  <Link key={a.id} to={`/faq/question/${a.question_id}`}
                    className={`block rounded-xl p-4 transition-all group border ${
                      a.is_best ? 'bg-emerald-50/50 border-emerald-100 hover:border-emerald-200'
                        : 'bg-gray-50 border-transparent hover:bg-blue-50/50 hover:border-blue-100'}`}>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-[10px] text-gray-400 font-medium">إجابة على:</span>
                      <span className="text-sm font-bold text-gray-700 group-hover:text-blue-600 transition-colors line-clamp-1">{a.question_title || 'سؤال'}</span>
                      {a.is_best && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          أفضل إجابة
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed mb-2">{a.body}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>{(a.upvotes || 0) - (a.downvotes || 0)} صوت</span>
                      <span>{timeAgo(a.created_at)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
