import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import DashboardLayout from './DashboardLayout';
import { useToast } from '../components/ui/Toast';

const STATUS_TABS = [
  { key: 'pending', label: 'معلق', emoji: '🟡' },
  { key: 'reviewed', label: 'مراجع', emoji: '🔵' },
  { key: 'resolved', label: 'محلول', emoji: '🟢' },
];

const REASON_LABELS = {
  wrong_answer: 'الإجابة خاطئة',
  spelling_error: 'خطأ إملائي',
  unclear: 'غير واضح',
  other: 'سبب آخر',
};

const REASON_COLORS = {
  wrong_answer: 'bg-red-100 text-red-700',
  spelling_error: 'bg-amber-100 text-amber-700',
  unclear: 'bg-blue-100 text-blue-700',
  other: 'bg-gray-100 text-gray-600',
};

export default function QuestionReportsPage() {
  const [activeTab, setActiveTab] = useState('pending');
  const [reports, setReports] = useState([]);
  const [counts, setCounts] = useState({ pending: 0, reviewed: 0, resolved: 0 });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/exercises/admin/question-reports?status=${activeTab}`);
      setReports(res.data);
    } catch {
      toast.error('خطأ في جلب البلاغات');
    } finally {
      setLoading(false);
    }
  }, [activeTab, toast]);

  const fetchCounts = useCallback(async () => {
    try {
      const res = await api.get('/exercises/admin/question-reports/count');
      setCounts(res.data);
    } catch {}
  }, []);

  useEffect(() => { fetchReports(); }, [fetchReports]);
  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  const updateStatus = async (id, newStatus) => {
    try {
      await api.patch(`/exercises/admin/question-reports/${id}`, { status: newStatus });
      toast.success(newStatus === 'resolved' ? 'تم حل البلاغ ✅' : 'تم رفض البلاغ');
      fetchReports();
      fetchCounts();
    } catch {
      toast.error('خطأ في تحديث البلاغ');
    }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'الآن';
    if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `منذ ${diffHours} ساعة`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `منذ ${diffDays} يوم`;
    return d.toLocaleDateString('ar-SA');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🚩</span>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">بلاغات الأسئلة</h1>
              <p className="text-sm text-gray-500">مراجعة وإدارة بلاغات الطلاب عن الأسئلة</p>
            </div>
          </div>
          {counts.pending > 0 && (
            <span className="bg-red-500 text-white text-sm font-bold px-3 py-1 rounded-full">
              {counts.pending} معلق
            </span>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span>{tab.emoji}</span>
              <span>{tab.label}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === tab.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-500'
              }`}>
                {counts[tab.key] || 0}
              </span>
            </button>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-16">
            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">جارٍ التحميل...</p>
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <span className="text-5xl block mb-3">📋</span>
            <p className="text-gray-500 font-medium">لا توجد بلاغات {STATUS_TABS.find(t => t.key === activeTab)?.label}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50/50">
                    <th className="text-right px-4 py-3 font-medium text-gray-500">السؤال</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">السبب</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">التمرين</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">المبلّغ</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">التاريخ</th>
                    {activeTab === 'pending' && (
                      <th className="text-center px-4 py-3 font-medium text-gray-500">إجراء</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {reports.map(report => (
                    <tr key={report.id} className="border-b last:border-0 hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-gray-800 font-medium truncate max-w-[200px]" title={report.question_text}>
                          {report.question_text || '—'}
                        </p>
                        {report.details && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]" title={report.details}>
                            💬 {report.details}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${REASON_COLORS[report.reason] || 'bg-gray-100 text-gray-600'}`}>
                          {REASON_LABELS[report.reason] || report.reason}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {report.exercise_title || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {report.reporter_name || report.reporter_email || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {formatDate(report.created_at)}
                      </td>
                      {activeTab === 'pending' && (
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => updateStatus(report.id, 'resolved')}
                              className="w-8 h-8 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 flex items-center justify-center transition-colors"
                              title="حل"
                            >
                              ✅
                            </button>
                            <button
                              onClick={() => updateStatus(report.id, 'reviewed')}
                              className="w-8 h-8 rounded-lg bg-gray-50 text-gray-400 hover:bg-gray-100 flex items-center justify-center transition-colors"
                              title="رفض"
                            >
                              ❌
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
