import { useState } from 'react';
import api, { SERVER_URL } from '../../lib/api';
import FileUploadProgress from '../FileUploadProgress';
import { Button, Alert, Card, Input, FormField } from '../ui';

export default function SplitPdf() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pdfInfo, setPdfInfo] = useState(null);
  const [splitPage, setSplitPage] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const loadPdfInfo = async (newFiles) => {
    setFiles(newFiles);
    setResult(null);
    setPdfInfo(null);
    setError('');
    if (!newFiles.length) return;

    const formData = new FormData();
    formData.append('file', newFiles[0]);
    try {
      const res = await api.post('/pdf-tools/info', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPdfInfo(res.data);
      setSplitPage(Math.ceil(res.data.pageCount / 2).toString());
    } catch (err) {
      setError(err.response?.data?.message || 'خطأ في قراءة الملف');
    }
  };

  const handleSplit = async () => {
    if (!files.length) return setError('اختر ملف PDF أولاً');
    if (!splitPage || parseInt(splitPage) < 1) return setError('أدخل رقم صفحة صالح');
    setError('');
    setLoading(true);
    setProgress(0);

    const formData = new FormData();
    formData.append('file', files[0]);
    formData.append('splitAfterPage', splitPage);

    try {
      const res = await api.post('/pdf-tools/split', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
        },
      });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'حدث خطأ أثناء التقسيم');
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  const reset = () => {
    setFiles([]);
    setResult(null);
    setPdfInfo(null);
    setError('');
    setSplitPage('');
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
                الملف يحتوي على <strong>{pdfInfo.pageCount}</strong> صفحة
              </p>
              <FormField label="التقسيم بعد الصفحة رقم:">
                <Input
                  type="number"
                  min="1"
                  max={pdfInfo.pageCount - 1}
                  value={splitPage}
                  onChange={(e) => setSplitPage(e.target.value)}
                  placeholder={`1 إلى ${pdfInfo.pageCount - 1}`}
                />
              </FormField>
              {splitPage && parseInt(splitPage) >= 1 && parseInt(splitPage) < pdfInfo.pageCount && (
                <p className="text-gray-500 text-xs mt-2">
                  الجزء 1: صفحة 1 إلى {splitPage} • الجزء 2: صفحة {parseInt(splitPage) + 1} إلى {pdfInfo.pageCount}
                </p>
              )}
            </div>
          )}

          <Button onClick={handleSplit} disabled={loading || !files.length || !pdfInfo}>
            {loading ? 'جاري التقسيم...' : '✂️ تقسيم الملف'}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
            <p className="text-emerald-700 font-bold text-lg mb-3">تم التقسيم بنجاح!</p>
            <div className="space-y-3">
              {result.parts.map((part, i) => (
                <div key={i} className="flex items-center justify-between bg-white rounded-lg p-3 border">
                  <div>
                    <p className="font-medium text-gray-800">{part.label}</p>
                    <p className="text-gray-500 text-sm">{part.pages} صفحة</p>
                  </div>
                  <a
                    href={`${SERVER_URL}${part.downloadUrl}`}
                    download
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    تحميل
                  </a>
                </div>
              ))}
            </div>
          </div>
          <Button variant="secondary" onClick={reset}>ملف جديد</Button>
        </div>
      )}
    </Card>
  );
}
