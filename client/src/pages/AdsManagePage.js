import { useState, useEffect } from 'react';
import api from '../lib/api';
import DashboardLayout from './DashboardLayout';
import { Alert, Button, Input, FormField, Card, LoadingState, Textarea } from '../components/ui';

const POSITION_OPTIONS = [
  { value: 'header_banner', label: 'تحت الهيدر', group: 'عام' },
  { value: 'footer_banner', label: 'فوق الفوتر', group: 'عام' },
  { value: 'home_after_stages', label: 'الرئيسية - بعد المراحل', group: 'الرئيسية' },
  { value: 'home_between_sections', label: 'الرئيسية - بين الأقسام', group: 'الرئيسية' },
  { value: 'file_interstitial', label: 'صفحة الكتاب - إعلان ملء الشاشة عند الفتح', group: 'صفحة الكتاب' },
  { value: 'file_above_viewer', label: 'صفحة الكتاب - فوق المستعرض', group: 'صفحة الكتاب' },
  { value: 'file_below_viewer', label: 'صفحة الكتاب - تحت المستعرض', group: 'صفحة الكتاب' },
  { value: 'subject_after_header', label: 'صفحة المادة - بعد الهيدر', group: 'صفحة المادة' },
  { value: 'subject_between_lessons', label: 'صفحة المادة - بين الدروس', group: 'صفحة المادة' },
  { value: 'tests_after_header', label: 'الاختبارات - بعد الهيدر', group: 'الاختبارات' },
  { value: 'tests_between_cards', label: 'الاختبارات - بين الكارتات', group: 'الاختبارات' },
  { value: 'exercises_after_header', label: 'التمارين - بعد الهيدر', group: 'التمارين' },
  { value: 'exercises_between_cards', label: 'التمارين - بين الكارتات', group: 'التمارين' },
];

const POSITION_LABELS = Object.fromEntries(POSITION_OPTIONS.map(o => [o.value, o.label]));

const FORMAT_OPTIONS = [
  { value: 'auto', label: 'تلقائي (Auto)' },
  { value: 'horizontal', label: 'أفقي (Horizontal)' },
  { value: 'vertical', label: 'عمودي (Vertical)' },
  { value: 'rectangle', label: 'مربع (Rectangle)' },
];

