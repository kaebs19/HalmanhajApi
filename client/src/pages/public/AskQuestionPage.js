import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { API_BASE } from '../../lib/api';
import { useUserAuth } from '../../context/UserAuthContext';
import SEO from '../../components/public/SEO';

export default function AskQuestionPage() {
  const { user, token } = useUserAuth();
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [stageId, setStageId] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [semester, setSemester] = useState(0);
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  const [stages, setStages] = useState([]);
  const [grades, setGrades] = useState([]);
  const [subjects, setSubjects] = useState([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/public/navigation`)
      .then(res => res.json())
      .then(data => setStages(data.stages || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (stageId) {
      const stage = stages.find(s => s.id === stageId);
      setGrades(stage?.grades || []);
    } else {
      setGrades([]);
    }
    setGradeId('');
    setSubjectId('');
    setSubjects([]);
  }, [stageId, stages]);

  useEffect(() => {
    if (gradeId) {
      fetch(`${API_BASE}/public/grades/${gradeId}`)
        .then(res => res.json())
        .then(data => setSubjects(data.subjects || []))
        .catch(() => setSubjects([]));
    } else {
      setSubjects([]);
      setSubjectId('');
    }
  }, [gradeId]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('حجم الصورة يجب أن لا يتجاوز 10 ميجا');
        return;
      }
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setImage(null);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!title.trim()) { setError('عنوان السؤال مطلوب'); return; }
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      if (body.trim()) formData.append('body', body.trim());
      if (stageId) formData.append('stage_id', stageId);
      if (gradeId) formData.append('grade_id', gradeId);
      if (subjectId) formData.append('subject_id', subjectId);
      formData.append('semester', semester);
      if (image) formData.append('image', image);

      const res = await fetch(`${API_BASE}/community/questions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (!res.ok) { const data = await res.json(); throw new Error(data.message); }
      const newQuestion = await res.json();
      navigate(`/faq/question/${newQuestion.id}`);
    } catch (err) {
      setError(err.message || 'خطأ في إرسال السؤال');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <SEO title="اطرح سؤالاً" />
        <svg className="w-16 h-16 mx-auto mb-4 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
        <p className="text-gray-500 mb-4">يجب تسجيل الدخول لطرح سؤال</p>
        <Link to="/auth/login" className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">تسجيل الدخول</Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <SEO title="اطرح سؤالاً" />
      <Link to="/faq" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 mb-6 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        العودة لسؤال وجواب
      </Link>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <h1 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          اطرح سؤالاً جديداً
        </h1>

        {error && <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">تصنيف السؤال (اختياري)</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">المرحلة</label>
                <select value={stageId} onChange={e => setStageId(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                  <option value="">اختر المرحلة</option>
                  {stages.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">الصف</label>
                <select value={gradeId} onChange={e => setGradeId(e.target.value)} disabled={!stageId} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50">
                  <option value="">اختر الصف</option>
                  {grades.map(g => (<option key={g.id} value={g.id}>{g.name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">المادة</label>
                <select value={subjectId} onChange={e => setSubjectId(e.target.value)} disabled={!gradeId} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50">
                  <option value="">اختر المادة</option>
                  {subjects.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">الفصل الدراسي</label>
              <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200 p-0.5 w-fit">
                {[{ value: 0, label: 'مشترك' }, { value: 1, label: 'الفصل الأول' }, { value: 2, label: 'الفصل الثاني' }].map(opt => (
                  <button key={opt.value} type="button" onClick={() => setSemester(opt.value)} className={`text-xs px-3 py-1.5 rounded-md transition-all ${semester === opt.value ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}>{opt.label}</button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">عنوان السؤال <span className="text-red-500">*</span></label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="اكتب سؤالك بوضوح..." className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400" required />
            <p className="text-xs text-gray-400 mt-1">اكتب عنواناً واضحاً ومحدداً لسؤالك</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">تفاصيل إضافية</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="أضف تفاصيل أكثر عن سؤالك (اختياري)..." rows={5} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-none" />
          </div>

          {/* رفع صورة */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">إرفاق صورة (اختياري)</label>
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center hover:border-blue-400 transition-colors">
              {imagePreview ? (
                <div className="relative inline-block">
                  <img src={imagePreview} alt="معاينة" className="max-h-48 rounded-lg mx-auto" />
                  <button type="button" onClick={removeImage} className="absolute -top-2 -left-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 shadow-lg">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer block">
                  <svg className="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <p className="text-sm text-gray-500 mb-1">اضغط لاختيار صورة</p>
                  <p className="text-xs text-gray-400">JPG, PNG, WebP - سيتم ضغطها تلقائياً إلى 1 ميجا</p>
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} className="hidden" />
                </label>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <Link to="/faq" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">إلغاء</Link>
            <button type="submit" disabled={submitting || !title.trim()} className="bg-blue-600 text-white px-8 py-3 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm">
              {submitting ? (<div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
              )}
              نشر السؤال
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
