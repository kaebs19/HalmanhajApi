import { useState, useEffect, useRef } from 'react';
import emojiCategories from '../data/emojiData';

const RECENT_KEY = 'halmanhaj_recent_emojis';
const MAX_RECENT = 12;

function getRecentEmojis() {
  try {
    const stored = localStorage.getItem(RECENT_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRecentEmoji(emoji) {
  try {
    const recent = getRecentEmojis();
    const updated = [emoji, ...recent.filter(e => e !== emoji)].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [emoji];
  }
}

export default function EmojiPicker({
  selectedEmoji = '',
  onSelect,
  compact = false,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('education');
  const [recentEmojis, setRecentEmojis] = useState([]);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customEmoji, setCustomEmoji] = useState('');
  const searchRef = useRef(null);

  useEffect(() => {
    setRecentEmojis(getRecentEmojis());
  }, []);

  const handleSelect = (emoji) => {
    onSelect(emoji);
    const updated = saveRecentEmoji(emoji);
    setRecentEmojis(updated);
  };

  const handleCustomSubmit = () => {
    if (customEmoji.trim()) {
      handleSelect(customEmoji.trim());
      setCustomEmoji('');
      setShowCustomInput(false);
    }
  };

  // فلترة الإيموجي بالبحث
  const getFilteredEmojis = () => {
    if (!searchQuery.trim()) return null;
    const query = searchQuery.trim().toLowerCase();
    const results = [];
    emojiCategories.forEach(cat => {
      cat.emojis.forEach(item => {
        if (item.nameAr.includes(query) || item.emoji === query) {
          results.push(item);
        }
      });
    });
    return results;
  };

  const filteredEmojis = getFilteredEmojis();
  const activeEmojis = filteredEmojis || emojiCategories.find(c => c.id === activeCategory)?.emojis || [];

  const btnSize = compact ? 'w-8 h-8 text-base' : 'w-10 h-10 text-xl';

  return (
    <div className="space-y-2">
      {/* شريط البحث */}
      <div className="relative">
        <input
          ref={searchRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ابحث عن أيقونة..."
          className="w-full px-3 py-2 pr-9 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <svg className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        {searchQuery && (
          <button
            type="button"
            onClick={() => { setSearchQuery(''); searchRef.current?.focus(); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* الإيموجي الأخيرة */}
      {!searchQuery && recentEmojis.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 mb-1.5">الأخيرة</p>
          <div className="flex flex-wrap gap-1.5">
            {recentEmojis.map((emoji, i) => (
              <button
                key={`recent-${i}`}
                type="button"
                onClick={() => handleSelect(emoji)}
                className={`${btnSize} flex items-center justify-center rounded-lg transition-all ${
                  selectedEmoji === emoji
                    ? 'bg-blue-100 border-2 border-blue-500 scale-110'
                    : 'bg-gray-50 border border-gray-200 hover:bg-gray-100 hover:scale-105'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* تبويبات الفئات */}
      {!searchQuery && (
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
          {emojiCategories.map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                activeCategory === cat.id
                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                  : 'bg-gray-50 text-gray-500 border border-gray-100 hover:bg-gray-100'
              }`}
            >
              <span className="text-sm">{cat.icon}</span>
              {cat.nameAr}
            </button>
          ))}
        </div>
      )}

      {/* نتائج البحث */}
      {searchQuery && filteredEmojis?.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-3">لا توجد نتائج لـ "{searchQuery}"</p>
      )}

      {/* شبكة الإيموجي */}
      <div className={`flex flex-wrap gap-1.5 ${compact ? 'max-h-36' : 'max-h-48'} overflow-y-auto p-1`}>
        {activeEmojis.map((item, i) => (
          <button
            key={`${item.emoji}-${i}`}
            type="button"
            onClick={() => handleSelect(item.emoji)}
            title={item.nameAr}
            className={`${btnSize} flex items-center justify-center rounded-lg transition-all ${
              selectedEmoji === item.emoji
                ? 'bg-blue-100 border-2 border-blue-500 scale-110'
                : 'bg-gray-50 border border-gray-200 hover:bg-gray-100 hover:scale-105'
            }`}
          >
            {item.emoji}
          </button>
        ))}
      </div>

      {/* إدخال يدوي */}
      <div className="flex items-center justify-between pt-1 border-t border-gray-100">
        {selectedEmoji && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">المحدد:</span>
            <span className="text-2xl">{selectedEmoji}</span>
            <button
              type="button"
              onClick={() => onSelect('')}
              className="text-xs text-red-400 hover:text-red-600"
            >
              إزالة
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => setShowCustomInput(!showCustomInput)}
          className="text-xs text-blue-500 hover:text-blue-700 mr-auto"
        >
          {showCustomInput ? 'إخفاء' : 'إدخال يدوي'}
        </button>
      </div>

      {showCustomInput && (
        <div className="flex gap-2">
          <input
            type="text"
            value={customEmoji}
            onChange={(e) => setCustomEmoji(e.target.value)}
            placeholder="الصق إيموجي هنا..."
            className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-lg text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
            maxLength={4}
          />
          <button
            type="button"
            onClick={handleCustomSubmit}
            disabled={!customEmoji.trim()}
            className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            اختر
          </button>
        </div>
      )}
    </div>
  );
}
