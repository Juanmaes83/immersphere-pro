#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// seed-demo.mjs — Crea la propiedad Demo Master en Immersphere Pro
//
// Uso:
//   node seed-demo.mjs <email> <password>
//
// Prerequisitos:
//   1. Node 18+ (usa fetch nativo)
//   2. Sustituir las URLs PLACEHOLDER por tus imagenes reales antes de ejecutar
// ─────────────────────────────────────────────────────────────────────────────

const API = 'https://immersphere-pro-production.up.railway.app/api';

// ─────────────────────────────────────────────────────────────────────────────
// PANORAMAS
// Por defecto: usa la imagen demo del proyecto (funciona, misma imagen x5).
// Para la demo final, sustituye cada URL por la imagen real de cada estancia.
// Formato: JPEG equirectangular, URLs publicas https://
// ─────────────────────────────────────────────────────────────────────────────
const CDN = 'https://d8j0ntlcm91z4.cloudfront.net/user_32tIBn1VWPFRvRlTsdl6JD8uoae/';

// Panoramas generados con HiggsFields nano_banana_2 — Barcelona Eixample
const PANORAMAS = {
  entrada:    `${CDN}hf_20260519_065419_c846af98-8c61-4ea9-ba78-e3b3b7f81b84.png`,
  salon:      `${CDN}hf_20260519_071439_c326a27b-7139-4e2a-9a23-0f498086c353.png`,
  cocina:     `${CDN}hf_20260519_065854_8f2cf8c6-be3f-46f4-98ca-7e30610122b8.png`,
  dormitorio: `${CDN}hf_20260519_065953_2ad41767-3adc-423c-9b45-7512e671a623.png`,
  terraza:    `${CDN}hf_20260519_070109_6a94d0f4-93d3-400a-af08-1e17114e8fdb.png`,
};

// Cover image para thumbnailUrl de la propiedad
const COVER_URL = `${CDN}hf_20260519_070355_e40cedac-0bf1-402d-bca4-0556062e3aeb_min.webp`;

// Floorplan: sustituir por URL real del plano de planta (PNG/JPG)
// Si no tienes plano, dejarlo vacio ('') — el boton Plano no aparecera en el viewer
const FLOORPLAN_URL = '';

// Audio: dejar vacio ('') para silencio (decision tomada: no arriesgar CORS)
const AUDIO = {
  entrada:    '',
  salon:      '',
  cocina:     '',
  dormitorio: '',
  terraza:    '',
};

// ─────────────────────────────────────────────────────────────────────────────

function log(msg) { console.log(msg); }
function warn(msg) { console.warn('\x1b[33m' + msg + '\x1b[0m'); }
function ok(msg) { console.log('\x1b[32m' + msg + '\x1b[0m'); }
function err(msg) { console.error('\x1b[31m' + msg + '\x1b[0m'); }

