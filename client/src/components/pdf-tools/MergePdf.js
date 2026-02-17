import { useState } from 'react';
import api, { SERVER_URL } from '../../lib/api';
import FileUploadProgress from '../FileUploadProgress';
import { Button, Alert, Card } from '../ui';

export default function MergePdf() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const moveFile = (fromIndex, toIndex) => {
    const updated = [...files];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    setFiles(updated);
  };

  const handleMerge = async () => {
    if (files.length < 2) return setError('يجب رفع ملفين على الأقل');
    setError('');
    setLoading(true);
    setProgress(0);

    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    formData.append('order', JSON.stringify(files.map((_, i) => i)));

    try {
      const res = await api.post('/pdf-tools/merge', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
        },
      });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'حدث خطأ أثناء الدمج');
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
            multiple={true}
            maxFiles={20}
            uploadProgress={progress}
            isUploading={loading}
          />

          {files.length >= 2 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-700 text-sm font-medium mb-3">ترتيب الدمج (اسحب لتغيير الترتيب):</p>
              <div className="space-y-2">
                {files.map((file, i) => (
                  <div key={i} className="flex items-center gap-2 bg-white rounded-lg p-2 border">
                    <span className="text-gray-400 font-bold w-6 text-center">{i + 1}</span>
                    <span className="text-sm text-gray-700 flex-1 truncate">📄 {file.name}</span>
                    <div className="flex gap-1">
                      {i > 0 && (
                        <button
                          onClick={() => moveFile(i, i - 1)}
                          className="text-gray-400 hover:text-blue-600 px-1"
                          title="نقل لأعلى"
                        >
                          ▲
                        </button>
                      )}
                      {i < files.length - 1 && (
                        <button
                          onClick={() => moveFile(i, i + 1)}
                          className="text-gray-400 hover:text-blue-600 px-1"
                          title="نقل لأسفل"
                        >
                          ▼
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button onClick={handleMerge} disabled={loading || files.length < 2}>
            {loading ? 'جاري الدمج...' : `🔗 دمج ${files.length} ملفات`}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
            <p className="text-emerald-700 font-bold text-lg mb-2">تم الدمج بنجاح!</p>
            <p className="text-gray-600 text-sm">
              تم دمج {result.fileCount} ملفات • {result.totalPages} صفحة إجمالية
            </p>
          </div>
          <div className="flex gap-3">
            <a
              href={`${SERVER_URL}${result.downloadUrl}`}
              download
              className="flex-1 bg-blue-600 text-white text-center py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              تحميل الملف المدمج
            </a>
            <Button variant="secondary" onClick={reset}>ملفات جديدة</Button>
          </div>
        </div>
      )}
    </Card>
  );
}
