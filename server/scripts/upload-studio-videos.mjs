/**
 * upload-studio-videos.mjs
 * Downloads videos from GitHub repo and uploads them to Cloudinary CDN.
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

// ── Credentials ──────────────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: 'dgbgriykc',
  api_key:    '572837533883339',
  api_secret: '1Jf72edpHQT6JUt-EzYZqo3sH_8',
});

// ── Videos to upload ─────────────────────────────────────────────────────────
const BASE_URL = 'https://raw.githubusercontent.com/Juanmaes83/IMMERSPHERE-PRO-INMOBILIARIAS/main/';

const VIDEOS = [
  { file: '01.mp4',                        public_id: 'studio/hero_showreel',          label: 'Hero Showreel' },
  { file: '03_01.mp4',                     public_id: 'studio/inmobiliarias_01',        label: 'Inmobiliarias 01' },
  { file: '03_02.mp4',                     public_id: 'studio/inmobiliarias_02',        label: 'Inmobiliarias 02' },
  { file: '03_03.mp4',                     public_id: 'studio/inmobiliarias_03',        label: 'Inmobiliarias 03' },
  { file: 'INMOBILIARIAS_GENERICO_VIDEO_2.mp4', public_id: 'studio/inmobiliarias_04',  label: 'Inmobiliarias 04' },
  { file: 'INMOBILIARIAS_GENERICO_VIDEO_3.mp4', public_id: 'studio/inmobiliarias_05',  label: 'Inmobiliarias 05' },
  { file: 'INMOBILIARIAS_GENERICO_VIDEO_7.mp4', public_id: 'studio/inmobiliarias_06',  label: 'Inmobiliarias 06' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function download(url, dest) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    const request = protocol.get(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        file.close();
        fs.unlinkSync(dest);
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const total = parseInt(res.headers['content-length'] || '0', 10);
      let downloaded = 0;
      res.on('data', (chunk) => {
        downloaded += chunk.length;
        if (total > 0) {
          const pct = ((downloaded / total) * 100).toFixed(1);
          process.stdout.write(`\r  ↓ ${pct}% (${(downloaded / 1024 / 1024).toFixed(1)} MB)`);
        }
      });
      res.pipe(file);
      file.on('finish', () => { file.close(); process.stdout.write('\n'); resolve(); });
    });
    request.on('error', (err) => { file.close(); fs.unlinkSync(dest); reject(err); });
  });
}

async function uploadToCloudinary(localPath, public_id) {
  return cloudinary.uploader.upload(localPath, {
    resource_type: 'video',
    public_id,
    folder: 'immersphere-studio',
    overwrite: true,
    eager: [
      { format: 'mp4', quality: 'auto:good', width: 1280, crop: 'limit' },
      { format: 'webm', quality: 'auto:good', width: 1280, crop: 'limit' },
    ],
    eager_async: false,
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
const tmpDir = os.tmpdir();
const results = [];

console.log('\n🎬  Immersphere Studio — Video Upload Script');
console.log('='.repeat(55));

for (const video of VIDEOS) {
  const url = BASE_URL + video.file;
  const tmpPath = path.join(tmpDir, video.file);

  console.log(`\n[${video.label}]`);
  console.log(`  ↓ Downloading: ${video.file}`);

  try {
    await download(url, tmpPath);
    const stat = fs.statSync(tmpPath);
    console.log(`  ✓ Downloaded: ${(stat.size / 1024 / 1024).toFixed(1)} MB`);

    console.log(`  ↑ Uploading to Cloudinary: immersphere-studio/${video.public_id}`);
    const result = await uploadToCloudinary(tmpPath, video.public_id);

    const cdnUrl = result.secure_url;
    results.push({ label: video.label, public_id: video.public_id, url: cdnUrl });
    console.log(`  ✓ CDN URL: ${cdnUrl}`);

    fs.unlinkSync(tmpPath);
  } catch (err) {
    console.error(`  ✗ FAILED: ${err.message}`);
    results.push({ label: video.label, public_id: video.public_id, url: null, error: err.message });
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }
}

console.log('\n' + '='.repeat(55));
console.log('✅  Upload complete. CDN URLs:\n');
for (const r of results) {
  if (r.url) {
    console.log(`  ${r.label}:`);
    console.log(`    "${r.url}"`);
  } else {
    console.log(`  ${r.label}: ✗ ${r.error}`);
  }
}
console.log('\n📋  Copy these URLs into PricingPage.tsx STUDIO_VIDEOS array.\n');
