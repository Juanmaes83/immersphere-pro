import { deflateRawSync } from 'node:zlib';
import { prisma } from '../index.js';
import { env } from '../config/env.js';

// CRC32 with reversed polynomial
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC32_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16LE(buf: Buffer, offset: number, value: number): void {
  buf[offset] = value & 0xff;
  buf[offset + 1] = (value >>> 8) & 0xff;
}

function writeUint32LE(buf: Buffer, offset: number, value: number): void {
  buf[offset] = value & 0xff;
  buf[offset + 1] = (value >>> 8) & 0xff;
  buf[offset + 2] = (value >>> 16) & 0xff;
  buf[offset + 3] = (value >>> 24) & 0xff;
}

interface ZipEntry {
  name: string;
  data: Buffer;
  compressed: Buffer;
  crc: number;
  offset: number;
  dosDate: number;
  dosTime: number;
}

function dosDateTime(): { date: number; time: number } {
  const now = new Date();
  const date =
    ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const time =
    (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  return { date, time };
}

function buildZip(files: Array<{ name: string; data: Buffer }>): Buffer {
  const { date: dosDate, time: dosTime } = dosDateTime();
  const entries: ZipEntry[] = [];
  const localParts: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = Buffer.from(file.name, 'utf8');
    const compressed = deflateRawSync(file.data, { level: 6 });
    const crc = crc32(file.data);

    // Local file header: 30 bytes + filename
    const local = Buffer.alloc(30 + nameBytes.length);
    local.writeUInt32LE(0x04034b50, 0);  // signature
    writeUint16LE(local, 4, 20);          // version needed (2.0)
    writeUint16LE(local, 6, 0);           // flags
    writeUint16LE(local, 8, 8);           // compression: deflate
    writeUint16LE(local, 10, dosTime);
    writeUint16LE(local, 12, dosDate);
    writeUint32LE(local, 14, crc);
    writeUint32LE(local, 18, compressed.length);
    writeUint32LE(local, 22, file.data.length);
    writeUint16LE(local, 26, nameBytes.length);
    writeUint16LE(local, 28, 0);          // extra field length
    nameBytes.copy(local, 30);

    entries.push({ name: file.name, data: file.data, compressed, crc, offset, dosDate, dosTime });
    localParts.push(local, compressed);
    offset += local.length + compressed.length;
  }

  const cdOffset = offset;
  const cdParts: Buffer[] = [];

  for (const entry of entries) {
    const nameBytes = Buffer.from(entry.name, 'utf8');
    const cd = Buffer.alloc(46 + nameBytes.length);
    cd.writeUInt32LE(0x02014b50, 0);       // central dir signature
    writeUint16LE(cd, 4, 20);              // version made by
    writeUint16LE(cd, 6, 20);              // version needed
    writeUint16LE(cd, 8, 0);               // flags
    writeUint16LE(cd, 10, 8);              // compression: deflate
    writeUint16LE(cd, 12, entry.dosTime);
    writeUint16LE(cd, 14, entry.dosDate);
    writeUint32LE(cd, 16, entry.crc);
    writeUint32LE(cd, 20, entry.compressed.length);
    writeUint32LE(cd, 24, entry.data.length);
    writeUint16LE(cd, 28, nameBytes.length);
    writeUint16LE(cd, 30, 0);              // extra length
    writeUint16LE(cd, 32, 0);              // comment length
    writeUint16LE(cd, 34, 0);              // disk number start
    writeUint16LE(cd, 36, 0);              // internal attributes
    cd.writeUInt32LE(0, 38);               // external attributes
    writeUint32LE(cd, 42, entry.offset);
    nameBytes.copy(cd, 46);
    cdParts.push(cd);
  }

  const cdSize = cdParts.reduce((s, b) => s + b.length, 0);

  // End of central directory: 22 bytes
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  writeUint16LE(eocd, 4, 0);              // disk number
  writeUint16LE(eocd, 6, 0);             // disk with CD
  writeUint16LE(eocd, 8, entries.length);
  writeUint16LE(eocd, 10, entries.length);
  writeUint32LE(eocd, 12, cdSize);
  writeUint32LE(eocd, 16, cdOffset);
  writeUint16LE(eocd, 20, 0);            // comment length

  return Buffer.concat([...localParts, ...cdParts, eocd]);
}

