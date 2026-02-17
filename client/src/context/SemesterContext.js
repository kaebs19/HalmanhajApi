import { createContext, useContext, useState, useEffect } from 'react';
import { API_BASE } from '../lib/api';

const SemesterContext = createContext();

export function SemesterProvider({ children }) {
  const [semesters, setSemesters] = useState([]);
  const [selectedSemester, setSelectedSemester] = useState(() => {
    // أولاً: اختيار المستخدم المحفوظ محلياً
    return localStorage.getItem('selectedSemester') || null;
  });
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${API_BASE}/public/navigation`);
        const data = await res.json();
        if (data.semesters) setSemesters(data.semesters);

        // إذا لم يكن هناك اختيار محفوظ، نقرأ القيمة الافتراضية من الإعدادات
        if (!localStorage.getItem('selectedSemester')) {
          try {
            const settingsRes = await fetch(`${API_BASE}/settings`);
            const settingsData = await settingsRes.json();
            const defaultSemester = settingsData?.default_semester || '0';
            setSelectedSemester(defaultSemester);
          } catch {
            setSelectedSemester('0');
          }
        }
      } catch {
        if (!selectedSemester) setSelectedSemester('0');
      } finally {
        setInitialized(true);
      }
    };
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedSemester !== null) {
      localStorage.setItem('selectedSemester', selectedSemester);
    }
  }, [selectedSemester]);

  return (
    <SemesterContext.Provider value={{ semesters, selectedSemester: selectedSemester || '0', setSelectedSemester, initialized }}>
      {children}
    </SemesterContext.Provider>
  );
}

export function useSemester() {
  const context = useContext(SemesterContext);
  if (!context) throw new Error('useSemester must be used within SemesterProvider');
  return context;
}
