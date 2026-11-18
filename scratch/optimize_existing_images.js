import fs from 'fs';
import path from 'path';
import os from 'os';
import { createRequire } from 'module';

/**
 * Script Optimasi & Kompresi Foto Lama (In-Place Batch Optimizer)
 * 
 * Memindai folder uploads (baik di lokal maupun di Hostinger production) dan static img,
 * me-resize foto yang > 1200px dan mengompresnya langsung tanpa mengubah nama file agar link di database
 * tetap 100% valid dan aman.
 * 
 * Cara Penggunaan:
 * 1. Default (otomatis deteksi folder):
 *    node scratch/optimize_existing_images.js
 * 
 * 2. Menentukan folder custom via argumen:
 *    node scratch/optimize_existing_images.js /home/u707667165/domains/sumdebetta.com/uploads
 */

function resolveSharp() {
  const require = createRequire(import.meta.url);

  // 1. Coba require langsung dari lokasi script
  try {
    return require('sharp');
  } catch {}

  // 2. Coba require dari direktori kerja saat ini (process.cwd())
  try {
    const cwdRequire = createRequire(path.join(process.cwd(), 'dummy.js'));
    return cwdRequire('sharp');
  } catch {}

  // 3. Coba cari di folder versions Hostinger (hbuilds/versions/<UUID>/nodejs)
  try {
    const versionsDir = path.join(os.homedir(), 'domains', 'sumdebetta.com', 'hbuilds', 'versions');
    if (fs.existsSync(versionsDir)) {
      const versions = fs.readdirSync(versionsDir).sort().reverse();
      for (const v of versions) {
        const candidateDir = path.join(versionsDir, v, 'nodejs');
        if (fs.existsSync(candidateDir)) {
          try {
            const vRequire = createRequire(path.join(candidateDir, 'dummy.js'));
            return vRequire('sharp');
          } catch {}
        }
      }
    }
  } catch {}

  return null;
}

function resolvePath(p) {
  if (!p) return null;
  if (p.startsWith('~/')) {
    return path.join(os.homedir(), p.slice(2));
  }
  return path.resolve(p);
}

async function optimizeFolder(sharp, folderPath, maxDimension = 1200, quality = 82) {
  if (!fs.existsSync(folderPath)) {
    return null;
  }

  const entries = fs.readdirSync(folderPath, { withFileTypes: true });
  let count = 0;
  let totalSaved = 0;
  let skipped = 0;

  console.log(`\n📂 Memproses folder: ${folderPath}`);

  for (const entry of entries) {
    if (!entry.isFile()) continue;

    const ext = path.extname(entry.name).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) continue;

    const fullPath = path.join(folderPath, entry.name);
    let stat;
    try {
      stat = fs.statSync(fullPath);
    } catch {
      continue;
    }

    const originalSize = stat.size;

    // Lewati jika file sudah kecil (< 120KB)
    if (originalSize < 120 * 1024) {
      skipped++;
      continue;
    }

    try {
      const image = sharp(fullPath);
      const metadata = await image.metadata();

      let pipeline = sharp(fullPath);

      // Resize jika dimensi lebih dari maxDimension
      if (metadata.width > maxDimension || metadata.height > maxDimension) {
        pipeline = pipeline.resize(maxDimension, maxDimension, {
          fit: 'inside',
          withoutEnlargement: true,
        });
      }

      // Pertahankan format asli agar nama file & URL di database tidak berubah
      let compressedBuffer;
      if (ext === '.jpg' || ext === '.jpeg') {
        compressedBuffer = await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
      } else if (ext === '.png') {
        // Jika PNG dan memiliki transparansi, gunakan png compression
        compressedBuffer = await pipeline.png({ quality, compressionLevel: 9 }).toBuffer();
      } else if (ext === '.webp') {
        compressedBuffer = await pipeline.webp({ quality }).toBuffer();
      }

      if (compressedBuffer && compressedBuffer.length < originalSize) {
        const saved = originalSize - compressedBuffer.length;
        fs.writeFileSync(fullPath, compressedBuffer);
        totalSaved += saved;
        count++;
        console.log(`  ✓ ${entry.name}: ${(originalSize / 1024).toFixed(1)} KB -> ${(compressedBuffer.length / 1024).toFixed(1)} KB (Hemat ${(saved / 1024).toFixed(1)} KB)`);
      } else {
        skipped++;
      }
    } catch (err) {
      console.warn(`  ⚠ Gagal memproses ${entry.name}:`, err.message);
    }
  }

  console.log(`  Hasil: ${count} foto dioptimasi, ${skipped} foto dilewati (sudah optimal), hemat ${(totalSaved / (1024 * 1024)).toFixed(2)} MB`);
  return { count, savedBytes: totalSaved };
}

