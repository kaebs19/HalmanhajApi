import { useState, useEffect, useCallback, useRef } from 'react';
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
  const [pathData, setPathData] = useState(null); // { path, nodes }
  const [pathLoading, setPathLoading] = useState(false);
  const [showPath, setShowPath] = useState(false);

  // === إضافة محطة ===
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
  const [editModal, setEditModal] = useState(null); // { node, exerciseId, exerciseTitle, requiredXp }
  const [editSearch, setEditSearch] = useState('');
  // === توليد تلقائي ===
  const [showAutoConfirm, setShowAutoConfirm] = useState(false);
  const [autoGenInfo, setAutoGenInfo] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [editExercises, setEditExercises] = useState([]);
  const [loadingEditExercises, setLoadingEditExercises] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const editSearchTimerRef = useRef(null);

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
    setShowPath(false);
  };

  const handleGradeChange = (id) => {
    setSelectedGrade(prev => prev === id ? '' : id);
    setSelectedSubject('');
    setShowPath(false);
  };

  // ═══ جلب المسار ═══
  const fetchPath = useCallback(async () => {
    if (!selectedSubject || !selectedGrade) return;
    setPathLoading(true);
    try {
      const res = await api.get(`/learning-paths/admin/${selectedSubject}/${selectedGrade}`);
      setPathData(res.data);
    } catch {
      toast.error('خطأ في تحميل المسار');
      setPathData(null);
    } finally {
      setPathLoading(false);
    }
  }, [selectedSubject, selectedGrade, toast]);

  const handleShowPath = () => {
    setShowPath(true);
    fetchPath();
  };

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
    if (showPath && selectedSubject) {
      fetchExercises();
    }
  }, [showPath, selectedSubject, fetchExercises]);

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

  // ═══ إضافة محطة ═══
  const handleAddNode = async () => {
    if (addNodeType !== 'checkpoint' && !addExerciseId) {
      toast.error('اختر تمريناً أولاً');
      return;
    }
    setAddingNode(true);
    try {
      let pathId = pathData?.path?.id;

      // إنشاء المسار إذا لم يكن موجوداً
      if (!pathId) {
        const subjectName = subjects.find(s => String(s.id) === String(selectedSubject))?.name || 'مسار التعلم';
        const pathRes = await api.post('/learning-paths', {
          subject_id: selectedSubject,
          grade_id: selectedGrade,
          title: subjectName,
        });
        pathId = pathRes.data.id;
      }

      // إضافة المحطة
      await api.post(`/learning-paths/${pathId}/nodes`, {
        exercise_id: addNodeType === 'checkpoint' ? exercises[0]?.id : addExerciseId,
        node_type: addNodeType,
        required_xp: addRequiredXp,
      });

      toast.success('تم إضافة المحطة');
      resetAddForm();
      fetchPath();
    } catch (err) {
      toast.error(err.response?.data?.message || 'خطأ في إضافة المحطة');
    } finally {
      setAddingNode(false);
    }
  };

  // ═══ توليد تلقائي ═══
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
        toast.success(`تم توليد المسار تلقائياً — ${res.data.nodes_created} محطة`);
        setShowAutoConfirm(false);
        setShowPath(true);
        fetchPath();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'خطأ في التوليد التلقائي');
    } finally {
      setGenerating(false);
    }
  };

  const resetAddForm = () => {
    setAddNodeType('exercise');
    setAddExerciseId('');
    setAddExerciseTitle('');
    setAddRequiredXp(0);
    setExerciseSearch('');
  };

  // ═══ حذف محطة ═══
  const handleDeleteNode = async (nodeId) => {
    if (!window.confirm('هل تريد حذف هذه المحطة؟\nسيتم إعادة ترتيب المحطات تلقائياً')) return;
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
  const selectedSubjectName = subjects.find(s => String(s.id) === String(selectedSubject))?.name || '';
  const selectedGradeName = grades.find(g => String(g.id) === String(selectedGrade))?.name || '';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* ═══ Header ═══ */}
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <span>🗺️</span> إدارة مسارات التعلم
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">اختر المرحلة والصف والمادة لعرض مسار التعلم</p>
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

        {/* ═══ اختيار المادة + زر العرض ═══ */}
        {selectedGrade && (
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedSubject}
              onChange={e => { setSelectedSubject(e.target.value); setShowPath(false); }}
              className={selectClass}
            >
              <option value="">اختر المادة</option>
              {filteredSubjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            {selectedSubject && !showPath && (
              <>
                <button
                  onClick={handleShowPath}
                  className="bg-gradient-to-l from-blue-600 to-blue-700 text-white px-5 py-2 rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 flex items-center gap-2"
                >
                  <span>🗺️</span> عرض المسار
                </button>
                <button
                  onClick={() => handleAutoGenerate(false)}
                  disabled={generating}
                  className="bg-gradient-to-l from-violet-500 to-purple-600 text-white px-5 py-2 rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-violet-500/25 transition-all duration-200 flex items-center gap-2 disabled:opacity-50"
                >
                  {generating ? '⏳ جارٍ...' : '🪄 توليد تلقائي'}
                </button>
              </>
            )}
          </div>
        )}

        {/* ═══ محتوى المسار ═══ */}
        {showPath && (
          pathLoading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* ═══ العمود الأيسر — المسار الحالي ═══ */}
              <div className="lg:col-span-3">
                <div className="bg-white rounded-2xl border border-gray-100 p-6">
                  {/* Header المسار */}
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-lg font-bold text-gray-800">
                        {path ? path.title : `${selectedSubjectName} — ${selectedGradeName}`}
                      </h2>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {nodes.length} محطة
                      </p>
                    </div>
                    {path && (
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${path.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {path.is_active ? '✅ نشط' : '⏸️ متوقف'}
                      </span>
                    )}
                  </div>

                  {/* قائمة المحطات */}
                  {nodes.length === 0 ? (
                    <div className="text-center py-12">
                      <span className="text-4xl block mb-3">🗺️</span>
                      <p className="text-gray-400 text-sm mb-1">لا يوجد مسار بعد</p>
                      <p className="text-gray-400 text-xs">ابدأ بإضافة أول محطة من اللوحة اليسرى</p>
                    </div>
                  ) : (
                    <div className="relative">
                      {nodes.map((node, i) => {
                        const isLast = i === nodes.length - 1;
                        const nodeType = NODE_TYPES.find(t => t.value === node.node_type) || NODE_TYPES[0];

                        return (
                          <div key={node.id} className="flex items-start gap-3 relative">
                            {/* خط عمودي */}
                            {!isLast && (
                              <div
                                className="absolute w-0.5 bg-gray-200 rounded-full"
                                style={{ right: '0.9375rem', top: '2.5rem', bottom: '-0.5rem' }}
                              />
                            )}

                            {/* الدائرة */}
                            <div className="flex-shrink-0 z-10">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 ${nodeType.color}`}>
                                {nodeType.icon}
                              </div>
                            </div>

                            {/* البطاقة */}
                            <div className={`flex-1 ${isLast ? '' : 'pb-4'}`}>
                              <div className="bg-white rounded-xl border border-gray-200 p-3 hover:border-gray-300 transition-all">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1 min-w-0">
                                    {/* العنوان */}
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                      <span className="text-xs text-gray-400 font-mono">#{i + 1}</span>
                                      <h3 className="text-sm font-bold text-gray-800 truncate">
                                        {node.exercise_title || nodeType.label}
                                      </h3>
                                    </div>

                                    {/* معلومات */}
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
                                      {parseInt(node.questions_count) > 0 && (
                                        <span>{node.questions_count} سؤال</span>
                                      )}
                                      {parseInt(node.xp_reward) > 0 && (
                                        <span className="text-amber-600">{node.xp_reward} XP</span>
                                      )}
                                      {parseInt(node.required_xp) > 0 && (
                                        <span className="text-blue-600">🔒 {node.required_xp} XP مطلوب</span>
                                      )}
                                    </div>
                                  </div>

                                  {/* أزرار التحكم */}
                                  <div className="flex items-center gap-0.5 mr-2">
                                    <button
                                      onClick={() => handleReorder(i, 'up')}
                                      disabled={i === 0}
                                      className={`p-1.5 rounded-lg transition-colors ${i === 0 ? 'text-gray-200' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'}`}
                                      title="تحريك لأعلى"
                                    >
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                                      </svg>
                                    </button>
                                    <button
                                      onClick={() => handleReorder(i, 'down')}
                                      disabled={isLast}
                                      className={`p-1.5 rounded-lg transition-colors ${isLast ? 'text-gray-200' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'}`}
                                      title="تحريك لأسفل"
                                    >
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </button>
                                    {node.node_type !== 'checkpoint' && (
                                      <button
                                        onClick={() => openEditModal(node)}
                                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        title="تعديل"
                                      >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleDeleteNode(node.id)}
                                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                      title="حذف"
                                    >
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* ═══ العمود الأيمن — إضافة محطة ═══ */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-2xl border border-gray-100 p-6 sticky top-24">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                      <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      إضافة محطة جديدة
                    </h3>
                    <button
                      onClick={() => handleAutoGenerate(false)}
                      disabled={generating || !selectedSubject || !selectedGrade}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg bg-violet-50 text-violet-600 hover:bg-violet-100 disabled:opacity-50 transition-colors"
                    >
                      {generating ? '⏳ جارٍ...' : '🪄 توليد تلقائي'}
                    </button>
                  </div>

                  {/* نوع المحطة */}
                  <div className="mb-4">
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
                    <div className="mb-4">
                      <label className="text-xs text-gray-500 font-medium mb-2 block">اختر التمرين</label>
                      <input
                        type="text"
                        value={exerciseSearch}
                        onChange={e => setExerciseSearch(e.target.value)}
                        placeholder="🔍 ابحث عن تمرين..."
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none mb-2"
                      />

                      {/* التمرين المختار */}
                      {addExerciseId && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-2 flex items-center justify-between">
                          <span className="text-xs font-medium text-blue-700 truncate">{addExerciseTitle}</span>
                          <button
                            onClick={() => { setAddExerciseId(''); setAddExerciseTitle(''); }}
                            className="text-blue-400 hover:text-blue-600 mr-2"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      )}

                      {/* قائمة التمارين */}
                      <div className="max-h-48 overflow-y-auto space-y-1 border border-gray-100 rounded-lg">
                        {loadingExercises ? (
                          <div className="text-center py-4">
                            <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
                          </div>
                        ) : filteredExercises.length === 0 ? (
                          <p className="text-xs text-gray-400 text-center py-4">لا توجد تمارين</p>
                        ) : (
                          filteredExercises.map(ex => (
                            <button
                              key={ex.id}
                              onClick={() => { setAddExerciseId(ex.id); setAddExerciseTitle(ex.title); }}
                              className={`w-full text-right p-2 text-xs hover:bg-blue-50 transition-colors ${
                                addExerciseId === ex.id ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                              }`}
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
                  <div className="mb-4">
                    <label className="text-xs text-gray-500 font-medium mb-2 block">XP مطلوب للفتح</label>
                    <input
                      type="number"
                      min="0"
                      value={addRequiredXp}
                      onChange={e => setAddRequiredXp(parseInt(e.target.value) || 0)}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
                    />
                  </div>

                  {/* زر الإضافة */}
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
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        إضافة للمسار
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )
        )}
      </div>

      {/* ═══ Edit Modal ═══ */}
      {editModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-800 mb-4">تعديل المحطة</h3>

            {/* بحث التمرين */}
            <div className="mb-4">
              <label className="text-xs text-gray-500 font-medium mb-2 block">التمرين</label>
              <input
                type="text"
                value={editSearch}
                onChange={e => {
                  setEditSearch(e.target.value);
                  clearTimeout(editSearchTimerRef.current);
                  editSearchTimerRef.current = setTimeout(() => fetchEditExercises(e.target.value), 300);
                }}
                placeholder="🔍 ابحث عن تمرين..."
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none mb-2"
              />

              {/* التمرين المختار */}
              {editModal.exerciseTitle && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-2">
                  <span className="text-xs font-medium text-blue-700">{editModal.exerciseTitle}</span>
                </div>
              )}

              {/* قائمة التمارين */}
              <div className="max-h-40 overflow-y-auto space-y-1 border border-gray-100 rounded-lg">
                {loadingEditExercises ? (
                  <div className="text-center py-3">
                    <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
                  </div>
                ) : editExercises.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-3">لا توجد نتائج</p>
                ) : (
                  editExercises.map(ex => (
                    <button
                      key={ex.id}
                      onClick={() => setEditModal(prev => ({ ...prev, exerciseId: ex.id, exerciseTitle: ex.title }))}
                      className={`w-full text-right p-2 text-xs hover:bg-blue-50 transition-colors ${
                        editModal.exerciseId === ex.id ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                      }`}
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

            {/* XP مطلوب */}
            <div className="mb-6">
              <label className="text-xs text-gray-500 font-medium mb-2 block">XP مطلوب للفتح</label>
              <input
                type="number"
                min="0"
                value={editModal.requiredXp}
                onChange={e => setEditModal(prev => ({ ...prev, requiredXp: parseInt(e.target.value) || 0 }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
              />
            </div>

            {/* أزرار */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {savingEdit ? 'جاري الحفظ...' : 'حفظ'}
              </button>
              <button
                onClick={() => setEditModal(null)}
                className="flex-1 bg-gray-100 text-gray-600 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-200 transition-colors"
              >
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
    </DashboardLayout>
  );
}