function safeTitle(title: string): string {
  return title.replace(/[<>&"'`]/g, '');
}

function buildPanoramaHtml(propertyTitle: string, imageUrl: string, propertyUrl: string): string {
  const title = safeTitle(propertyTitle);
  const safeImageUrl = encodeURI(imageUrl);
  const safePropertyUrl = propertyUrl.replace(/'/g, '%27');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tour 360° — ${title}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0a0a14; overflow: hidden; font-family: system-ui, -apple-system, sans-serif; }
    #wrap { width: 100vw; height: 100vh; position: relative; }
    canvas { display: block; cursor: grab; }
    canvas:active { cursor: grabbing; }
    #top {
      position: absolute; top: 0; left: 0; right: 0; z-index: 10;
      padding: 1rem 1.5rem;
      background: linear-gradient(to bottom, rgba(0,0,0,0.65) 0%, transparent 100%);
      pointer-events: none;
    }
    #badge {
      font-size: 0.65rem; font-weight: 800; letter-spacing: 0.18em;
      text-transform: uppercase; color: #06b6d4; margin-bottom: 0.2rem;
    }
    #prop-title { color: #fff; font-size: 1.1rem; font-weight: 900; }
    #bottom {
      position: absolute; bottom: 0; left: 0; right: 0; z-index: 10;
      padding: 1.25rem 1.5rem;
      display: flex; align-items: center; justify-content: space-between;
      background: linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 100%);
    }
    #powered { color: rgba(255,255,255,0.2); font-size: 0.65rem; letter-spacing: 0.1em; }
    #actions { display: flex; gap: 0.6rem; align-items: center; }
    .btn {
      border: none; border-radius: 999px; font-weight: 800; font-size: 0.8rem;
      cursor: pointer; padding: 0.55rem 1.2rem; text-decoration: none;
      transition: opacity 0.15s;
    }
    .btn:hover { opacity: 0.82; }
    .btn-ghost {
      background: rgba(255,255,255,0.12); color: #fff;
    }
    .btn-primary {
      background: linear-gradient(135deg, #7c3aed, #06b6d4); color: #fff;
      display: inline-block;
    }
    #hint {
      position: absolute; bottom: 5rem; left: 50%; transform: translateX(-50%);
      background: rgba(0,0,0,0.55); color: rgba(255,255,255,0.75);
      font-size: 0.75rem; padding: 0.4rem 1.1rem; border-radius: 999px;
      z-index: 10; transition: opacity 0.8s; white-space: nowrap;
    }
    #err {
      display: none; position: absolute; inset: 0; z-index: 20;
      align-items: center; justify-content: center; flex-direction: column; gap: 1rem;
      background: #0a0a14; color: rgba(255,255,255,0.5); font-size: 0.9rem; text-align: center;
      padding: 2rem;
    }
  </style>
