/**
 * upload-renders.mjs
 * Uploads user's own render/production videos from local PC to Cloudinary CDN.
 * Run: node scripts/upload-renders.mjs
 */

import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

cloudinary.config({
  cloud_name: 'dgbgriykc',
  api_key:    '572837533883339',
  api_secret: '1Jf72edpHQT6JUt-EzYZqo3sH_8',
});

const VIDEOS = [
  {
    path: 'C:\\Users\\temp123\\Desktop\\PROYECTOS IA\\VIDEOS IA\\INMOBILIARIAS\\INMOBILIARIAS_GENERICO_VIDEO_9.mp4',
    public_id: 'immersphere-studio/renders/inmobiliarias_09',
    label: 'Inmobiliarias Generico Video 9',
  },
  {
    path: 'C:\\Users\\temp123\\Downloads\\SUBIR A RUBIK SOTA\\RENDER.mp4',
    public_id: 'immersphere-studio/renders/render_01',
    label: 'RENDER (Studio hero)',
  },
  {
    path: 'C:\\Users\\temp123\\Downloads\\SUBIR A RUBIK SOTA\\0527 (1).mp4',
    public_id: 'immersphere-studio/renders/reel_0527',
    label: 'Reel 0527',
  },
  {
    path: 'C:\\Users\\temp123\\Downloads\\SUBIR A RUBIK SOTA\\RENDER2 INMOBILIARIAS.mp4',
    public_id: 'immersphere-studio/renders/render_inmobiliarias_02',
    label: 'Render 2 Inmobiliarias',
  },
  {
    path: 'C:\\Users\\temp123\\Downloads\\SUBIR A RUBIK SOTA\\RENDER DECORACIÓN.mp4',
    public_id: 'immersphere-studio/renders/render_decoracion',
    label: 'Render Decoración',
  },
  {
    path: 'C:\\Users\\temp123\\Downloads\\SUBIR A RUBIK SOTA\\RENDER INMOBILIARIA ESPACIOS.mp4',
    public_id: 'immersphere-studio/renders/render_espacios_01',
    label: 'Render Inmobiliaria Espacios 1',
  },
  {
    path: 'C:\\Users\\temp123\\Downloads\\SUBIR A RUBIK SOTA\\RENDER INMOBILIARIA ESPACIOS 2.mp4',
    public_id: 'immersphere-studio/renders/render_espacios_02',
    label: 'Render Inmobiliaria Espacios 2',
  },
];

console.log(`\n🎬  Upload renders locales → Cloudinary (${VIDEOS.length} vídeos)`);
console.log('='.repeat(60));

const results = [];

for (let i = 0; i < VIDEOS.length; i++) {
  const v = VIDEOS[i];
  const sizeMB = (fs.statSync(v.path).size / 1024 / 1024).toFixed(1);
  console.log(`\n[${i + 1}/${VIDEOS.length}] ${v.label} (${sizeMB} MB)`);
  console.log(`  ↑ Subiendo a: ${v.public_id}`);

  try {
    const result = await cloudinary.uploader.upload(v.path, {
      resource_type: 'video',
      public_id: v.public_id,
      overwrite: true,
      eager_async: false,
    });
    console.log(`  ✓ ${result.secure_url}`);
    results.push({ label: v.label, public_id: v.public_id, url: result.secure_url });
  } catch (err) {
    console.error(`  ✗ ERROR: ${err.message}`);
    results.push({ label: v.label, public_id: v.public_id, url: null, error: err.message });
  }
}

console.log('\n' + '='.repeat(60));
console.log('\n✅  RESULTADO FINAL:\n');
for (const r of results) {
  if (r.url) console.log(`  ✓  ${r.label}\n     ${r.url}\n`);
  else console.log(`  ✗  ${r.label}: ${r.error}\n`);
}
