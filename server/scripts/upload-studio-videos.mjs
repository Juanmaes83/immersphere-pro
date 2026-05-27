/**
 * upload-studio-videos.mjs
 * Downloads ALL videos from the GitHub portfolio repo and uploads them to Cloudinary CDN.
 * Run: node scripts/upload-studio-videos.mjs
 */

import { v2 as cloudinary } from 'cloudinary';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

cloudinary.config({
  cloud_name: 'dgbgriykc',
  api_key:    '572837533883339',
  api_secret: '1Jf72edpHQT6JUt-EzYZqo3sH_8',
});

const BASE_URL = 'https://raw.githubusercontent.com/Juanmaes83/IMMERSPHERE-PRO-INMOBILIARIAS/main/';

// Complete video list — all 43 + hero
const VIDEOS = [
  // Hero / showreel
  { file: '01.mp4', public_id: 'hero_showreel', category: 'hero', label: 'Hero Showreel' },

  // Inmobiliarias (6)
  { file: '03_01.mp4',                          public_id: 'inmobiliarias/01', category: 'inmobiliarias', label: 'Inmobiliarias 01' },
  { file: '03_02.mp4',                          public_id: 'inmobiliarias/02', category: 'inmobiliarias', label: 'Inmobiliarias 02' },
  { file: '03_03.mp4',                          public_id: 'inmobiliarias/03', category: 'inmobiliarias', label: 'Inmobiliarias 03' },
  { file: 'INMOBILIARIAS_GENERICO_VIDEO_2.mp4', public_id: 'inmobiliarias/04', category: 'inmobiliarias', label: 'Inmobiliarias 04' },
  { file: 'INMOBILIARIAS_GENERICO_VIDEO_3.mp4', public_id: 'inmobiliarias/05', category: 'inmobiliarias', label: 'Inmobiliarias 05' },
  { file: 'INMOBILIARIAS_GENERICO_VIDEO_7.mp4', public_id: 'inmobiliarias/06', category: 'inmobiliarias', label: 'Inmobiliarias 06' },

  // Arquitectura (4)
  { file: 'TM-BUILDING_ARQUITECTO_VIDEO_4.mp4',      public_id: 'arquitectura/01', category: 'arquitectura', label: 'Arquitectura 01' },
  { file: 'TM-BUILDING_ARQUITECTO_VIDEO_6.mp4',      public_id: 'arquitectura/02', category: 'arquitectura', label: 'Arquitectura 02' },
  { file: 'TM-BUILDING_ARQUITECTO_VIDEO_7.mp4',      public_id: 'arquitectura/03', category: 'arquitectura', label: 'Arquitectura 03' },
  { file: 'ARQUITECTURA_CHALETS-REFORMAS_VIDEO_3.mp4', public_id: 'arquitectura/04', category: 'arquitectura', label: 'Arquitectura 04' },

  // Constructoras (15)
  { file: '04_01.mp4',                                  public_id: 'constructoras/01', category: 'constructoras', label: 'Constructoras 01' },
  { file: '04_02.mp4',                                  public_id: 'constructoras/02', category: 'constructoras', label: 'Constructoras 02' },
  { file: '04_03.mp4',                                  public_id: 'constructoras/03', category: 'constructoras', label: 'Constructoras 03' },
  { file: '04_04.mp4',                                  public_id: 'constructoras/04', category: 'constructoras', label: 'Constructoras 04' },
  { file: '04_05.mp4',                                  public_id: 'constructoras/05', category: 'constructoras', label: 'Constructoras 05' },
  { file: 'TM-BUILDING_ARQUITECTO_VIDEO_10.mp4',        public_id: 'constructoras/06', category: 'constructoras', label: 'Constructoras 06' },
  { file: 'TM-BUILDING_ARQUITECTO_VIDEO_23.mp4',        public_id: 'constructoras/07', category: 'constructoras', label: 'Constructoras 07' },
  { file: 'TM-BUILDING_ARQUITECTO_VIDEO_32.mp4',        public_id: 'constructoras/08', category: 'constructoras', label: 'Constructoras 08' },
  { file: 'ARQUITECTURA_PARKING_VIDEO_1.mp4',           public_id: 'constructoras/09', category: 'constructoras', label: 'Constructoras 09' },
  { file: 'ARQUITECTURA_INFRAESTRUCTURAS_VIDEO_1.mp4',  public_id: 'constructoras/10', category: 'constructoras', label: 'Constructoras 10' },
  { file: 'ARQUITECTURA_INGENIERIA-OBRA-CIVIL_VIDEO_3.mp4', public_id: 'constructoras/11', category: 'constructoras', label: 'Constructoras 11' },
  { file: 'ARQUITECTURA_OFICINAS_VIDEO_3.mp4',          public_id: 'constructoras/12', category: 'constructoras', label: 'Constructoras 12' },
  { file: 'VIDEO11.mp4',                                public_id: 'constructoras/13', category: 'constructoras', label: 'Constructoras 13' },
  { file: 'VIDEO12.mp4',                                public_id: 'constructoras/14', category: 'constructoras', label: 'Constructoras 14' },

  // Promotoras (6)
  { file: '05_01.mp4', public_id: 'promotoras/01', category: 'promotoras', label: 'Promotoras 01' },
  { file: '05_02.mp4', public_id: 'promotoras/02', category: 'promotoras', label: 'Promotoras 02' },
  { file: '05_03.mp4', public_id: 'promotoras/03', category: 'promotoras', label: 'Promotoras 03' },
  { file: '05_04.mp4', public_id: 'promotoras/04', category: 'promotoras', label: 'Promotoras 04' },
  { file: '05_05.mp4', public_id: 'promotoras/05', category: 'promotoras', label: 'Promotoras 05' },
  { file: '05_06.mp4', public_id: 'promotoras/06', category: 'promotoras', label: 'Promotoras 06' },

  // Decoradores (5)
  { file: '06_01.mp4', public_id: 'decoradores/01', category: 'decoradores', label: 'Decoradores 01' },
  { file: '06_02.mp4', public_id: 'decoradores/02', category: 'decoradores', label: 'Decoradores 02' },
  { file: '06_03.mp4', public_id: 'decoradores/03', category: 'decoradores', label: 'Decoradores 03' },
  { file: '06_04.mp4', public_id: 'decoradores/04', category: 'decoradores', label: 'Decoradores 04' },
  { file: '06_05.mp4', public_id: 'decoradores/05', category: 'decoradores', label: 'Decoradores 05' },

  // Singulares (2)
  { file: '111.mp4', public_id: 'singulares/01', category: 'singulares', label: 'Singular 01' },
  { file: '113.mp4', public_id: 'singulares/02', category: 'singulares', label: 'Singular 02' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function download(url, dest) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    const request = protocol.get(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        file.close(); fs.unlinkSync(dest);
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close(); fs.unlinkSync(dest);
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const total = parseInt(res.headers['content-length'] || '0', 10);
      let downloaded = 0;
      res.on('data', (chunk) => {
        downloaded += chunk.length;
        if (total > 0) process.stdout.write(`\r  ↓ ${((downloaded/total)*100).toFixed(1)}% (${(downloaded/1024/1024).toFixed(1)} MB)`);
      });
      res.pipe(file);
      file.on('finish', () => { file.close(); process.stdout.write('\n'); resolve(); });
    });
    request.on('error', (err) => { file.close(); if (fs.existsSync(dest)) fs.unlinkSync(dest); reject(err); });
  });
}

