const fs = require('fs');
const path = require('path');

const COMPLETED_DIR = path.join(__dirname, '../uploads/lessons/.tus-completed');
const LESSONS_DIR = path.join(__dirname, '../uploads/lessons');
const MAX_AGE_HOURS = 24;

function cleanupOrphanedTusFiles() {
  if (!fs.existsSync(COMPLETED_DIR)) return;

  const now = Date.now();

  let files;
  try {
    files = fs.readdirSync(COMPLETED_DIR);
  } catch {
    return;
  }

  for (const infoFile of files) {
    if (!infoFile.endsWith('.json')) continue;

    try {
      const infoPath = path.join(COMPLETED_DIR, infoFile);
      const meta = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
      const completedAt = new Date(meta.completedAt).getTime();
      const ageHours = (now - completedAt) / (1000 * 60 * 60);

      if (ageHours > MAX_AGE_HOURS) {
        // Delete the uploaded file
        fs.unlink(path.join(LESSONS_DIR, meta.id), () => {});
        // Delete the tus configstore info file
        fs.unlink(path.join(LESSONS_DIR, meta.id + '.json'), () => {});
        // Delete the completed tracking file
        fs.unlink(infoPath, () => {});
        console.log(`🧹 Cleaned up orphaned tus file: ${meta.id}`);
      }
    } catch {
      // Skip corrupted info files
    }
  }
}

module.exports = { cleanupOrphanedTusFiles };
