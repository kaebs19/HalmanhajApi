import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { TYPE_ICON, TYPE_LABEL } from './ExerciseQuestionForm';

const DIFF_COLORS = { easy: 'text-emerald-600', medium: 'text-amber-600', hard: 'text-red-600' };

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  // Ctrl+K / Cmd+K للفتح
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Focus عند الفتح
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery(''); setResults(null); setSelectedIdx(0);
    }
  }, [open]);

  // بحث مع debounce
  useEffect(() => {
    if (!query || query.length < 2) { setResults(null); return; }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/stats/search', { params: { q: query } });
        setResults(res.data);
        setSelectedIdx(0);
      } catch { setResults(null); }
      finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  // بناء قائمة مسطحة للنتائج
  const flatItems = useCallback(() => {
    if (!results) return [];
    const items = [];
    if (results.exercises.length > 0) {
      items.push({ type: 'header', label: 'التمارين' });
      results.exercises.forEach(ex => items.push({
        type: 'exercise', id: ex.id, title: ex.title,
        subtitle: `${TYPE_ICON[ex.type] || ''} ${TYPE_LABEL[ex.type] || ex.type} · ${ex.questions_count} سؤال${ex.unit_title ? ' · ' + ex.unit_title : ''}${ex.subject_name ? ' · ' + ex.subject_name : ''}`,
        to: `/admin/exercises/${ex.id}/edit`,
        badge: ex.is_published ? null : 'مسودة',
      }));
    }
    if (results.units.length > 0) {
      items.push({ type: 'header', label: 'الوحدات' });
      results.units.forEach(u => items.push({
        type: 'unit', id: u.id, title: u.title,
        subtitle: `${u.exercise_count} تمرين${u.subject_name ? ' · ' + u.subject_name : ''}`,
        to: '/admin/exercise-path',
      }));
    }
    if (results.subjects.length > 0) {
      items.push({ type: 'header', label: 'المواد' });
      results.subjects.forEach(s => items.push({
        type: 'subject', id: s.id, title: `${s.icon || ''} ${s.name}`,
        subtitle: 'مادة دراسية',
        to: '/admin/subjects',
      }));
    }
    if (results.lessons.length > 0) {
      items.push({ type: 'header', label: 'الدروس' });
      results.lessons.forEach(l => items.push({
        type: 'lesson', id: l.id, title: l.title,
        subtitle: l.subject_name || '',
        to: `/admin/lessons`,
      }));
    }
    return items;
  }, [results]);

  const items = flatItems();
  const selectableItems = items.filter(i => i.type !== 'header');

  // التنقل بالأسهم
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(prev => Math.min(prev + 1, selectableItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = selectableItems[selectedIdx];
      if (item?.to) { navigate(item.to); setOpen(false); }
    }
  };

  const handleSelect = (item) => {
    if (item.to) { navigate(item.to); setOpen(false); }
  };

  if (!open) return null;

  let selectableIdx = -1;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={() => setOpen(false)}>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* حقل البحث */}
        <div className="flex items-center gap-3 px-5 py-4 border-b">
          <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="ابحث عن تمرين، وحدة، مادة، درس..."
            className="flex-1 text-sm outline-none placeholder:text-gray-400"
            dir="rtl"
          />
          <kbd className="hidden sm:inline-block text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 font-mono">ESC</kbd>
        </div>

        {/* النتائج */}
        <div className="max-h-[50vh] overflow-y-auto">
          {loading && (
            <div className="px-5 py-8 text-center text-gray-400 text-sm">جاري البحث...</div>
          )}

          {!loading && query.length >= 2 && results && selectableItems.length === 0 && (
            <div className="px-5 py-8 text-center text-gray-400">
              <p className="text-sm font-medium">لا توجد نتائج</p>
              <p className="text-xs mt-1">جرب كلمات بحث مختلفة</p>
            </div>
          )}

          {!loading && items.length > 0 && (
            <div className="py-2">
              {items.map((item, i) => {
                if (item.type === 'header') {
                  return (
                    <div key={`h-${i}`} className="px-5 pt-3 pb-1">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{item.label}</span>
                    </div>
                  );
                }

                selectableIdx++;
                const isSelected = selectableIdx === selectedIdx;

                return (
                  <button
                    key={`${item.type}-${item.id}`}
                    onClick={() => handleSelect(item)}
                    className={`w-full text-right flex items-center gap-3 px-5 py-2.5 transition-colors ${
                      isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs flex-shrink-0 ${
                      item.type === 'exercise' ? 'bg-blue-100 text-blue-600' :
                      item.type === 'unit' ? 'bg-indigo-100 text-indigo-600' :
                      item.type === 'subject' ? 'bg-amber-100 text-amber-600' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {item.type === 'exercise' ? '📝' :
                       item.type === 'unit' ? '📚' :
                       item.type === 'subject' ? '📖' : '📄'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${isSelected ? 'text-blue-700' : 'text-gray-800'}`}>
                        {item.title}
                      </p>
                      <p className="text-[11px] text-gray-400 truncate">{item.subtitle}</p>
                    </div>
                    {item.badge && (
                      <span className="text-[9px] bg-yellow-50 text-yellow-600 px-1.5 py-0.5 rounded font-medium">{item.badge}</span>
                    )}
                    {isSelected && (
                      <kbd className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">Enter</kbd>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {!loading && !query && (
            <div className="px-5 py-6 text-center text-gray-400">
              <p className="text-sm">ابدأ بالكتابة للبحث</p>
              <p className="text-xs mt-2 flex items-center justify-center gap-2">
                <kbd className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 font-mono">Ctrl+K</kbd>
                <span>للبحث من أي مكان</span>
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {selectableItems.length > 0 && (
          <div className="px-5 py-2.5 border-t bg-gray-50 flex items-center gap-4 text-[10px] text-gray-400">
            <span className="flex items-center gap-1"><kbd className="bg-white px-1 py-0.5 rounded border text-[9px] font-mono">↑↓</kbd> للتنقل</span>
            <span className="flex items-center gap-1"><kbd className="bg-white px-1 py-0.5 rounded border text-[9px] font-mono">Enter</kbd> للفتح</span>
          </div>
        )}
      </div>
    </div>
  );
}