</head>
<body>
  <div id="wrap">
    <div id="top">
      <div id="badge">Immersphere Pro · Tour 360°</div>
      <div id="prop-title">${title}</div>
    </div>
    <div id="hint">Arrastra para girar &nbsp;·&nbsp; Scroll para zoom</div>
    <div id="bottom">
      <span id="powered">Powered by Immersphere Pro</span>
      <div id="actions">
        <button class="btn btn-ghost" onclick="toggleFs()">⛶ Pantalla completa</button>
        <a class="btn btn-primary" href="${safePropertyUrl}" target="_blank" rel="noopener">Contactar agente →</a>
      </div>
    </div>
    <div id="err">
      <span style="font-size:2rem">⚠</span>
      <span>No se pudo cargar la imagen del tour.<br>Verifica tu conexión a internet.</span>
    </div>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.min.js"></script>
  <script>
    (function () {
      var wrap = document.getElementById('wrap');
      var hint = document.getElementById('hint');
      var errBox = document.getElementById('err');

      setTimeout(function () { hint.style.opacity = '0'; }, 3500);
      setTimeout(function () { hint.remove(); }, 4400);

      var W = function () { return wrap.clientWidth; };
      var H = function () { return wrap.clientHeight; };

      var scene = new THREE.Scene();
      var camera = new THREE.PerspectiveCamera(75, W() / H(), 0.1, 1000);
      camera.position.set(0, 0, 0.01);

      var renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(W(), H());
      wrap.appendChild(renderer.domElement);

      var geo = new THREE.SphereGeometry(500, 64, 40);
      geo.scale(-1, 1, 1);

      var loader = new THREE.TextureLoader();
      loader.load(
        '${safeImageUrl}',
        function (tex) {
          var mat = new THREE.MeshBasicMaterial({ map: tex });
          scene.add(new THREE.Mesh(geo, mat));
        },
        undefined,
        function () {
          errBox.style.display = 'flex';
        }
      );

      var isDragging = false, prevX = 0, prevY = 0;
      var targetLon = 0, targetLat = 0, lon = 0, lat = 0, fov = 75;

      renderer.domElement.addEventListener('pointerdown', function (e) {
        isDragging = true; prevX = e.clientX; prevY = e.clientY;
        renderer.domElement.setPointerCapture(e.pointerId);
      });
      renderer.domElement.addEventListener('pointermove', function (e) {
        if (!isDragging) return;
        targetLon -= (e.clientX - prevX) * 0.15;
        targetLat += (e.clientY - prevY) * 0.15;
        prevX = e.clientX; prevY = e.clientY;
      });
      renderer.domElement.addEventListener('pointerup', function () { isDragging = false; });

      renderer.domElement.addEventListener('wheel', function (e) {
        fov = Math.max(30, Math.min(100, fov + e.deltaY * 0.05));
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }, { passive: true });

      var lastPinchDist = 0;
      renderer.domElement.addEventListener('touchstart', function (e) {
        if (e.touches.length === 2)
          lastPinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      }, { passive: true });
      renderer.domElement.addEventListener('touchmove', function (e) {
        if (e.touches.length !== 2) return;
        var d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        fov = Math.max(30, Math.min(100, fov - (d - lastPinchDist) * 0.1));
        camera.fov = fov; camera.updateProjectionMatrix(); lastPinchDist = d;
      }, { passive: true });

      window.addEventListener('resize', function () {
        camera.aspect = W() / H();
        camera.updateProjectionMatrix();
        renderer.setSize(W(), H());
      });

      window.toggleFs = function () {
        if (!document.fullscreenElement) wrap.requestFullscreen().catch(function () {});
        else document.exitFullscreen();
      };

      var phi, theta;
      (function animate() {
        requestAnimationFrame(animate);
        lon += (targetLon - lon) * 0.08;
        lat += (targetLat - lat) * 0.08;
        lat = Math.max(-85, Math.min(85, lat));
        phi = THREE.MathUtils.degToRad(90 - lat);
        theta = THREE.MathUtils.degToRad(lon);
        camera.lookAt(
          500 * Math.sin(phi) * Math.cos(theta),
          500 * Math.cos(phi),
          500 * Math.sin(phi) * Math.sin(theta)
        );
        renderer.render(scene, camera);
      })();
    })();
  </script>