async function api(method, path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const [email, password] = process.argv.slice(2);

  if (!email || !password) {
    err('Uso: node seed-demo.mjs <email> <password>');
    process.exit(1);
  }

  // Advertencia si siguen usando panoramas placeholder
  const usingDemoPano = Object.values(PANORAMAS).some((u) => u.includes('panorama-living-room'));
  const noFloorplan   = !FLOORPLAN_URL || FLOORPLAN_URL.startsWith('PLACEHOLDER');
  if (usingDemoPano) {
    warn('\n[!] Usando panorama demo (misma imagen x5). Sustituye por imagenes reales en el admin.');
  }
  if (noFloorplan) {
    warn('[!] Sin floorplanUrl — el boton Plano no aparecera en el viewer hasta que lo configures.\n');
  }
  const pendingPanoramas = Object.entries(PANORAMAS).filter(([, u]) => u.startsWith('PLACEHOLDER'));
  const pendingFloor = FLOORPLAN_URL.startsWith('PLACEHOLDER');

  // ── 1. Login ──────────────────────────────────────────────────────────────
  log('Autenticando...');
  const auth = await api('POST', '/auth/login', { email, password });
  const token = auth.data?.tokens?.accessToken;
  if (!token) throw new Error('Login fallido. Revisa email y password.');
  ok('  Token OK');

  // ── 2. Crear propiedad en DRAFT con floorplanUrl ──────────────────────────
  log('\nCreando propiedad: Atico Lumiere...');
  const propRes = await api('POST', '/properties', {
    title:        'Atico Lumiere - Experiencia Inmersiva',
    description:  'Una vivienda disenada para quienes entienden que el espacio tambien comunica. 127m2 de luz, silencio y conversacion en el corazon de la ciudad.',
    type:         'APARTMENT',
    status:       'DRAFT',
    price:        485000,
    area:         127,
    rooms:        3,
    bathrooms:    2,
    address:      'Barcelona, Catalunya',
    thumbnailUrl: COVER_URL,
    floorplanUrl: FLOORPLAN_URL,
  }, token);
  const propertyId = propRes.data?.id;
  if (!propertyId) throw new Error('No se pudo crear la propiedad: ' + JSON.stringify(propRes));
  ok(`  Propiedad creada: ${propertyId}`);

  // El servidor crea un espacio "Vista general" por defecto — eliminarlo
  const existingSpaces = await api('GET', `/properties/${propertyId}/spaces`, null, token);
  for (const s of existingSpaces.data ?? []) {
    if (s.name === 'Vista general') {
      await api('DELETE', `/properties/${propertyId}/spaces/${s.id}`, null, token);
      log(`  (espacio por defecto "${s.name}" eliminado)`);
    }
  }

  // ── 3. Crear 5 espacios en orden con toda la narrativa y duraciones ───────
  log('\nCreando 5 espacios...');

  const spaceDefs = [
    {
      key:  'entrada',
      name: 'Entrada',
      order: 1,
      status: 'ACTIVE',
      guidedDuration: 8,
      storySubheadline: 'Cada manana empieza aqui.',
      storyHighlight:   'El umbral que marca el ritmo del dia.',
      ctaLabel:  'Explorar disponibilidad',
      ctaSubtext: 'Sin compromiso - respuesta en 24h',
      floorplanPin: { x: 22, y: 48 },
    },
    {
      key:  'salon',
      name: 'Salon',
      order: 2,
      status: 'ACTIVE',
      guidedDuration: 14,
      storySubheadline: 'La conversacion siempre empieza aqui.',
      storyHighlight:   'Luz natural todo el dia. Silencio cuando lo necesitas.',
      ctaLabel:   'Hablar con el asesor',
      ctaSubtext: 'Disponible ahora - sin esperas',
      floorplanPin: { x: 45, y: 42 },
    },
    {
      key:  'cocina',
      name: 'Cocina',
      order: 3,
      status: 'ACTIVE',
      guidedDuration: 9,
      storySubheadline: 'La conversacion acaba siempre aqui.',
      storyHighlight:   'Disenada para cocinar y quedarse.',
      ctaLabel:   'Solicitar dossier',
      ctaSubtext: 'PDF completo - enviado al instante',
      floorplanPin: { x: 68, y: 38 },
    },
    {
      key:  'dormitorio',
      name: 'Dormitorio',
      order: 4,
      status: 'ACTIVE',
      guidedDuration: 11,
      storySubheadline: 'El silencio tambien forma parte del espacio.',
      storyHighlight:   'Orientacion este. La primera luz sin alarma.',
      ctaLabel:   'Solicitar dossier completo',
      ctaSubtext: 'Memoria de calidades incluida',
      floorplanPin: { x: 72, y: 65 },
    },
    {
      key:  'terraza',
      name: 'Terraza',
      order: 5,
      status: 'ACTIVE',
      guidedDuration: 18,
      storySubheadline: 'La ciudad desde otro ritmo.',
      storyHighlight:   '38m2 sobre Barcelona. El cielo forma parte del salon.',
      ctaLabel:   'Solicitar visita presencial',
      ctaSubtext: 'Agenda en 2 minutos - sin desplazamiento',
      floorplanPin: { x: 48, y: 75 },
    },
  ];

  // Crear espacios y recoger IDs
  const spaceIds = {};
  for (const def of spaceDefs) {
    const { key, ...spacePayload } = def;
    const res = await api('POST', `/properties/${propertyId}/spaces`, spacePayload, token);
    const id = res.data?.id;
    if (!id) throw new Error(`No se pudo crear espacio ${def.name}: ${JSON.stringify(res)}`);
    spaceIds[key] = id;
    ok(`  ${def.name} -> ${id}`);
  }

  // ── 4 + 7. Crear activo 360 + hotspots por espacio (en un solo POST cada uno) ──
  // Hotspots son flotantes (no 3D). Posiciones para no solaparse, zona visible.
  log('\nCreando activos panorama + hotspots...');

  const assetDefs = [
    {
      key: 'entrada',
      panorama: PANORAMAS.entrada,
      hotspots: [
        { label: 'Salon',   type: 'navigation', position: { x: 38, y: 68 }, targetKey: 'salon'   },
        { label: 'Terraza', type: 'navigation', position: { x: 62, y: 68 }, targetKey: 'terraza' },
      ],
    },
    {
      key: 'salon',
      panorama: PANORAMAS.salon,
      hotspots: [
        { label: 'Cocina',      type: 'navigation', position: { x: 35, y: 70 }, targetKey: 'cocina'     },
        { label: 'Dormitorio',  type: 'navigation', position: { x: 65, y: 70 }, targetKey: 'dormitorio' },
      ],
    },
    {
      key: 'cocina',
      panorama: PANORAMAS.cocina,
      hotspots: [
        { label: 'Salon',   type: 'navigation', position: { x: 38, y: 70 }, targetKey: 'salon'   },
        { label: 'Terraza', type: 'navigation', position: { x: 62, y: 62 }, targetKey: 'terraza' },
      ],
    },
    {
      key: 'dormitorio',
      panorama: PANORAMAS.dormitorio,
      hotspots: [
        { label: 'Terraza', type: 'navigation', position: { x: 50, y: 68 }, targetKey: 'terraza' },
      ],
    },
    {
      key: 'terraza',
      panorama: PANORAMAS.terraza,
      hotspots: [
        { label: 'Solicitar visita', type: 'cta',        position: { x: 50, y: 72 }, targetKey: null    },
        { label: 'Entrada',          type: 'navigation', position: { x: 30, y: 62 }, targetKey: 'entrada' },
      ],
    },
  ];

  for (const def of assetDefs) {
    const spaceId = spaceIds[def.key];
    if (!spaceId) { warn(`  Sin spaceId para ${def.key}, omitido.`); continue; }

    const hotspots = def.hotspots.map((h) => ({
      label:         h.label,
      type:          h.type,
      position:      h.position,
      body:          '',
      metric:        '',
      ...(h.targetKey ? { targetSpaceId: spaceIds[h.targetKey] } : {}),
    }));

    const res = await api(
      'POST',
      `/properties/${propertyId}/spaces/${spaceId}/assets`,
      {
        type:      'panorama_360',
        url:       def.panorama,
        thumbnail: def.panorama,
        format:    'jpg',
        size:      0,
        hotspots,
      },
      token
    );

    const assetId = res.data?.id;
    ok(`  ${def.key}: activo ${assetId} + ${hotspots.length} hotspot(s)`);
  }

  // ── 5. Audio — ya decidido silencio, no hay URLs fiables hoy ─────────────
  // Si en el futuro tienes URLs CDN con CORS abierto, actualiza AUDIO arriba
  // y descomenta el bloque de actualizar espacios con ambientAudio.
  //
  // Ejemplo para activar audio en Salon cuando tengas la URL:
  //   await api('PUT', `/properties/${propertyId}/spaces/${spaceIds.salon}`,
  //     { ambientAudio: 'https://cdn.ejemplo.com/salon.mp3' }, token);

  // ── 9. Publicar ───────────────────────────────────────────────────────────
  // updateProperty usa el mismo schema que create: title es requerido
  log('\nPublicando propiedad...');
  await api('PUT', `/properties/${propertyId}`, {
    title:        'Atico Lumiere - Experiencia Inmersiva',
    description:  'Una vivienda disenada para quienes entienden que el espacio tambien comunica. 127m2 de luz, silencio y conversacion en el corazon de la ciudad.',
    type:         'APARTMENT',
    status:       'PUBLISHED',
    price:        485000,
    area:         127,
    rooms:        3,
    bathrooms:    2,
    address:      'Barcelona, Catalunya',
    thumbnailUrl: COVER_URL,
    floorplanUrl: FLOORPLAN_URL,
  }, token);
  ok('  Propiedad publicada (PUBLISHED)');

  // ── Resumen final ─────────────────────────────────────────────────────────
  const viewerUrl  = `https://immersphere-pro.vercel.app/property/${propertyId}`;
  const embedUrl   = `https://immersphere-pro.vercel.app/embed/${propertyId}`;
  const adminUrl   = 'https://immersphere-pro.vercel.app/properties';

  console.log('\n' + '='.repeat(64));
  ok('DEMO MASTER CREADA');
  console.log('='.repeat(64));
  console.log(`  ID propiedad : ${propertyId}`);
  console.log(`  Viewer       : ${viewerUrl}`);
  console.log(`  Embed        : ${embedUrl}`);
  console.log(`  Admin        : ${adminUrl}`);
  console.log('');
  console.log('  Espacios creados:');
  for (const [k, id] of Object.entries(spaceIds)) {
    console.log(`    ${k.padEnd(12)} ${id}`);
  }

  if (pendingPanoramas.length > 0 || pendingFloor) {
    console.log('');
    warn('  PENDIENTE — sustituir URLs placeholder:');
    for (const [name, url] of pendingPanoramas) {
      warn(`    panorama.${name} = "${url}"`);
    }
    if (pendingFloor) warn(`    floorplan     = "${FLOORPLAN_URL}"`);
    warn('');
    warn('  Para actualizar las imagenes, edita el espacio en el admin:');
    warn(`    ${adminUrl}`);
  }

  console.log('='.repeat(64) + '\n');
}

main().catch((e) => {
  err('\nError: ' + e.message);
  process.exit(1);
});
