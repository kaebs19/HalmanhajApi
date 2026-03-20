import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import api from '../lib/api';
import DashboardLayout from './DashboardLayout';
import { useToast } from '../components/ui/Toast';
import { TYPE_LABEL, TYPE_ICON, TYPE_COLORS, DIFF_LABEL, DIFF_COLORS } from '../components/ExerciseQuestionForm';

const selectClass = 'text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none';

const NODE_TYPES = [
  { value: 'exercise', label: 'تمرين', icon: '📍', color: 'border-blue-300 bg-blue-50 text-blue-700' },
  { value: 'checkpoint', label: 'نقطة تفتيش', icon: '⭐', color: 'border-amber-300 bg-amber-50 text-amber-700' },
  { value: 'final_test', label: 'اختبار نهائي', icon: '🏆', color: 'border-green-300 bg-green-50 text-green-700' },
];

export default function LearningPathManagerPage() {
  const { toast } = useToast();

  // === بيانات التصنيف ===
  const [stages, setStages] = useState([]);
  const [grades, setGrades] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedStage, setSelectedStage] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');

  // === بيانات المسار ===
  const [pathData, setPathData] = useState(null);
  const [pathLoading, setPathLoading] = useState(false);

  // === إضافة محطة (قسم متقدم) ===
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [addNodeType, setAddNodeType] = useState('exercise');
  const [addExerciseId, setAddExerciseId] = useState('');
  const [addExerciseTitle, setAddExerciseTitle] = useState('');
  const [addRequiredXp, setAddRequiredXp] = useState(0);
  const [addingNode, setAddingNode] = useState(false);

  // === بحث التمارين ===
  const [exercises, setExercises] = useState([]);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [loadingExercises, setLoadingExercises] = useState(false);

  // === Edit Modal ===
  const [editModal, setEditModal] = useState(null);
  const [editSearch, setEditSearch] = useState('');
  const [editExercises, setEditExercises] = useState([]);
  const [loadingEditExercises, setLoadingEditExercises] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const editSearchTimerRef = useRef(null);

  // === توليد تلقائي ===
  const [showAutoConfirm, setShowAutoConfirm] = useState(false);
  const [autoGenInfo, setAutoGenInfo] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [regeneratingUnit, setRegeneratingUnit] = useState(null);

  // === إحصائيات المسار ===
  const [pathStats, setPathStats] = useState(null);

  // === ترتيب الوحدات ===
  const [showUnitOrder, setShowUnitOrder] = useState(false);
  const [unitOrderList, setUnitOrderList] = useState([]);
  const [savingUnitOrder, setSavingUnitOrder] = useState(false);

  // ═══ جلب بيانات التصنيف ═══
  useEffect(() => {
    const fetchMeta = async () => {
      const [stagesRes, gradesRes, subjectsRes] = await Promise.allSettled([
        api.get('/stages'),
        api.get('/grades'),
        api.get('/subjects'),
      ]);
      if (stagesRes.status === 'fulfilled') setStages(stagesRes.value.data);
      if (gradesRes.status === 'fulfilled') setGrades(gradesRes.value.data);
      if (subjectsRes.status === 'fulfilled') setSubjects(subjectsRes.value.data);
    };
    fetchMeta();
  }, []);

  // ═══ فلاتر متتالية ═══
  const filteredGrades = selectedStage
    ? grades.filter(g => String(g.stage_id) === String(selectedStage))
    : [];

  const filteredSubjects = selectedGrade
    ? subjects.filter(s =>
        s.grades?.some(g => String(g.grade_id) === String(selectedGrade)) ||
        String(s.grade_id) === String(selectedGrade)
      )
    : selectedStage
      ? subjects.filter(s =>
          s.grades?.some(g => String(g.stage_id) === String(selectedStage)) ||
          s.tracks?.some(t => String(t.stage_id) === String(selectedStage))
        )
      : subjects;

  const handleStageChange = (id) => {
    setSelectedStage(prev => prev === id ? '' : id);
    setSelectedGrade('');
    setSelectedSubject('');
    setPathData(null);
  };

  const handleGradeChange = (id) => {
    setSelectedGrade(prev => prev === id ? '' : id);
    setSelectedSubject('');
    setPathData(null);
  };

  // ═══ جلب المسار تلقائياً عند اختيار المادة ═══
  const fetchPath = useCallback(async () => {
    if (!selectedSubject || !selectedGrade) return;
    setPathLoading(true);
    try {
      const res = await api.get(`/learning-paths/admin/${selectedSubject}/${selectedGrade}`);
      setPathData(res.data);
    } catch {
      setPathData(null);
    } finally {
      setPathLoading(false);
    }
  }, [selectedSubject, selectedGrade]);

  // جلب تلقائي عند تغيير المادة
  useEffect(() => {
    if (selectedSubject && selectedGrade) {
      fetchPath();
    }
  }, [selectedSubject, selectedGrade, fetchPath]);

  // جلب إحصائيات المسار
  useEffect(() => {
    if (!pathData?.path?.id) { setPathStats(null); return; }
    api.get(`/learning-paths/admin/stats/${pathData.path.id}`)
      .then(r => setPathStats(r.data))
      .catch(() => setPathStats(null));
  }, [pathData?.path?.id]);

  // ═══ بحث التمارين (إضافة) ═══
  const fetchExercises = useCallback(async () => {
    if (!selectedSubject) return;
    setLoadingExercises(true);
    try {
      const res = await api.get(`/exercises?subject_id=${selectedSubject}`);
      setExercises(res.data || []);
    } catch {
      setExercises([]);
    } finally {
      setLoadingExercises(false);
    }
  }, [selectedSubject]);

  useEffect(() => {
    if (selectedSubject) fetchExercises();
  }, [selectedSubject, fetchExercises]);

  const filteredExercises = exerciseSearch.trim()
    ? exercises.filter(e => e.title?.includes(exerciseSearch.trim()))
    : exercises;

  // ═══ بحث التمارين (تعديل) ═══
  const fetchEditExercises = useCallback(async (searchTerm) => {
    if (!selectedSubject) return;
    setLoadingEditExercises(true);
    try {
      const res = await api.get(`/exercises?subject_id=${selectedSubject}`);
      const data = res.data || [];
      setEditExercises(searchTerm ? data.filter(e => e.title?.includes(searchTerm)) : data);
    } catch {
      setEditExercises([]);
    } finally {
      setLoadingEditExercises(false);
    }
  }, [selectedSubject]);

  // ═══ توليد تلقائي — بضغطة واحدة ═══
  const handleAutoGenerate = async (force = false) => {
    if (!selectedSubject || !selectedGrade) {
      toast.error('اختر المادة والصف أولاً');
      return;
    }
    setGenerating(true);
    try {
      const res = await api.post('/learning-paths/auto-generate', {
        subject_id: selectedSubject,
        grade_id: selectedGrade,
        force,
      });
      if (res.data.exists && !force) {
        setAutoGenInfo(res.data);
        setShowAutoConfirm(true);
      } else if (res.data.success) {
        toast.success(`✅ تم توليد المسار — ${res.data.nodes_created} محطة`);
        setShowAutoConfirm(false);
        fetchPath();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'خطأ في التوليد التلقائي');
    } finally {
      setGenerating(false);
    }
  };

  // ═══ إعادة توليد وحدة واحدة ═══
  const handleAutoGenerateUnit = async (unitId) => {
    setRegeneratingUnit(unitId);
    try {
      const res = await api.post('/learning-paths/auto-generate', {
        subject_id: selectedSubject,
        grade_id: selectedGrade,
        unit_id: unitId,
        force: true,
      });
      if (res.data.success) {
        toast.success(`✅ تم إعادة توليد الوحدة — ${res.data.nodes_created} محطة`);
        fetchPath();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'خطأ في إعادة التوليد');
    } finally {
      setRegeneratingUnit(null);
    }
  };

  // ═══ ترتيب الوحدات ═══
  const openUnitOrder = () => {
    const sorted = [...availableUnits].sort((a, b) => (a.order_index ?? 999) - (b.order_index ?? 999));
    setUnitOrderList(sorted);
    setShowUnitOrder(true);
  };

  const moveUnit = (idx, direction) => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= unitOrderList.length) return;
    const newList = [...unitOrderList];
    [newList[idx], newList[targetIdx]] = [newList[targetIdx], newList[idx]];
    setUnitOrderList(newList);
  };

  const saveUnitOrder = async () => {
    setSavingUnitOrder(true);
    try {
      const orders = unitOrderList.map((u, i) => ({ id: u.id, order_index: i + 1 }));
      await api.put('/exercises/units/reorder', { orders });
      toast.success('تم حفظ ترتيب الوحدات');
      setShowUnitOrder(false);
      fetchPath();
    } catch {
      toast.error('خطأ في حفظ الترتيب');
    } finally {
      setSavingUnitOrder(false);
    }
  };

  // ═══ إضافة محطة يدوياً ═══
  const handleAddNode = async () => {
    if (addNodeType !== 'checkpoint' && !addExerciseId) {
      toast.error('اختر تمريناً أولاً');
      return;
    }
    setAddingNode(true);
    try {
      let pathId = pathData?.path?.id;
      if (!pathId) {
        const subjectName = subjects.find(s => String(s.id) === String(selectedSubject))?.name || 'مسار التعلم';
        const pathRes = await api.post('/learning-paths', {
          subject_id: selectedSubject,
          grade_id: selectedGrade,
          title: subjectName,
        });
        pathId = pathRes.data.id;
      }
      await api.post(`/learning-paths/${pathId}/nodes`, {
        exercise_id: addNodeType === 'checkpoint' ? exercises[0]?.id : addExerciseId,
        node_type: addNodeType,
        required_xp: addRequiredXp,
      });
      toast.success('تم إضافة المحطة');
      setAddNodeType('exercise');
      setAddExerciseId('');
      setAddExerciseTitle('');
      setAddRequiredXp(0);
      setExerciseSearch('');
      fetchPath();
    } catch (err) {
      toast.error(err.response?.data?.message || 'خطأ في إضافة المحطة');
    } finally {
      setAddingNode(false);
    }
  };

  // ═══ حذف محطة ═══
  const handleDeleteNode = async (nodeId) => {
    if (!window.confirm('هل تريد حذف هذه المحطة؟')) return;
    try {
      await api.delete(`/learning-paths/nodes/${nodeId}`);
      toast.success('تم حذف المحطة');
      fetchPath();
    } catch {
      toast.error('خطأ في حذف المحطة');
    }
  };

  // ═══ إعادة ترتيب ═══
  const handleReorder = async (nodeIdx, direction) => {
    const nodes = pathData?.nodes || [];
    const targetIdx = direction === 'up' ? nodeIdx - 1 : nodeIdx + 1;
    if (targetIdx < 0 || targetIdx >= nodes.length) return;
    const nodeA = nodes[nodeIdx];
    const nodeB = nodes[targetIdx];
    try {
      await Promise.all([
        api.put(`/learning-paths/nodes/${nodeA.id}`, { order_index: nodeB.order_index }),
        api.put(`/learning-paths/nodes/${nodeB.id}`, { order_index: nodeA.order_index }),
      ]);
      fetchPath();
    } catch {
      toast.error('خطأ في إعادة الترتيب');
    }
  };

  // ═══ تعديل محطة ═══
  const openEditModal = (node) => {
    setEditModal({
      node,
      exerciseId: node.exercise_id,
      exerciseTitle: node.exercise_title || '',
      requiredXp: node.required_xp || 0,
    });
    setEditSearch('');
    setEditExercises([]);
    fetchEditExercises('');
  };

  const handleSaveEdit = async () => {
    if (!editModal) return;
    setSavingEdit(true);
    try {
      await api.put(`/learning-paths/nodes/${editModal.node.id}`, {
        exercise_id: editModal.exerciseId,
        required_xp: editModal.requiredXp,
      });
      toast.success('تم تعديل المحطة');
      setEditModal(null);
      fetchPath();
    } catch {
      toast.error('خطأ في تعديل المحطة');
    } finally {
      setSavingEdit(false);
    }
  };

  // ═══ Render ═══
  const nodes = pathData?.nodes || [];
  const path = pathData?.path;
  const availableUnits = pathData?.units || [];
  const selectedSubjectName = subjects.find(s => String(s.id) === String(selectedSubject))?.name || '';
  const selectedGradeName = grades.find(g => String(g.id) === String(selectedGrade))?.name || '';
  const hasPath = path && nodes.length > 0;
  const noPathYet = selectedSubject && selectedGrade && !pathLoading && !hasPath;

  // تجميع المحطات حسب الوحدة
  const groupedNodes = useMemo(() => {
    if (!nodes || nodes.length === 0) return [];
    const groups = [];
    let currentUnitId = '__init__';
    let currentGroup = null;

    for (const node of nodes) {
      const uid = node.unit_id || '__ungrouped__';
      if (uid !== currentUnitId) {
        currentGroup = {
          unit_id: node.unit_id || null,
          unit_title: node.unit_title || 'تمارين عامة',
          unit_order: node.unit_order ?? 999,
          nodes: [],
        };
        groups.push(currentGroup);
        currentUnitId = uid;
      }
      currentGroup.nodes.push(node);
    }
    return groups;
  }, [nodes]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* ═══ Header ═══ */}
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <span>🗺️</span> إدارة مسارات التعلم
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">اختر المرحلة والصف والمادة — ثم اضغط "توليد تلقائي"</p>
        </div>

        {/* ═══ فلاتر المراحل ═══ */}
        {stages.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {stages.map(stage => (
              <button
                key={stage.id}
                onClick={() => handleStageChange(stage.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                  selectedStage === stage.id
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300 hover:text-blue-600'
                }`}
              >
                {stage.icon || stage.emoji || ''} {stage.name}
              </button>
            ))}
          </div>
        )}

        {/* ═══ فلاتر الصفوف ═══ */}
        {selectedStage && filteredGrades.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {filteredGrades.map(grade => (
              <button
                key={grade.id}
                onClick={() => handleGradeChange(grade.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                  selectedGrade === grade.id
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'bg-white text-gray-500 border border-gray-200 hover:border-violet-300 hover:text-violet-600'
                }`}
              >
                {grade.name}
              </button>
            ))}
          </div>
        )}

        {/* ═══ اختيار المادة (أزرار مثل الصفوف) ═══ */}
        {selectedGrade && filteredSubjects.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {filteredSubjects.map(s => (
              <button
                key={s.id}
                onClick={() => {
                  if (String(selectedSubject) === String(s.id)) {
                    setSelectedSubject(''); setPathData(null); setShowManualAdd(false);
                  } else {
                    setSelectedSubject(s.id); setPathData(null); setShowManualAdd(false);
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                  String(selectedSubject) === String(s.id)
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-white text-gray-500 border border-gray-200 hover:border-emerald-300 hover:text-emerald-600'
                }`}
              >
                {s.icon || ''} {s.name}
              </button>
            ))}
          </div>
        )}

        {/* ═══ Loading ═══ */}
        {pathLoading && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        )}

        {/* ═══ لا يوجد مسار — زر التوليد الكبير ═══ */}
        {noPathYet && (
          <div className="bg-white rounded-2xl border-2 border-dashed border-violet-200 p-10 text-center">
            <span className="text-5xl block mb-4">🪄</span>
            <h2 className="text-xl font-bold text-gray-800 mb-2">
              توليد مسار تعلم لـ {selectedSubjectName}
            </h2>
            <p className="text-sm text-gray-500 mb-2">
              {selectedGradeName} — {exercises.length} تمرين متاح
            </p>
            {exercises.length === 0 ? (
              <div className="mt-4">
                <p className="text-sm text-amber-600 mb-3">⚠️ لا توجد تمارين لهذه المادة. استورد تمارين أولاً</p>
                <a
                  href="/admin/exercises"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
                >
                  📥 الذهاب لإدارة التمارين
                </a>
              </div>
            ) : (
              <button
                onClick={() => handleAutoGenerate(false)}
                disabled={generating}
                className="mt-4 bg-gradient-to-l from-violet-500 to-purple-600 text-white px-8 py-3.5 rounded-xl text-base font-bold hover:shadow-xl hover:shadow-violet-500/30 transition-all duration-300 disabled:opacity-50 flex items-center gap-3 mx-auto"
              >
                {generating ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    جارٍ التوليد...
                  </>
                ) : (
                  <>
                    <span className="text-xl">🪄</span>
                    توليد المسار تلقائياً بضغطة واحدة
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* ═══ المسار موجود — عرضه ═══ */}
        {hasPath && !pathLoading && (
          <div className="space-y-4">
            {/* Header المسار */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                    <span className="text-lg">🗺️</span>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-800">
                      {path.title || selectedSubjectName}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {selectedGradeName} — {nodes.length} محطة
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${path.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {path.is_active ? '✅ نشط' : '⏸️ متوقف'}
                  </span>
                  {availableUnits.length > 1 && (
                    <button
                      onClick={openUnitOrder}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors"
                    >
                      🔢 ترتيب الوحدات
                    </button>
                  )}
                  <button
                    onClick={() => handleAutoGenerate(false)}
                    disabled={generating}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg bg-violet-50 text-violet-600 hover:bg-violet-100 disabled:opacity-50 transition-colors"
                  >
                    {generating ? '⏳' : '🪄'} إعادة توليد الكل
                  </button>
                </div>
              </div>
            </div>

            {/* إحصائيات الطلاب */}
            {pathStats && pathStats.total_students > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="text-sm font-bold text-gray-500 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                  إحصائيات الطلاب
                </h3>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">{pathStats.total_students}</p>
                    <p className="text-xs text-gray-400">بدأوا المسار</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-emerald-600">{pathStats.completed_students}</p>
                    <p className="text-xs text-gray-400">أكملوا المسار</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-violet-600">
                      {pathStats.total_students > 0 ? Math.round((pathStats.completed_students / pathStats.total_students) * 100) : 0}%
                    </p>
                    <p className="text-xs text-gray-400">نسبة الإكمال</p>
                  </div>
                </div>
                {/* شريط تقدم المحطات */}
                <div className="space-y-1.5">
                  {pathStats.nodes.map(n => {
                    const pct = n.total_students > 0 ? Math.round((n.completed_count / n.total_students) * 100) : 0;
                    return (
                      <div key={n.node_id} className="flex items-center gap-2 text-xs">
                        <span className="w-32 truncate text-gray-500">{n.exercise_title}</span>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }}></div>
                        </div>
                        <span className="w-14 text-left text-gray-400">{n.completed_count}/{n.total_students}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* قائمة المحطات — مجمعة حسب الوحدة */}
            {groupedNodes.map((group, gIdx) => {
              let globalOffset = 0;
              for (let g = 0; g < gIdx; g++) globalOffset += groupedNodes[g].nodes.length;

              return (
                <div key={group.unit_id || `ungrouped-${gIdx}`} className="space-y-0">
                  {/* Header الوحدة */}
                  <div className="bg-indigo-50 rounded-t-2xl border border-indigo-200 px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{group.unit_id ? '📚' : '📎'}</span>
                      <h3 className="font-bold text-indigo-800 text-sm">{group.unit_title}</h3>
                      <span className="text-xs text-indigo-500 bg-indigo-100 px-2 py-0.5 rounded-full">{group.nodes.length} محطة</span>
                    </div>
                    {group.unit_id && (
                      <button
                        onClick={() => handleAutoGenerateUnit(group.unit_id)}
                        disabled={regeneratingUnit === group.unit_id}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg bg-indigo-100 text-indigo-600 hover:bg-indigo-200 disabled:opacity-50 transition-colors"
                      >
                        {regeneratingUnit === group.unit_id ? '⏳ جاري...' : '🔄 إعادة توليد الوحدة'}
                      </button>
                    )}
                  </div>

                  {/* محطات الوحدة */}
                  <div className="bg-white rounded-b-2xl border border-t-0 border-gray-100 p-6 mb-4">
                    <div className="relative">
                      {group.nodes.map((node, i) => {
                        const globalIdx = globalOffset + i;
                        const isLast = i === group.nodes.length - 1;
                        const nodeType = NODE_TYPES.find(t => t.value === node.node_type) || NODE_TYPES[0];

                        return (
                          <div key={node.id} className="flex items-start gap-3 relative">
                            {!isLast && (
                              <div
                                className="absolute w-0.5 bg-gray-200 rounded-full"
                                style={{ right: '0.9375rem', top: '2.5rem', bottom: '-0.5rem' }}
                              />
                            )}
                            <div className="flex-shrink-0 z-10">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 ${nodeType.color}`}>
                                {nodeType.icon}
                              </div>
                            </div>
                            <div className={`flex-1 ${isLast ? '' : 'pb-4'}`}>
                              <div className="bg-white rounded-xl border border-gray-200 p-3 hover:border-gray-300 transition-all">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                      <span className="text-xs text-gray-400 font-mono">#{globalIdx + 1}</span>
                                      <h3 className="text-sm font-bold text-gray-800 truncate">
                                        {node.exercise_title || nodeType.label}
                                      </h3>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
                                      {node.exercise_type && (
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${TYPE_COLORS[node.exercise_type] || 'bg-gray-50 text-gray-600'}`}>
                                          {TYPE_ICON[node.exercise_type]} {TYPE_LABEL[node.exercise_type]}
                                        </span>
                                      )}
                                      {node.difficulty && (
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${DIFF_COLORS[node.difficulty] || ''}`}>
                                          {DIFF_LABEL[node.difficulty]}
                                        </span>
                                      )}
                                      {parseInt(node.questions_count) > 0 && <span>{node.questions_count} سؤال</span>}
                                      {parseInt(node.xp_reward) > 0 && <span className="text-amber-600">{node.xp_reward} XP</span>}
                                      {parseInt(node.required_xp) > 0 && <span className="text-blue-600">🔒 {node.required_xp} XP</span>}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-0.5 mr-2">
                                    <button onClick={() => handleReorder(globalIdx, 'up')} disabled={globalIdx === 0}
                                      className={`p-1.5 rounded-lg transition-colors ${globalIdx === 0 ? 'text-gray-200' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'}`}>
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                                    </button>
                                    <button onClick={() => handleReorder(globalIdx, 'down')} disabled={globalIdx === nodes.length - 1}
                                      className={`p-1.5 rounded-lg transition-colors ${globalIdx === nodes.length - 1 ? 'text-gray-200' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'}`}>
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                                    </button>
                                    {node.node_type !== 'checkpoint' && (
                                      <button onClick={() => openEditModal(node)}
                                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="تعديل">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                      </button>
                                    )}
                                    <button onClick={() => handleDeleteNode(node.id)}
                                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="حذف">
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* الوحدات بدون محطات */}
            {availableUnits.filter(u => !groupedNodes.some(g => g.unit_id === u.id)).length > 0 && (
              <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4">
                <p className="text-xs text-amber-700 font-medium mb-2">📌 وحدات بدون محطات في المسار:</p>
                <div className="flex flex-wrap gap-2">
                  {availableUnits.filter(u => !groupedNodes.some(g => g.unit_id === u.id)).map(u => (
                    <button
                      key={u.id}
                      onClick={() => handleAutoGenerateUnit(u.id)}
                      disabled={regeneratingUnit === u.id}
                      className="text-xs bg-white border border-amber-300 text-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-100 disabled:opacity-50 transition-colors"
                    >
                      {regeneratingUnit === u.id ? '⏳' : '➕'} {u.title} ({u.exercises_count} تمرين)
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ═══ إضافة محطة يدوياً (مطوي) ═══ */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <button
                onClick={() => setShowManualAdd(!showManualAdd)}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  إضافة محطة يدوياً (متقدم)
                </span>
                <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${showManualAdd ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showManualAdd && (
                <div className="border-t border-gray-100 p-5 space-y-4">
                  {/* نوع المحطة */}
                  <div>
                    <label className="text-xs text-gray-500 font-medium mb-2 block">النوع</label>
                    <div className="grid grid-cols-3 gap-2">
                      {NODE_TYPES.map(nt => (
                        <button
                          key={nt.value}
                          onClick={() => { setAddNodeType(nt.value); setAddExerciseId(''); setAddExerciseTitle(''); }}
                          className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all duration-200 border-2 text-xs font-medium ${
                            addNodeType === nt.value
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300'
                          }`}
                        >
                          <span className="text-lg">{nt.icon}</span>
                          {nt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* بحث التمرين */}
                  {addNodeType !== 'checkpoint' && (
                    <div>
                      <label className="text-xs text-gray-500 font-medium mb-2 block">اختر التمرين</label>
                      <input
                        type="text"
                        value={exerciseSearch}
                        onChange={e => setExerciseSearch(e.target.value)}
                        placeholder="🔍 ابحث عن تمرين..."
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none mb-2"
                      />
                      {addExerciseId && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-2 flex items-center justify-between">
                          <span className="text-xs font-medium text-blue-700 truncate">{addExerciseTitle}</span>
                          <button onClick={() => { setAddExerciseId(''); setAddExerciseTitle(''); }} className="text-blue-400 hover:text-blue-600 mr-2">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      )}
                      <div className="max-h-40 overflow-y-auto space-y-1 border border-gray-100 rounded-lg">
                        {loadingExercises ? (
                          <div className="text-center py-4"><div className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" /></div>
                        ) : filteredExercises.length === 0 ? (
                          <p className="text-xs text-gray-400 text-center py-4">لا توجد تمارين</p>
                        ) : (
                          filteredExercises.map(ex => (
                            <button
                              key={ex.id}
                              onClick={() => { setAddExerciseId(ex.id); setAddExerciseTitle(ex.title); }}
                              className={`w-full text-right p-2 text-xs hover:bg-blue-50 transition-colors ${addExerciseId === ex.id ? 'bg-blue-50 border-r-2 border-blue-500' : ''}`}
                            >
                              <div className="font-medium text-gray-800 truncate">{ex.title}</div>
                              <div className="flex items-center gap-2 text-gray-400 mt-0.5">
                                {ex.type && <span>{TYPE_ICON[ex.type]} {TYPE_LABEL[ex.type]}</span>}
                                {ex.difficulty && <span>{DIFF_LABEL[ex.difficulty]}</span>}
                                <span>{ex.questions_count} سؤال</span>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* XP مطلوب */}
                  <div>
                    <label className="text-xs text-gray-500 font-medium mb-2 block">XP مطلوب للفتح</label>
                    <input
                      type="number" min="0" value={addRequiredXp}
                      onChange={e => setAddRequiredXp(parseInt(e.target.value) || 0)}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
                    />
                  </div>

                  <button
                    onClick={handleAddNode}
                    disabled={addingNode || (addNodeType !== 'checkpoint' && !addExerciseId)}
                    className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
                      addingNode || (addNodeType !== 'checkpoint' && !addExerciseId)
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-l from-blue-600 to-blue-700 text-white hover:shadow-lg hover:shadow-blue-500/25'
                    }`}
                  >
                    {addingNode ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                        إضافة للمسار
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══ Edit Modal ═══ */}
      {editModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-800 mb-4">تعديل المحطة</h3>
            <div className="mb-4">
              <label className="text-xs text-gray-500 font-medium mb-2 block">التمرين</label>
              <input
                type="text" value={editSearch}
                onChange={e => {
                  setEditSearch(e.target.value);
                  clearTimeout(editSearchTimerRef.current);
                  editSearchTimerRef.current = setTimeout(() => fetchEditExercises(e.target.value), 300);
                }}
                placeholder="🔍 ابحث عن تمرين..."
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none mb-2"
              />
              {editModal.exerciseTitle && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-2">
                  <span className="text-xs font-medium text-blue-700">{editModal.exerciseTitle}</span>
                </div>
              )}
              <div className="max-h-40 overflow-y-auto space-y-1 border border-gray-100 rounded-lg">
                {loadingEditExercises ? (
                  <div className="text-center py-3"><div className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" /></div>
                ) : editExercises.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-3">لا توجد نتائج</p>
                ) : (
                  editExercises.map(ex => (
                    <button key={ex.id}
                      onClick={() => setEditModal(prev => ({ ...prev, exerciseId: ex.id, exerciseTitle: ex.title }))}
                      className={`w-full text-right p-2 text-xs hover:bg-blue-50 transition-colors ${editModal.exerciseId === ex.id ? 'bg-blue-50 border-r-2 border-blue-500' : ''}`}
                    >
                      <div className="font-medium text-gray-800 truncate">{ex.title}</div>
                      <div className="flex items-center gap-2 text-gray-400 mt-0.5">
                        {ex.type && <span>{TYPE_ICON[ex.type]} {TYPE_LABEL[ex.type]}</span>}
                        {ex.difficulty && <span>{DIFF_LABEL[ex.difficulty]}</span>}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
            <div className="mb-6">
              <label className="text-xs text-gray-500 font-medium mb-2 block">XP مطلوب للفتح</label>
              <input type="number" min="0" value={editModal.requiredXp}
                onChange={e => setEditModal(prev => ({ ...prev, requiredXp: parseInt(e.target.value) || 0 }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
              />
            </div>
            <div className="flex items-center gap-3">
              <button onClick={handleSaveEdit} disabled={savingEdit}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-50">
                {savingEdit ? 'جاري الحفظ...' : 'حفظ'}
              </button>
              <button onClick={() => setEditModal(null)}
                className="flex-1 bg-gray-100 text-gray-600 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-200 transition-colors">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Confirm Auto-Generate Modal ═══ */}
      {showAutoConfirm && autoGenInfo && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowAutoConfirm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6 text-center" onClick={e => e.stopPropagation()}>
            <span className="text-4xl block mb-3">⚠️</span>
            <h3 className="text-lg font-bold text-gray-800 mb-2">يوجد مسار مسبق</h3>
            <p className="text-sm text-gray-500 mb-5">
              فيه <span className="font-bold text-gray-800">{autoGenInfo.node_count}</span> محطة. هل تريد استبداله بمسار جديد؟
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleAutoGenerate(true)}
                disabled={generating}
                className="flex-1 bg-violet-600 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-violet-700 disabled:opacity-50 transition-all"
              >
                {generating ? '⏳ جارٍ...' : '🪄 استبدال'}
              </button>
              <button
                onClick={() => setShowAutoConfirm(false)}
                className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ═══ Unit Reorder Modal ═══ */}
      {showUnitOrder && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowUnitOrder(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-800 mb-1">🔢 ترتيب الوحدات</h3>
            <p className="text-xs text-gray-500 mb-4">اسحب أو استخدم الأسهم لتغيير الترتيب</p>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {unitOrderList.map((unit, idx) => (
                <div key={unit.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-200">
                  <span className="text-xs font-bold text-gray-400 w-6 text-center">{idx + 1}</span>
                  <span className="flex-1 text-sm font-medium text-gray-700 truncate">{unit.title}</span>
                  <span className="text-[10px] text-gray-400">{unit.exercises_count} تمرين</span>
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => moveUnit(idx, 'up')}
                      disabled={idx === 0}
                      className={`p-0.5 rounded ${idx === 0 ? 'text-gray-200' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'}`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                    </button>
                    <button
                      onClick={() => moveUnit(idx, 'down')}
                      disabled={idx === unitOrderList.length - 1}
                      className={`p-0.5 rounded ${idx === unitOrderList.length - 1 ? 'text-gray-200' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'}`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={saveUnitOrder}
                disabled={savingUnitOrder}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {savingUnitOrder ? '⏳ جاري الحفظ...' : '💾 حفظ الترتيب'}
              </button>
              <button
                onClick={() => setShowUnitOrder(false)}
                className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