export default function AdsManagePage() {
  const [adsEnabled, setAdsEnabled] = useState(false);
  const [publisherId, setPublisherId] = useState('');
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingSlot, setEditingSlot] = useState(null);

  // حالة النموذج
  const [formData, setFormData] = useState({
    name: '', slot_id: '', position: '', format: 'auto', is_active: true, custom_code: '', sort_order: 0
  });

  const fetchData = async () => {
    try {
      const [settingsRes, slotsRes] = await Promise.all([
        api.get('/settings'),
        api.get('/ads/slots')
      ]);
      setAdsEnabled(settingsRes.data.ads_enabled === true || settingsRes.data.ads_enabled === 'true');
      setPublisherId(settingsRes.data.ads_publisher_id || '');
      setSlots(slotsRes.data);
    } catch (err) {
      setError('خطأ في جلب البيانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSaveSettings = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.put('/settings', {
        ads_enabled: String(adsEnabled),
        ads_publisher_id: publisherId
      });
      setSuccess('تم حفظ الإعدادات بنجاح');
    } catch (err) {
      setError('خطأ في حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', slot_id: '', position: '', format: 'auto', is_active: true, custom_code: '', sort_order: 0 });
    setEditingSlot(null);
    setShowForm(false);
  };

  const handleEditSlot = (slot) => {
    setFormData({
      name: slot.name,
      slot_id: slot.slot_id || '',
      position: slot.position,
      format: slot.format || 'auto',
      is_active: slot.is_active,
      custom_code: slot.custom_code || '',
      sort_order: slot.sort_order || 0
    });
    setEditingSlot(slot.id);
    setShowForm(true);
  };

  const handleSubmitSlot = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editingSlot) {
        await api.put(`/ads/slots/${editingSlot}`, formData);
      } else {
        await api.post('/ads/slots', formData);
      }
      fetchData();
      resetForm();
    } catch (err) {
      setError(err.response?.data?.message || 'خطأ في حفظ الموقع الإعلاني');
    }
  };

  const handleDeleteSlot = async (id) => {
    if (!window.confirm('هل تريد حذف هذا الموقع الإعلاني؟')) return;
    try {
      await api.delete(`/ads/slots/${id}`);
      fetchData();
    } catch (err) {
      setError('خطأ في الحذف');
    }
  };

  const handleQuickSetup = async () => {
    if (!window.confirm('سيتم إنشاء جميع المواقع الإعلانية الأساسية. متأكد؟')) return;
    setError('');
    const defaultSlots = [
      { name: 'بانر الهيدر', position: 'header_banner', format: 'auto', sort_order: 0 },
      { name: 'بعد المراحل', position: 'home_after_stages', format: 'auto', sort_order: 1 },
      { name: 'بين الأقسام', position: 'home_between_sections', format: 'auto', sort_order: 2 },
      { name: 'فوق المستعرض', position: 'file_above_viewer', format: 'fluid', sort_order: 0 },
      { name: 'تحت المستعرض', position: 'file_below_viewer', format: 'fluid', sort_order: 1 },
      { name: 'صفحة المادة', position: 'subject_after_header', format: 'auto', sort_order: 0 },
      { name: 'بين الدروس', position: 'subject_between_lessons', format: 'auto', sort_order: 1 },
      { name: 'بانر الفوتر', position: 'footer_banner', format: 'auto', sort_order: 10 },
    ];
    try {
      for (const slot of defaultSlots) {
        await api.post('/ads/slots', { ...slot, slot_id: '', is_active: true, custom_code: '' });
      }
      setSuccess(`تم إنشاء ${defaultSlots.length} مواقع إعلانية. أضف Slot IDs لكل موقع.`);
      fetchData();
    } catch (err) {
      setError('خطأ في الإعداد السريع');
    }
  };

  const handleToggleSlot = async (slot) => {
    try {
      await api.put(`/ads/slots/${slot.id}`, { ...slot, is_active: !slot.is_active });
      fetchData();
    } catch (err) {
      setError('خطأ في تحديث الحالة');
    }
  };

  if (loading) return <DashboardLayout><LoadingState /></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">إدارة الإعلانات</h1>
        <p className="text-gray-500 text-sm mb-6">إعداد Google AdSense والمواقع الإعلانية</p>

        {error && <Alert type="error" className="mb-4">{error}</Alert>}
        {success && <Alert type="success" className="mb-4">{success}</Alert>}

        {/* ═══════ الإعدادات العامة ═══════ */}
        <Card className="mb-6">
          <h2 className="text-lg font-bold text-gray-700 mb-4">إعدادات AdSense</h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">تفعيل الإعلانات</p>
                <p className="text-xs text-gray-400">عرض الإعلانات في الموقع العام</p>
              </div>
              <button
                onClick={() => setAdsEnabled(!adsEnabled)}
                className={`relative w-12 h-6 rounded-full transition-colors ${adsEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${adsEnabled ? 'right-0.5' : 'right-6'}`} />
              </button>
            </div>

            <FormField label="Publisher ID">
              <Input
                value={publisherId}
                onChange={(e) => setPublisherId(e.target.value)}
                placeholder="ca-pub-XXXXXXXXXX"
                dir="ltr"
                className="font-mono"
              />
            </FormField>

            <Button onClick={handleSaveSettings} loading={saving}>
              حفظ الإعدادات
            </Button>
          </div>
        </Card>

        {/* ═══════ المواقع الإعلانية ═══════ */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-700">المواقع الإعلانية</h2>
          <div className="flex gap-2">
            {slots.length === 0 && (
              <Button onClick={handleQuickSetup} size="sm" variant="secondary" disabled={!publisherId}>
                ⚡ إعداد سريع
              </Button>
            )}
            <Button onClick={() => { resetForm(); setShowForm(true); }} size="sm">
              + إضافة موقع
            </Button>
          </div>
        </div>

        {/* نموذج إضافة/تعديل */}
        {showForm && (
          <Card className="mb-4">
            <h3 className="text-base font-bold text-gray-700 mb-4">
              {editingSlot ? 'تعديل موقع إعلاني' : 'إضافة موقع إعلاني جديد'}
            </h3>
            <form onSubmit={handleSubmitSlot} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="اسم الموقع">
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="مثال: إعلان أعلى صفحة الكتاب"
                    required
                  />
                </FormField>

                <FormField label="الموقع (Position)">
                  <select
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                    required
                  >
                    <option value="">اختر الموقع...</option>
                    {Object.entries(
                      POSITION_OPTIONS.reduce((groups, opt) => {
                        (groups[opt.group] = groups[opt.group] || []).push(opt);
                        return groups;
                      }, {})
                    ).map(([group, opts]) => (
                      <optgroup key={group} label={group}>
                        {opts.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </FormField>

                <FormField label="Ad Slot ID">
                  <Input
                    value={formData.slot_id}
                    onChange={(e) => setFormData({ ...formData, slot_id: e.target.value })}
                    placeholder="1234567890"
                    dir="ltr"
                    className="font-mono"
                  />
                </FormField>

                <FormField label="الحجم (Format)">
                  <select
                    value={formData.format}
                    onChange={(e) => setFormData({ ...formData, format: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                  >
                    {FORMAT_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </FormField>

                <FormField label="الترتيب">
                  <Input
                    type="number"
                    value={formData.sort_order}
                    onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                  />
                </FormField>

                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                    id="is_active"
                  />
                  <label htmlFor="is_active" className="text-sm text-gray-700">نشط</label>
                </div>
              </div>

              <FormField label="كود مخصص (اختياري - بديل عن AdSense)">
                <Textarea
                  value={formData.custom_code}
                  onChange={(e) => setFormData({ ...formData, custom_code: e.target.value })}
                  placeholder="<div>كود HTML مخصص</div>"
                  dir="ltr"
                  rows={3}
                  className="font-mono text-xs"
                />
              </FormField>

              <div className="flex gap-2">
                <Button type="submit">{editingSlot ? 'تحديث' : 'إضافة'}</Button>
                <Button type="button" variant="secondary" onClick={resetForm}>إلغاء</Button>
              </div>
            </form>
          </Card>
        )}

        {/* قائمة المواقع */}
        {slots.length === 0 ? (
          <Card>
            <div className="text-center py-8 text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
              </svg>
              <p className="text-sm">لا توجد مواقع إعلانية بعد</p>
              <p className="text-xs mt-1">اضغط "إضافة موقع" لإنشاء أول موقع إعلاني</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-2">
            {slots.map(slot => (
              <Card key={slot.id} className="!p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* حالة */}
                    <button
                      onClick={() => handleToggleSlot(slot)}
                      className={`w-3 h-3 rounded-full flex-shrink-0 ${slot.is_active ? 'bg-green-500' : 'bg-gray-300'}`}
                      title={slot.is_active ? 'نشط' : 'معطل'}
                    />

                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{slot.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{POSITION_LABELS[slot.position] || slot.position}</span>
                        {slot.slot_id ? (
                          <span className="text-[10px] text-gray-400 font-mono">Slot: {slot.slot_id}</span>
                        ) : !slot.custom_code && (
                          <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded">⚠ بدون Slot ID</span>
                        )}
                        {slot.custom_code && (
                          <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded">كود مخصص</span>
                        )}
                        <span className="text-[10px] text-gray-400">{slot.format}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEditSlot(slot)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteSlot(slot.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
