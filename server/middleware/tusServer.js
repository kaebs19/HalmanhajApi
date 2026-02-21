const { Server } = require('@tus/server');
const { FileStore } = require('@tus/file-store');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');

const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
];

const MAX_SIZE = 200 * 1024 * 1024; // 200MB

const uploadDir = path.join(__dirname, '../uploads/lessons');
const completedDir = path.join(uploadDir, '.tus-completed');

// Ensure directories exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(completedDir)) {
  fs.mkdirSync(completedDir, { recursive: true });
}

const tusServer = new Server({
  path: '/api/tus',
  datastore: new FileStore({ directory: uploadDir }),
  maxSize: MAX_SIZE,
  relativeLocation: true,

  namingFunction(req, metadata) {
    const originalName = metadata?.filename || '';
    const ext = path.extname(originalName) || '';
    return Date.now() + '-' + Math.round(Math.random() * 1E9) + ext;
  },

  async onUploadCreate(req, upload) {
    // Verify JWT
    const header = req.headers?.authorization || req.headers?.get?.('authorization');
    if (!header || !header.startsWith('Bearer ')) {
      throw { status_code: 401, body: 'غير مصرح' };
    }
    try {
      jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    } catch {
      throw { status_code: 401, body: 'رمز غير صالح' };
    }

    // Validate MIME type
    const filetype = upload.metadata?.filetype;
    if (filetype && !ALLOWED_TYPES.includes(filetype)) {
      throw { status_code: 400, body: 'نوع الملف غير مدعوم' };
    }

    // Validate size
    if (upload.size && upload.size > MAX_SIZE) {
      throw { status_code: 400, body: 'حجم الملف يتجاوز الحد المسموح (200MB)' };
    }

    return {};
  },

  async onUploadFinish(req, upload) {
    // Track completed upload for orphan cleanup
    const meta = {
      id: upload.id,
      filename: upload.metadata?.filename || upload.id,
      filetype: upload.metadata?.filetype || 'application/octet-stream',
      size: upload.size || upload.offset,
      completedAt: new Date().toISOString()
    };

    try {
      fs.writeFileSync(
        path.join(completedDir, upload.id + '.json'),
        JSON.stringify(meta)
      );
    } catch {
      // Non-critical — cleanup tracking only
    }

    return {};
  }
});

module.exports = tusServer;
