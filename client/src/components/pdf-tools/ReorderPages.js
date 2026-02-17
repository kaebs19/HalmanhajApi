import { useState } from 'react';
import api, { SERVER_URL } from '../../lib/api';
import FileUploadProgress from '../FileUploadProgress';
import { Button, Alert, Card } from '../ui';

export default function ReorderPages() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pdfInfo, setPdfInfo] = useState(null);
  const [pageOrder, setPageOrder] = useState([]);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const loadPdfInfo = async (newFiles) => {
    setFiles(newFiles);
    setResult(null);
    setPdfInfo(null);
    setPageOrder([]);
    setError('');
    if (!newFiles.length) return;

    const formData = new FormData();
    formData.append('file', newFiles[0]);
    try {
      const res = await api.post('/pdf-tools/info', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPdfInfo(res.data);
      setPageOrder(Array.from({ length: res.data.pageCount }, (_, i) => i + 1));
    } catch (err) {
      setError(err.response?.data?.message || 'خطأ في قراءة الملف');
    }
  };

  const movePage = (fromIndex, toIndex) => {
    const updated = [...pageOrder];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    setPageOrder(updated);
  };

  const handleDragStart = (index) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    movePage(draggedIndex, index);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const isChanged = () => {
    return pageOrder.some((p, i) => p !== i + 1);
  };

  const handleReorder = async () => {
    if (!files.length) return setError('اختر ملف PDF أولاً');
    if (!isChanged()) return setError('لم يتم تغيير ترتيب الصفحات');
    setError('');
    setLoading(true);
    setProgress(0);

    const formData = new FormData();
    formData.append('file', files[0]);
    formData.append('order', JSON.stringify(pageOrder));

    try {
      const res = await api.post('/pdf-tools/reorder-pages', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
        },
      });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'حدث خطأ أثناء الترتيب');
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  const resetOrder = () => {
    if (pdfInfo) {
      setPageOrder(Array.from({ length: pdfInfo.pageCount }, (_, i) => i + 1));
    }
  };

  const reset = () => {
    setFiles([]);
    setResult(null);
    setPdfInfo(null);
    setPageOrder([]);
    setError('');
  };

  return (
    <Card className="p-6">
      {error && <Alert className="mb-4">{error}</Alert>}

      {!result ? (
        <div className="space-y-4">
          <FileUploadProgress
            files={files}
            onFilesChange={loadPdfInfo}
            accept=".pdf"
            multiple={false}
            uploadProgress={progress}
            isUploading={loading}
          />

          {pdfInfo && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-blue-700 text-sm">
                  اسحب الصفحات لإعادة الترتيب ({pdfInfo.pageCount} صفحة):
                </p>
                {isChanged() && (
                  <button onClick={resetOrder} className="text-xs text-gray-500 hover:text-blue-600">
                    إعادة تعيين
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {pageOrder.map((pageNum, index) => (
                  <div
                    key={pageNum}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`w-14 h-14 rounded-lg text-sm font-medium flex flex-col items-center justify-center cursor-grab active:cursor-grabbing transition-all select-none ${
                      draggedIndex === index
                        ? 'bg-blue-500 text-white shadow-lg scale-105'
                        : pageNum !== index + 1
                        ? 'bg-amber-100 text-amber-700 border-2 border-amber-300'
                        : 'bg-white text-gray-600 border border-gray-300 hover:border-blue-300'
                    }`}
                  >
                    <span className="text-base font-bold">{pageNum}</span>
                    {pageNum !== index + 1 && (
                      <span className="text-[10px] opacity-70">← {index + 1}</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-1 mt-3">
                {pageOrder.length > 1 && (
                  <>
                    <button
                      onClick={() => movePage(0, pageOrder.length - 1)}
                      className="text-xs bg-white border rounded px-2 py-1 text-gray-500 hover:text-blue-600"
                    >
                      نقل الأولى للآخر ↓
                    </button>
                    <button
                      onClick={() => movePage(pageOrder.length - 1, 0)}
                      className="text-xs bg-white border rounded px-2 py-1 text-gray-500 hover:text-blue-600"
                    >
                      نقل الأخيرة للأول ↑
                    </button>
                    <button
                      onClick={() => setPageOrder([...pageOrder].reverse())}
                      className="text-xs bg-white border rounded px-2 py-1 text-gray-500 hover:text-blue-600"
                    >
                      عكس الترتيب ⟲
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          <Button onClick={handleReorder} disabled={loading || !files.length || !isChanged()}>
            {loading ? 'جاري الترتيب...' : '🔄 حفظ الترتيب الجديد'}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
            <p className="text-emerald-700 font-bold text-lg mb-2">تم إعادة الترتيب بنجاح!</p>
            <p className="text-gray-600 text-sm">{result.totalPages} صفحة بالترتيب الجديد</p>
          </div>
          <div className="flex gap-3">
            <a
              href={`${SERVER_URL}${result.downloadUrl}`}
              download
              className="flex-1 bg-blue-600 text-white text-center py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              تحميل الملف
            </a>
            <Button variant="secondary" onClick={reset}>ملف جديد</Button>
          </div>
        </div>
      )}
    </Card>
  );
}