</body>
</html>`;
}

function buildSplatHtml(propertyTitle: string, splatUrl: string, propertyUrl: string): string {
  const title = safeTitle(propertyTitle);
  const encoded = encodeURIComponent(splatUrl);
  const safePropertyUrl = propertyUrl.replace(/'/g, '%27');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tour 3D — ${title}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      background: #0a0a14; color: #fff;
      font-family: system-ui, -apple-system, sans-serif; padding: 2rem;
    }
    .card {
      max-width: 480px; width: 100%;
      background: #13131f; border: 1px solid rgba(255,255,255,0.08);
      border-radius: 1.5rem; padding: 2.5rem 2rem; text-align: center;
    }
    .badge {
      display: inline-block;
      background: linear-gradient(135deg, #7c3aed, #06b6d4);
      border-radius: 999px; padding: 0.35rem 1rem;
      font-size: 0.7rem; font-weight: 900; letter-spacing: 0.18em;
      text-transform: uppercase; margin-bottom: 1.5rem;
    }
    h1 { font-size: clamp(1.4rem, 5vw, 2rem); font-weight: 900; line-height: 1.15; margin-bottom: 1rem; }
    p { color: rgba(255,255,255,0.5); font-size: 0.9rem; line-height: 1.6; margin-bottom: 1.5rem; }
    .btn {
      display: inline-block;
      background: linear-gradient(135deg, #7c3aed, #06b6d4);
      color: #fff; font-weight: 900; font-size: 0.9rem;
      text-decoration: none; border-radius: 999px; padding: 0.85rem 2rem;
      transition: opacity 0.15s; margin-bottom: 0.75rem;
    }
    .btn:hover { opacity: 0.85; }
    .btn-ghost {
      display: inline-block; background: rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.7); font-weight: 700; font-size: 0.82rem;
      text-decoration: none; border-radius: 999px; padding: 0.65rem 1.4rem;
      transition: opacity 0.15s;
    }
    .note { font-size: 0.72rem; color: rgba(255,255,255,0.25); margin-top: 1rem; }
    .powered { margin-top: 2.5rem; font-size: 0.7rem; color: rgba(255,255,255,0.18); letter-spacing: 0.12em; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">Immersphere Pro · Tour 3D</div>
    <h1>${title}</h1>
    <p>Explora esta propiedad con tecnología Gaussian Splatting 3D. Requiere conexión a internet para cargar el visor.</p>
    <a href="https://superspl.at/editor?load=${encoded}" target="_blank" rel="noopener noreferrer" class="btn">
      Iniciar tour 3D →
    </a>
    <br>
    <a href="${safePropertyUrl}" target="_blank" rel="noopener noreferrer" class="btn-ghost">
      Ver ficha completa en Immersphere Pro
    </a>
    <p class="note">Se abrirá el visor 3D en una nueva pestaña. Compatible con Chrome y Edge.</p>
  </div>
  <p class="powered">Powered by Immersphere Pro</p>
</body>
</html>`;
}

export async function buildPropertyTourZip(
  tenantId: string,
  propertyId: string
): Promise<{ buffer: Buffer; filename: string } | null> {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, tenantId },
    include: {
      spaces: {
        orderBy: { order: 'asc' },
        include: {
          assets: {
            orderBy: { createdAt: 'asc' }
          }
        }
      }
    }
  });

  if (!property) return null;

  let assetUrl: string | null = null;
  let assetType: 'GAUSSIAN_SPLAT' | 'PANORAMA_360' = 'PANORAMA_360';

  // Gaussian Splat takes priority
  outer: for (const space of property.spaces) {
    for (const asset of space.assets) {
      if (asset.type === 'GAUSSIAN_SPLAT' && asset.url && !asset.url.startsWith('demo://')) {
        assetUrl = asset.url;
        assetType = 'GAUSSIAN_SPLAT';
        break outer;
      }
    }
  }

  // Fall back to first real panorama
  if (!assetUrl) {
    outer: for (const space of property.spaces) {
      for (const asset of space.assets) {
        if (asset.type === 'PANORAMA_360' && asset.url && !asset.url.startsWith('demo://')) {
          assetUrl = asset.url;
          assetType = 'PANORAMA_360';
          break outer;
        }
      }
    }
  }

  if (!assetUrl) return null;

  const appUrl = env.APP_URL.replace(/\/$/, '');
  const propertyUrl = `${appUrl}/property/${propertyId}`;

  const html = assetType === 'GAUSSIAN_SPLAT'
    ? buildSplatHtml(property.title, assetUrl, propertyUrl)
    : buildPanoramaHtml(property.title, assetUrl, propertyUrl);

  const htmlBuf = Buffer.from(html, 'utf8');
  const zip = buildZip([{ name: 'tour.html', data: htmlBuf }]);

  const slug = property.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || propertyId.slice(0, 8);

  const date = new Date().toISOString().slice(0, 10);
  const filename = `tour-${slug}-${date}.zip`;

  return { buffer: zip, filename };
}
