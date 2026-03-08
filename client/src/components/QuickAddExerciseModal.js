import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useToast } from './ui/Toast';
import { EXERCISE_TYPES, TYPE_ICON, TYPE_LABEL } from './ExerciseQuestionForm';

export default function QuickAddExerciseModal({ onClose }) {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [stages, setStages] = useState([]);
  const [grades, setGrades] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedStage, setSelectedStage] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState('mcq');
  const [saving, setSaving] = useState(false);

  // Fetch metadata
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

  // Subject filtering (same 3-layer fallback)
  const filteredGrades = selectedStage
    ? grades.filter(g => String(g.stage_id) === String(selectedStage))
    : [];

  const filteredSubjects = selectedGrade
    ? subjects.filter(s => {
        const grade = grades.find(g => String(g.id) === String(selectedGrade));
        if (grade?.tracks && grade.tracks.length > 0) {
          const trackIds = grade.tracks.map(t => String(t.track_id || t.id));
          return s.tracks?.some(t => trackIds.includes(String(t.track_id)));
        }
        if (s.grades?.some(g => String(g.grade_id) === String(selectedGrade))) return true;
        if (s.grade_id && String(s.grade_id) === String(selectedGrade)) return true;
        return false;
      })
    : selectedStage
      ? subjects.filter(s => {
          if (s.grades?.some(g => String(g.stage_id) === String(selectedStage))) return true;
          if (s.tracks?.some(t => String(t.stage_id) === String(selectedStage))) return true;
          if (s.grade_id) {
            const g = grades.find(gr => String(gr.id) === String(s.grade_id));
            if (g && String(g.stage_id) === String(selectedStage)) return true;
          }
          return false;
        })
      : [];

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error('عنوان التمرين مطلوب');
      return;
    }
    if (!selectedSubject) {
      toast.error('يجب اختيار المادة');
      return;
    }

    setSaving(true);
    try {
      const res = await api.post('/exercises', {
        subject_id: selectedSubject,
        stage_id: selectedStage || null,
        grade_id: selectedGrade || null,
        title,
        type,
        difficulty: 'medium',
        xp_reward: 10,
      });
      toast.success('تم إنشاء التمرين');
      onClose();
      navigate(`/admin/exercises/${res.data.id}/edit`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'خطأ في إنشاء التمرين');
    } finally {
      setSaving(false);
    }
  };

  const selectClass = 'w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none disabled:bg-gray-50 disabled:text-gray-400';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white rounded-t-2xl z-10">
          <h3 className="text-lg font-bold text-gray-800">إضافة سريعة</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span className="text-xs font-medium text-gray-500 mb-1 block">المرحلة</span>
              <select
                value={selectedStage}
                onChange={e => { setSelectedStage(e.target.value); setSelectedGrade(''); setSelectedSubject(''); }}
                className={selectClass}
              >
                <option value="">اختر المرحلة</option>
                {stages.map(s => <option key={s.id} value={s.id}>{s.icon || ''} {s.name}</option>)}
              </select>
            </div>
            <div>
              <span className="text-xs font-medium text-gray-500 mb-1 block">الصف</span>
              <select
                value={selectedGrade}
                onChange={e => { setSelectedGrade(e.target.value); setSelectedSubject(''); }}
                disabled={!selectedStage}
                className={selectClass}
              >
                <option value="">{selectedStage ? 'اختر الصف' : '-'}</option>
                {filteredGrades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <span className="text-xs font-medium text-gray-500 mb-1 block">المادة</span>
            <select
              value={selectedSubject}
              onChange={e => setSelectedSubject(e.target.value)}
              disabled={!selectedStage}
              className={selectClass}
            >
              <option value="">{selectedStage ? 'اختر المادة' : '-'}</option>
              {filteredSubjects.map(s => <option key={s.id} value={s.id}>{s.icon || ''} {s.name}</option>)}
            </select>
          </div>

          {/* Title */}
          <div>
            <span className="text-xs font-medium text-gray-500 mb-1 block">عنوان التمرين</span>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="مثال: تمرين على جمع الأعداد"
              className={selectClass}
            />
          </div>

          {/* Type Grid */}
          <div>
            <span className="text-xs font-medium text-gray-500 mb-2 block">نوع التمرين</span>
            <div className="grid grid-cols-3 gap-2">
              {EXERCISE_TYPES.map(t => {
                const isSelected = type === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setType(t.value)}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-lg transition-all border-2 ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-blue-300'
                    }`}
                  >
                    <span className="text-lg">{t.icon}</span>
                    <span className={`text-[10px] font-medium ${isSelected ? 'text-blue-700' : 'text-gray-500'}`}>
                      {t.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 rounded-b-2xl flex items-center justify-between">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 font-medium">
            إلغاء
          </button>
          <button
            onClick={handleCreate}
            disabled={saving || !selectedSubject || !title.trim()}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
              saving || !selectedSubject || !title.trim()
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-l from-blue-600 to-blue-700 text-white hover:shadow-lg hover:shadow-blue-500/25'
            }`}
          >
            {saving ? 'جاري الإنشاء...' : 'إنشاء والانتقال للأسئلة'}
          </button>
        </div>
      </div>
    </div>
  );
}
