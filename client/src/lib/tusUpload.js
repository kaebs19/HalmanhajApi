import * as tus from 'tus-js-client';

const TUS_ENDPOINT = '/api/tus';
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
const PARALLEL_UPLOADS = 3;
const RETRY_DELAYS = [0, 1000, 3000, 5000, 10000];

/**
 * Upload a single file via tus protocol with auto-resume.
 * Returns { upload, abort } handle.
 */
export function createTusUpload(file, token, callbacks = {}) {
  const { onProgress, onSuccess, onError } = callbacks;

  const upload = new tus.Upload(file, {
    endpoint: TUS_ENDPOINT,
    chunkSize: CHUNK_SIZE,
    retryDelays: RETRY_DELAYS,
    parallelUploads: PARALLEL_UPLOADS,
    storeFingerprintForResuming: true,
    removeFingerprintOnSuccess: true,
    metadata: {
      filename: file.name,
      filetype: file.type,
      filesize: String(file.size),
    },
    headers: {
      Authorization: `Bearer ${token}`,
    },
    onProgress(bytesUploaded, bytesTotal) {
      onProgress?.(bytesUploaded, bytesTotal);
    },
    onSuccess() {
      const url = upload.url;
      const fileName = url.split('/').pop();
      onSuccess?.({
        file_name: fileName,
        original_name: file.name,
        mime_type: file.type,
        file_size: file.size,
      });
    },
    onError(error) {
      onError?.(error);
    },
    onShouldRetry(err) {
      const status = err.originalResponse?.getStatus();
      if (status === 401 || status === 403 || status === 400) return false;
      return true;
    },
  });

  // Try to resume previous upload, then start
  upload.findPreviousUploads().then(previousUploads => {
    if (previousUploads.length > 0) {
      upload.resumeFromPreviousUpload(previousUploads[0]);
    }
    upload.start();
  });

  return {
    upload,
    abort: () => upload.abort(),
  };
}

/**
 * Upload multiple files via tus with aggregate progress tracking.
 * Returns { abort } handle.
 *
 * callbacks:
 *   onTotalProgress(totalUploaded, totalSize, percent, speed, eta)
 *   onFileSuccess(fileIndex, fileInfo)
 *   onFileError(fileIndex, error)
 *   onAllComplete(results)
 */
export function createMultiTusUpload(files, token, callbacks = {}) {
  const { onTotalProgress, onFileSuccess, onFileError, onAllComplete } = callbacks;

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const fileProgress = new Array(files.length).fill(0);
  const results = new Array(files.length).fill(null);
  const uploads = [];
  let completedCount = 0;

  // Speed calculation
  let lastTime = 0;
  let lastTotal = 0;
  const speedSamples = [];

  function calcAggregateProgress() {
    const totalUploaded = fileProgress.reduce((sum, b) => sum + b, 0);
    const percent = totalSize > 0 ? Math.round((totalUploaded / totalSize) * 100) : 0;

    const now = Date.now();
    let speed = 0;
    let eta = 0;

    if (lastTime > 0 && (now - lastTime) > 200) {
      const timeDiff = (now - lastTime) / 1000;
      const bytesDiff = totalUploaded - lastTotal;
      if (timeDiff > 0) {
        const instantSpeed = bytesDiff / timeDiff;
        speedSamples.push(instantSpeed);
        if (speedSamples.length > 5) speedSamples.shift();

        speed = speedSamples.reduce((a, b) => a + b, 0) / speedSamples.length;

        const remaining = totalSize - totalUploaded;
        if (speed > 0) {
          eta = remaining / speed;
        }
      }
      lastTotal = totalUploaded;
      lastTime = now;
    } else if (lastTime === 0) {
      lastTime = now;
      lastTotal = totalUploaded;
    }

    onTotalProgress?.(totalUploaded, totalSize, percent, speed, eta);
  }

  function checkAllDone() {
    completedCount++;
    if (completedCount === files.length) {
      onAllComplete?.(results);
    }
  }

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const handle = createTusUpload(file, token, {
      onProgress(bytesUploaded) {
        fileProgress[i] = bytesUploaded;
        calcAggregateProgress();
      },
      onSuccess(fileInfo) {
        fileProgress[i] = file.size;
        results[i] = { success: true, fileInfo };
        onFileSuccess?.(i, fileInfo);
        calcAggregateProgress();
        checkAllDone();
      },
      onError(error) {
        results[i] = { success: false, error };
        onFileError?.(i, error);
        checkAllDone();
      },
    });
    uploads.push(handle);
  }

  return {
    abort() {
      uploads.forEach(u => u.abort());
    }
  };
}
