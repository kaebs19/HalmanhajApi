import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import DashboardLayout from './DashboardLayout';
import { useToast } from '../components/ui/Toast';
import QuickAddExerciseModal from '../components/QuickAddExerciseModal';
import QuickImportModal from '../components/QuickImportModal';
import {
  TYPE_LABEL, TYPE_ICON, TYPE_COLORS,
  DIFF_LABEL, DIFF_COLORS,
} from '../components/ExerciseQuestionForm';

const NODE_TYPES = {
  exercise: { icon: '📍', label: 'تمرين', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  checkpoint: { icon: '⭐', label: 'نقطة تفتيش', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  final_test: { icon: '🏆', label: 'اختبار نهائي', color: 'bg-green-50 text-green-700 border-green-200' },
};

export default function ExercisePathPage() {
  const { toast } = useToast();
  const navigate = useNavigate();

  // === فلاتر مشتركة ===
  const [stages, setStages] = useState([]);
  const [grades, setGrades] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [filterStage, setFilterStage] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [filterSubject, setFilterSubject] = useState('');

  // === التمارين ===
  const [exercises, setExercises] = useState([]);
  const [groupedData, setGroupedData] = useState(null);
  const [loadingEx, setLoadingEx] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showQuickImport, setShowQuickImport] = useState(false);

  // === المسار ===
  const [pathData, setPathData] = useState(null);
  const [pathStats, setPathStats] = useState(null);
  const [loadingPath, setLoadingPath] = useState(false);
  const [generating, setGenerating] = useState(false);

  // === Tab للموبايل ===
  const [activeTab, setActiveTab] = useState('exercises');

  // جلب بيانات التصنيف
  useEffect(() => {
    Promise.allSettled([
      api.get('/stages'), api.get('/grades'), api.get('/subjects'),
    ]).then(([s, g, sub]) => {
      if (s.status === 'fulfilled') setStages(s.value.data);
      if (g.status === 'fulfilled') setGrades(g.value.data);
      if (sub.status === 'fulfilled') setSubjects(sub.value.data);
    });
  }, []);

  // فلاتر متتالية
  const filteredGrades = filterStage ? grades.filter(g => String(g.stage_id) === String(filterStage)) : [];
  const filteredSubjects = filterGrade
    ? subjects.filter(s => s.grades?.some(g => String(g.grade_id) === String(filterGrade)))
    : filterStage
      ? subjects.filter(s =>
          s.grades?.some(g => String(g.stage_id) === String(filterStage)) ||
          s.tracks?.some(t => String(t.stage_id) === String(filterStage))
        )
      : [];

  const handleStageChange = (id) => {
    setFilterStage(prev => prev === id ? '' : id);
    setFilterGrade(''); setFilterSubject('');
    setPathData(null); setGroupedData(null);
  };

  const handleGradeChange = (id) => {
    setFilterGrade(prev => prev === id ? '' : id);
    setFilterSubject('');
    setPathData(null); setGroupedData(null);
  };

  // === جلب التمارين ===
  const fetchExercises = useCallback(async () => {
    if (!filterSubject) { setExercises([]); setGroupedData(null); return; }
    setLoadingEx(true);
    try {
      const params = new URLSearchParams();
      if (filterStage) params.append('stage_id', filterStage);
      if (filterGrade) params.append('grade_id', filterGrade);
      if (filterSubject) params.append('subject_id', filterSubject);
      const [exRes, groupRes] = await Promise.allSettled([
        api.get(`/exercises?${params.toString()}`),
        api.get('/exercises/grouped', { params: { subject_id: filterSubject, grade_id: filterGrade || null } }),
      ]);
      if (exRes.status === 'fulfilled') setExercises(exRes.value.data || []);
      if (groupRes.status === 'fulfilled') setGroupedData(groupRes.value.data);
    } catch { toast.error('خطأ في تحميل التمارين'); }
    finally { setLoadingEx(false); }
  }, [filterStage, filterGrade, filterSubject, toast]);

  useEffect(() => { fetchExercises(); }, [fetchExercises]);

  // === جلب المسار ===
  const fetchPath = useCallback(async () => {
    if (!filterSubject || !filterGrade) { setPathData(null); setPathStats(null); return; }
    setLoadingPath(true);
    try {
      const res = await api.get(`/learning-paths/admin/${filterSubject}/${filterGrade}`);
      setPathData(res.data);
      // جلب الإحصائيات
      if (res.data?.path?.id) {
        api.get(`/learning-paths/admin/stats/${res.data.path.id}`)
          .then(r => setPathStats(r.data)).catch(() => setPathStats(null));
      }
    } catch { setPathData(null); setPathStats(null); }
    finally { setLoadingPath(false); }
  }, [filterSubject, filterGrade]);

  useEffect(() => { fetchPath(); }, [fetchPath]);

  // مجموعة IDs التمارين في المسار
  const pathExerciseIds = new Set(
    (pathData?.nodes || []).map(n => n.exercise_id)
  );

  // === إجراءات التمارين ===
  const handleDelete = async (id) => {
    if (!window.confirm('هل تريد حذف هذا التمرين؟')) return;
    try {
      await api.delete(`/exercises/${id}`);
      toast.success('تم حذف التمرين');
      fetchExercises(); fetchPath();
    } catch { toast.error('خطأ في الحذف'); }
  };

  const handleTogglePublish = async (id) => {
    try {
      const res = await api.patch(`/exercises/${id}/publish`);
      setExercises(prev => prev.map(e => e.id === id ? { ...e, is_published: res.data.is_published } : e));
      toast.success(res.data.is_published ? 'تم النشر' : 'تم إلغاء النشر');
    } catch { toast.error('خطأ في تغيير حالة النشر'); }
  };

  const handleBulkPublish = async (publish) => {
    if (selectedIds.size === 0) return;
    try {
      await api.post('/exercises/bulk-publish', { exercise_ids: Array.from(selectedIds), is_published: publish });
      toast.success(publish ? `تم نشر ${selectedIds.size} تمرين` : `تم إلغاء نشر ${selectedIds.size} تمرين`);
      setSelectedIds(new Set()); fetchExercises();
    } catch { toast.error('خطأ'); }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  // === إجراءات المسار ===
  const handleAutoGenerate = async (force = false) => {
    if (!filterSubject || !filterGrade) return;
    setGenerating(true);
    try {
      const res = await api.post('/learning-paths/auto-generate', {
        subject_id: filterSubject, grade_id: filterGrade, force,
      });
      toast.success(`تم توليد المسار: ${res.data.nodes_created} محطة`);
      fetchPath();
    } catch (err) {
      if (err.response?.status === 409) {
        if (window.confirm('يوجد مسار حالي. هل تريد استبداله؟')) {
          handleAutoGenerate(true);
        }
      } else {
        toast.error(err.response?.data?.message || 'خطأ في توليد المسار');
      }
    } finally { setGenerating(false); }
  };

  const handleDeleteNode = async (nodeId) => {
    if (!window.confirm('هل تريد حذف هذه المحطة؟')) return;
    try {
      await api.delete(`/learning-paths/nodes/${nodeId}`);
      toast.success('تم حذف المحطة');
      fetchPath();
    } catch { toast.error('خطأ في حذف المحطة'); }
  };

  // === أسماء الفلاتر ===
  const subjectName = subjects.find(s => String(s.id) === String(filterSubject))?.name || '';
  const gradeName = grades.find(g => String(g.id) === String(filterGrade))?.name || '';

  // === عرض التمارين المجمعة ===
  const units = groupedData?.units || [];
  const ungrouped = groupedData?.ungrouped || [];
  const nodes = pathData?.nodes || [];
  const path = pathData?.path;

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto">
        {/* العنوان */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-800">التمارين والمسارات</h1>
            <p className="text-sm text-gray-400">إدارة التمارين ومسارات التعلم من مكان واحد</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowQuickImport(true)} className="bg-white border border-emerald-300 text-emerald-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-50 transition-all flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              استيراد
            </button>
            <button onClick={() => setShowQuickAdd(true)} className="bg-gradient-to-l from-blue-600 to-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold hover:shadow-lg transition-all flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
              إضافة تمرين
            </button>
          </div>
        </div>

        {/* الفلاتر */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6 space-y-3">
          {/* المراحل */}
          {stages.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {stages.map(s => (
                <button key={s.id} onClick={() => handleStageChange(s.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    filterStage === s.id ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-50 text-gray-600 border border-gray-200 hover:border-blue-300'
                  }`}>{s.icon || ''} {s.name}</button>
              ))}
            </div>
          )}
          {/* الصفوف */}
          {filteredGrades.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {filteredGrades.map(g => (
                <button key={g.id} onClick={() => handleGradeChange(g.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    filterGrade === g.id ? 'bg-violet-600 text-white' : 'bg-gray-50 text-gray-500 border border-gray-200 hover:border-violet-300'
                  }`}>{g.name}</button>
              ))}
            </div>
          )}
          {/* المواد */}
          {filteredSubjects.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {filteredSubjects.map(s => (
                <button key={s.id} onClick={() => setFilterSubject(prev => prev === s.id ? '' : s.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    filterSubject === s.id ? 'bg-amber-500 text-white' : 'bg-gray-50 text-gray-500 border border-gray-200 hover:border-amber-300'
                  }`}>{s.icon || ''} {s.name}</button>
              ))}
            </div>
          )}
        </div>

        {/* إرشاد في حال عدم اختيار فلاتر */}
        {!filterSubject && (
          <div className="text-center py-16 text-gray-400">
            <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            <p className="text-lg font-medium">اختر المرحلة والصف والمادة</p>
            <p className="text-sm">لعرض التمارين والمسار التعليمي</p>
          </div>
        )}

        {/* تبويبات الموبايل */}
        {filterSubject && (
          <div className="lg:hidden flex gap-2 mb-4">
            <button onClick={() => setActiveTab('exercises')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'exercises' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
              التمارين ({exercises.length})
            </button>
            <button onClick={() => setActiveTab('path')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'path' ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
              المسار ({nodes.length})
            </button>
          </div>
        )}

        {/* شريط الإجراءات الجماعية */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4">
            <span className="text-sm font-medium text-blue-800">{selectedIds.size} تمرين محدد</span>
            <div className="flex gap-2 mr-auto">
              <button onClick={() => handleBulkPublish(true)} className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-700">نشر الكل</button>
              <button onClick={() => handleBulkPublish(false)} className="bg-amber-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-amber-600">إلغاء النشر</button>
              <button onClick={() => setSelectedIds(new Set())} className="bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-bold">إلغاء</button>
            </div>
          </div>
        )}

        {/* العرض المقسم */}
        {filterSubject && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* ═══ الجانب الأيمن: التمارين ═══ */}
            <div className={`space-y-4 ${activeTab !== 'exercises' ? 'hidden lg:block' : ''}`}>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-500 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                  التمارين ({exercises.length})
                </h2>
              </div>

              {loadingEx ? (
                <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="bg-white rounded-xl border p-4 animate-pulse"><div className="h-4 bg-gray-200 rounded w-3/4"></div></div>)}</div>
              ) : exercises.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">
                  <p className="font-medium">لا توجد تمارين</p>
                  <p className="text-xs mt-1">أضف تمارين جديدة للبدء</p>
                </div>
              ) : (
                <>
                  {/* عرض حسب الوحدات */}
                  {units.map(unit => (
                    <div key={unit.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                      <div className="bg-indigo-50 px-4 py-2.5 flex items-center justify-between border-b border-indigo-100">
                        <span className="text-xs font-bold text-indigo-700">📚 {unit.title} ({unit.exercises?.length || 0})</span>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {(unit.exercises || []).map(ex => (
                          <ExerciseRow key={ex.id} exercise={ex} inPath={pathExerciseIds.has(ex.id)}
                            selected={selectedIds.has(ex.id)} onToggleSelect={() => toggleSelect(ex.id)}
                            onPublish={() => handleTogglePublish(ex.id)} onDelete={() => handleDelete(ex.id)} />
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* تمارين بدون وحدة */}
                  {ungrouped.length > 0 && (
                    <div className="bg-white rounded-xl border border-dashed border-amber-200 overflow-hidden">
                      <div className="bg-amber-50 px-4 py-2.5 border-b border-amber-100">
                        <span className="text-xs font-bold text-amber-700">📎 بدون وحدة ({ungrouped.length})</span>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {ungrouped.map(ex => (
                          <ExerciseRow key={ex.id} exercise={ex} inPath={pathExerciseIds.has(ex.id)}
                            selected={selectedIds.has(ex.id)} onToggleSelect={() => toggleSelect(ex.id)}
                            onPublish={() => handleTogglePublish(ex.id)} onDelete={() => handleDelete(ex.id)} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* تمارين بدون تجميع (fallback) */}
                  {!groupedData && (
                    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
                      {exercises.map(ex => (
                        <ExerciseRow key={ex.id} exercise={ex} inPath={pathExerciseIds.has(ex.id)}
                          selected={selectedIds.has(ex.id)} onToggleSelect={() => toggleSelect(ex.id)}
                          onPublish={() => handleTogglePublish(ex.id)} onDelete={() => handleDelete(ex.id)} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ═══ الجانب الأيسر: المسار ═══ */}
            <div className={`space-y-4 ${activeTab !== 'path' ? 'hidden lg:block' : ''}`}>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-500 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                  المسار التعليمي
                </h2>
                {filterGrade && (
                  <button
                    onClick={() => handleAutoGenerate(false)} disabled={generating}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg bg-violet-100 text-violet-700 hover:bg-violet-200 disabled:opacity-50 transition-colors flex items-center gap-1"
                  >
                    {generating ? '⏳ جاري التوليد...' : '🪄 توليد تلقائي'}
                  </button>
                )}
              </div>

              {!filterGrade ? (
                <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">
                  <p className="font-medium">اختر الصف لعرض المسار</p>
                </div>
              ) : loadingPath ? (
                <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="bg-white rounded-xl border p-4 animate-pulse"><div className="h-4 bg-gray-200 rounded w-1/2"></div></div>)}</div>
              ) : !path ? (
                <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
                  <p className="text-gray-500 font-medium mb-3">لا يوجد مسار بعد</p>
                  <button onClick={() => handleAutoGenerate(false)} disabled={generating}
                    className="bg-violet-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-violet-700 disabled:opacity-50">
                    {generating ? 'جاري التوليد...' : '🪄 توليد المسار تلقائياً'}
                  </button>
                </div>
              ) : (
                <>
                  {/* معلومات المسار */}
                  <div className="bg-white rounded-xl border border-gray-100 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-gray-800 text-sm">{path.title || subjectName}</h3>
                        <p className="text-xs text-gray-400">{gradeName} — {nodes.length} محطة</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${path.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {path.is_active ? '✅ نشط' : '⏸️ متوقف'}
                      </span>
                    </div>

                    {/* إحصائيات */}
                    {pathStats && pathStats.total_students > 0 && (
                      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-100">
                        <div className="text-center">
                          <p className="text-lg font-bold text-blue-600">{pathStats.total_students}</p>
                          <p className="text-[10px] text-gray-400">بدأوا</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-emerald-600">{pathStats.completed_students}</p>
                          <p className="text-[10px] text-gray-400">أكملوا</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-violet-600">
                            {pathStats.total_students > 0 ? Math.round((pathStats.completed_students / pathStats.total_students) * 100) : 0}%
                          </p>
                          <p className="text-[10px] text-gray-400">إكمال</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* قائمة المحطات */}
                  <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    <div className="divide-y divide-gray-50">
                      {nodes.map((node, idx) => {
                        const nt = NODE_TYPES[node.node_type] || NODE_TYPES.exercise;
                        return (
                          <div key={node.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                            {/* رقم + خط */}
                            <div className="flex flex-col items-center">
                              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border ${nt.color}`}>
                                {nt.icon}
                              </span>
                              {idx < nodes.length - 1 && <div className="w-0.5 h-4 bg-gray-200 mt-1"></div>}
                            </div>
                            {/* المعلومات */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">
                                {node.exercise_title || nt.label}
                              </p>
                              <p className="text-[10px] text-gray-400">
                                {TYPE_ICON[node.exercise_type]} {TYPE_LABEL[node.exercise_type] || node.node_type}
                                {node.xp_reward ? ` · ${node.xp_reward} XP` : ''}
                              </p>
                            </div>
                            {/* حذف */}
                            <button onClick={() => handleDeleteNode(node.id)}
                              className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    {nodes.length === 0 && (
                      <div className="p-6 text-center text-gray-400 text-sm">المسار فارغ</div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showQuickAdd && <QuickAddExerciseModal onClose={() => { setShowQuickAdd(false); fetchExercises(); }} />}
      {showQuickImport && <QuickImportModal onClose={() => { setShowQuickImport(false); fetchExercises(); }}
        preSelectedSubject={filterSubject} preSelectedGrade={filterGrade} preSelectedStage={filterStage} />}
    </DashboardLayout>
  );
}

// === مكون صف التمرين ===
function ExerciseRow({ exercise, inPath, selected, onToggleSelect, onPublish, onDelete }) {
  return (
    <div className="flex items-center gap-2 py-2.5 px-4 hover:bg-gray-50 transition-colors">
      <input type="checkbox" checked={selected} onChange={onToggleSelect}
        className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 cursor-pointer" />
      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${inPath ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
        {inPath ? '✓' : '—'}
      </span>
      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TYPE_COLORS[exercise.type] || 'bg-gray-50 text-gray-600'}`}>
        {TYPE_ICON[exercise.type]}
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-sm text-gray-700 truncate block">{exercise.title}</span>
      </div>
      <span className="text-[10px] text-gray-400">{exercise.questions_count || 0}س</span>
      {!exercise.is_published && <span className="text-[9px] bg-yellow-50 text-yellow-600 px-1 py-0.5 rounded">مسودة</span>}
      <div className="flex items-center gap-0.5">
        <button onClick={onPublish} className={`p-1 rounded transition-colors ${exercise.is_published ? 'text-emerald-500 hover:bg-emerald-50' : 'text-gray-400 hover:bg-gray-100'}`} title={exercise.is_published ? 'إلغاء النشر' : 'نشر'}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {exercise.is_published ? <><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>
            : <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />}
          </svg>
        </button>
        <Link to={`/admin/exercises/${exercise.id}/edit`} className="p-1 text-gray-400 hover:text-blue-600 rounded transition-colors" title="تعديل">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
        </Link>
        <button onClick={onDelete} className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors" title="حذف">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>
    </div>
  );
}
