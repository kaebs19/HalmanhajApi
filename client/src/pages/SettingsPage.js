import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api, { SERVER_URL } from '../lib/api';
import DashboardLayout from './DashboardLayout';
import subjectTemplates from '../data/subjectTemplates';
import { Alert, Button, Input, FormField, Card, LoadingState, Textarea } from '../components/ui';
import EmojiPicker from '../components/EmojiPicker';

export default function SettingsPage() {
  const { admin, updateAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('account');

  const tabs = [
    { id: 'account', label: 'الحساب' },
    { id: 'templates', label: 'مواد جاهزة' },
    { id: 'site', label: 'إعدادات الموقع' },
    { id: 'pages', label: 'الصفحات' },
  ];

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">الإعدادات</h1>
        <p className="text-gray-500 text-sm mb-6">إدارة حسابك وإعدادات النظام</p>

        {/* تبويبات */}
        <div className="flex bg-gray-100 rounded-lg p-1 mb-6 w-fit flex-wrap gap-0.5">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'account' ? (
          <AccountTab admin={admin} updateAdmin={updateAdmin} />
        ) : activeTab === 'templates' ? (
          <TemplatesTab />
        ) : activeTab === 'pages' ? (
          <PagesTab />
        ) : (
          <SiteSettingsTab />
        )}
      </div>
    </DashboardLayout>
  );
}

// ======================== تبويب الحساب ========================

function AccountTab({ admin, updateAdmin }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <ProfileForm admin={admin} updateAdmin={updateAdmin} />
      <PasswordForm />
    </div>
  );
}

