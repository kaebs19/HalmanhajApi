import { useState, useRef, useEffect } from 'react';

const formatSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
};

const formatTime = (seconds) => {
  if (!seconds || seconds === Infinity || seconds < 0) return '';
  if (seconds < 60) return `${Math.ceil(seconds)} ثانية`;
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.ceil(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')} دقيقة`;
  }
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.ceil((seconds % 3600) / 60);
  return `${hrs}:${mins.toString().padStart(2, '0')} ساعة`;
};

const formatSpeed = (bytesPerSecond) => {
  if (!bytesPerSecond || bytesPerSecond <= 0) return '';
  if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`;
  if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
};

export default function FileUploadProgress({
  files,
  onFilesChange,
  accept = '.pdf,image/*,video/*,.doc,.docx,.ppt,.pptx',
  multiple = true,
  maxFiles = 10,
  maxFileSize = 200 * 1024 * 1024, // 200MB
  uploadProgress = 0,
  isUploading = false,
  uploadedBytes = 0,
  totalBytes = 0,
  uploadSpeed = 0,
  uploadEta = 0,
  uploadError = null,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [sizeError, setSizeError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (sizeError) {
      const timer = setTimeout(() => setSizeError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [sizeError]);

  const validateFiles = (newFiles) => {
    const oversized = newFiles.filter(f => f.size > maxFileSize);
    if (oversized.length > 0) {
      setSizeError(`${oversized.map(f => f.name).join('، ')} — الحد الأقصى ${formatSize(maxFileSize)}`);
      return newFiles.filter(f => f.size <= maxFileSize);
    }
    return newFiles;
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = validateFiles(Array.from(e.dataTransfer.files));
    if (!multiple) {
      onFilesChange(dropped.slice(0, 1));
    } else {
      const combined = [...(files || []), ...dropped].slice(0, maxFiles);
      onFilesChange(combined);
    }
  };

  const handleFileSelect = (e) => {
    const selected = validateFiles(Array.from(e.target.files));
    if (!multiple) {
      onFilesChange(selected.slice(0, 1));
    } else {
      const combined = [...(files || []), ...selected].slice(0, maxFiles);
      onFilesChange(combined);
    }
    e.target.value = '';
  };

  const removeFile = (index) => {
    const updated = files.filter((_, i) => i !== index);
    onFilesChange(updated);
  };

  const getFileIcon = (file) => {
    if (file.type === 'application/pdf') return '📄';
    if (file.type.startsWith('image/')) return '🖼️';
    if (file.type.startsWith('video/')) return '🎬';
    if (file.name.endsWith('.doc') || file.name.endsWith('.docx')) return '📝';
    if (file.name.endsWith('.ppt') || file.name.endsWith('.pptx')) return '📊';
    return '📎';
  };

  const totalSize = files?.reduce((acc, f) => acc + f.size, 0) || 0;

  return (
    <div className="space-y-3">
      {/* خطأ الحجم */}
      {sizeError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700 flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {sizeError}
        </div>
      )}

      {/* منطقة السحب والإسقاط */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
          isDragging
            ? 'border-blue-500 bg-blue-50 scale-[1.01]'
            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
        } ${isUploading ? 'pointer-events-none opacity-60' : 'cursor-pointer'}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileSelect}
          className="hidden"
        />
        <div className="text-4xl mb-2">{isDragging ? '📥' : '📁'}</div>
        <p className="text-gray-600 font-medium">
          {isDragging ? 'أفلت الملفات هنا' : 'اسحب الملفات هنا أو اضغط للاختيار'}
        </p>
        <p className="text-gray-400 text-sm mt-1">
          {multiple ? `حتى ${maxFiles} ملفات • ` : ''}الحد الأقصى {formatSize(maxFileSize)} للملف
        </p>
      </div>

      {/* قائمة الملفات المختارة */}
      {files && files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, i) => (
            <div
              key={i}
              className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2 border"
            >
              <span className="text-xl">{getFileIcon(file)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 truncate">{file.name}</p>
                <p className="text-xs text-gray-400">{formatSize(file.size)}</p>
              </div>
              {!isUploading && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                  className="text-red-400 hover:text-red-600 text-lg"
                >
                  ✕
                </button>
              )}
            </div>
          ))}

          {/* إجمالي حجم الملفات */}
          {files.length > 1 && (
            <div className="text-xs text-gray-400 text-left px-1">
              إجمالي: {formatSize(totalSize)} ({files.length} ملفات)
            </div>
          )}
        </div>
      )}

      {/* شريط التقدم المحسّن */}
      {isUploading && (
        <div className="bg-blue-50/50 rounded-xl border border-blue-100 p-4 space-y-3">
          {/* النسبة والحالة */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm font-medium text-gray-700">
                {uploadProgress < 100 ? 'جاري الرفع...' : 'جاري المعالجة...'}
              </span>
            </div>
            <span className="text-lg font-bold text-blue-600">{uploadProgress}%</span>
          </div>

          {/* شريط التقدم */}
          <div className="relative w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-l from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${uploadProgress}%` }}
            />
            {/* تأثير متحرك */}
            {uploadProgress < 100 && (
              <div className="absolute inset-0 overflow-hidden rounded-full">
                <div className="h-full w-full bg-gradient-to-l from-transparent via-white/20 to-transparent animate-pulse" />
              </div>
            )}
          </div>

          {/* تفاصيل الرفع */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-3">
              {/* الحجم المرفوع / الإجمالي */}
              {totalBytes > 0 && (
                <span>{formatSize(uploadedBytes)} / {formatSize(totalBytes)}</span>
              )}
              {/* السرعة */}
              {uploadSpeed > 0 && uploadProgress < 100 && (
                <span className="text-blue-500 font-medium">
                  {formatSpeed(uploadSpeed)}
                </span>
              )}
            </div>
            {/* الوقت المتبقي */}
            {uploadEta > 0 && uploadProgress < 100 && (
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                متبقي {formatTime(uploadEta)}
              </span>
            )}
          </div>

          {/* خطأ الرفع */}
          {uploadError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700 flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{uploadError}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
