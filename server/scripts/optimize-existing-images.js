/**
 * سكريبت لتصغير الصور الحالية في مجلدات stages و grades
 * يُشغّل مرة واحدة: node scripts/optimize-existing-images.js
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const FOLDERS = [
  { dir: path.join(__dirname, '../uploads/stages'), maxSize: 128 },
  { dir: path.join(__dirname, '../uploads/grades'), maxSize: 100 },
  { dir: path.join(__dirname, '../uploads/thumbnails'), maxSize: 200 },
  { dir: path.join(__dirname, '../uploads/settings'), maxSize: 100 },
];

async function optimizeFolder({ dir, maxSize }) {
  if (!fs.existsSync(dir)) {
    console.log(`⏭️ Skipping ${dir} (not found)`);
    return;
  }

  const files = fs.readdirSync(dir).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
  console.log(`📁 ${path.basename(dir)}: ${files.length} images found`);

  let optimized = 0;
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    const sizeBefore = stat.size;

    try {
      const metadata = await sharp(filePath).metadata();

      // تخطي لو أصغر من الحجم المطلوب
      if (metadata.width <= maxSize && metadata.height <= maxSize) {
        continue;
      }

      const tempPath = filePath + '.opt';
      await sharp(filePath)
        .resize(maxSize, maxSize, { fit: 'cover', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(tempPath);

      const sizeAfter = fs.statSync(tempPath).size;

      // استبدال فقط لو أصغر
      if (sizeAfter < sizeBefore) {
        fs.unlinkSync(filePath);

        // لو مش webp, غير الامتداد
        const ext = path.extname(file).toLowerCase();
        if (ext !== '.webp') {
          const newName = file.replace(/\.(jpg|jpeg|png)$/i, '.webp');
          fs.renameSync(tempPath, path.join(dir, newName));
          console.log(`  ✅ ${file} → ${newName} (${(sizeBefore/1024).toFixed(1)}KB → ${(sizeAfter/1024).toFixed(1)}KB)`);
        } else {
          fs.renameSync(tempPath, filePath);
          console.log(`  ✅ ${file} (${(sizeBefore/1024).toFixed(1)}KB → ${(sizeAfter/1024).toFixed(1)}KB)`);
        }
        optimized++;
      } else {
        fs.unlinkSync(tempPath);
      }
    } catch (err) {
      console.log(`  ⚠️ ${file}: ${err.message}`);
    }
  }
  console.log(`  📊 Optimized: ${optimized}/${files.length}`);
}

async function main() {
  console.log('🔧 Optimizing existing images...\n');
  for (const folder of FOLDERS) {
    await optimizeFolder(folder);
    console.log('');
  }
  console.log('✅ Done!');
}

main();
