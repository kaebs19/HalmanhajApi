import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api, { SERVER_URL } from '../lib/api';
import DashboardLayout from './DashboardLayout';
import subjectTemplates from '../data/subjectTemplates';
import { Alert, Button, Input, FormField, Card, LoadingState, Textarea } from '../components/ui';
import { useToast } from '../components/ui/Toast';
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

// شريحة اختيار (صف/مسار)
function Chip({ active, disabled, tone = 'blue', onClick, children }) {
  const tones = {
    blue: 'bg-blue-100 border-blue-300 text-blue-800',
    emerald: 'bg-emerald-100 border-emerald-300 text-emerald-800',
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors border ${
        disabled
          ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
          : active
            ? `${tones[tone]} cursor-pointer`
            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100 cursor-pointer'
      }`}
    >
      {children}
    </button>
  );
}

// اختيار الصفوف والمسارات — المسارات تُعرض حسب الصفوف المختارة لتسهيل الاختيار
// singleGrade: صف واحد فقط (كل مادة تخص صفاً واحداً بدروسه)
function PlacementPicker({ grades, tracks, gradeIds, trackIds, onToggleGrade, onToggleTrack, singleGrade }) {
  const gradesByStage = {};
  grades.forEach(g => {
    const key = g.stage_name || 'أخرى';
    if (!gradesByStage[key]) gradesByStage[key] = [];
    gradesByStage[key].push(g);
  });

  // المسارات المرتبطة بالصفوف المختارة (grade_tracks)، وإن لم يُختر صف نعرض كل المسارات
  const allowedTrackIds = new Set();
  grades
    .filter(g => gradeIds.includes(g.id))
    .forEach(g => (g.tracks || []).forEach(t => allowedTrackIds.add(t.track_id)));

  const visibleTracks = allowedTrackIds.size > 0
    ? tracks.filter(t => allowedTrackIds.has(t.id))
    : tracks;

  const tracksByStage = {};
  visibleTracks.forEach(t => {
    const key = t.stage_name || 'أخرى';
    if (!tracksByStage[key]) tracksByStage[key] = [];
    tracksByStage[key].push(t);
  });

  return (
    <>
      <div className="mb-4">
        <label className="text-gray-600 text-sm font-medium mb-2 block">
          {singleGrade ? 'الصف' : 'الصفوف'}
          {singleGrade && (
            <span className="text-xs text-gray-400 font-normal mr-2">
              — صف واحد فقط، لأن لكل صف دروسه الخاصة
            </span>
          )}
        </label>
        <div className="bg-gray-50 rounded-lg p-3 space-y-3">
          {Object.entries(gradesByStage).map(([stageName, stageGrades]) => (
            <div key={stageName}>
              <p className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                {stageName}
              </p>
              <div className="flex flex-wrap gap-2">
                {stageGrades.map(g => (
                  <Chip key={g.id} active={gradeIds.includes(g.id)} onClick={() => onToggleGrade(g.id)}>
                    {g.name}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {visibleTracks.length > 0 && (
        <div className="mb-4">
          <label className="text-gray-600 text-sm font-medium mb-2 block">
            المسارات
            {allowedTrackIds.size > 0 && (
              <span className="text-xs text-gray-400 font-normal"> (مسارات الصفوف المختارة)</span>
            )}
          </label>
          <div className="bg-gray-50 rounded-lg p-3 space-y-3">
            {Object.entries(tracksByStage).map(([stageName, stageTracks]) => (
              <div key={stageName}>
                <p className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  {stageName}
                </p>
                <div className="flex flex-wrap gap-2">
                  {stageTracks.map(t => (
                    <Chip key={t.id} tone="emerald" active={trackIds.includes(t.id)} onClick={() => onToggleTrack(t.id)}>
                      {t.icon ? `${t.icon} ` : ''}{t.name}
                    </Chip>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

const blankForm = () => ({
  name: '',
  icon: '',
  image: null,
  imagePreview: null,
  removeImage: false,
  description: '',
  keywords: '',
  gradeIds: [],
  trackIds: [],
  sortOrder: '',
});

function TemplatesTab() {
  const { toast } = useToast();
  const [existingSubjects, setExistingSubjects] = useState([]);
  const [grades, setGrades] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // نطاق العمل: مرحلة ← صف ← مسار
  const [scopeStageId, setScopeStageId] = useState('');
  const [scopeGradeId, setScopeGradeId] = useState('');
  const [scopeTrackId, setScopeTrackId] = useState('');

  // اللوحة المفتوحة: null | 'add' | 'edit' | 'instances'
  const [panel, setPanel] = useState(null);
  const [activeTemplate, setActiveTemplate] = useState(null);
  const [editingSubject, setEditingSubject] = useState(null);
  const [form, setForm] = useState(blankForm());

  // نسخ لصفوف/مسارات أخرى (في وضع التعديل)
  const [copyGradeIds, setCopyGradeIds] = useState([]);
  const [copyTrackIds, setCopyTrackIds] = useState([]);
  const [copyLessons, setCopyLessons] = useState(false);
  const [showCopy, setShowCopy] = useState(false);

  const fetchSubjects = async () => {
    const res = await api.get('/subjects');
    setExistingSubjects(res.data);
    return res.data;
  };

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
        setError('خطأ في جلب البيانات');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // ————— مساعدات النطاق —————
  const scopeGrades = scopeStageId ? grades.filter(g => g.stage_id === scopeStageId) : grades;
  const scopeGrade = grades.find(g => g.id === scopeGradeId) || null;
  const scopeTracks = (() => {
    if (scopeGrade) {
      const ids = new Set((scopeGrade.tracks || []).map(t => t.track_id));
      return tracks.filter(t => ids.has(t.id));
    }
    return scopeStageId ? tracks.filter(t => t.stage_id === scopeStageId) : [];
  })();

  const closePanel = () => {
    setPanel(null);
    setActiveTemplate(null);
    setEditingSubject(null);
    setForm(blankForm());
    setCopyGradeIds([]);
    setCopyTrackIds([]);
    setCopyLessons(false);
    setShowCopy(false);
  };

  const handleStageScope = (stageId) => {
    setScopeStageId(stageId);
    setScopeGradeId('');
    setScopeTrackId('');
    closePanel();
  };

  const handleGradeScope = (gradeId) => {
    setScopeGradeId(gradeId);
    setScopeTrackId('');
    closePanel();
  };

  const handleTrackScope = (trackId) => {
    setScopeTrackId(trackId);
    closePanel();
  };

  // ————— مساعدات المواد —————
  const instancesOf = (templateName) =>
    existingSubjects.filter(s => s.template_key === templateName || s.name === templateName);

  const inScope = (subject) => {
    if (scopeGradeId && !(subject.grades || []).some(g => g.grade_id === scopeGradeId)) return false;
    if (scopeTrackId && !(subject.tracks || []).some(t => t.track_id === scopeTrackId)) return false;
    return true;
  };

  const placementLabel = (subject) => {
    const gradeNames = (subject.grades || []).map(g => g.grade_name);
    const trackNames = (subject.tracks || []).map(t => t.track_name);
    if (gradeNames.length === 0 && trackNames.length === 0) return 'غير مرتبطة بأي صف';
    return [...gradeNames, ...trackNames].join(' • ');
  };

  const scopeSubjects = existingSubjects.filter(inScope);

  // اسم القالب المطابق للاسم المكتوب (إن وُجد) — لإبقاء template_key متوافقاً مع الاسم
  const templateNameOf = (name) => subjectTemplates.find(t => t.name === name)?.name || null;

  // أسماء الصفوف والمسارات المقابلة لقائمة معرفات
  const placementNames = (gradeIds, trackIds) => {
    const names = [
      ...grades.filter(g => gradeIds.includes(g.id)).map(g => g.name),
      ...tracks.filter(t => trackIds.includes(t.id)).map(t => t.name),
    ];
    return names.length > 0 ? names.join(' • ') : 'بدون صف أو مسار';
  };

  // ما الذي سيتغير على المادة الأصلية عند الحفظ (لعرض التحذير ولتأكيده قبل الحفظ)
  const renamed = !!editingSubject && form.name.trim() !== '' && form.name.trim() !== editingSubject.name;

  const removedGradeNames = editingSubject
    ? (editingSubject.grades || [])
        .filter(g => !form.gradeIds.includes(g.grade_id))
        .map(g => g.grade_name)
    : [];

  const removedTrackNames = editingSubject
    ? (editingSubject.tracks || [])
        .filter(t => !form.trackIds.includes(t.track_id))
        .map(t => t.track_name)
    : [];

  // ————— فتح اللوحات —————
  const openAdd = (template) => {
    setPanel('add');
    setActiveTemplate(template);
    setEditingSubject(null);
    setForm({
      ...blankForm(),
      name: template?.name || '',
      icon: template?.icon || '',
      gradeIds: scopeGradeId ? [scopeGradeId] : [],
      trackIds: scopeTrackId ? [scopeTrackId] : [],
    });
    setError('');
    setSuccess('');
  };

  const openEdit = (subject) => {
    setPanel('edit');
    setEditingSubject(subject);
    setActiveTemplate(null);
    setForm({
      ...blankForm(),
      name: subject.name || '',
      icon: subject.icon || '',
      imagePreview: subject.image_url ? `${SERVER_URL}${subject.image_url}` : null,
      description: subject.description || '',
      keywords: subject.keywords || '',
      gradeIds: (subject.grades || []).map(g => g.grade_id),
      trackIds: (subject.tracks || []).map(t => t.track_id),
      sortOrder: subject.sort_order ?? '',
    });
    setCopyGradeIds([]);
    setCopyTrackIds([]);
    setCopyLessons(false);
    setShowCopy(false);
    setError('');
    setSuccess('');
  };

  const handleTemplateClick = (template) => {
    const instances = instancesOf(template.name);
    const scoped = instances.filter(inScope);

    if (scoped.length === 1) {
      // نسخة واحدة داخل النطاق ← تعديلها مباشرة
      if (panel === 'edit' && editingSubject?.id === scoped[0].id) return closePanel();
      return openEdit(scoped[0]);
    }
    if (instances.length > 0) {
      // عدة نسخ أو نسخ خارج النطاق ← اختيار النسخة المقصودة
      if (panel === 'instances' && activeTemplate?.name === template.name) return closePanel();
      setPanel('instances');
      setActiveTemplate(template);
      setEditingSubject(null);
      setError('');
      setSuccess('');
      return;
    }
    return openAdd(template);
  };

  // ————— حقول النموذج —————
  const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  // صف واحد فقط لكل مادة — واختيار صف جديد يُسقط المسارات التي لا تخصه
  const toggleFormGrade = (gradeId) =>
    setForm(prev => {
      if (prev.gradeIds.includes(gradeId)) return { ...prev, gradeIds: [] };
      const grade = grades.find(g => g.id === gradeId);
      const allowed = new Set((grade?.tracks || []).map(t => t.track_id));
      return {
        ...prev,
        gradeIds: [gradeId],
        trackIds: allowed.size > 0 ? prev.trackIds.filter(id => allowed.has(id)) : prev.trackIds,
      };
    });

  const toggleFormTrack = (trackId) =>
    setForm(prev => ({
      ...prev,
      trackIds: prev.trackIds.includes(trackId)
        ? prev.trackIds.filter(id => id !== trackId)
        : [...prev.trackIds, trackId],
    }));

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setForm(prev => ({
      ...prev,
      image: file,
      imagePreview: URL.createObjectURL(file),
      removeImage: false,
      icon: '',
    }));
  };

  const handleIconSelect = (emoji) => {
    setForm(prev => ({
      ...prev,
      icon: emoji,
      image: null,
      imagePreview: null,
      removeImage: !!prev.imagePreview,
    }));
  };

  // ————— الحفظ —————
  // مادة جديدة مستقلة — تُستخدم للإضافة ولزر "حفظ كمادة جديدة" في وضع التعديل
  const createSubject = async (templateKey) => {
    const fd = new FormData();
    fd.append('name', form.name.trim());
    fd.append('template_key', templateKey);
    if (form.icon) fd.append('icon', form.icon);
    if (form.image) fd.append('image', form.image);
    fd.append('grade_ids', JSON.stringify(form.gradeIds));
    fd.append('track_ids', JSON.stringify(form.trackIds));
    fd.append('description', form.description);
    fd.append('keywords', form.keywords);

    await api.post('/subjects', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  };

  const validateForm = () => {
    if (!form.name.trim()) {
      setError('أدخل اسم المادة');
      return false;
    }
    if (form.gradeIds.length === 0) {
      setError('اختر الصف الذي تخصه هذه المادة');
      return false;
    }
    if (form.gradeIds.length > 1) {
      setError('كل مادة تخص صفاً واحداً فقط — لصف آخر أنشئ مادة مستقلة له');
      return false;
    }
    return true;
  };

  const handleCreate = async () => {
    if (!validateForm()) return;

    setBusy(true);
    setError('');
    try {
      await createSubject(activeTemplate?.name || form.name.trim());
      await fetchSubjects();
      closePanel();
      setSuccess(`تمت إضافة مادة "${form.name.trim()}"`);
      toast.success('تمت إضافة المادة');
    } catch (err) {
      setError(err.response?.data?.message || 'خطأ في إضافة المادة');
    } finally {
      setBusy(false);
    }
  };

  // حفظ القيم الحالية كمادة جديدة مستقلة دون المساس بالمادة الأصلية ودروسها
  const handleSaveAsNew = async () => {
    if (!editingSubject) return;
    if (!validateForm()) return;

    const templateKey = templateNameOf(form.name.trim()) || form.name.trim();
    const ok = window.confirm(
      `سيتم إنشاء مادة جديدة باسم "${form.name.trim()}" في: ${placementNames(form.gradeIds, form.trackIds)}\n\n` +
      `المادة الأصلية "${editingSubject.name}" ستبقى كما هي مع دروسها (${editingSubject.lessons_count || 0} درس).`
    );
    if (!ok) return;

    setBusy(true);
    setError('');
    try {
      await createSubject(templateKey);
      await fetchSubjects();
      closePanel();
      setSuccess(`تمت إضافة مادة جديدة "${form.name.trim()}" دون تغيير المادة الأصلية`);
      toast.success('تمت إضافة المادة الجديدة');
    } catch (err) {
      setError(err.response?.data?.message || 'خطأ في إضافة المادة');
    } finally {
      setBusy(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingSubject) return;
    if (!validateForm()) return;

    // تحذير صريح: التعديل يطبَّق على المادة الأصلية ودروسها، لا يُنشئ مادة جديدة
    const warnings = [];
    if (renamed) {
      warnings.push(`• سيتغير اسم المادة الحالية من "${editingSubject.name}" إلى "${form.name.trim()}"`);
    }
    if (removedGradeNames.length > 0) {
      warnings.push(`• ستختفي المادة من: ${removedGradeNames.join(' • ')}`);
    }
    if (removedTrackNames.length > 0) {
      warnings.push(`• ستختفي المادة من مسارات: ${removedTrackNames.join(' • ')}`);
    }

    if (warnings.length > 0) {
      const lessons = editingSubject.lessons_count || 0;
      const ok = window.confirm(
        `أنت تعدّل المادة الحالية${lessons > 0 ? ` وبها ${lessons} درس` : ''}:\n\n` +
        warnings.join('\n') +
        `\n\nإذا كنت تريد مادة منفصلة بدل تعديل هذه، أغلق هذه الرسالة واستخدم زر "حفظ كمادة جديدة".\n\nمتابعة التعديل؟`
      );
      if (!ok) return;
    }

    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('name', form.name.trim());
      // إبقاء template_key متوافقاً مع الاسم الجديد حتى لا تبقى المادة مرتبطة بقالب اسم قديم
      if (renamed) fd.append('template_key', templateNameOf(form.name.trim()) || form.name.trim());
      fd.append('icon', form.icon || '');
      if (form.image) fd.append('image', form.image);
      if (form.removeImage) fd.append('remove_image', 'true');
      fd.append('description', form.description);
      fd.append('keywords', form.keywords);
      fd.append('grade_ids', JSON.stringify(form.gradeIds));
      fd.append('track_ids', JSON.stringify(form.trackIds));
      if (form.sortOrder !== '') fd.append('sort_order', form.sortOrder);

      await api.put(`/subjects/${editingSubject.id}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const updated = await fetchSubjects();
      const fresh = updated.find(s => s.id === editingSubject.id);
      if (fresh) setEditingSubject(fresh);
      setSuccess('تم تحديث المادة بنجاح');
      toast.success('تم تحديث المادة');
    } catch (err) {
      setError(err.response?.data?.message || 'خطأ في تحديث المادة');
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    if (!editingSubject) return;
    if (copyGradeIds.length === 0 && copyTrackIds.length === 0) {
      setError('اختر صف أو مسار واحد على الأقل للنسخ');
      return;
    }

    setBusy(true);
    setError('');
    try {
      await api.post(`/subjects/${editingSubject.id}/copy`, {
        grade_ids: JSON.stringify(copyGradeIds),
        track_ids: JSON.stringify(copyTrackIds),
        copy_lessons: copyLessons,
      });
      await fetchSubjects();
      setCopyGradeIds([]);
      setCopyTrackIds([]);
      setCopyLessons(false);
      setShowCopy(false);
      setSuccess(copyLessons ? 'تم نسخ المادة مع الدروس' : 'تم نسخ المادة بنجاح');
      toast.success('تم نسخ المادة');
    } catch (err) {
      setError(err.response?.data?.message || 'خطأ في نسخ المادة');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (subject) => {
    const count = subject.lessons_count || 0;
    const msg = count > 0
      ? `حذف "${subject.name}" (${placementLabel(subject)}) سيحذف ${count} درس مرتبط بها. متأكد؟`
      : `حذف "${subject.name}" (${placementLabel(subject)})؟`;
    if (!window.confirm(msg)) return;

    setBusy(true);
    setError('');
    try {
      await api.delete(`/subjects/${subject.id}`);
      await fetchSubjects();
      closePanel();
      setSuccess('تم حذف المادة');
      toast.success('تم حذف المادة');
    } catch (err) {
      setError(err.response?.data?.message || 'خطأ في حذف المادة');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState />;

  const templateNames = subjectTemplates.map(t => t.name);
  const customSubjects = scopeSubjects.filter(
    s => !templateNames.includes(s.template_key) && !templateNames.includes(s.name)
  );

  return (
    <div>
      <p className="text-gray-500 text-sm mb-4">
        اختر المرحلة والصف والمسار أولاً، ثم اضغط على المادة لإضافتها أو تعديلها. كل مادة مرتبطة بصف/مسار محدد،
        والتعديل يطبَّق على النسخة المختارة فقط.
      </p>

      {error && <Alert>{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {/* ————— اختيار النطاق ————— */}
      <Card className="p-4 mb-5">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-sm font-medium text-gray-600 ml-2">المرحلة:</span>
          <Chip active={!scopeStageId} onClick={() => handleStageScope('')}>الكل</Chip>
          {stages.map(st => (
            <Chip key={st.id} active={scopeStageId === st.id} onClick={() => handleStageScope(st.id)}>
              {st.name}
            </Chip>
          ))}
        </div>

        {scopeGrades.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-sm font-medium text-gray-600 ml-2">الصف:</span>
            <Chip active={!scopeGradeId} onClick={() => handleGradeScope('')}>الكل</Chip>
            {scopeGrades.map(g => (
              <Chip key={g.id} active={scopeGradeId === g.id} onClick={() => handleGradeScope(g.id)}>
                {g.name}
                {!scopeStageId && <span className="text-[10px] text-gray-400">({g.stage_name})</span>}
              </Chip>
            ))}
          </div>
        )}

        {scopeTracks.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-600 ml-2">المسار:</span>
            <Chip tone="emerald" active={!scopeTrackId} onClick={() => handleTrackScope('')}>الكل</Chip>
            {scopeTracks.map(t => (
              <Chip key={t.id} tone="emerald" active={scopeTrackId === t.id} onClick={() => handleTrackScope(t.id)}>
                {t.icon ? `${t.icon} ` : ''}{t.name}
              </Chip>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-500 mt-3">
          عدد المواد في هذا النطاق: <span className="font-semibold text-gray-700">{scopeSubjects.length}</span>
          {scopeGradeId && scopeTrackId && ' (هذا هو الرقم الذي يظهر للطلاب في بطاقة المسار)'}
        </p>
      </Card>

      {/* ————— شبكة المواد الجاهزة ————— */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 mb-4">
        {subjectTemplates.map((template) => {
          const instances = instancesOf(template.name);
          const scoped = instances.filter(inScope);
          const here = scoped.length > 0;
          const elsewhereOnly = !here && instances.length > 0;
          const isActive =
            (panel === 'edit' && scoped.some(s => s.id === editingSubject?.id)) ||
            (panel !== 'edit' && activeTemplate?.name === template.name);
          const display = scoped[0] || null;

          return (
            <button
              key={template.name}
              onClick={() => handleTemplateClick(template)}
              className={`relative p-4 rounded-xl border-2 text-center transition-all cursor-pointer ${
                isActive
                  ? 'bg-amber-50 border-amber-400 shadow-md'
                  : here
                    ? 'bg-gray-50 border-gray-200 hover:border-amber-300 hover:bg-amber-50/50'
                    : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm'
              }`}
            >
              {here && (
                <span className="absolute top-1.5 left-1.5 min-w-[20px] h-5 px-1 bg-green-500 text-white rounded-full flex items-center justify-center text-xs">
                  {scoped.length > 1 ? scoped.length : '✓'}
                </span>
              )}
              {elsewhereOnly && (
                <span className="absolute top-1.5 left-1.5 min-w-[20px] h-5 px-1 bg-gray-300 text-white rounded-full flex items-center justify-center text-[10px]">
                  {instances.length}
                </span>
              )}
              {display?.image_url ? (
                <img
                  src={`${SERVER_URL}${display.image_url}`}
                  alt={display.name || 'صورة المادة'}
                  className="w-8 h-8 rounded object-cover mx-auto mb-2"
                />
              ) : (
                <span className="text-3xl block mb-2">{display?.icon || template.icon}</span>
              )}
              <span className="text-sm font-medium text-gray-700">{display?.name || template.name}</span>
              <span className="text-[10px] text-gray-400 block mt-1">
                {here
                  ? (scoped.length > 1 ? 'عدة نسخ — اضغط للاختيار' : 'اضغط للتعديل')
                  : elsewhereOnly
                    ? `مضافة في صفوف أخرى (${instances.length})`
                    : 'اضغط للإضافة'}
              </span>
            </button>
          );
        })}
      </div>

      {/* ————— مواد مخصصة داخل النطاق ————— */}
      {customSubjects.length > 0 && (
        <>
          <h4 className="text-sm font-semibold text-gray-500 mb-2">مواد مخصصة</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 mb-4">
            {customSubjects.map((subject) => (
              <button
                key={subject.id}
                onClick={() => (editingSubject?.id === subject.id ? closePanel() : openEdit(subject))}
                className={`relative p-4 rounded-xl border-2 text-center transition-all cursor-pointer ${
                  editingSubject?.id === subject.id
                    ? 'bg-amber-50 border-amber-400 shadow-md'
                    : 'bg-gray-50 border-gray-200 hover:border-amber-300 hover:bg-amber-50/50'
                }`}
              >
                <span className="absolute top-1.5 left-1.5 w-5 h-5 bg-green-500 text-white rounded-full flex items-center justify-center text-xs">✓</span>
                {subject.image_url ? (
                  <img src={`${SERVER_URL}${subject.image_url}`} alt={subject.name || 'صورة المادة'} className="w-8 h-8 rounded object-cover mx-auto mb-2" />
                ) : (
                  <span className="text-3xl block mb-2">{subject.icon || '📚'}</span>
                )}
                <span className="text-sm font-medium text-gray-700">{subject.name}</span>
                <span className="text-[10px] text-gray-400 block mt-1">{placementLabel(subject)}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* زر إضافة مادة مخصصة */}
      <div className="mb-6">
        <button
          onClick={() => (panel === 'add' && !activeTemplate ? closePanel() : openAdd(null))}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed transition-all ${
            panel === 'add' && !activeTemplate
              ? 'border-blue-400 bg-blue-50 text-blue-700'
              : 'border-gray-300 text-gray-600 hover:border-blue-300 hover:text-blue-600'
          }`}
        >
          <span className="text-lg">{panel === 'add' && !activeTemplate ? '✕' : '➕'}</span>
          <span className="text-sm font-medium">
            {panel === 'add' && !activeTemplate ? 'إلغاء' : 'إضافة مادة مخصصة'}
          </span>
        </button>
      </div>

      {/* ————— اختيار النسخة عند وجود أكثر من نسخة ————— */}
      {panel === 'instances' && activeTemplate && (
        <Card className="p-6 mb-6 border-amber-200">
          <h3 className="text-lg font-semibold text-gray-700 mb-1">
            نسخ مادة: <span className="text-amber-600">{activeTemplate.icon} {activeTemplate.name}</span>
          </h3>
          <p className="text-gray-500 text-sm mb-4">
            هذه المادة مضافة أكثر من مرة. اختر النسخة التي تريد تعديلها — التعديل لن يؤثر على بقية النسخ.
          </p>

          <div className="space-y-2 mb-4">
            {instancesOf(activeTemplate.name).map(subject => (
              <div
                key={subject.id}
                className={`flex items-center justify-between gap-3 p-3 rounded-lg border ${
                  inScope(subject) ? 'border-amber-200 bg-amber-50/40' : 'border-gray-200 bg-white'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-700">
                    {subject.icon || '📚'} {subject.name}
                    <span className="text-xs text-gray-400 mr-2">({subject.lessons_count || 0} درس)</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{placementLabel(subject)}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button onClick={() => openEdit(subject)}>تعديل</Button>
                  <Button variant="secondary" onClick={() => handleDelete(subject)} disabled={busy}>حذف</Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <Button onClick={() => openAdd(activeTemplate)}>
              إضافة نسخة جديدة{scopeGrade ? ` لـ${scopeGrade.name}` : ''}
            </Button>
            <Button variant="secondary" onClick={closePanel}>إغلاق</Button>
          </div>
        </Card>
      )}

      {/* ————— نموذج الإضافة / التعديل ————— */}
      {(panel === 'add' || panel === 'edit') && (
        <Card className={`p-6 ${panel === 'edit' ? 'border-amber-200' : ''}`}>
          <h3 className="text-lg font-semibold text-gray-700 mb-1">
            {panel === 'edit' ? 'تعديل المادة: ' : 'إضافة مادة: '}
            <span className={panel === 'edit' ? 'text-amber-600' : 'text-blue-600'}>
              {form.icon || '📚'} {form.name || 'مادة جديدة'}
            </span>
          </h3>
          {panel === 'edit' && editingSubject && (
            <p className="text-xs text-gray-500 mb-4">
              النسخة الحالية: {placementLabel(editingSubject)} — {editingSubject.lessons_count || 0} درس
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <FormField label="اسم المادة">
              <Input
                type="text"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                placeholder="مثال: تربية فكرية"
              />
            </FormField>
            <FormField label="ترتيب العرض">
              <Input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setField('sortOrder', e.target.value)}
                placeholder="الأصغر يظهر أولاً"
              />
            </FormField>
          </div>

          <div className="mb-4">
            <label className="text-gray-600 text-sm font-medium mb-2 block">الأيقونة</label>
            <EmojiPicker selectedEmoji={form.icon} onSelect={handleIconSelect} compact />
          </div>

          <div className="mb-4">
            <label className="text-gray-600 text-sm font-medium mb-2 block">أو ارفع صورة</label>
            <div className="flex items-center gap-4">
              <label className="cursor-pointer bg-gray-100 text-gray-700 px-5 py-2.5 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium">
                اختيار صورة
                <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
              </label>
              {form.imagePreview && (
                <div className="relative">
                  <img src={form.imagePreview} alt="معاينة" className="w-12 h-12 object-cover rounded-lg border" />
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, image: null, imagePreview: null, removeImage: true }))}
                    className="absolute -top-2 -left-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                  >x</button>
                </div>
              )}
            </div>
          </div>

          <div className="mb-4">
            <label className="text-gray-600 text-sm font-medium mb-2 block">الوصف (اختياري)</label>
            <textarea
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              placeholder="وصف مختصر للمادة..."
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
            />
          </div>

          <div className="mb-4">
            <label className="text-gray-600 text-sm font-medium mb-2 block">الكلمات المفتاحية</label>
            <input
              type="text"
              value={form.keywords}
              onChange={(e) => setField('keywords', e.target.value)}
              placeholder="كلمات مفتاحية مفصولة بفاصلة"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <hr className="my-4 border-gray-200" />

          <p className="text-gray-500 text-sm mb-3">
            {panel === 'edit'
              ? 'الصف والمسارات التي تظهر فيها هذه المادة — كل مادة تخص صفاً واحداً بدروسه الخاصة'
              : 'اختر الصف الذي ستُضاف إليه المادة، ثم مساراته'}
          </p>

          <PlacementPicker
            grades={grades}
            tracks={tracks}
            gradeIds={form.gradeIds}
            trackIds={form.trackIds}
            onToggleGrade={toggleFormGrade}
            onToggleTrack={toggleFormTrack}
            singleGrade
          />

          {/* تحذير: ما الذي سيحدث للمادة الأصلية عند الحفظ */}
          {panel === 'edit' && editingSubject && (renamed || removedGradeNames.length > 0 || removedTrackNames.length > 0) && (
            <div className="mb-4 p-3 rounded-lg border border-amber-300 bg-amber-50 text-sm text-amber-800">
              <p className="font-semibold mb-1">
                ⚠️ هذا تعديل على المادة الحالية{(editingSubject.lessons_count || 0) > 0 ? ` وبها ${editingSubject.lessons_count} درس` : ''} — وليس إضافة مادة جديدة:
              </p>
              <ul className="list-disc pr-5 space-y-0.5">
                {renamed && <li>سيتغير الاسم من "{editingSubject.name}" إلى "{form.name.trim()}"</li>}
                {removedGradeNames.length > 0 && <li>ستختفي من: {removedGradeNames.join(' • ')}</li>}
                {removedTrackNames.length > 0 && <li>ستختفي من مسارات: {removedTrackNames.join(' • ')}</li>}
              </ul>
              <p className="mt-1.5">
                إذا كنت تريد مادة منفصلة بهذا الاسم، استخدم زر <span className="font-semibold">«حفظ كمادة جديدة»</span> بالأسفل.
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <Button onClick={panel === 'edit' ? handleUpdate : handleCreate} disabled={busy}>
              {busy ? 'جاري الحفظ...' : panel === 'edit' ? 'حفظ التعديلات' : 'إضافة المادة'}
            </Button>
            <Button variant="secondary" onClick={closePanel}>إلغاء</Button>
            {panel === 'edit' && editingSubject && (
              <>
                <Button variant="secondary" onClick={handleSaveAsNew} disabled={busy}>
                  حفظ كمادة جديدة
                </Button>
                <Button variant="secondary" onClick={() => setShowCopy(!showCopy)}>
                  {showCopy ? 'إخفاء النسخ' : 'نسخ لصف/مسار آخر'}
                </Button>
                <Button variant="secondary" onClick={() => handleDelete(editingSubject)} disabled={busy}>
                  حذف هذه النسخة
                </Button>
              </>
            )}
          </div>

          {/* ————— نسخ إلى صفوف/مسارات أخرى ————— */}
          {panel === 'edit' && showCopy && editingSubject && (
            <div className="mt-5 pt-5 border-t border-gray-200">
              <p className="text-gray-500 text-sm mb-3">
                سيتم إنشاء <span className="font-semibold">مادة مستقلة لكل صف</span> تختاره باسم "{editingSubject.name}" —
                كل واحدة بدروسها الخاصة، ولا تتأثر بتعديلات المادة الحالية.
              </p>

              <label className="flex items-center gap-2 cursor-pointer mb-3 p-2.5 bg-blue-50/50 rounded-lg border border-blue-100">
                <input
                  type="checkbox"
                  checked={copyLessons}
                  onChange={(e) => setCopyLessons(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700">نسخ الدروس أيضاً</span>
                <span className="text-xs text-gray-400">({editingSubject.lessons_count || 0} درس)</span>
              </label>

              <PlacementPicker
                grades={grades}
                tracks={tracks}
                gradeIds={copyGradeIds}
                trackIds={copyTrackIds}
                onToggleGrade={(id) =>
                  setCopyGradeIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
                }
                onToggleTrack={(id) =>
                  setCopyTrackIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
                }
              />

              <Button onClick={handleCopy} disabled={busy}>
                {busy ? 'جاري النسخ...' : 'تنفيذ النسخ'}
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ======================== تبويب إعدادات الموقع ========================

function SiteSettingsTab() {
  const { toast } = useToast();
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
      toast.success('تم حفظ الإعدادات بنجاح');
    } catch {
      setError('خطأ في حفظ الإعدادات');
      toast.error('خطأ في حفظ الإعدادات');
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

  // مصادر الدروس محفوظة كمصفوفة JSON
  let lessonSources = [];
  if (Array.isArray(settings.lesson_sources)) {
    lessonSources = settings.lesson_sources;
  } else if (typeof settings.lesson_sources === 'string') {
    try { lessonSources = JSON.parse(settings.lesson_sources) || []; } catch { lessonSources = []; }
  }

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

      {/* مصادر الدروس */}
      <LessonSourcesCard
        sources={lessonSources}
        defaultSource={settings.default_lesson_source || ''}
        onChange={(list) => handleChange('lesson_sources', list)}
        onDefaultChange={(val) => handleChange('default_lesson_source', val)}
      />

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

// ======================== بطاقة مصادر الدروس ========================
// قائمة نصية يختار منها الأدمن مصدر الملف عند إضافة درس (وزارة التعليم، إعداد المعلم...)

function LessonSourcesCard({ sources, defaultSource, onChange, onDefaultChange }) {
  const [newSource, setNewSource] = useState('');

  const addSource = () => {
    const value = newSource.trim();
    if (!value || sources.includes(value)) {
      setNewSource('');
      return;
    }
    onChange([...sources, value]);
    setNewSource('');
  };

  const updateSource = (index, value) => {
    onChange(sources.map((s, i) => (i === index ? value : s)));
  };

  const removeSource = (index) => {
    const removed = sources[index];
    onChange(sources.filter((_, i) => i !== index));
    if (removed === defaultSource) onDefaultChange('');
  };

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-gray-700 mb-1 flex items-center gap-2">
        <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
        مصادر الدروس
      </h2>
      <p className="text-xs text-gray-400 mb-4">
        تظهر هذه المصادر كخيارات عند إضافة درس، ويحدد الأدمن المصدر بعلامة صح.
      </p>

      <div className="space-y-2 mb-4">
        {sources.length === 0 && (
          <p className="text-sm text-gray-400">لا توجد مصادر بعد — أضف أول مصدر بالأسفل.</p>
        )}
        {sources.map((source, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              type="text"
              value={source}
              onChange={(e) => updateSource(index, e.target.value)}
              placeholder="اسم المصدر"
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => onDefaultChange(defaultSource === source ? '' : source)}
              title="تعيين كمصدر افتراضي"
              className={`text-xs px-3 py-2 rounded-lg border transition-colors whitespace-nowrap ${
                defaultSource === source
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
              }`}
            >
              {defaultSource === source ? '✓ افتراضي' : 'افتراضي'}
            </button>
            <button
              type="button"
              onClick={() => removeSource(index)}
              className="text-xs px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors border border-red-200"
            >
              حذف
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Input
          type="text"
          value={newSource}
          onChange={(e) => setNewSource(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addSource();
            }
          }}
          placeholder="مثال: وزارة التعليم"
          className="flex-1"
        />
        <Button type="button" onClick={addSource} variant="secondary">إضافة مصدر</Button>
      </div>
      <p className="text-xs text-gray-400 mt-2">لا تنسَ الضغط على "حفظ جميع الإعدادات" بالأسفل.</p>
    </Card>
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
  {
    key: 'delete_account_page',
    title: 'حذف الحساب',
    icon: (
      <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
      </svg>
    ),
    placeholder: 'اكتب تعليمات حذف الحساب هنا...\n\nيجب أن تتضمن:\n- خطوات حذف الحساب من التطبيق والموقع\n- ما البيانات التي تُحذف وما التي تبقى\n- مدة الاحتفاظ بالنسخ الاحتياطية',
    hint: 'يدعم HTML. صفحة /delete-account — مطلوبة من Google Play (حقل Delete account URL في Data safety). يجب أن تُفتح بدون تسجيل دخول.',
    url: '/delete-account'
  },
];

function PagesTab() {
  const { toast } = useToast();
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
          delete_account_page: res.data.delete_account_page || '',
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
      toast.success('تم حفظ جميع الصفحات بنجاح');
    } catch {
      setError('خطأ في الحفظ');
      toast.error('خطأ في الحفظ');
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
