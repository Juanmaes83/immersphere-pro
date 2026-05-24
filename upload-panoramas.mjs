// upload-panoramas.mjs — sube los JPEGs convertidos y conecta a los espacios demo
import fs from 'fs';
import path from 'path';

const API    = 'https://immersphere-pro-production.up.railway.app/api';
const PROP   = '2fe0f03b-5631-4d21-8337-cf526428834c';
const PANOS  = 'C:\\Users\\temp123\\Desktop\\immersphere-fix\\panoramas';

const SPACES = {
  entrada:    { spaceId: 'cb0e2f1d-b21d-425f-bf32-14cb1d084187', assetId: 'f8f6c21b-9301-4377-bf29-10434ac95a62' },
  salon:      { spaceId: '889db1e4-6f55-4cfa-bb61-4ca09ba9f826', assetId: 'c2db8de6-3ef8-4ed1-a509-0fb095a6bffc' },
  cocina:     { spaceId: 'e478be2d-0497-4296-8c36-b9b60907571d', assetId: '50eb5d9e-24bc-476b-a321-8ff1b0125cd6' },
  dormitorio: { spaceId: 'cc453087-0c56-4429-936c-620cce3332b7', assetId: '7b723a94-2c84-43a7-b500-6c8ec20e6376' },
  terraza:    { spaceId: '39e50cdd-0f71-4dce-90b7-087ca2cac270', assetId: 'de638182-c431-442f-857b-c29c70e0ad57' },
};

const FILES = [
  { key: 'entrada',    file: 'entrada_360.jpg'    },
  { key: 'salon',      file: 'salon_360.jpg'      },
  { key: 'cocina',     file: 'cocina_360.jpg'     },
  { key: 'dormitorio', file: 'dormitorio_360.jpg' },
  { key: 'terraza',    file: 'terraza_360.jpg'    },
];

async function apiJson(method, path_, body, token) {
  const res = await fetch(`${API}${path_}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path_} -> ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function uploadFile(filePath, fileName, token) {
  const buffer = fs.readFileSync(filePath);
  const blob   = new Blob([buffer], { type: 'image/jpeg' });
  const form   = new FormData();
  form.append('file', blob, fileName);

  const res = await fetch(`${API}/uploads`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Upload ${fileName} -> ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function main() {
  // Login
  console.log('Autenticando...');
  const auth  = await apiJson('POST', '/auth/login', { email: 'admin@demo.com', password: 'Immersphere123!' });
  const token = auth.data.tokens.accessToken;
  console.log('  Token OK\n');

  const results = {};

  for (const { key, file } of FILES) {
    const filePath = path.join(PANOS, file);
    const sizeMB   = (fs.statSync(filePath).size / 1024 / 1024).toFixed(2);
    console.log(`Subiendo ${file} (${sizeMB} MB)...`);

    // Upload a Cloudinary via servidor
    const upRes      = await uploadFile(filePath, file, token);
    const cloudUrl   = upRes.data.url;
    const thumbUrl   = upRes.data.thumbnailUrl || cloudUrl;
    console.log(`  Cloudinary: ${cloudUrl}`);

    // Actualizar asset del espacio
    const { spaceId, assetId } = SPACES[key];
    await apiJson('PUT', `/properties/${PROP}/spaces/${spaceId}/assets/${assetId}`, {
      url:       cloudUrl,
      thumbnail: thumbUrl,
      type:      'panorama_360',
      format:    'jpg',
    }, token);
    console.log(`  Asset actualizado\n`);
    results[key] = cloudUrl;
  }

  // Actualizar coverImage de la propiedad con terraza
  console.log('Actualizando coverImage con terraza...');
  await apiJson('PUT', `/properties/${PROP}`, {
    title:       'Atico Lumiere - Experiencia Inmersiva',
    description: 'Una vivienda disenada para quienes entienden que el espacio tambien comunica. 127m2 de luz, silencio y conversacion en el corazon de la ciudad.',
    type:        'APARTMENT', status: 'PUBLISHED', price: 485000,
    area: 127, rooms: 3, bathrooms: 2, address: 'Barcelona, Catalunya',
    coverImage: results.terraza,
  }, token);
  console.log('  OK\n');

  console.log('='.repeat(60));
  console.log('DEMO MASTER — PANORAMAS CONECTADOS');
  console.log('='.repeat(60));
  for (const [k, url] of Object.entries(results)) {
    console.log(`  ${k.padEnd(12)} ${url.substring(0, 55)}...`);
  }
  console.log(`\n  Viewer: https://immersphere-pro.vercel.app/property/${PROP}`);
  console.log('='.repeat(60));
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
