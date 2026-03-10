import { useState, useEffect, useRef } from 'react';

export default function AdModal({ onClose, onAdComplete, title = 'تخطي السؤال', promptText }) {
  const [stage, setStage] = useState('prompt'); // prompt | watching | done
  const [countdown, setCountdown] = useState(5);
  const intervalRef = useRef(null);

  const startAd = () => {
    setStage('watching');
    setCountdown(5);
    intervalRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          setStage('done');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  useEffect(() => {
    if (stage === 'done') {
      const t = setTimeout(() => onAdComplete(), 800);
      return () => clearTimeout(t);
    }
  }, [stage, onAdComplete]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <span className="text-xl">⏭️</span>
            <h3 className="text-base font-bold text-gray-800">{title}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="px-5 py-6 text-center">
          {stage === 'prompt' && (
            <>
              <div className="text-5xl mb-4">🎬</div>
              <p className="text-gray-600 text-sm mb-6">
                {promptText || <>انتهت التخطيات اليومية!<br />شاهد إعلاناً قصيراً للحصول على تخطي إضافي</>}
              </p>
              <button
                onClick={startAd}
                className="w-full bg-[#1CB0F6] text-white py-3 rounded-xl font-bold hover:bg-[#0A9FE0] transition-all active:scale-95"
              >
                🎬 شاهد إعلان
              </button>
            </>
          )}
          {stage === 'watching' && (
            <>
              <div className="text-5xl mb-4 animate-pulse">📺</div>
              <p className="text-gray-500 text-sm mb-3">جارٍ تحميل الإعلان...</p>
              <div className="text-6xl font-bold text-[#1CB0F6] mb-2">{countdown}</div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="h-2 bg-[#1CB0F6] rounded-full transition-all duration-1000"
                  style={{ width: `${((5 - countdown) / 5) * 100}%` }}
                />
              </div>
            </>
          )}
          {stage === 'done' && (
            <>
              <div className="text-5xl mb-4">✅</div>
              <p className="text-[#58A700] font-bold text-lg">تم! حصلت على تخطي إضافي</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