async function uploadToCloudinary(localPath, public_id) {
  return cloudinary.uploader.upload(localPath, {
    resource_type: 'video',
    public_id: `immersphere-studio/${public_id}`,
    overwrite: true,
    eager_async: false,
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
const tmpDir = os.tmpdir();
const results = [];
let success = 0, failed = 0;

console.log(`\n🎬  Immersphere Studio — Full Video Upload (${VIDEOS.length} videos)`);
console.log('='.repeat(60));

for (let i = 0; i < VIDEOS.length; i++) {
  const video = VIDEOS[i];
  const url = BASE_URL + video.file;
  const tmpPath = path.join(tmpDir, video.file);

  console.log(`\n[${i+1}/${VIDEOS.length}] ${video.label}`);
  console.log(`  ↓ Downloading: ${video.file}`);

  try {
    await download(url, tmpPath);
    const stat = fs.statSync(tmpPath);
    console.log(`  ✓ Downloaded: ${(stat.size/1024/1024).toFixed(1)} MB`);
    console.log(`  ↑ Uploading: immersphere-studio/${video.public_id}`);
    const result = await uploadToCloudinary(tmpPath, video.public_id);
    results.push({ ...video, url: result.secure_url });
    console.log(`  ✓ ${result.secure_url}`);
    success++;
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  } catch (err) {
    console.error(`  ✗ FAILED: ${err.message}`);
    results.push({ ...video, url: null, error: err.message });
    failed++;
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }
}

console.log('\n' + '='.repeat(60));
console.log(`\n✅  Done. ${success} uploaded, ${failed} failed.\n`);

// Output URL map for code
console.log('// CDN URL map for GitHub Pages index.html:');
console.log('const CLOUDINARY_BASE = "https://res.cloudinary.com/dgbgriykc/video/upload/immersphere-studio/";');
console.log('const videoData = {');
const byCategory = {};
for (const r of results) {
  if (!r.url) continue;
  if (!byCategory[r.category]) byCategory[r.category] = [];
  // Extract just the sub-path after immersphere-studio/
  const path_part = r.public_id; // e.g. "inmobiliarias/01"
  byCategory[r.category].push(path_part);
}
for (const [cat, ids] of Object.entries(byCategory)) {
  console.log(`  ${cat}: [${ids.map(id => `"${id}"`).join(', ')}],`);
}
console.log('};');
