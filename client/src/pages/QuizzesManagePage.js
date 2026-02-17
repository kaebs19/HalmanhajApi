import { useState, useEffect } from 'react';
import api from '../lib/api';
import DashboardLayout from './DashboardLayout';
import { Alert, Button, Input, Select, FormField, Textarea } from '../components/ui';

export default function QuizzesManagePage() {
  const [quizzes, setQuizzes] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // حقول النموذج
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [semester, setSemester] = useState(0);
  const [duration, setDuration] = useState(30);
  const [isPublished, setIsPublished] = useState(true);
  const [questions, setQuestions] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [quizzesRes, subjectsRes, gradesRes] = await Promise.all([
        api.get('/quizzes'),
        api.get('/subjects'),
        api.get('/grades')
      ]);
      setQuizzes(quizzesRes.data);
      setSubjects(subjectsRes.data);
      setGrades(gradesRes.data);
    } catch {
      setError('خطأ في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setSubjectId('');
    setGradeId('');
    setSemester(0);
    setDuration(30);
    setIsPublished(true);
    setQuestions([]);
    setEditing(null);
    setError('');
    setSuccess('');
  };

  const openEdit = (quiz) => {
    setTitle(quiz.title);
    setDescription(quiz.description || '');
    setSubjectId(quiz.subject_id || '');
    setGradeId(quiz.grade_id || '');
    setSemester(quiz.semester);
    setDuration(quiz.duration_minutes);
    setIsPublished(quiz.is_published);
    setQuestions(quiz.questions || []);
    setEditing(quiz);
    setShowForm(true);
  };

  const addQuestion = () => {
    setQuestions([...questions, { text: '', options: ['', '', '', ''], correctIndex: 0 }]);
  };

  const updateQuestion = (index, field, value) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    setQuestions(updated);
  };

  const updateOption = (qIndex, oIndex, value) => {
    const updated = [...questions];
    updated[qIndex].options[oIndex] = value;
    setQuestions(updated);
  };

  const removeQuestion = (index) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!title.trim()) {
      setError('عنوان الاختبار مطلوب');
      return;
    }

    const data = {
      title, description, subject_id: subjectId || null, grade_id: gradeId || null,
      semester, duration_minutes: duration, is_published: isPublished, questions
    };

    try {
      if (editing) {
        await api.put(`/quizzes/${editing.id}`, data);
        setSuccess('تم تحديث الاختبار');
      } else {
        await api.post('/quizzes', data);
        setSuccess('تم إنشاء الاختبار');
      }
      fetchData();
      setTimeout(() => { setShowForm(false); resetForm(); }, 800);
    } catch (err) {
      setError(err.response?.data?.message || 'خطأ في الحفظ');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل تريد حذف هذا الاختبار؟')) return;
    try {
      await api.delete(`/quizzes/${id}`);
      setQuizzes(quizzes.filter(q => q.id !== id));
    } catch {
      setError('خطأ في الحذف');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">إدارة الاختبارات</h1>
            <p className="text-sm text-gray-500 mt-0.5">{quizzes.length} اختبار</p>
          </div>
          <Button onClick={() => { resetForm(); setShowForm(!showForm); }}>
            {showForm ? 'إلغاء' : '+ إضافة اختبار'}
          </Button>
        </div>

        {error && <Alert>{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        {/* النموذج */}
        {showForm && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-800">{editing ? 'تعديل الاختبار' : 'اختبار جديد'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="عنوان الاختبار *">
                  <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="عنوان الاختبار" required />
                </FormField>
                <FormField label="المدة (دقيقة)">
                  <Input type="number" value={duration} onChange={e => setDuration(parseInt(e.target.value))} min={5} />
                </FormField>
              </div>

              <FormField label="الوصف">
                <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="وصف الاختبار..." />
              </FormField>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField label="المادة">
                  <Select value={subjectId} onChange={e => setSubjectId(e.target.value)}>
                    <option value="">كل المواد</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </Select>
                </FormField>
                <FormField label="الصف">
                  <Select value={gradeId} onChange={e => setGradeId(e.target.value)}>
                    <option value="">كل الصفوف</option>
                    {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </Select>
                </FormField>
                <FormField label="الفصل">
                  <Select value={semester} onChange={e => setSemester(parseInt(e.target.value))}>
                    <option value={0}>مشترك</option>
                    <option value={1}>الأول</option>
                    <option value={2}>الثاني</option>
                  </Select>
                </FormField>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isPublished} onChange={e => setIsPublished(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
                <span className="text-sm text-gray-700">منشور</span>
              </label>

              {/* الأسئلة */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-700">الأسئلة ({questions.length})</h3>
                  <button type="button" onClick={addQuestion} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                    + إضافة سؤال
                  </button>
                </div>

                {questions.map((q, qi) => (
                  <div key={qi} className="bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-100">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-500">سؤال {qi + 1}</span>
                      <button type="button" onClick={() => removeQuestion(qi)} className="text-xs text-red-500 hover:text-red-700">حذف</button>
                    </div>
                    <Input
                      value={q.text}
                      onChange={e => updateQuestion(qi, 'text', e.target.value)}
                      placeholder="نص السؤال"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      {q.options.map((opt, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`correct-${qi}`}
                            checked={q.correctIndex === oi}
                            onChange={() => updateQuestion(qi, 'correctIndex', oi)}
                            className="w-4 h-4 text-green-600"
                          />
                          <Input
                            value={opt}
                            onChange={e => updateOption(qi, oi, e.target.value)}
                            placeholder={`الخيار ${oi + 1}`}
                            className="flex-1"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-3 border-t">
                <Button type="submit">{editing ? 'حفظ التعديلات' : 'إنشاء الاختبار'}</Button>
                <Button variant="secondary" onClick={() => { setShowForm(false); resetForm(); }}>إلغاء</Button>
              </div>
            </form>
          </div>
        )}

        {/* قائمة الاختبارات */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        ) : quizzes.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-sm">لا توجد اختبارات بعد</p>
          </div>
        ) : (
          <div className="space-y-3">
            {quizzes.map(quiz => (
              <div key={quiz.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-bold text-gray-800 truncate">{quiz.title}</h3>
                    {!quiz.is_published && (
                      <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">مسودة</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>{quiz.questions_count} سؤال</span>
                    <span>{quiz.duration_minutes} دقيقة</span>
                    {quiz.subject_name && <span>{quiz.subject_name}</span>}
                    {quiz.grade_name && <span>{quiz.grade_name}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 mr-4">
                  <button onClick={() => openEdit(quiz)} className="p-2 text-gray-400 hover:text-blue-600 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button onClick={() => handleDelete(quiz.id)} className="p-2 text-gray-400 hover:text-red-600 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