function ProfileForm({ admin, updateAdmin }) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (admin) {
      setDisplayName(admin.display_name || '');
      setEmail(admin.email || '');
    }
  }, [admin]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const res = await api.put('/auth/profile', {
        display_name: displayName,
        email
      });
      updateAdmin({ display_name: res.data.display_name, email: res.data.email });
      setSuccess('تم تحديث البيانات بنجاح');
    } catch (err) {
      setError(err.response?.data?.message || 'خطأ في تحديث البيانات');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-gray-700 mb-4">بيانات الحساب</h2>

      {error && <Alert>{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="اسم المستخدم">
          <Input type="text" value={admin?.username || ''} disabled className="bg-gray-50" />
        </FormField>

        <FormField label="الاسم الكامل">
          <Input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="أدخل اسمك الكامل"
          />
        </FormField>

        <FormField label="البريد الإلكتروني">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@email.com"
            dir="ltr"
          />
        </FormField>

        <Button type="submit" disabled={loading}>
          {loading ? 'جاري الحفظ...' : 'حفظ التغييرات'}
        </Button>
      </form>
    </Card>
  );
}

function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('كلمة المرور الجديدة غير متطابقة');
      return;
    }

    if (newPassword.length < 6) {
      setError('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    setLoading(true);
    try {
      await api.put('/auth/password', {
        current_password: currentPassword,
        new_password: newPassword
      });
      setSuccess('تم تغيير كلمة المرور بنجاح');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.response?.data?.message || 'خطأ في تغيير كلمة المرور');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-gray-700 mb-4">تغيير كلمة المرور</h2>

      {error && <Alert>{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="كلمة المرور الحالية">
          <Input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="أدخل كلمة المرور الحالية"
            required
          />
        </FormField>

        <FormField label="كلمة المرور الجديدة">
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="أدخل كلمة المرور الجديدة"
            required
          />
        </FormField>

        <FormField label="تأكيد كلمة المرور الجديدة">
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="أعد إدخال كلمة المرور الجديدة"
            required
          />
        </FormField>

        <Button type="submit" disabled={loading}>
          {loading ? 'جاري التغيير...' : 'تغيير كلمة المرور'}
        </Button>
      </form>
    </Card>
  );
}

// ======================== تبويب المواد الجاهزة ========================

function TemplatesTab() {
  const [existingSubjects, setExistingSubjects] = useState([]);
  const [grades, setGrades] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [, setStages] = useState([]); // eslint-disable-line no-unused-vars
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedGradeIds, setSelectedGradeIds] = useState([]);
  const [selectedTrackIds, setSelectedTrackIds] = useState([]);
  const [addingLoading, setAddingLoading] = useState(false);
  const [customIcon, setCustomIcon] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  // وضع إضافة مادة مخصصة
  const [customMode, setCustomMode] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customImage, setCustomImage] = useState(null);
  const [customImagePreview, setCustomImagePreview] = useState(null);
  // وضع ربط/تعديل مادة موجودة
  const [linkingSubject, setLinkingSubject] = useState(null);
  const [linkedGradeIds, setLinkedGradeIds] = useState([]);
  const [linkedTrackIds, setLinkedTrackIds] = useState([]);
  const [editName, setEditName] = useState('');
  const [editImage, setEditImage] = useState(null);
  const [editImagePreview, setEditImagePreview] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [subjectsRes, gradesRes, tracksRes, stagesRes] = await Promise.all([
          api.get('/subjects'),
          api.get('/grades'),
          api.get('/tracks'),
          api.get('/stages'),
        ]);
        setExistingSubjects(subjectsRes.data);
        setGrades(gradesRes.data);
        setTracks(tracksRes.data);
        setStages(stagesRes.data);
      } catch {
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const isSubjectExists = (templateName) => {
    return existingSubjects.some(s => s.name === templateName);
  };

  // تجميع الصفوف حسب المرحلة
  const gradesByStage = {};
  grades.forEach(g => {
    const stageName = g.stage_name || 'أخرى';
    if (!gradesByStage[stageName]) gradesByStage[stageName] = [];
    gradesByStage[stageName].push(g);
  });

  // تجميع المسارات حسب المرحلة
  const tracksByStage = {};
  tracks.forEach(t => {
    const stageName = t.stage_name || 'أخرى';
    if (!tracksByStage[stageName]) tracksByStage[stageName] = [];
    tracksByStage[stageName].push(t);
  });

  const handleSelectTemplate = (template) => {
    // إذا المادة موجودة → وضع الربط
    if (isSubjectExists(template.name)) {
      const existing = existingSubjects.find(s => s.name === template.name);
      if (linkingSubject?.id === existing.id) {
        setLinkingSubject(null);
        setSelectedGradeIds([]);
        setSelectedTrackIds([]);
        setLinkedGradeIds([]);
        setLinkedTrackIds([]);
        setEditName('');
        setCustomIcon('');
        setEditImage(null);
        setEditImagePreview(null);
      } else {
        setLinkingSubject(existing);
        setEditName(existing.name);
        setCustomIcon(existing.icon || '');
        setEditImagePreview(existing.image_url ? `${SERVER_URL}${existing.image_url}` : null);
        setEditImage(null);
        // الصفوف المرتبطة حالياً
        const currentGrades = (existing.grades || []).map(g => g.grade_id);
        const currentTracks = (existing.tracks || []).map(t => t.track_id);
        setLinkedGradeIds(currentGrades);
        setLinkedTrackIds(currentTracks);
        setSelectedGradeIds([]);
        setSelectedTrackIds([]);
        setSelectedTemplate(null);
        setCustomMode(false);
      }
      setError('');
      setSuccess('');
      return;
    }

    if (selectedTemplate?.name === template.name) {
      setSelectedTemplate(null);
      setSelectedGradeIds([]);
      setSelectedTrackIds([]);
      setCustomIcon('');
    } else {
      setSelectedTemplate(template);
      setCustomIcon(template.icon);
      setSelectedGradeIds([]);
      setSelectedTrackIds([]);
      setLinkingSubject(null);
      setCustomMode(false);
    }
    setError('');
    setSuccess('');
  };

  const toggleGrade = (gradeId) => {
    setSelectedGradeIds(prev =>
      prev.includes(gradeId)
        ? prev.filter(id => id !== gradeId)
        : [...prev, gradeId]
    );
  };

  const toggleTrack = (trackId) => {
    setSelectedTrackIds(prev =>
      prev.includes(trackId)
        ? prev.filter(id => id !== trackId)
        : [...prev, trackId]
    );
  };

  const handleAddSubject = async () => {
    if (!selectedTemplate) return;
    if (selectedGradeIds.length === 0 && selectedTrackIds.length === 0) {
      setError('اختر صف أو مسار واحد على الأقل');
      return;
    }

    setAddingLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('name', selectedTemplate.name);
      formData.append('icon', customIcon || selectedTemplate.icon);
      formData.append('grade_ids', JSON.stringify(selectedGradeIds));
      formData.append('track_ids', JSON.stringify(selectedTrackIds));

      await api.post('/subjects', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // تحديث القائمة
      const res = await api.get('/subjects');
      setExistingSubjects(res.data);
      setSelectedTemplate(null);
      setSelectedGradeIds([]);
      setSelectedTrackIds([]);
      setCustomIcon('');
      setSuccess(`تم إضافة مادة "${selectedTemplate.name}" بنجاح`);
    } catch (err) {
      setError(err.response?.data?.message || 'خطأ في إضافة المادة');
    } finally {
      setAddingLoading(false);
    }
  };

  // تعديل وربط مادة موجودة
  const handleLinkSubject = async () => {
    if (!linkingSubject) return;

    const nameChanged = editName.trim() && editName.trim() !== linkingSubject.name;
    const iconChanged = customIcon !== (linkingSubject.icon || '');
    const imageChanged = editImage !== null;
    const hasNewGrades = selectedGradeIds.length > 0 || selectedTrackIds.length > 0;

    if (!nameChanged && !iconChanged && !imageChanged && !hasNewGrades) {
      setError('لم يتم إجراء أي تعديل');
      return;
    }

    setAddingLoading(true);
    setError('');
    try {
      // تحديث الاسم/الأيقونة/الصورة إذا تغيرت
      if (nameChanged || iconChanged || imageChanged) {
        const formData = new FormData();
        formData.append('name', editName.trim() || linkingSubject.name);
        if (customIcon) formData.append('icon', customIcon);
        if (editImage) formData.append('image', editImage);

        await api.put(`/subjects/${linkingSubject.id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      // ربط بصفوف جديدة إذا تم اختيارها
      if (hasNewGrades) {
        await api.post(`/subjects/${linkingSubject.id}/link-grades`, {
          grade_ids: selectedGradeIds,
          track_ids: selectedTrackIds,
        });
      }

      const res = await api.get('/subjects');
      setExistingSubjects(res.data);
      setLinkingSubject(null);
      setSelectedGradeIds([]);
      setSelectedTrackIds([]);
      setLinkedGradeIds([]);
      setLinkedTrackIds([]);
      setEditName('');
      setCustomIcon('');
      setEditImage(null);
      setEditImagePreview(null);
      setSuccess('تم تحديث المادة بنجاح');
    } catch (err) {
      setError(err.response?.data?.message || 'خطأ في تحديث المادة');
    } finally {
      setAddingLoading(false);
    }
  };

  // إضافة مادة مخصصة
  const handleAddCustomSubject = async () => {
    if (!customName.trim()) {
      setError('أدخل اسم المادة');
      return;
    }
    if (selectedGradeIds.length === 0 && selectedTrackIds.length === 0) {
      setError('اختر صف أو مسار واحد على الأقل');
      return;
    }

    setAddingLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('name', customName.trim());
      if (customIcon) formData.append('icon', customIcon);
      if (customImage) formData.append('image', customImage);
      formData.append('grade_ids', JSON.stringify(selectedGradeIds));
      formData.append('track_ids', JSON.stringify(selectedTrackIds));

      await api.post('/subjects', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const res = await api.get('/subjects');
      setExistingSubjects(res.data);
      setCustomMode(false);
      setCustomName('');
      setCustomIcon('');
      setCustomImage(null);
      setCustomImagePreview(null);
      setSelectedGradeIds([]);
      setSelectedTrackIds([]);
      setSuccess(`تم إضافة مادة "${customName.trim()}" بنجاح`);
    } catch (err) {
      setError(err.response?.data?.message || 'خطأ في إضافة المادة');
    } finally {
      setAddingLoading(false);
    }
  };

  const handleCustomImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setCustomImage(file);
      setCustomImagePreview(URL.createObjectURL(file));
    }
  };

  const handleEditImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setEditImage(file);
      setEditImagePreview(URL.createObjectURL(file));
      setCustomIcon('');
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <p className="text-gray-500 text-sm mb-4">
        اختر من المواد الجاهزة لإضافتها بسرعة. المواد المُضافة يمكن الضغط عليها لربطها بصفوف إضافية
      </p>

      {error && <Alert>{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {/* شبكة المواد الجاهزة */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 mb-4">
        {subjectTemplates.map((template) => {
          const exists = isSubjectExists(template.name);
          const isSelected = selectedTemplate?.name === template.name;
          const existingSubject = exists ? existingSubjects.find(s => s.name === template.name) : null;
          const isLinking = linkingSubject?.id === existingSubject?.id;

          return (
            <button
              key={template.name}
              onClick={() => handleSelectTemplate(template)}
              className={`relative p-4 rounded-xl border-2 text-center transition-all cursor-pointer ${
                isLinking
                  ? 'bg-amber-50 border-amber-400 shadow-md'
                  : exists
                    ? 'bg-gray-50 border-gray-200 hover:border-amber-300 hover:bg-amber-50/50'
                    : isSelected
                      ? 'bg-blue-50 border-blue-400 shadow-md'
                      : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm'
              }`}
            >
              {exists && (
                <span className={`absolute top-1.5 left-1.5 w-5 h-5 ${isLinking ? 'bg-amber-500' : 'bg-green-500'} text-white rounded-full flex items-center justify-center text-xs`}>
                  {isLinking ? '+' : '✓'}
                </span>
              )}
              <span className="text-3xl block mb-2">{template.icon}</span>
              <span className="text-sm font-medium text-gray-700">{template.name}</span>
              {exists && !isLinking && (
                <span className="text-[10px] text-gray-400 block mt-1">اضغط لإضافة لصفوف أخرى</span>
              )}
            </button>
          );
        })}
      </div>

      {/* زر إضافة مادة مخصصة */}
      <div className="mb-6">
        <button
          onClick={() => {
            setCustomMode(!customMode);
            setSelectedTemplate(null);
            setLinkingSubject(null);
            setSelectedGradeIds([]);
            setSelectedTrackIds([]);
            setCustomIcon('');
            setCustomName('');
            setCustomImage(null);
            setCustomImagePreview(null);
            setError('');
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed transition-all ${
            customMode
              ? 'border-blue-400 bg-blue-50 text-blue-700'
              : 'border-gray-300 text-gray-600 hover:border-blue-300 hover:text-blue-600'
          }`}
        >
          <span className="text-lg">{customMode ? '✕' : '➕'}</span>
          <span className="text-sm font-medium">{customMode ? 'إلغاء' : 'إضافة مادة مخصصة'}</span>
        </button>
      </div>

      {/* قسم إضافة مادة مخصصة */}
      {customMode && (
        <Card className="p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">
            إضافة مادة مخصصة
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <FormField label="اسم المادة">
              <Input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="مثال: تربية فكرية"
              />
            </FormField>
          </div>

          {/* الأيقونة أو الصورة */}
          <div className="mb-4">
            <label className="text-gray-600 text-sm font-medium mb-2 block">الأيقونة</label>
            <EmojiPicker
              selectedEmoji={customIcon}
              onSelect={(emoji) => { setCustomIcon(emoji); setCustomImage(null); setCustomImagePreview(null); }}
              compact
            />
          </div>

          <div className="mb-4">
            <label className="text-gray-600 text-sm font-medium mb-2 block">أو ارفع صورة</label>
            <div className="flex items-center gap-4">
              <label className="cursor-pointer bg-gray-100 text-gray-700 px-5 py-2.5 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium">
                اختيار صورة
                <input type="file" accept="image/*" onChange={handleCustomImageChange} className="hidden" />
              </label>
              {customImagePreview && (
                <div className="relative">
                  <img src={customImagePreview} alt="معاينة" className="w-12 h-12 object-cover rounded-lg border" />
                  <button
                    type="button"
                    onClick={() => { setCustomImage(null); setCustomImagePreview(null); }}
                    className="absolute -top-2 -left-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                  >x</button>
                </div>
              )}
            </div>
          </div>

          <p className="text-gray-500 text-sm mb-4">اختر الصفوف والمسارات التي ستُدرَّس فيها هذه المادة</p>

          {/* الصفوف */}
          {grades.length > 0 && (
            <div className="mb-4">
              <label className="text-gray-600 text-sm font-medium mb-2 block">الصفوف</label>
              <div className="bg-gray-50 rounded-lg p-3 space-y-3">
                {Object.entries(gradesByStage).map(([stageName, stageGrades]) => (
                  <div key={stageName}>
                    <p className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                      {stageName}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {stageGrades.map(g => (
                        <label key={g.id} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm cursor-pointer transition-colors border ${
                          selectedGradeIds.includes(g.id) ? 'bg-blue-100 border-blue-300 text-blue-800' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'
                        }`}>
                          <input type="checkbox" checked={selectedGradeIds.includes(g.id)} onChange={() => toggleGrade(g.id)} className="hidden" />
                          {g.name}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* المسارات */}
          {tracks.length > 0 && (
            <div className="mb-4">
              <label className="text-gray-600 text-sm font-medium mb-2 block">المسارات</label>
              <div className="bg-gray-50 rounded-lg p-3 space-y-3">
                {Object.entries(tracksByStage).map(([stageName, stageTracks]) => (
                  <div key={stageName}>
                    <p className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      {stageName}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {stageTracks.map(t => (
                        <label key={t.id} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm cursor-pointer transition-colors border ${
                          selectedTrackIds.includes(t.id) ? 'bg-emerald-100 border-emerald-300 text-emerald-800' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'
                        }`}>
                          <input type="checkbox" checked={selectedTrackIds.includes(t.id)} onChange={() => toggleTrack(t.id)} className="hidden" />
                          {t.name}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button onClick={handleAddCustomSubject} disabled={addingLoading}>
              {addingLoading ? 'جاري الإضافة...' : 'إضافة المادة'}
            </Button>
            <Button variant="secondary" onClick={() => { setCustomMode(false); setCustomName(''); setCustomIcon(''); setCustomImage(null); setCustomImagePreview(null); setSelectedGradeIds([]); setSelectedTrackIds([]); }}>
              إلغاء
            </Button>
          </div>
        </Card>
      )}

      {/* قسم تعديل/ربط مادة موجودة */}
      {linkingSubject && (
        <Card className="p-6 border-amber-200">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">
            تعديل المادة: <span className="text-amber-600">{customIcon || linkingSubject.icon || '📚'} {editName || linkingSubject.name}</span>
          </h3>

          {/* تعديل الاسم */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <FormField label="اسم المادة">
              <Input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="اسم المادة"
              />
            </FormField>
          </div>

          {/* تخصيص الأيقونة */}
          <div className="mb-4">
            <label className="text-gray-600 text-sm font-medium mb-2 block">الأيقونة</label>
            <EmojiPicker
              selectedEmoji={customIcon}
              onSelect={(emoji) => { setCustomIcon(emoji); setEditImage(null); setEditImagePreview(null); }}
              compact
            />
          </div>

          {/* رفع صورة بديلة */}
          <div className="mb-4">
            <label className="text-gray-600 text-sm font-medium mb-2 block">أو ارفع صورة</label>
            <div className="flex items-center gap-4">
              <label className="cursor-pointer bg-gray-100 text-gray-700 px-5 py-2.5 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium">
                اختيار صورة
                <input type="file" accept="image/*" onChange={handleEditImageChange} className="hidden" />
              </label>
              {editImagePreview && (
                <div className="relative">
                  <img src={editImagePreview} alt="معاينة" className="w-12 h-12 object-cover rounded-lg border" />
                  <button
                    type="button"
                    onClick={() => { setEditImage(null); setEditImagePreview(null); }}
                    className="absolute -top-2 -left-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                  >x</button>
                </div>
              )}
            </div>
          </div>

          <hr className="my-4 border-gray-200" />
          <p className="text-gray-500 text-sm mb-4">يمكنك أيضاً ربط المادة بصفوف أو مسارات إضافية</p>

          {/* الصفوف */}
          {grades.length > 0 && (
            <div className="mb-4">
              <label className="text-gray-600 text-sm font-medium mb-2 block">الصفوف</label>
              <div className="bg-gray-50 rounded-lg p-3 space-y-3">
                {Object.entries(gradesByStage).map(([stageName, stageGrades]) => (
                  <div key={stageName}>
                    <p className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                      {stageName}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {stageGrades.map(g => {
                        const alreadyLinked = linkedGradeIds.includes(g.id);
                        return (
                          <label key={g.id} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors border ${
                            alreadyLinked
                              ? 'bg-gray-100 border-gray-300 text-gray-400 cursor-default'
                              : selectedGradeIds.includes(g.id)
                                ? 'bg-amber-100 border-amber-300 text-amber-800 cursor-pointer'
                                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100 cursor-pointer'
                          }`}>
                            <input type="checkbox" checked={alreadyLinked || selectedGradeIds.includes(g.id)} onChange={() => !alreadyLinked && toggleGrade(g.id)} disabled={alreadyLinked} className="hidden" />
                            {g.name}
                            {alreadyLinked && <span className="text-[10px] text-gray-400">(مرتبط)</span>}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* المسارات */}
          {tracks.length > 0 && (
            <div className="mb-4">
              <label className="text-gray-600 text-sm font-medium mb-2 block">المسارات</label>
              <div className="bg-gray-50 rounded-lg p-3 space-y-3">
                {Object.entries(tracksByStage).map(([stageName, stageTracks]) => (
                  <div key={stageName}>
                    <p className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      {stageName}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {stageTracks.map(t => {
                        const alreadyLinked = linkedTrackIds.includes(t.id);
                        return (
                          <label key={t.id} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors border ${
                            alreadyLinked
                              ? 'bg-gray-100 border-gray-300 text-gray-400 cursor-default'
                              : selectedTrackIds.includes(t.id)
                                ? 'bg-emerald-100 border-emerald-300 text-emerald-800 cursor-pointer'
                                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100 cursor-pointer'
                          }`}>
                            <input type="checkbox" checked={alreadyLinked || selectedTrackIds.includes(t.id)} onChange={() => !alreadyLinked && toggleTrack(t.id)} disabled={alreadyLinked} className="hidden" />
                            {t.name}
                            {alreadyLinked && <span className="text-[10px] text-gray-400">(مرتبط)</span>}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button onClick={handleLinkSubject} disabled={addingLoading}>
              {addingLoading ? 'جاري الحفظ...' : 'حفظ التعديلات'}
            </Button>
            <Button variant="secondary" onClick={() => { setLinkingSubject(null); setSelectedGradeIds([]); setSelectedTrackIds([]); setLinkedGradeIds([]); setLinkedTrackIds([]); setEditName(''); setCustomIcon(''); setEditImage(null); setEditImagePreview(null); }}>
              إلغاء
            </Button>
          </div>
        </Card>
      )}

      {/* قسم اختيار الصفوف/المسارات عند تحديد مادة جديدة من القوالب */}
      {selectedTemplate && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">
            إضافة مادة: <span className="text-blue-600">{customIcon || selectedTemplate.icon} {selectedTemplate.name}</span>
          </h3>

          {/* تخصيص الأيقونة */}
          <div className="mb-4">
            <label className="text-gray-600 text-sm font-medium mb-2 block">تخصيص الأيقونة</label>
            <EmojiPicker
              selectedEmoji={customIcon}
              onSelect={setCustomIcon}
              compact
            />
          </div>

          <p className="text-gray-500 text-sm mb-4">اختر الصفوف والمسارات التي ستُدرَّس فيها هذه المادة</p>

          {/* الصفوف */}
          {grades.length > 0 && (
            <div className="mb-4">
              <label className="text-gray-600 text-sm font-medium mb-2 block">الصفوف</label>
              <div className="bg-gray-50 rounded-lg p-3 space-y-3">
                {Object.entries(gradesByStage).map(([stageName, stageGrades]) => (
                  <div key={stageName}>
                    <p className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                      {stageName}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {stageGrades.map(g => (
                        <label key={g.id} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm cursor-pointer transition-colors border ${
                          selectedGradeIds.includes(g.id) ? 'bg-blue-100 border-blue-300 text-blue-800' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'
                        }`}>
                          <input type="checkbox" checked={selectedGradeIds.includes(g.id)} onChange={() => toggleGrade(g.id)} className="hidden" />
                          {g.name}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* المسارات */}
          {tracks.length > 0 && (
            <div className="mb-4">
              <label className="text-gray-600 text-sm font-medium mb-2 block">المسارات</label>
              <div className="bg-gray-50 rounded-lg p-3 space-y-3">
                {Object.entries(tracksByStage).map(([stageName, stageTracks]) => (
                  <div key={stageName}>
                    <p className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      {stageName}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {stageTracks.map(t => (
                        <label key={t.id} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm cursor-pointer transition-colors border ${
                          selectedTrackIds.includes(t.id) ? 'bg-emerald-100 border-emerald-300 text-emerald-800' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'
                        }`}>
                          <input type="checkbox" checked={selectedTrackIds.includes(t.id)} onChange={() => toggleTrack(t.id)} className="hidden" />
                          {t.name}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button onClick={handleAddSubject} disabled={addingLoading}>
              {addingLoading ? 'جاري الإضافة...' : 'إضافة المادة'}
            </Button>
            <Button variant="secondary" onClick={() => { setSelectedTemplate(null); setSelectedGradeIds([]); setSelectedTrackIds([]); setCustomIcon(''); }}>
              إلغاء
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

// ======================== تبويب إعدادات الموقع ========================

function SiteSettingsTab() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const logoInputRef = useRef(null);
  const faviconInputRef = useRef(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get('/settings');
        setSettings(res.data);
      } catch {
        setError('خطأ في جلب الإعدادات');
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSocialChange = (platform, value) => {
    const social = typeof settings.social_links === 'object'
      ? { ...settings.social_links }
      : { twitter: '', youtube: '', telegram: '', whatsapp: '' };
    social[platform] = value;
    setSettings(prev => ({ ...prev, social_links: social }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await api.put('/settings', settings);
      setSettings(res.data);
      setSuccess('تم حفظ الإعدادات بنجاح');
    } catch {
      setError('خطأ في حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (file, field) => {
    if (!file) return;
    const setUploading = field === 'logo_url' ? setUploadingLogo : setUploadingFavicon;
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('field', field);
      const res = await api.post('/settings/upload-logo', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSettings(prev => ({ ...prev, [field]: res.data.url }));
      setSuccess(field === 'logo_url' ? 'تم رفع الشعار بنجاح' : 'تم رفع الأيقونة بنجاح');
    } catch {
      setError('خطأ في رفع الملف');
    } finally {
      setUploading(false);
    }
  };

  const socialLinks = typeof settings.social_links === 'object'
    ? settings.social_links
    : { twitter: '', youtube: '', telegram: '', whatsapp: '' };

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      {error && <Alert>{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {/* الشعار واسم الموقع */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          الهوية البصرية
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* الشعار */}
          <div>
            <label className="text-sm font-medium text-gray-600 mb-2 block">شعار الموقع</label>
            <div className="flex items-center gap-4">
              <div
                onClick={() => logoInputRef.current?.click()}
                className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all overflow-hidden"
              >
                {uploadingLogo ? (
                  <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                ) : settings.logo_url ? (
                  <img src={`${SERVER_URL}${settings.logo_url}`} alt="شعار" className="w-full h-full object-contain p-1" />
                ) : (
                  <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                )}
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500 mb-2">PNG, JPG, WebP - يفضل 200x200 بكسل</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200"
                  >
                    {settings.logo_url ? 'تغيير الشعار' : 'رفع شعار'}
                  </button>
                  {settings.logo_url && (
                    <button
                      type="button"
                      onClick={() => handleChange('logo_url', null)}
                      className="text-xs px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors border border-red-200"
                    >
                      إزالة
                    </button>
                  )}
                </div>
              </div>
            </div>
            <input ref={logoInputRef} type="file" accept=".png,.jpg,.jpeg,.webp,.svg" onChange={(e) => handleUpload(e.target.files[0], 'logo_url')} className="hidden" />
          </div>

          {/* الأيقونة المفضلة */}
          <div>
            <label className="text-sm font-medium text-gray-600 mb-2 block">الأيقونة المفضلة (Favicon)</label>
            <div className="flex items-center gap-4">
              <div
                onClick={() => faviconInputRef.current?.click()}
                className="w-14 h-14 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all overflow-hidden"
              >
                {uploadingFavicon ? (
                  <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                ) : settings.favicon_url ? (
                  <img src={`${SERVER_URL}${settings.favicon_url}`} alt="favicon" className="w-full h-full object-contain p-1" />
                ) : (
                  <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                )}
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500 mb-2">PNG أو ICO - 32x32 أو 64x64</p>
                <button
                  type="button"
                  onClick={() => faviconInputRef.current?.click()}
                  className="text-xs px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200"
                >
                  {settings.favicon_url ? 'تغيير' : 'رفع أيقونة'}
                </button>
              </div>
            </div>
            <input ref={faviconInputRef} type="file" accept=".png,.ico,.jpg,.webp" onChange={(e) => handleUpload(e.target.files[0], 'favicon_url')} className="hidden" />
          </div>
        </div>

        {/* اسم الموقع */}
        <div className="mt-6">
          <FormField label="اسم الموقع">
            <Input
              type="text"
              value={settings.site_name || ''}
              onChange={(e) => handleChange('site_name', e.target.value)}
              placeholder="حل المنهج"
            />
          </FormField>
        </div>

        {/* اللون الرئيسي */}
        <div className="mt-4">
          <FormField label="اللون الرئيسي">
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.primary_color || '#2563eb'}
                onChange={(e) => handleChange('primary_color', e.target.value)}
                className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer"
              />
              <Input
                type="text"
                value={settings.primary_color || '#2563eb'}
                onChange={(e) => handleChange('primary_color', e.target.value)}
                dir="ltr"
                className="w-32"
                placeholder="#2563eb"
              />
              <div
                className="h-10 flex-1 rounded-lg border"
                style={{ backgroundColor: settings.primary_color || '#2563eb' }}
              ></div>
            </div>
          </FormField>
        </div>
      </Card>

      {/* الفصل الدراسي الافتراضي */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          الفصل الدراسي
        </h2>
        <FormField label="الفصل الدراسي الافتراضي">
          <select
            value={settings.default_semester || '0'}
            onChange={(e) => handleChange('default_semester', e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            <option value="0">الكل (عرض جميع الفصول)</option>
            <option value="1">الفصل الدراسي الأول</option>
            <option value="2">الفصل الدراسي الثاني</option>
          </select>
          <p className="text-xs text-gray-400 mt-1.5">سيتم تطبيق هذا الفصل كافتراضي للزوار الجدد. يمكن للمستخدم تغييره لاحقاً.</p>
        </FormField>
      </Card>

      {/* SEO العام */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          تحسين محركات البحث (SEO)
        </h2>

        <div className="space-y-4">
          <FormField label="عنوان الموقع (Title)">
            <Input
              type="text"
              value={settings.seo_title || ''}
              onChange={(e) => handleChange('seo_title', e.target.value)}
              placeholder="حل المنهج - حلول المناهج الدراسية السعودية"
            />
            <p className="text-xs text-gray-400 mt-1">{(settings.seo_title || '').length}/60 حرف</p>
          </FormField>

          <FormField label="وصف الموقع (Description)">
            <Textarea
              value={settings.seo_description || ''}
              onChange={(e) => handleChange('seo_description', e.target.value)}
              placeholder="وصف مختصر يظهر في نتائج البحث..."
              rows={3}
            />
            <p className="text-xs text-gray-400 mt-1">{(settings.seo_description || '').length}/155 حرف</p>
          </FormField>

          <FormField label="الكلمات المفتاحية">
            <Input
              type="text"
              value={settings.seo_keywords || ''}
              onChange={(e) => handleChange('seo_keywords', e.target.value)}
              placeholder="حل كتاب, حلول, مناهج, السعودية"
            />
            <p className="text-xs text-gray-400 mt-1">افصل بين الكلمات بفاصلة</p>
          </FormField>
        </div>
      </Card>

      {/* التواصل والفوتر */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
          التواصل والفوتر
        </h2>

        <div className="space-y-4">
          <FormField label="البريد الإلكتروني للتواصل">
            <Input
              type="email"
              value={settings.contact_email || ''}
              onChange={(e) => handleChange('contact_email', e.target.value)}
              placeholder="info@halmanhaj.com"
              dir="ltr"
            />
          </FormField>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="تويتر (X)">
              <Input
                type="text"
                value={socialLinks.twitter || ''}
                onChange={(e) => handleSocialChange('twitter', e.target.value)}
                placeholder="https://twitter.com/..."
                dir="ltr"
              />
            </FormField>
            <FormField label="يوتيوب">
              <Input
                type="text"
                value={socialLinks.youtube || ''}
                onChange={(e) => handleSocialChange('youtube', e.target.value)}
                placeholder="https://youtube.com/..."
                dir="ltr"
              />
            </FormField>
            <FormField label="تليجرام">
              <Input
                type="text"
                value={socialLinks.telegram || ''}
                onChange={(e) => handleSocialChange('telegram', e.target.value)}
                placeholder="https://t.me/..."
                dir="ltr"
              />
            </FormField>
            <FormField label="واتساب">
              <Input
                type="text"
                value={socialLinks.whatsapp || ''}
                onChange={(e) => handleSocialChange('whatsapp', e.target.value)}
                placeholder="https://wa.me/..."
                dir="ltr"
              />
            </FormField>
          </div>

          <FormField label="نص الفوتر">
            <Input
              type="text"
              value={settings.footer_text || ''}
              onChange={(e) => handleChange('footer_text', e.target.value)}
              placeholder="جميع الحقوق محفوظة لموقع حل المنهج"
            />
          </FormField>
        </div>
      </Card>

      {/* زر الحفظ */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving} className="px-8">
          {saving ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              جاري الحفظ...
            </span>
          ) : 'حفظ جميع الإعدادات'}
        </Button>
      </div>
    </div>
  );
}

// ======================== تبويب الصفحات (سياسة الخصوصية، شروط الاستخدام، اتصل بنا) ========================

const PAGE_CONFIGS = [
  {
    key: 'privacy_policy',
    title: 'سياسة الخصوصية',
    icon: (
      <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    placeholder: 'اكتب سياسة الخصوصية هنا...\n\nمثال:\n- نحن نحترم خصوصية المستخدمين\n- البيانات المجمعة تستخدم لتحسين الخدمة فقط\n- لا نشارك بياناتك مع أطراف ثالثة',
    hint: 'يدعم HTML. اكتب سياسة الخصوصية التي ستظهر في صفحة /privacy',
    url: '/privacy'
  },
  {
    key: 'terms_of_service',
    title: 'شروط الاستخدام',
    icon: (
      <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    placeholder: 'اكتب شروط الاستخدام هنا...\n\nمثال:\n- باستخدامك للموقع فأنت توافق على هذه الشروط\n- المحتوى التعليمي متاح للاستخدام الشخصي فقط\n- يحظر إعادة نشر المحتوى بدون إذن',
    hint: 'يدعم HTML. اكتب شروط الاستخدام التي ستظهر في صفحة /terms',
    url: '/terms'
  },
  {
    key: 'contact_page',
    title: 'اتصل بنا',
    icon: (
      <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    placeholder: 'اكتب محتوى صفحة اتصل بنا...\n\nمثال:\n- البريد الإلكتروني: info@halmanhaj.com\n- تويتر: @halmanhaj\n- نسعد بتواصلكم واستفساراتكم',
    hint: 'يدعم HTML. اكتب محتوى صفحة التواصل التي ستظهر في صفحة /contact',
    url: '/contact'
  },
];

function PagesTab() {
  const [pages, setPages] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [expandedPage, setExpandedPage] = useState(null);

  useEffect(() => {
    const fetchPages = async () => {
      try {
        const res = await api.get('/settings');
        setPages({
          privacy_policy: res.data.privacy_policy || '',
          terms_of_service: res.data.terms_of_service || '',
          contact_page: res.data.contact_page || '',
        });
      } catch {
        setError('خطأ في جلب البيانات');
      } finally {
        setLoading(false);
      }
    };
    fetchPages();
  }, []);

  const handleChange = (key, value) => {
    setPages(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async (key) => {
    setSaving(key);
    setError('');
    setSuccess('');
    try {
      await api.put('/settings', { [key]: pages[key] });
      const config = PAGE_CONFIGS.find(p => p.key === key);
      setSuccess(`تم حفظ "${config.title}" بنجاح`);
    } catch {
      setError('خطأ في الحفظ');
    } finally {
      setSaving(null);
    }
  };

  const handleSaveAll = async () => {
    setSaving('all');
    setError('');
    setSuccess('');
    try {
      await api.put('/settings', pages);
      setSuccess('تم حفظ جميع الصفحات بنجاح');
    } catch {
      setError('خطأ في الحفظ');
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-sm">
            إدارة محتوى الصفحات القانونية والتواصل. يدعم HTML للتنسيق المتقدم.
          </p>
        </div>
        <Button onClick={handleSaveAll} disabled={saving === 'all'} className="px-6">
          {saving === 'all' ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              جاري الحفظ...
            </span>
          ) : 'حفظ الكل'}
        </Button>
      </div>

      {error && <Alert>{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {PAGE_CONFIGS.map(config => {
        const isExpanded = expandedPage === config.key;
        const hasContent = pages[config.key]?.trim().length > 0;

        return (
          <Card key={config.key} className="overflow-hidden">
            {/* رأس البطاقة */}
            <div
              className="p-5 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => setExpandedPage(isExpanded ? null : config.key)}
            >
              <div className="flex items-center gap-3">
                {config.icon}
                <div>
                  <h3 className="font-semibold text-gray-800">{config.title}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {hasContent ? (
                      <span className="text-green-600 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                        محتوى مضاف ({pages[config.key].length} حرف)
                      </span>
                    ) : (
                      <span className="text-gray-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                        لا يوجد محتوى بعد
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {hasContent && (
                  <a
                    href={config.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    معاينة
                  </a>
                )}
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* محتوى المحرر */}
            {isExpanded && (
              <div className="border-t border-gray-100 p-5">
                <div className="mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">HTML</span>
                    <span className="text-xs text-gray-400">{config.hint}</span>
                  </div>
                  <textarea
                    value={pages[config.key] || ''}
                    onChange={(e) => handleChange(config.key, e.target.value)}
                    placeholder={config.placeholder}
                    rows={12}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono leading-relaxed resize-y min-h-[200px]"
                    dir="rtl"
                  />
                </div>

                {/* معاينة مباشرة */}
                {pages[config.key]?.trim() && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-gray-500 mb-2">معاينة:</p>
                    <div
                      className="bg-gray-50 rounded-xl p-4 border border-gray-200 prose prose-sm max-w-none text-gray-700"
                      style={{ direction: 'rtl' }}
                      dangerouslySetInnerHTML={{ __html: pages[config.key] }}
                    />
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <Button
                    onClick={() => handleSave(config.key)}
                    disabled={saving === config.key}
                  >
                    {saving === config.key ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        جاري الحفظ...
                      </span>
                    ) : `حفظ ${config.title}`}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        );
      })}

      {/* نصائح */}
      <Card className="p-5 bg-blue-50 border-blue-200">
        <h4 className="font-semibold text-blue-800 text-sm mb-2 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          نصائح لكتابة المحتوى
        </h4>
        <ul className="text-xs text-blue-700 space-y-1.5 list-disc list-inside">
          <li>يمكنك استخدام HTML مثل <code className="bg-blue-100 px-1 rounded">&lt;h2&gt;</code> للعناوين و <code className="bg-blue-100 px-1 rounded">&lt;p&gt;</code> للفقرات</li>
          <li>استخدم <code className="bg-blue-100 px-1 rounded">&lt;ul&gt;&lt;li&gt;</code> للقوائم المنقطة</li>
          <li>استخدم <code className="bg-blue-100 px-1 rounded">&lt;strong&gt;</code> للنص الغامق و <code className="bg-blue-100 px-1 rounded">&lt;a href="..."&gt;</code> للروابط</li>
          <li>الصفحات تظهر في فوتر الموقع تلقائياً عند إضافة المحتوى</li>
        </ul>
      </Card>
    </div>
  );
}
