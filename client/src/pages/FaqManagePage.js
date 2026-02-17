import { useState, useEffect } from 'react';
import api from '../lib/api';
import DashboardLayout from './DashboardLayout';
import { Alert, Button, Input, FormField, Textarea } from '../components/ui';

const SEMESTER_OPTIONS = [
  { value: 0, label: 'مشترك' },
  { value: 1, label: 'الفصل الأول' },
  { value: 2, label: 'الفصل الثاني' },
];

export default function FaqManagePage() {
  const [faqs, setFaqs] = useState([]);
  const [grades, setGrades] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // حقول النموذج
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [semester, setSemester] = useState(0);
  const [isPublished, setIsPublished] = useState(true);

  // فلتر العرض
  const [filterGrade, setFilterGrade] = useState('');
  const [filterSubject, setFilterSubject] = useState('');

  useEffect(() => {
    fetchFaqs();
    fetchGrades();
    fetchSubjects();
  }, []);

  const fetchFaqs = async () => {
    try {
      const res = await api.get('/faqs');
      setFaqs(res.data);
    } catch {
      setError('خطأ في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const fetchGrades = async () => {
    try {
      const res = await api.get('/grades');
      setGrades(res.data);
    } catch {}
  };

  const fetchSubjects = async () => {
    try {
      const res = await api.get('/subjects');
      setSubjects(res.data);
    } catch {}
  };

  // فلترة المواد حسب الصف المحدد في النموذج
  const filteredSubjectsForForm = gradeId
    ? subjects.filter(s => {
        // إذا المادة مرتبطة بالصف عبر subject_grades
        if (s.grades && Array.isArray(s.grades)) {
          return s.grades.some(g => g.id === gradeId);
        }
        // أو إذا grade_id مباشر
        return s.grade_id === gradeId;
      })
    : subjects;

  const resetForm = () => {
    setQuestion('');
    setAnswer('');
    setGradeId('');
    setSubjectId('');
    setSemester(0);
    setIsPublished(true);
    setEditing(null);
    setError('');
    setSuccess('');
  };

  const openEdit = (faq) => {
    setQuestion(faq.question);
    setAnswer(faq.answer);
    setGradeId(faq.grade_id || '');
    setSubjectId(faq.subject_id || '');
    setSemester(faq.semester || 0);
    setIsPublished(faq.is_published);
    setEditing(faq);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!question.trim() || !answer.trim()) {
      setError('السؤال والإجابة مطلوبان');
      return;
    }

    const data = {
      question,
      answer,
      grade_id: gradeId || null,
      subject_id: subjectId || null,
      semester: parseInt(semester),
      is_published: isPublished,
    };

    try {
      if (editing) {
        await api.put(`/faqs/${editing.id}`, data);
        setSuccess('تم تحديث السؤال');
      } else {
        await api.post('/faqs', data);
        setSuccess('تم إضافة السؤال');
      }
      fetchFaqs();
      setTimeout(() => { setShowForm(false); resetForm(); }, 800);
    } catch (err) {
      setError(err.response?.data?.message || 'خطأ في الحفظ');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل تريد حذف هذا السؤال؟')) return;
    try {
      await api.delete(`/faqs/${id}`);
      setFaqs(faqs.filter(f => f.id !== id));
    } catch {
      setError('خطأ في الحذف');
    }
  };

  // فلترة الأسئلة في العرض
  const filteredFaqs = faqs.filter(faq => {
    if (filterGrade && faq.grade_id !== filterGrade) return false;
    if (filterSubject && faq.subject_id !== filterSubject) return false;
    return true;
  });

  const getSemesterLabel = (val) => {
    const opt = SEMESTER_OPTIONS.find(o => o.value === val);
    return opt ? opt.label : 'مشترك';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">سؤال وجواب</h1>
            <p className="text-sm text-gray-500 mt-0.5">{filteredFaqs.length} سؤال</p>
          </div>
          <Button onClick={() => { resetForm(); setShowForm(!showForm); }}>
            {showForm ? 'إلغاء' : '+ إضافة سؤال'}
          </Button>
        </div>

        {error && <Alert>{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        {/* فلاتر */}
        {!showForm && faqs.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-gray-200 p-4">
            <span className="text-sm text-gray-500 font-medium">فلترة:</span>
            <select
              value={filterGrade}
              onChange={e => { setFilterGrade(e.target.value); setFilterSubject(''); }}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              <option value="">كل الصفوف</option>
              {grades.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <select
              value={filterSubject}
              onChange={e => setFilterSubject(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              <option value="">كل المواد</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* النموذج */}
        {showForm && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-800">{editing ? 'تعديل السؤال' : 'سؤال جديد'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* الصف والمادة */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField label="الصف الدراسي">
                  <select
                    value={gradeId}
                    onChange={e => { setGradeId(e.target.value); setSubjectId(''); }}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                  >
                    <option value="">عام (بدون صف)</option>
                    {grades.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </FormField>

                <FormField label="المادة الدراسية">
                  <select
                    value={subjectId}
                    onChange={e => setSubjectId(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                  >
                    <option value="">بدون مادة</option>
                    {(filteredSubjectsForForm.length > 0 ? filteredSubjectsForForm : subjects).map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </FormField>

                <FormField label="الفصل الدراسي">
                  <select
                    value={semester}
                    onChange={e => setSemester(parseInt(e.target.value))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                  >
                    {SEMESTER_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </FormField>
              </div>

              <FormField label="السؤال *">
                <Input value={question} onChange={e => setQuestion(e.target.value)} placeholder="اكتب السؤال هنا..." required />
              </FormField>
              <FormField label="الإجابة *">
                <Textarea value={answer} onChange={e => setAnswer(e.target.value)} rows={4} placeholder="اكتب الإجابة هنا..." required />
              </FormField>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isPublished} onChange={e => setIsPublished(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
                <span className="text-sm text-gray-700">منشور</span>
              </label>
              <div className="flex gap-3 pt-3 border-t">
                <Button type="submit">{editing ? 'حفظ التعديلات' : 'إضافة السؤال'}</Button>
                <Button variant="secondary" onClick={() => { setShowForm(false); resetForm(); }}>إلغاء</Button>
              </div>
            </form>
          </div>
        )}

        {/* قائمة الأسئلة */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        ) : filteredFaqs.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-sm">لا توجد أسئلة بعد</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredFaqs.map(faq => (
              <div key={faq.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-sm font-bold text-gray-800">{faq.question}</h3>
                      {!faq.is_published && (
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">مسودة</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2 mb-2">{faq.answer}</p>

                    {/* معلومات الربط */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {faq.grade_name && (
                        <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                          {faq.stage_name && `${faq.stage_name} - `}{faq.grade_name}
                        </span>
                      )}
                      {faq.subject_name && (
                        <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-medium">
                          {faq.subject_name}
                        </span>
                      )}
                      <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-medium">
                        {getSemesterLabel(faq.semester)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mr-4 flex-shrink-0">
                    <button onClick={() => openEdit(faq)} className="p-2 text-gray-400 hover:text-blue-600 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button onClick={() => handleDelete(faq.id)} className="p-2 text-gray-400 hover:text-red-600 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
