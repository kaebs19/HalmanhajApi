import { useState } from 'react';
import api, { SERVER_URL } from '../../lib/api';
import FileUploadProgress from '../FileUploadProgress';
import { Button, Alert, Card } from '../ui';

export default function RemovePages() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pdfInfo, setPdfInfo] = useState(null);
  const [selectedPages, setSelectedPages] = useState(new Set());
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const loadPdfInfo = async (newFiles) => {
    setFiles(newFiles);
    setResult(null);
    setPdfInfo(null);
    setSelectedPages(new Set());
    setError('');
    if (!newFiles.length) return;

    const formData = new FormData();
    formData.append('file', newFiles[0]);
    try {
      const res = await api.post('/pdf-tools/info', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPdfInfo(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'خطأ في قراءة الملف');
    }
  };

  const togglePage = (pageNum) => {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageNum)) next.delete(pageNum);
      else next.add(pageNum);
      return next;
    });
  };

  const handleRemove = async () => {
    if (!files.length) return setError('اختر ملف PDF أولاً');
    if (selectedPages.size === 0) return setError('اختر صفحات للحذف');
    if (pdfInfo && selectedPages.size >= pdfInfo.pageCount) return setError('لا يمكن حذف جميع الصفحات');
    setError('');
    setLoading(true);
    setProgress(0);

    const formData = new FormData();
    formData.append('file', files[0]);
    formData.append('pages', JSON.stringify(Array.from(selectedPages)));

    try {
      const res = await api.post('/pdf-tools/remove-pages', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
        },
      });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'حدث خطأ أثناء الحذف');
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  const reset = () => {
    setFiles([]);
    setResult(null);
    setPdfInfo(null);
    setSelectedPages(new Set());
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
              <p className="text-blue-700 text-sm mb-3">
                الملف يحتوي على <strong>{pdfInfo.pageCount}</strong> صفحة — اضغط على الصفحات التي تريد حذفها:
              </p>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: pdfInfo.pageCount }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => togglePage(pageNum)}
                    className={`w-10 h-10 rounded-lg text-sm font-medium transition-all ${
                      selectedPages.has(pageNum)
                        ? 'bg-red-500 text-white shadow-sm'
                        : 'bg-white text-gray-600 border border-gray-300 hover:border-red-300 hover:text-red-500'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}
              </div>
              {selectedPages.size > 0 && (
                <p className="text-red-600 text-sm mt-3">
                  سيتم حذف {selectedPages.size} صفحة • يتبقى {pdfInfo.pageCount - selectedPages.size} صفحة
                </p>
              )}
            </div>
          )}

          <Button onClick={handleRemove} disabled={loading || !files.length || selectedPages.size === 0}>
            {loading ? 'جاري الحذف...' : `🗑️ حذف ${selectedPages.size} صفحة`}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
            <p className="text-emerald-700 font-bold text-lg mb-2">تم الحذف بنجاح!</p>
            <p className="text-gray-600 text-sm">
              تم حذف {result.removedPages} صفحة • يتبقى {result.remainingPages} صفحة
            </p>
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
