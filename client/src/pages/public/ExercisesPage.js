import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useUserAuth } from '../../context/UserAuthContext';
import { API_BASE } from '../../lib/api';
import AdUnit from '../../components/public/AdUnit';
import AdModal from '../../components/public/AdModal';

const TYPE_ICONS = {
  mcq: '🔤', true_false: '✅', fill_blank: '✏️', matching: '🔗',
  ordering: '🔢', classify: '📂', speed: '⚡', read_answer: '📖', image_match: '🖼️',
  word_build: '🔤', letter_pos: '🔠', numeric_input: '🔢', text_input: '✍️'
};
const DIFF_LABELS = { easy: 'سهل', medium: 'متوسط', hard: 'صعب' };

// ألوان المواد (تتكرر بالتناوب)
const SUBJECT_COLORS = [
  { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', accent: 'bg-blue-500' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', accent: 'bg-emerald-500' },
  { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', accent: 'bg-amber-500' },
  { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200', accent: 'bg-purple-500' },
  { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200', accent: 'bg-rose-500' },
  { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-200', accent: 'bg-cyan-500' },
];

export default function ExercisesPage() {
  const { user, token, updateUser } = useUserAuth();
  const navigate = useNavigate();

  // بيانات المواد
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // بيانات المسارات لكل المواد
  const [allPaths, setAllPaths] = useState({}); // { subjectId: pathData }
  const [pathsLoading, setPathsLoading] = useState(false);
  const [showAdForNode, setShowAdForNode] = useState(null);

  // اختيار الصف
  const [stages, setStages] = useState([]);
  const [grades, setGrades] = useState([]);
  const [selectedStage, setSelectedStage] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [savingGrade, setSavingGrade] = useState(false);
  const [showGradeChanger, setShowGradeChanger] = useState(false);

  // بناء المسار المختلط: وحدة من كل مادة بالتناوب
  const interleavedGroups = useMemo(() => {
    if (subjects.length === 0 || Object.keys(allPaths).length === 0) return [];

    // جمع الوحدات لكل مادة
    const subjectUnits = {};
    const subjectColorMap = {};

    subjects.forEach((subject, idx) => {
      subjectColorMap[subject.id] = SUBJECT_COLORS[idx % SUBJECT_COLORS.length];
      const pathData = allPaths[subject.id];
      if (!pathData?.nodes || pathData.nodes.length === 0) {
        subjectUnits[subject.id] = [];
        return;
      }

      // تجميع nodes حسب الوحدة
      const units = [];
      let currentUnitId = '__init__';
      let currentGroup = null;

      for (const node of pathData.nodes) {
        const uid = node.unit_id || '__ungrouped__';
        if (uid !== currentUnitId) {
          currentGroup = {
            unit_id: node.unit_id || null,
            unit_title: node.unit_title || 'تمارين عامة',
            subject_id: subject.id,
            subject_name: subject.name,
            subject_icon: subject.icon,
            color: subjectColorMap[subject.id],
            nodes: [],
          };
          units.push(currentGroup);
          currentUnitId = uid;
        }
        currentGroup.nodes.push(node);
      }
      subjectUnits[subject.id] = units;
    });

    // التناوب: وحدة من كل مادة
    const result = [];
    const subjectIds = subjects.map(s => s.id).filter(id => (subjectUnits[id]?.length || 0) > 0);
    const maxUnits = Math.max(...subjectIds.map(id => subjectUnits[id].length), 0);

    for (let round = 0; round < maxUnits; round++) {
      for (const sid of subjectIds) {
        if (round < subjectUnits[sid].length) {
          result.push(subjectUnits[sid][round]);
        }
      }
    }

    return result;
  }, [subjects, allPaths]);

  // إجمالي التقدم
  const totalProgress = useMemo(() => {
    let completed = 0, total = 0, xp = 0;
    Object.values(allPaths).forEach(pd => {
      if (pd?.progress) {
        completed += pd.progress.completed_count || 0;
        total += pd.progress.total_nodes || 0;
        xp += pd.progress.total_xp_earned || 0;
      }
    });
    return { completed, total, xp, pct: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }, [allPaths]);

  // جلب المواد حسب الصف
  const fetchSubjects = useCallback((gradeId) => {
    if (!token || !gradeId) {
      setSubjects([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`${API_BASE}/exercises/student/list?grade_id=${gradeId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        const arr = Array.isArray(data) ? data : [];
        const subjectMap = new Map();
        arr.forEach(ex => {
          if (ex.subject_id && !subjectMap.has(ex.subject_id)) {
            subjectMap.set(ex.subject_id, {
              id: ex.subject_id,
              name: ex.subject_name,
              icon: ex.subject_icon,
              exercisesCount: 0,
            });
          }
          if (ex.subject_id) {
            subjectMap.get(ex.subject_id).exercisesCount++;
          }
        });
        setSubjects(Array.from(subjectMap.values()));
      })
      .catch(() => setSubjects([]))
      .finally(() => setLoading(false));
  }, [token]);

  // جلب المواد عند التحميل
  useEffect(() => {
    if (user?.grade_id) {
      fetchSubjects(user.grade_id);
    } else {
      setLoading(false);
    }
  }, [user?.grade_id, fetchSubjects]);

  // جلب مسارات كل المواد بالتوازي
  useEffect(() => {
    if (subjects.length === 0 || !token) {
      setAllPaths({});
      return;
    }
    setPathsLoading(true);

    Promise.all(
      subjects.map(subject =>
        fetch(`${API_BASE}/learning-paths/${subject.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then(r => r.ok ? r.json() : null)
          .then(data => ({ subjectId: subject.id, data }))
          .catch(() => ({ subjectId: subject.id, data: null }))
      )
    ).then(results => {
      const paths = {};
      results.forEach(r => {
        if (r.data) paths[r.subjectId] = r.data;
      });
      setAllPaths(paths);
    }).finally(() => setPathsLoading(false));
  }, [subjects, token]);

  // جلب المراحل (لشاشة اختيار الصف)
  useEffect(() => {
    if (!user || user.grade_id) return;
    fetch(`${API_BASE}/public/browse/stages`)
      .then(r => r.json())
      .then(data => setStages(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [user]);

  // جلب الصفوف عند اختيار مرحلة
  useEffect(() => {
    if (!selectedStage) {
      setGrades([]);
      setSelectedGrade('');
      return;
    }
    const stage = stages.find(s => s.id === selectedStage);
    if (!stage) return;
    fetch(`${API_BASE}/public/browse/grades?stage_slug=${stage.slug}`)
      .then(r => r.json())
      .then(data => {
        setGrades(Array.isArray(data.grades) ? data.grades : []);
        setSelectedGrade('');
      })
      .catch(() => setGrades([]));
  }, [selectedStage, stages]);

  // حفظ الصف
  const saveGrade = async (stageId, gradeId) => {
    if (!gradeId) return;
    setSavingGrade(true);
    try {
      const res = await fetch(`${API_BASE}/user/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ stage_id: stageId, grade_id: gradeId })
      });
      if (res.ok) {
        const updated = await res.json();
        updateUser({ stage_id: updated.stage_id, grade_id: updated.grade_id });
        setShowGradeChanger(false);
        setSelectedStage('');
        setSelectedGrade('');
      }
    } catch (err) {
      console.error('Error saving grade:', err);
    } finally {
      setSavingGrade(false);
    }
  };

  const openGradeChanger = () => {
    setShowGradeChanger(true);
    if (stages.length === 0) {
      fetch(`${API_BASE}/public/browse/stages`)
        .then(r => r.json())
        .then(data => setStages(Array.isArray(data) ? data : []))
        .catch(() => {});
    }
  };

  // التعامل مع الضغط على محطة
  const handleNodeClick = (node) => {
    if (node.status === 'locked') {
      setShowAdForNode(node);
      return;
    }
    if (node.exercise_id) {
      navigate(`/exercises/${node.exercise_id}/play`, {
        state: { nodeId: node.id, pathId: node.path_id }
      });
    }
  };

  // بعد مشاهدة الإعلان → الانتقال للتمرين
  const handleAdComplete = async () => {
    if (!showAdForNode) return;
    try {
      await fetch(`${API_BASE}/exercises/skip/earn-from-ad`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
    } catch {}
    const node = showAdForNode;
    setShowAdForNode(null);
    if (node.exercise_id) {
      navigate(`/exercises/${node.exercise_id}/play`, {
        state: { nodeId: node.id, pathId: node.path_id }
      });
    }
  };

  // غير مسجل → اختبارات عامة
  if (!user) {
    return <Navigate to="/اختبارات" replace />;
  }

  // مسجل بدون صف → شاشة اختيار الصف
  if (!user.grade_id) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-gradient-to-l from-indigo-600 to-blue-700 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
            <h1 className="text-2xl sm:text-3xl font-bold">تمارين & تحديات</h1>
            <p className="text-blue-100 text-sm sm:text-base mt-1">اختر صفك الدراسي لتبدأ</p>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
          <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm text-center">
            <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-indigo-100 to-blue-200 flex items-center justify-center">
              <svg className="w-10 h-10 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">مرحباً {user.name}!</h2>
            <p className="text-sm text-gray-500 mb-8">اختر مرحلتك وصفك الدراسي لنعرض لك التمارين المناسبة</p>

            {!selectedStage ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {stages.map(stage => (
                  <button
                    key={stage.id}
                    onClick={() => setSelectedStage(stage.id)}
                    className="flex items-center gap-3 p-4 border-2 border-gray-100 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/50 transition-all text-right group"
                  >
                    <span className="text-2xl">{stage.icon || '🎓'}</span>
                    <div>
                      <p className="font-bold text-gray-800 group-hover:text-indigo-600 transition-colors">{stage.name}</p>
                      <p className="text-xs text-gray-400">{stage.grades_count} صف</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div>
                <button
                  onClick={() => { setSelectedStage(''); setGrades([]); setSelectedGrade(''); }}
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  رجوع للمراحل
                </button>
                <p className="text-sm font-medium text-gray-600 mb-3">اختر الصف:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {grades.map(grade => (
                    <button
                      key={grade.id}
                      onClick={() => saveGrade(selectedStage, grade.id)}
                      disabled={savingGrade}
                      className="p-4 border-2 border-gray-100 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/50 transition-all font-bold text-gray-800 hover:text-indigo-600 disabled:opacity-50"
                    >
                      {grade.name}
                    </button>
                  ))}
                </div>
                {grades.length === 0 && (
                  <p className="text-sm text-gray-400 py-4">جاري تحميل الصفوف...</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // مسجل مع grade_id → الصفحة الرئيسية
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ═══ Header ═══ */}
      <div className="bg-gradient-to-l from-indigo-600 to-blue-700 text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold mb-1">مرحباً {user.name}!</h1>
              <p className="text-blue-200 text-sm">اختبر معلوماتك وتحدَّ نفسك</p>
            </div>
            <button
              onClick={openGradeChanger}
              className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm rounded-xl px-3 py-2 text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              تغيير الصف
            </button>
          </div>

          {/* ═══ شريط التقدم الإجمالي ═══ */}
          {totalProgress.total > 0 && (
            <div>
              <div className="bg-white/20 rounded-full h-3 mb-2">
                <div
                  className="bg-white h-3 rounded-full transition-all duration-500"
                  style={{ width: `${totalProgress.pct}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-blue-100">
                <span>{totalProgress.pct}% مكتمل</span>
                <span>{totalProgress.completed}/{totalProgress.total} محطة</span>
                <span>{totalProgress.xp} XP</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ Grade Changer Modal ═══ */}
      {showGradeChanger && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowGradeChanger(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-800">تغيير الصف الدراسي</h3>
              <button onClick={() => setShowGradeChanger(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {!selectedStage ? (
              <div className="space-y-2">
                <p className="text-sm text-gray-500 mb-3">اختر المرحلة:</p>
                {stages.map(stage => (
                  <button
                    key={stage.id}
                    onClick={() => setSelectedStage(stage.id)}
                    className="w-full flex items-center gap-3 p-3 border border-gray-100 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/50 transition-all text-right"
                  >
                    <span className="text-xl">{stage.icon || '🎓'}</span>
                    <span className="font-medium text-gray-700">{stage.name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div>
                <button
                  onClick={() => { setSelectedStage(''); setGrades([]); }}
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  رجوع
                </button>
                <p className="text-sm text-gray-500 mb-3">اختر الصف:</p>
                <div className="space-y-2">
                  {grades.map(grade => (
                    <button
                      key={grade.id}
                      onClick={() => saveGrade(selectedStage, grade.id)}
                      disabled={savingGrade}
                      className="w-full p-3 border border-gray-100 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/50 transition-all font-medium text-gray-700 text-right disabled:opacity-50"
                    >
                      {grade.name}
                    </button>
                  ))}
                  {grades.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-3">جاري التحميل...</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="max-w-lg mx-auto px-4 sm:px-6 py-6">
        <AdUnit position="exercises_after_header" className="mb-6" />

        {/* ═══ التحدي اليومي ═══ */}
        <Link
          to="/learn/daily-challenge"
          className="block bg-gradient-to-l from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-4 mb-6 hover:border-amber-400 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-200/50">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-gray-800 text-sm">التحدي اليومي</p>
                <p className="text-xs text-gray-500">أجب على أسئلة جديدة كل يوم واكسب نقاط</p>
              </div>
            </div>
            <svg className="w-5 h-5 text-amber-400 group-hover:text-amber-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </div>
        </Link>

        {/* ═══ المسار المختلط ═══ */}
        {loading || pathsLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin text-4xl mb-4">⏳</div>
            <p className="text-gray-500 text-sm">جاري تحميل المسار...</p>
          </div>
        ) : subjects.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-gray-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-gray-700 mb-2">لا توجد تمارين لهذا الصف بعد</h3>
            <p className="text-sm text-gray-500 mb-4">جرب تغيير الصف أو تصفح الاختبارات العامة</p>
            <div className="flex items-center justify-center gap-3">
              <button onClick={openGradeChanger} className="text-indigo-600 hover:text-indigo-700 text-sm font-medium hover:underline">
                تغيير الصف
              </button>
              <span className="text-gray-300">|</span>
              <Link to="/اختبارات" className="text-emerald-600 hover:text-emerald-700 text-sm font-medium hover:underline">
                تصفح الاختبارات
              </Link>
            </div>
          </div>
        ) : interleavedGroups.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
            <div className="text-5xl mb-4">🗺️</div>
            <h3 className="text-base font-bold text-gray-700 mb-2">لم يتم إنشاء مسارات تعلم بعد</h3>
            <p className="text-sm text-gray-500 mb-4">تصفح الاختبارات العامة</p>
            <Link to="/اختبارات" className="text-emerald-600 hover:text-emerald-700 text-sm font-medium hover:underline">
              تصفح الاختبارات
            </Link>
          </div>
        ) : (
          /* ═══ خريطة المسار المختلط (Duolingo-style) ═══ */
          <div className="space-y-2">
            {interleavedGroups.map((group, gIdx) => {
              const unitCompleted = group.nodes.filter(n => n.status === 'completed').length;
              const unitTotal = group.nodes.length;
              const color = group.color;

              return (
                <div key={`${group.subject_id}-${group.unit_id || gIdx}`}>
                  {/* فاصل الوحدة مع اسم المادة */}
                  <div className="flex items-center gap-3 my-5">
                    <div className="flex-1 h-px bg-gray-200" />
                    <div className={`${color.bg} ${color.text} px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-2`}>
                      <span>{group.subject_icon || '📘'}</span>
                      <span>{group.subject_name}</span>
                      <span className="mx-1">—</span>
                      <span>{group.unit_title}</span>
                      <span className={`text-xs ${color.bg} px-2 py-0.5 rounded-full opacity-80`}>{unitCompleted}/{unitTotal}</span>
                    </div>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>

                  {/* محطات الوحدة */}
                  <div className="relative">
                    {group.nodes.map((node, i) => {
                      const isGroupLast = i === group.nodes.length - 1;
                      const lineColor = node.status === 'completed' ? 'bg-green-400' : 'bg-gray-200';

                      return (
                        <div key={node.id} className="flex items-start gap-4 relative">
                          {!isGroupLast && (
                            <div
                              className={`absolute w-1 ${lineColor} rounded-full`}
                              style={{ right: '1.375rem', top: '3rem', bottom: '-0.5rem' }}
                            />
                          )}

                          <div className="flex-shrink-0 z-10">
                            <NodeCircle status={node.status} accentColor={color.accent} />
                          </div>

                          <div className={`flex-1 ${isGroupLast ? '' : 'pb-6'}`}>
                            <button
                              onClick={() => handleNodeClick(node)}
                              className={`w-full text-right rounded-xl border-2 p-4 transition-all ${
                                node.status === 'completed'
                                  ? 'bg-green-50 border-green-200 hover:border-green-400'
                                  : node.status === 'current'
                                    ? 'bg-blue-50 border-blue-300 shadow-md hover:border-blue-500'
                                    : node.status === 'available'
                                      ? 'bg-white border-gray-200 hover:border-blue-400 hover:shadow-sm'
                                      : 'bg-gray-50 border-gray-200 opacity-60 hover:opacity-80 cursor-pointer'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <h3 className={`font-bold text-sm ${
                                  node.status === 'completed' ? 'text-green-700' :
                                  node.status === 'current' ? 'text-blue-700' :
                                  node.status === 'locked' ? 'text-gray-400' : 'text-gray-800'
                                }`}>
                                  {node.exercise_title || `محطة ${node.order_index + 1}`}
                                </h3>
                                <StatusBadge status={node.status} />
                              </div>

                              <div className="flex items-center gap-3 text-xs text-gray-500">
                                {node.exercise_type && (
                                  <span>{TYPE_ICONS[node.exercise_type] || '🧩'} {node.exercise_type}</span>
                                )}
                                {node.questions_count > 0 && <span>{node.questions_count} سؤال</span>}
                                {node.xp_reward > 0 && <span className="text-amber-600">{node.xp_reward} XP</span>}
                                {node.difficulty && <span>{DIFF_LABELS[node.difficulty] || node.difficulty}</span>}
                              </div>

                              {node.status === 'current' && (
                                <p className="text-xs text-blue-600 font-medium mt-2">📍 أنت هنا — اضغط للبدء</p>
                              )}

                              {node.status === 'locked' && (
                                <p className="text-xs text-amber-600 font-medium mt-2">🎬 اضغط لمشاهدة إعلان والفتح</p>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <AdUnit position="exercises_between_cards" className="my-6" />

        {/* ═══ بانر المراجعة ═══ */}
        <Link
          to="/learn/review"
          className="block bg-gradient-to-l from-purple-50 to-violet-50 border-2 border-purple-200 rounded-2xl p-4 mb-4 hover:border-purple-400 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-400 to-violet-500 flex items-center justify-center shadow-lg shadow-purple-200/50">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-gray-800 text-sm">مراجعة التمارين</p>
                <p className="text-xs text-gray-500">راجع ما تعلمته وعزز فهمك</p>
              </div>
            </div>
            <svg className="w-5 h-5 text-purple-400 group-hover:text-purple-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </div>
        </Link>

        {/* ═══ رابط الاختبارات العامة ═══ */}
        <Link
          to="/اختبارات"
          className="flex items-center justify-between bg-gradient-to-l from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-xl p-4 hover:border-emerald-400 hover:shadow-sm transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-gray-800 text-sm">تصفح كل الاختبارات</p>
              <p className="text-xs text-gray-500">اختبارات مجانية لجميع المراحل والمواد</p>
            </div>
          </div>
          <svg className="w-5 h-5 text-emerald-400 group-hover:text-emerald-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
      </div>

      {/* ═══ AdModal — مشاهدة إعلان لفتح محطة مقفلة ═══ */}
      {showAdForNode && (
        <AdModal
          onClose={() => setShowAdForNode(null)}
          onAdComplete={handleAdComplete}
          title="فتح المحطة"
          promptText="هذه المحطة مقفلة! شاهد إعلاناً قصيراً لفتحها والانتقال للتمرين"
        />
      )}
    </div>
  );
}

// ─── دائرة المحطة ───
function NodeCircle({ status, accentColor }) {
  const baseClasses = 'w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold';

  switch (status) {
    case 'completed':
      return (
        <div className={`${baseClasses} bg-green-500 text-white shadow-sm`}>
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      );
    case 'current':
      return (
        <div className={`${baseClasses} ${accentColor || 'bg-blue-500'} text-white shadow-lg ring-4 ring-blue-200 animate-pulse`}>
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          </svg>
        </div>
      );
    case 'available':
      return (
        <div className={`${baseClasses} bg-white border-2 border-blue-400 text-blue-500`}>
          <span className="text-xl">○</span>
        </div>
      );
    case 'locked':
    default:
      return (
        <div className={`${baseClasses} bg-gray-200 text-gray-400`}>
          🔒
        </div>
      );
  }
}

// ─── شارة الحالة ───
function StatusBadge({ status }) {
  const styles = {
    completed: 'bg-green-100 text-green-700',
    current: 'bg-blue-100 text-blue-700',
    available: 'bg-gray-100 text-gray-600',
    locked: 'bg-gray-100 text-gray-400',
  };
  const labels = {
    completed: '✅ مكتمل',
    current: '▶ حالي',
    available: 'متاح',
    locked: '🔒 مقفل',
  };

  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${styles[status] || styles.locked}`}>
      {labels[status] || labels.locked}
    </span>
  );
}
