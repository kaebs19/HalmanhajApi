import { useState } from 'react';
import api, { SERVER_URL } from '../../lib/api';
import FileUploadProgress from '../FileUploadProgress';
import { Button, Alert, Card } from '../ui';

export default function CompressPdf() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleCompress = async () => {
    if (!files.length) return setError('اختر ملف PDF أولاً');
    setError('');
    setLoading(true);
    setProgress(0);
    setResult(null);

    const formData = new FormData();
    formData.append('file', files[0]);

    try {
      const res = await api.post('/pdf-tools/compress', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
        },
      });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'حدث خطأ أثناء الضغط');
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  const reset = () => {
    setFiles([]);
    setResult(null);
    setError('');
  };

  return (
    <Card className="p-6">
      {error && <Alert className="mb-4">{error}</Alert>}

      {!result ? (
        <div className="space-y-4">
          <FileUploadProgress
            files={files}
            onFilesChange={setFiles}
            accept=".pdf"
            multiple={false}
            uploadProgress={progress}
            isUploading={loading}
          />
          <Button onClick={handleCompress} disabled={loading || !files.length}>
            {loading ? 'جاري الضغط...' : '📦 ضغط الملف'}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
            <p className="text-emerald-700 font-bold text-lg mb-3">تم الضغط بنجاح!</p>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-gray-500 text-sm">الحجم الأصلي</p>
                <p className="font-bold text-gray-800">{result.originalSizeFormatted}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">الحجم الجديد</p>
                <p className="font-bold text-emerald-600">{result.compressedSizeFormatted}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">نسبة التوفير</p>
                <p className="font-bold text-blue-600">{result.savedPercent}%</p>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <a
              href={`${SERVER_URL}${result.downloadUrl}`}
              download
              className="flex-1 bg-blue-600 text-white text-center py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              تحميل الملف المضغوط
            </a>
            <Button variant="secondary" onClick={reset}>ملف جديد</Button>
          </div>
        </div>
      )}
    </Card>
  );
}
