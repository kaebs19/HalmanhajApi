import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import DashboardLayout from './DashboardLayout';
import { useToast } from '../components/ui/Toast';
import QuickAddExerciseModal from '../components/QuickAddExerciseModal';
import QuickImportModal from '../components/QuickImportModal';
import {
  EXERCISE_TYPES, TYPE_LABEL, TYPE_ICON, TYPE_COLORS,
  DIFFICULTY_OPTIONS, DIFF_LABEL, DIFF_COLORS,
} from '../components/ExerciseQuestionForm';

const selectClass = 'text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none';

export default function ExercisesListPage() {
  const { toast } = useToast();
  const navigate = useNavigate();

  // بيانات التصنيف
  const [stages, setStages] = useState([]);
  const [grades, setGrades] = useState([]);
  const [subjects, setSubjects] = useState([]);

  // الفلاتر
  const [filterStage, setFilterStage] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('');
  const [filterPublished, setFilterPublished] = useState('');

  // البيانات
  const [exercises, setExercises] = useState([]);
  const [groupedData, setGroupedData] = useState(null);
  const [collapsedUnits, setCollapsedUnits] = useState({});
  const [loading, setLoading] = useState(true);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showQuickImport, setShowQuickImport] = useState(false);

  // إدارة الوحدات
  const [editingUnitId, setEditingUnitId] = useState(null);
  const [editingUnitTitle, setEditingUnitTitle] = useState('');
  const [showCreateUnit, setShowCreateUnit] = useState(false);
  const [newUnitTitle, setNewUnitTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showMoveToUnit, setShowMoveToUnit] = useState(false);

  // توليد مسار التعلم
  const [generatingPath, setGeneratingPath] = useState(false);
  const [showPathConfirm, setShowPathConfirm] = useState(false);
  const [pathGenInfo, setPathGenInfo] = useState(null);

  // جلب بيانات التصنيف
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

  // جلب التمارين مع الفلاتر
  const fetchExercises = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStage) params.append('stage_id', filterStage);
      if (filterGrade) params.append('grade_id', filterGrade);
      if (filterSubject) params.append('subject_id', filterSubject);
      if (filterType) params.append('type', filterType);
      if (filterDifficulty) params.append('difficulty', filterDifficulty);
      if (filterPublished) params.append('is_published', filterPublished);
      const res = await api.get(`/exercises?${params.toString()}`);
      setExercises(res.data);

      // جلب العرض المجمّع إذا تم اختيار مادة
      if (filterSubject) {
        try {
          const groupedRes = await api.get('/exercises/grouped', {
            params: { subject_id: filterSubject, grade_id: filterGrade || null },
          });
          setGroupedData(groupedRes.data);
        } catch {
          setGroupedData(null);
        }
      } else {
        setGroupedData(null);
      }
    } catch {
      toast.error('خطأ في تحميل التمارين');
    } finally {
      setLoading(false);
    }
  }, [filterStage, filterGrade, filterSubject, filterType, filterDifficulty, filterPublished, toast]);

  useEffect(() => {
    fetchExercises();
  }, [fetchExercises]);

  // فلاتر متتالية
  const filteredGrades = filterStage
    ? grades.filter(g => String(g.stage_id) === String(filterStage))
    : [];

  const filteredSubjects = filterGrade
    ? subjects.filter(s => s.grades?.some(g => String(g.grade_id) === String(filterGrade)))
    : filterStage
      ? subjects.filter(s =>
          s.grades?.some(g => String(g.stage_id) === String(filterStage)) ||
          s.tracks?.some(t => String(t.stage_id) === String(filterStage))
        )
      : subjects;

  // أحداث الفلاتر
  const handleStageChange = (id) => {
    setFilterStage(prev => prev === id ? '' : id);
    setFilterGrade('');
    setFilterSubject('');
  };

  const handleGradeChange = (id) => {
    setFilterGrade(prev => prev === id ? '' : id);
    setFilterSubject('');
  };

  const toggleUnit = (unitId) => {
    setCollapsedUnits(prev => ({ ...prev, [unitId]: !prev[unitId] }));
  };

  // الأحداث
  const handleDelete = async (id) => {
    if (!window.confirm('هل تريد حذف هذا التمرين؟')) return;
    try {
      await api.delete(`/exercises/${id}`);
      setExercises(prev => prev.filter(e => e.id !== id));
      toast.success('تم حذف التمرين');
      // تحديث العرض المجمّع
      if (groupedData) fetchExercises();
    } catch {
      toast.error('خطأ في الحذف');
    }
  };

  const handleTogglePublish = async (id) => {
    try {
      const res = await api.patch(`/exercises/${id}/publish`);
      setExercises(prev => prev.map(e =>
        e.id === id ? { ...e, is_published: res.data.is_published } : e
      ));
      toast.success(res.data.is_published ? 'تم النشر' : 'تم إلغاء النشر');
      if (groupedData) fetchExercises();
    } catch {
      toast.error('خطأ في تغيير حالة النشر');
    }
  };

  const handleDuplicate = async (id) => {
    try {
      const res = await api.post(`/exercises/${id}/duplicate`);
      setExercises(prev => [res.data, ...prev]);
      toast.success('تم نسخ التمرين');
      if (groupedData) fetchExercises();
    } catch {
      toast.error('خطأ في نسخ التمرين');
    }
  };

  // ─── إدارة الوحدات ───
  const handleRenameUnit = async (unitId) => {
    if (!editingUnitTitle.trim()) return;
    try {
      await api.put(`/exercises/units/${unitId}`, { title: editingUnitTitle.trim() });
      toast.success('تم تعديل اسم الوحدة');
      setEditingUnitId(null);
      setEditingUnitTitle('');
      fetchExercises();
    } catch {
      toast.error('خطأ في تعديل الوحدة');
    }
  };

  const handleDeleteUnit = async (unitId) => {
    if (!window.confirm('هل تريد حذف هذه الوحدة؟ سيتم فك ربط التمارين منها (لن تُحذف التمارين).')) return;
    try {
      const res = await api.delete(`/exercises/units/${unitId}`);
      toast.success(`تم حذف الوحدة — ${res.data.ungrouped_exercises} تمرين تم فك ربطهم`);
      fetchExercises();
    } catch {
      toast.error('خطأ في حذف الوحدة');
    }
  };

  const handleCreateUnit = async () => {
    if (!newUnitTitle.trim() || !filterSubject) return;
    try {
      await api.post('/exercises/units', {
        subject_id: filterSubject,
        grade_id: filterGrade || null,
        title: newUnitTitle.trim(),
      });
      toast.success('تم إنشاء الوحدة');
      setShowCreateUnit(false);
      setNewUnitTitle('');
      fetchExercises();
    } catch {
      toast.error('خطأ في إنشاء الوحدة');
    }
  };

  const handleMoveUnit = async (unitId, direction) => {
    if (!displayData?.units) return;
    const units = [...displayData.units].filter(u => !u.isFallback);
    const idx = units.findIndex(u => u.id === unitId);
    if (idx < 0) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === units.length - 1) return;

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const orders = units.map((u, i) => ({
      id: u.id,
      order_index: i === idx ? swapIdx + 1 : i === swapIdx ? idx + 1 : i + 1,
    }));

    try {
      await api.put('/exercises/units/reorder', { orders });
      fetchExercises();
    } catch {
      toast.error('خطأ في ترتيب الوحدات');
    }
  };

  // ─── توليد مسار التعلم ───
  const handleGenerateLearningPath = async (force = false) => {
    if (!filterSubject || !filterGrade) {
      toast.error('اختر المادة والصف أولاً');
      return;
    }
    setGeneratingPath(true);
    try {
      const res = await api.post('/learning-paths/auto-generate', {
        subject_id: filterSubject,
        grade_id: filterGrade,
        force,
      });
      if (res.data.exists && !force) {
        setPathGenInfo(res.data);
        setShowPathConfirm(true);
      } else if (res.data.success) {
        toast.success(`تم توليد المسار — ${res.data.nodes_created} محطة`);
        setShowPathConfirm(false);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'خطأ في التوليد التلقائي');
    } finally {
      setGeneratingPath(false);
    }
  };

  // ─── نقل تمارين بدون وحدة لوحدة ───
  const handleMoveUngroupedToUnit = async (targetUnitId) => {
    const ungroupedExercises = (filteredDisplayData || displayData)?.ungrouped || [];
    if (ungroupedExercises.length === 0) return;
    try {
      const ids = ungroupedExercises.map(e => e.id);
      await api.post('/exercises/bulk-assign-unit', { exercise_ids: ids, unit_id: targetUnitId });
      toast.success(`تم نقل ${ids.length} تمرين للوحدة`);
      setShowMoveToUnit(false);
      fetchExercises();
    } catch {
      toast.error('خطأ في نقل التمارين');
    }
  };

  // ─── حذف كل تمارين بدون وحدة ───
  const handleDeleteAllUngrouped = async () => {
    const ungroupedExercises = (filteredDisplayData || displayData)?.ungrouped || [];
    if (ungroupedExercises.length === 0) return;
    if (!window.confirm(`هل تريد حذف ${ungroupedExercises.length} تمرين مستقل نهائياً؟ لا يمكن التراجع!`)) return;
    try {
      const ids = ungroupedExercises.map(e => e.id);
      await api.post('/exercises/bulk-delete', { exercise_ids: ids });
      toast.success(`تم حذف ${ids.length} تمرين`);
      fetchExercises();
    } catch {
      toast.error('خطأ في حذف التمارين');
    }
  };

  // ── مكوّن صف التمرين ──
  const ExerciseRow = ({ exercise }) => (
    <div className="flex items-center justify-between py-3 px-4 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0">
      <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${TYPE_COLORS[exercise.type] || 'bg-gray-50 text-gray-600'}`}>
          {TYPE_ICON[exercise.type]} {TYPE_LABEL[exercise.type]}
        </span>
        <span className="text-sm font-medium text-gray-700 truncate">{exercise.title}</span>
        {!exercise.is_published && (
          <span className="text-[10px] bg-yellow-50 text-yellow-600 px-1.5 py-0.5 rounded font-medium">مسودة</span>
        )}
        <span className="text-xs text-gray-400">{exercise.questions_count} سؤال</span>
      </div>
      <div className="flex items-center gap-1 mr-2">
        <button
          onClick={() => handleTogglePublish(exercise.id)}
          className={`p-1.5 rounded-lg transition-colors ${exercise.is_published ? 'text-emerald-500 hover:bg-emerald-50' : 'text-gray-400 hover:bg-gray-50'}`}
          title={exercise.is_published ? 'إلغاء النشر' : 'نشر'}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {exercise.is_published ? (
              <>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </>
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            )}
          </svg>
        </button>
        <Link
          to={`/admin/exercises/${exercise.id}/edit`}
          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          title="تعديل"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </Link>
        <button
          onClick={() => handleDuplicate(exercise.id)}
          className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
          title="نسخ"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
        <button
          onClick={() => handleDelete(exercise.id)}
          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          title="حذف"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );

  // ── مكوّن كارت الوحدة ──
  const UnitCard = ({ unit, unitIndex, totalUnits }) => {
    const isCollapsed = collapsedUnits[unit.id];
    const exercisesList = unit.exercises || [];
    const isEditing = editingUnitId === unit.id;

    return (
      <div className={`bg-white rounded-2xl border overflow-hidden ${unit.isFallback ? 'border-dashed border-amber-200' : 'border-gray-100'}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
          <button
            onClick={() => toggleUnit(unit.id)}
            className="flex items-center gap-3 text-right flex-1 min-w-0"
          >
            <span className="text-xl">{unit.isFallback ? '📎' : '📚'}</span>
            <div className="min-w-0">
              {isEditing ? (
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <input
                    type="text"
                    value={editingUnitTitle}
                    onChange={e => setEditingUnitTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRenameUnit(unit.id); if (e.key === 'Escape') setEditingUnitId(null); }}
                    className="text-sm font-bold text-gray-800 border border-blue-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500/20 outline-none w-48"
                    autoFocus
                  />
                  <button onClick={() => handleRenameUnit(unit.id)} className="text-emerald-600 hover:text-emerald-700 p-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button onClick={() => setEditingUnitId(null)} className="text-gray-400 hover:text-gray-600 p-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <>
                  <h3 className="text-sm font-bold text-gray-800 truncate">{unit.title}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {exercisesList.length} تمرين
                    {unit.isFallback && <span className="text-amber-500 mr-1">(مجمّع من العنوان)</span>}
                  </p>
                </>
              )}
            </div>
          </button>

          {/* شريط أدوات الوحدة */}
          <div className="flex items-center gap-1 mr-3" onClick={e => e.stopPropagation()}>
            {!unit.isFallback && (
              <>
                {/* تحريك لأعلى */}
                <button
                  onClick={() => handleMoveUnit(unit.id, 'up')}
                  disabled={unitIndex === 0}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="تحريك لأعلى"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                {/* تحريك لأسفل */}
                <button
                  onClick={() => handleMoveUnit(unit.id, 'down')}
                  disabled={unitIndex === totalUnits - 1}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="تحريك لأسفل"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {/* تعديل الاسم */}
                <button
                  onClick={() => { setEditingUnitId(unit.id); setEditingUnitTitle(unit.title); }}
                  className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                  title="تعديل الاسم"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                {/* حذف الوحدة */}
                <button
                  onClick={() => handleDeleteUnit(unit.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="حذف الوحدة"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </>
            )}
            {/* سهم الطي */}
            <svg className={`w-5 h-5 text-gray-400 transition-transform duration-200 mr-1 ${isCollapsed ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        {/* Body */}
        {!isCollapsed && exercisesList.length > 0 && (
          <div className="border-t border-gray-100">
            {exercisesList.map(ex => (
              <ExerciseRow key={ex.id} exercise={ex} />
            ))}
          </div>
        )}
        {!isCollapsed && exercisesList.length === 0 && (
          <div className="border-t border-gray-100 py-6 text-center text-gray-400 text-sm">
            لا توجد تمارين في هذه الوحدة
          </div>
        )}
      </div>
    );
  };

  // هل نعرض الوضع المجمّع من API (عند اختيار مادة)؟
  const showGroupedFromApi = groupedData && filterSubject && !filterType && !filterDifficulty && !filterPublished;

  // تجميع تلقائي من القائمة العادية عندما التمارين لديها unit_id
  const autoGroupedData = (() => {
    if (showGroupedFromApi) return null; // API grouped أولوية
    if (exercises.length === 0) return null;

    // هل يوجد تمارين لديها unit_id؟
    const hasUnits = exercises.some(ex => ex.unit_id);
    if (!hasUnits) return null;

    const unitsMap = {};
    const ungrouped = [];

    exercises.forEach(ex => {
      if (ex.unit_id) {
        if (!unitsMap[ex.unit_id]) {
          unitsMap[ex.unit_id] = {
            id: ex.unit_id,
            title: ex.unit_title || 'وحدة بدون اسم',
            order_index: ex.unit_order || 0,
            exercises: [],
          };
        }
        unitsMap[ex.unit_id].exercises.push(ex);
      } else {
        ungrouped.push(ex);
      }
    });

    const units = Object.values(unitsMap).sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    if (units.length === 0) return null;

    return { units, ungrouped };
  })();

  // الوضع المجمّع يعمل من API أو تلقائياً
  const showGrouped = showGroupedFromApi || !!autoGroupedData;
  const displayData = showGroupedFromApi ? groupedData : autoGroupedData;

  // فلترة بالبحث
  const filteredExercises = searchQuery
    ? exercises.filter(e => e.title?.includes(searchQuery))
    : exercises;

  const filteredDisplayData = searchQuery && displayData
    ? {
        units: displayData.units?.map(u => ({
          ...u,
          exercises: u.exercises?.filter(e => e.title?.includes(searchQuery)) || [],
        })).filter(u => u.title?.includes(searchQuery) || u.exercises.length > 0),
        ungrouped: displayData.ungrouped?.filter(e => e.title?.includes(searchQuery)),
      }
    : displayData;

  // عدد التمارين الإجمالي
  const finalDisplayData = filteredDisplayData || displayData;
  const totalCount = showGrouped && finalDisplayData
    ? (finalDisplayData.units?.reduce((sum, u) => sum + (u.exercises?.length || 0), 0) || 0) + (finalDisplayData.ungrouped?.length || 0)
    : filteredExercises.length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">إدارة التمارين</h1>
            <p className="text-sm text-gray-500 mt-0.5">{totalCount} تمرين</p>
          </div>
          <div className="flex items-center gap-2">
            {filterSubject && filterGrade && (
              <button
                onClick={() => handleGenerateLearningPath(false)}
                disabled={generatingPath}
                className="bg-white border border-violet-300 text-violet-700 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-violet-50 transition-all duration-200 flex items-center gap-2 disabled:opacity-50"
              >
                {generatingPath ? (
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                )}
                توليد مسار التعلم
              </button>
            )}
            <button
              onClick={() => setShowQuickAdd(true)}
              className="bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              إضافة سريعة
            </button>
            <button
              onClick={() => setShowQuickImport(true)}
              className="bg-white border border-emerald-300 text-emerald-700 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-50 transition-all duration-200 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              استيراد سريع
            </button>
            <button
              onClick={() => navigate('/admin/exercises/create')}
              className="bg-gradient-to-l from-blue-600 to-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              إضافة تمرين
            </button>
          </div>
        </div>

        {/* فلاتر المراحل */}
        {stages.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {stages.map(stage => (
              <button
                key={stage.id}
                onClick={() => handleStageChange(stage.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                  filterStage === stage.id
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300 hover:text-blue-600'
                }`}
              >
                {stage.icon || stage.emoji || ''} {stage.name}
              </button>
            ))}
          </div>
        )}

        {/* فلاتر الصفوف */}
        {filterStage && filteredGrades.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {filteredGrades.map(grade => (
              <button
                key={grade.id}
                onClick={() => handleGradeChange(grade.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                  filterGrade === grade.id
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'bg-white text-gray-500 border border-gray-200 hover:border-violet-300 hover:text-violet-600'
                }`}
              >
                {grade.name}
              </button>
            ))}
          </div>
        )}

        {/* فلاتر إضافية */}
        <div className="flex flex-wrap gap-3">
          {/* بحث بالعنوان */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="بحث بالعنوان..."
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 pl-8 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none w-44"
            />
            <svg className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          {filteredSubjects.length > 0 && (
            <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)} className={selectClass}>
              <option value="">كل المواد</option>
              {filteredSubjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className={selectClass}>
            <option value="">كل الأنواع</option>
            {EXERCISE_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
            ))}
          </select>
          <select value={filterDifficulty} onChange={e => setFilterDifficulty(e.target.value)} className={selectClass}>
            <option value="">كل المستويات</option>
            {DIFFICULTY_OPTIONS.map(d => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
          <select value={filterPublished} onChange={e => setFilterPublished(e.target.value)} className={selectClass}>
            <option value="">الكل</option>
            <option value="true">منشور</option>
            <option value="false">مسودة</option>
          </select>
        </div>

        {/* القائمة */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : totalCount === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <svg className="w-16 h-16 text-gray-200 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-gray-400 text-sm mb-3">لا توجد تمارين</p>
            <button onClick={() => navigate('/admin/exercises/create')} className="text-sm text-blue-600 hover:underline font-medium">
              إنشاء أول تمرين
            </button>
          </div>
        ) : showGrouped ? (
          /* ═══ العرض المجمّع بالوحدات ═══ */
          <div className="space-y-4">
            {/* زر إنشاء وحدة جديدة */}
            {filterSubject && (
              <div className="flex items-center gap-2">
                {showCreateUnit ? (
                  <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
                    <input
                      type="text"
                      value={newUnitTitle}
                      onChange={e => setNewUnitTitle(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleCreateUnit(); if (e.key === 'Escape') { setShowCreateUnit(false); setNewUnitTitle(''); } }}
                      placeholder="اسم الوحدة الجديدة..."
                      className="text-sm border-0 outline-none bg-transparent w-48"
                      autoFocus
                    />
                    <button onClick={handleCreateUnit} disabled={!newUnitTitle.trim()} className="text-emerald-600 hover:text-emerald-700 text-sm font-bold disabled:opacity-40">
                      إنشاء
                    </button>
                    <button onClick={() => { setShowCreateUnit(false); setNewUnitTitle(''); }} className="text-gray-400 hover:text-gray-600 text-sm">
                      إلغاء
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowCreateUnit(true)}
                    className="bg-white border border-gray-200 text-gray-600 px-3 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    وحدة جديدة
                  </button>
                )}
              </div>
            )}

            {(filteredDisplayData || displayData)?.units?.map((unit, idx, arr) => (
              <UnitCard key={unit.id} unit={unit} unitIndex={idx} totalUnits={arr.filter(u => !u.isFallback).length} />
            ))}

            {/* تمارين بدون وحدة */}
            {(filteredDisplayData || displayData)?.ungrouped?.length > 0 && (
              <div className="bg-white rounded-2xl border border-dashed border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
                  <button
                    onClick={() => toggleUnit('ungrouped')}
                    className="flex items-center gap-3 text-right flex-1 min-w-0"
                  >
                    <span className="text-xl">📦</span>
                    <div>
                      <h3 className="text-sm font-bold text-gray-500">بدون وحدة (تمارين مستقلة)</h3>
                      <p className="text-xs text-gray-400 mt-0.5">{(filteredDisplayData || displayData)?.ungrouped?.length} تمرين</p>
                    </div>
                  </button>
                  {/* أزرار إدارة التمارين المستقلة */}
                  <div className="flex items-center gap-1 mr-3" onClick={e => e.stopPropagation()}>
                    {/* نقل الكل لوحدة */}
                    <div className="relative">
                      <button
                        onClick={() => setShowMoveToUnit(!showMoveToUnit)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="نقل الكل لوحدة"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                      </button>
                      {showMoveToUnit && (
                        <div className="absolute left-0 top-full mt-1 bg-white rounded-xl border border-gray-200 shadow-lg z-20 w-56 py-1">
                          <p className="text-xs font-bold text-gray-500 px-3 py-2 border-b border-gray-100">نقل الكل إلى:</p>
                          {(finalDisplayData?.units || []).filter(u => !u.isFallback).map(u => (
                            <button
                              key={u.id}
                              onClick={() => handleMoveUngroupedToUnit(u.id)}
                              className="w-full text-right px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                            >
                              📚 {u.title}
                            </button>
                          ))}
                          {(finalDisplayData?.units || []).filter(u => !u.isFallback).length === 0 && (
                            <p className="text-xs text-gray-400 px-3 py-2">لا توجد وحدات — أنشئ وحدة أولاً</p>
                          )}
                        </div>
                      )}
                    </div>
                    {/* حذف الكل */}
                    <button
                      onClick={handleDeleteAllUngrouped}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="حذف كل التمارين المستقلة"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                    {/* سهم الطي */}
                    <svg className={`w-5 h-5 text-gray-400 transition-transform duration-200 mr-1 ${collapsedUnits['ungrouped'] ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                {!collapsedUnits['ungrouped'] && (
                  <div className="border-t border-gray-100">
                    {(filteredDisplayData || displayData)?.ungrouped?.map(ex => (
                      <ExerciseRow key={ex.id} exercise={ex} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* ═══ العرض المسطح (الحالي) ═══ */
          <div className="space-y-3">
            {filteredExercises.map(exercise => (
              <div key={exercise.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between hover:border-gray-200 hover:shadow-sm transition-all duration-200">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${TYPE_COLORS[exercise.type] || 'bg-gray-50 text-gray-600'}`}>
                      {TYPE_ICON[exercise.type]} {TYPE_LABEL[exercise.type]}
                    </span>
                    {exercise.difficulty && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${DIFF_COLORS[exercise.difficulty] || ''}`}>
                        {DIFF_LABEL[exercise.difficulty]}
                      </span>
                    )}
                    <h3 className="text-sm font-bold text-gray-800 truncate">{exercise.title}</h3>
                    {!exercise.is_published && (
                      <span className="text-[10px] bg-yellow-50 text-yellow-600 px-1.5 py-0.5 rounded font-medium">مسودة</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
                    {exercise.stage_name && <span>{exercise.stage_name}</span>}
                    {exercise.grade_name && <span>{exercise.grade_name}</span>}
                    {exercise.subject_name && (
                      <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded text-[10px] font-medium">
                        {exercise.subject_name}
                      </span>
                    )}
                    {exercise.lesson_title && <span>الدرس: {exercise.lesson_title}</span>}
                    <span>{exercise.questions_count} سؤال</span>
                    <span>{exercise.xp_reward} XP</span>
                    {parseInt(exercise.solved_count) > 0 && (
                      <span className="text-emerald-500">{exercise.solved_count} طالب حلّها</span>
                    )}
                    {parseInt(exercise.avg_accuracy) > 0 && (
                      <span className="text-blue-500">{exercise.avg_accuracy}% دقة</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 mr-4">
                  <button
                    onClick={() => handleTogglePublish(exercise.id)}
                    className={`p-2 rounded-lg transition-colors ${exercise.is_published ? 'text-emerald-500 hover:bg-emerald-50' : 'text-gray-400 hover:bg-gray-50'}`}
                    title={exercise.is_published ? 'إلغاء النشر' : 'نشر'}
                  >
                    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      {exercise.is_published ? (
                        <>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </>
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      )}
                    </svg>
                  </button>
                  <Link
                    to={`/admin/exercises/${exercise.id}/edit`}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="تعديل"
                  >
                    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </Link>
                  <button
                    onClick={() => handleDuplicate(exercise.id)}
                    className="p-2 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                    title="نسخ"
                  >
                    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(exercise.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="حذف"
                  >
                    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showQuickAdd && (
        <QuickAddExerciseModal onClose={() => setShowQuickAdd(false)} />
      )}

      {showQuickImport && (
        <QuickImportModal
          onClose={() => setShowQuickImport(false)}
          onImported={fetchExercises}
        />
      )}

      {/* dialog تأكيد توليد مسار التعلم */}
      {showPathConfirm && pathGenInfo && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowPathConfirm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6 text-center" onClick={e => e.stopPropagation()}>
            <span className="text-4xl block mb-3">&#9888;&#65039;</span>
            <h3 className="text-lg font-bold text-gray-800 mb-2">يوجد مسار مسبق</h3>
            <p className="text-sm text-gray-500 mb-5">
              فيه <span className="font-bold text-gray-800">{pathGenInfo.node_count}</span> محطة. هل تريد استبداله بمسار جديد؟
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleGenerateLearningPath(true)}
                disabled={generatingPath}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {generatingPath ? 'جاري التوليد...' : 'استبدال'}
              </button>
              <button
                onClick={() => setShowPathConfirm(false)}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-200 transition-colors"
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
