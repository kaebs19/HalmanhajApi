import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useUserAuth } from '../../context/UserAuthContext';
import { API_BASE } from '../../lib/api';
import SEO from '../../components/public/SEO';

const TYPE_ICONS = {
  mcq: '🔤', true_false: '✅', fill_blank: '✏️', matching: '🔗',
  ordering: '🔢', classify: '📂', speed: '⚡', read_answer: '📖', image_match: '🖼️',
  word_build: '🔤', letter_pos: '🔠'
};
const DIFF_LABELS = { easy: 'سهل', medium: 'متوسط', hard: 'صعب' };

export default function LearningPathPage() {
  const { subjectId } = useParams();
  const navigate = useNavigate();
  const { user, token, loading: authLoading } = useUserAuth();

  const [pathData, setPathData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lockedTooltip, setLockedTooltip] = useState(null);

  const nodes = pathData?.nodes || [];

  // تجميع المحطات حسب الوحدة (must be called before early returns)
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
          nodes: [],
        };
        groups.push(currentGroup);
        currentUnitId = uid;
      }
      currentGroup.nodes.push(node);
    }
    return groups;
  }, [nodes]);

  useEffect(() => {
    if (!token || authLoading) return;
    console.log('[LearningPath] fetching for subjectId:', subjectId);
    fetch(`${API_BASE}/learning-paths/${subjectId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => {
        console.log('[LearningPath] response status:', r.status);
        return r.ok ? r.json() : null;
      })
      .then(data => {
        console.log('[LearningPath] data:', data);
        setPathData(data);
      })
      .catch((err) => {
        console.error('[LearningPath] error:', err);
        setPathData(null);
      })
      .finally(() => setLoading(false));
  }, [subjectId, token, authLoading]);

  // ─── حالة عدم تسجيل الدخول ───
  if (!authLoading && !user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <SEO title="مسار التعلم" />
        <div className="text-6xl mb-4">🗺️</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">مسار التعلم</h1>
        <p className="text-gray-500 mb-6">سجّل دخول لعرض مسار التعلم الخاص بك</p>
        <Link to="/auth/login" className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition">
          تسجيل الدخول
        </Link>
      </div>
    );
  }

  // ─── تحميل ───
  if (loading || authLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <SEO title="مسار التعلم" />
        <div className="animate-spin text-4xl mb-4">⏳</div>
        <p className="text-gray-500">جاري تحميل المسار...</p>
      </div>
    );
  }

  // ─── لا يوجد مسار ───
  if (!pathData || !pathData.path) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <SEO title="مسار التعلم" />
        <div className="text-6xl mb-4">🗺️</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">لا يوجد مسار تعلم</h1>
        <p className="text-gray-500 mb-6">لم يتم إنشاء مسار تعلم لهذه المادة بعد</p>
        <Link to="/exercises" className="text-blue-600 hover:underline font-medium">
          العودة للتمارين
        </Link>
      </div>
    );
  }

  const { path, progress } = pathData;
  const completionPct = progress?.completion_percentage || 0;

  const handleNodeClick = (node) => {
    if (node.status === 'locked') {
      setLockedTooltip(node.id);
      setTimeout(() => setLockedTooltip(null), 2000);
      return;
    }
    if (node.exercise_id) {
      navigate(`/exercises/${node.exercise_id}/play`, {
        state: { nodeId: node.id, pathId: node.path_id }
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <SEO title={`مسار التعلم — ${path.title}`} />

      {/* ═══ Header ═══ */}
      <div className="bg-gradient-to-l from-blue-600 to-indigo-700 text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          <Link to="/exercises" className="inline-flex items-center gap-1 text-sm text-blue-200 hover:text-white mb-4">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            التمارين
          </Link>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">🗺️</span>
            <h1 className="text-2xl font-bold">{path.title}</h1>
          </div>
          {path.description && (
            <p className="text-blue-100 text-sm mb-4">{path.description}</p>
          )}

          {/* شريط التقدم */}
          <div className="bg-white/20 rounded-full h-3 mb-2">
            <div
              className="bg-white h-3 rounded-full transition-all duration-500"
              style={{ width: `${completionPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-sm text-blue-100">
            <span>{completionPct}% مكتمل</span>
            <span>{progress?.completed_count || 0}/{progress?.total_nodes || 0} محطة</span>
            <span>{progress?.total_xp_earned || 0} XP</span>
          </div>
        </div>
      </div>

      {/* ═══ خريطة المسار ═══ */}
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-8">
        {nodes.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>لا توجد محطات في هذا المسار بعد</p>
          </div>
        ) : (
          <div className="space-y-2">
            {groupedNodes.map((group, gIdx) => {
              const unitCompleted = group.nodes.filter(n => n.status === 'completed').length;
              const unitTotal = group.nodes.length;

              return (
                <div key={group.unit_id || `group-${gIdx}`}>
                  {/* فاصل الوحدة */}
                  {groupedNodes.length > 1 && (
                    <div className="flex items-center gap-3 my-5">
                      <div className="flex-1 h-px bg-gray-200" />
                      <div className="bg-indigo-100 text-indigo-700 px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-2">
                        <span>📚</span> {group.unit_title}
                        <span className="text-xs bg-indigo-200 text-indigo-600 px-2 py-0.5 rounded-full">{unitCompleted}/{unitTotal}</span>
                      </div>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>
                  )}

                  {/* محطات الوحدة */}
                  <div className="relative">
                    {group.nodes.map((node, i) => {
                      const isLast = i === group.nodes.length - 1 && gIdx === groupedNodes.length - 1;
                      const isGroupLast = i === group.nodes.length - 1;
                      const lineColor = node.status === 'completed' ? 'bg-green-400' : 'bg-gray-200';

                      return (
                        <div key={node.id} className="flex items-start gap-4 relative">
                          {!isLast && !isGroupLast && (
                            <div
                              className={`absolute w-1 ${lineColor} rounded-full`}
                              style={{ right: '1.375rem', top: '3rem', bottom: '-0.5rem' }}
                            />
                          )}

                          <div className="flex-shrink-0 z-10">
                            <NodeCircle status={node.status} nodeType={node.node_type} />
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
                                      : 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
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

                              {lockedTooltip === node.id && (
                                <p className="text-xs text-red-500 font-medium mt-2">🔒 أكمل المحطة السابقة أولاً</p>
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
      </div>
    </div>
  );
}

// ─── دائرة المحطة ───
function NodeCircle({ status, nodeType }) {
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
        <div className={`${baseClasses} bg-blue-500 text-white shadow-lg ring-4 ring-blue-200 animate-pulse`}>
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