async function run() {
  console.log('=====================================================');
  console.log('✦ SUMDE BETTA: BATCH IMAGE OPTIMIZER (IN-PLACE)');
  console.log('=====================================================');

  // Load library sharp secara dinamis
  const sharp = resolveSharp();
  if (!sharp) {
    console.error('\n❌ ERROR: Library "sharp" belum terinstall di server.');
    console.error('Silakan install sharp terlebih dahulu dengan perintah:');
    console.error('  npm install sharp\n');
    process.exit(1);
  }

  const cliTarget = process.argv[2] ? resolvePath(process.argv[2]) : null;

  // Kumpulan direktori kandidat
  const candidateDirs = new Set();

  if (cliTarget) {
    candidateDirs.add(cliTarget);
  }

  // 1. Env var UPLOADS_DIR jika ada
  if (process.env.UPLOADS_DIR) {
    candidateDirs.add(resolvePath(process.env.UPLOADS_DIR));
  }

  // 2. Folder produksi persisten di Hostinger
  candidateDirs.add('/home/u707667165/domains/sumdebetta.com/uploads');
  candidateDirs.add(path.join(os.homedir(), 'domains', 'sumdebetta.com', 'uploads'));

  // 3. Relatif dari direktori kerja sekarang (misal dijalankan dari hbuilds/versions/<UUID>/nodejs atau last-source)
  candidateDirs.add(path.resolve(process.cwd(), '..', '..', '..', 'uploads'));
  candidateDirs.add(path.resolve(process.cwd(), '..', 'uploads'));
  candidateDirs.add(path.resolve(process.cwd(), 'uploads'));

  // 4. Folder lokal project
  candidateDirs.add(path.join(process.cwd(), 'public', 'uploads'));

  let grandTotalCount = 0;
  let grandTotalSaved = 0;
  const processedDirs = new Set();

  for (const dir of candidateDirs) {
    if (!dir || processedDirs.has(dir)) continue;
    if (fs.existsSync(dir)) {
      processedDirs.add(dir);
      const res = await optimizeFolder(sharp, dir, 1200, 82);
      if (res) {
        grandTotalCount += res.count;
        grandTotalSaved += res.savedBytes;
      }
    }
  }

  // Cek juga folder public/img jika ada di sekitar direktori kerja
  const imgDirCandidates = [
    path.join(process.cwd(), 'public', 'img'),
    path.resolve(process.cwd(), '..', 'public', 'img'),
    path.join(os.homedir(), 'domains', 'sumdebetta.com', 'hbuilds', 'last-source', 'public', 'img'),
  ];

  for (const imgDir of imgDirCandidates) {
    if (fs.existsSync(imgDir) && !processedDirs.has(imgDir)) {
      processedDirs.add(imgDir);
      const res = await optimizeFolder(sharp, imgDir, 1400, 82);
      if (res) {
        grandTotalCount += res.count;
        grandTotalSaved += res.savedBytes;
      }
    }
  }

  console.log('\n=====================================================');
  console.log('✓ SELESAI!');
  console.log(`Total foto yang berhasil dioptimasi: ${grandTotalCount} file`);
  console.log(`Total kapasitas data yang dihemat: ${(grandTotalSaved / (1024 * 1024)).toFixed(2)} MB`);
  console.log('=====================================================');
}

run();
