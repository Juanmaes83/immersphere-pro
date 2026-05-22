/**
 * QR Kit de Escaparate — client-side PNG generator
 *
 * Generates a high-resolution A5 PNG (1748×2480px @ 300 DPI) ready for print.
 * Layout: brand header · QR code · property info · brand footer with tagline.
 * Uses browser Canvas API + qrcode library. Zero server involvement.
 */
import QRCode from 'qrcode';
import type { AuthTenant } from '@/store/authStore';

export interface QrKitProperty {
  id: string;
  title: string;
  price: number;
  status: string;
}

// ── Canvas dimensions: A5 portrait @ 300 DPI ─────────────────────────────────
const W = 1748;
const H = 2480;
const MARGIN = 120;

// ── Colour helpers ────────────────────────────────────────────────────────────
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

function hexAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(124,58,237,${alpha})`;
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
}

/** Decide whether to use white or dark text on a given background colour. */
function contrastColor(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#ffffff';
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.55 ? '#0f172a' : '#ffffff';
}

// ── Image helpers ─────────────────────────────────────────────────────────────
async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// ── Rounded rectangle helper ──────────────────────────────────────────────────
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ── Main generator ────────────────────────────────────────────────────────────
export async function downloadQrKit(
  property: QrKitProperty,
  tenant: AuthTenant
): Promise<void> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D not available');

  const brand = tenant.primaryColor || '#7C3AED';
  const onBrand = contrastColor(brand);
  const BAND_H = 280;
  const FOOTER_H = 240;
  const FOOTER_Y = H - FOOTER_H;

  // ── 1. White background ───────────────────────────────────────────────────
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // ── 2. Top band ───────────────────────────────────────────────────────────
  ctx.fillStyle = brand;
  ctx.fillRect(0, 0, W, BAND_H);

  // Agency logo or name
  let agencyNameDrawn = false;
  if (tenant.logoUrl) {
    try {
      const img = await loadImage(tenant.logoUrl);
      const MAX_LOGO_H = 150;
      const MAX_LOGO_W = W - MARGIN * 2;
      const scale = Math.min(MAX_LOGO_H / img.height, MAX_LOGO_W / img.width);
      const lw = img.width * scale;
      const lh = img.height * scale;
      ctx.drawImage(img, (W - lw) / 2, (BAND_H - lh) / 2, lw, lh);
      agencyNameDrawn = true;
    } catch { /* fallback to text below */ }
  }
  if (!agencyNameDrawn) {
    ctx.fillStyle = onBrand;
    ctx.font = `bold 68px Inter, ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      (tenant.logoText || tenant.name || 'Agencia').slice(0, 36),
      W / 2,
      BAND_H / 2
    );
  }

  // ── 3. Subtle dot pattern on white area ──────────────────────────────────
  ctx.fillStyle = hexAlpha(brand, 0.04);
  const DOT_STEP = 60;
  for (let dx = 0; dx < W; dx += DOT_STEP) {
    for (let dy = BAND_H; dy < FOOTER_Y; dy += DOT_STEP) {
      ctx.beginPath();
      ctx.arc(dx, dy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── 4. QR code ────────────────────────────────────────────────────────────
  const propertyUrl = `${window.location.origin}/property/${property.id}`;
  let qrY = BAND_H + 120;

  try {
    const qrDataUrl = await QRCode.toDataURL(propertyUrl, {
      width: 880,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
    });
    const qrImg = await loadImage(qrDataUrl);
    const QR_SIZE = 880;
    const QR_X = (W - QR_SIZE) / 2;

    // White card behind QR for clarity
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, QR_X - 30, qrY - 30, QR_SIZE + 60, QR_SIZE + 60, 28);
    ctx.fill();
    ctx.strokeStyle = hexAlpha(brand, 0.12);
    ctx.lineWidth = 4;
    roundRect(ctx, QR_X - 30, qrY - 30, QR_SIZE + 60, QR_SIZE + 60, 28);
    ctx.stroke();

    ctx.drawImage(qrImg, QR_X, qrY, QR_SIZE, QR_SIZE);
    qrY += QR_SIZE + 60;
  } catch {
    // QR failed — continue without it
    qrY += 60;
  }

  // ── 5. "Escanea" label ────────────────────────────────────────────────────
  ctx.fillStyle = '#64748b';
  ctx.font = `600 38px Inter, ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('Escanea para visitar el tour virtual', W / 2, qrY + 24);

  // ── 6. Divider ────────────────────────────────────────────────────────────
  const divY = qrY + 120;
  ctx.strokeStyle = hexAlpha(brand, 0.18);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(MARGIN, divY);
  ctx.lineTo(W - MARGIN, divY);
  ctx.stroke();

  // ── 7. Property title ─────────────────────────────────────────────────────
  let textY = divY + 80;
  ctx.fillStyle = '#0f172a';
  ctx.font = `bold 76px Inter, ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const titleLines = wrapText(ctx, property.title, W - MARGIN * 2).slice(0, 2);
  for (const line of titleLines) {
    ctx.fillText(line, W / 2, textY);
    textY += 94;
  }

  // ── 8. Price ──────────────────────────────────────────────────────────────
  if (property.price > 0) {
    textY += 18;
    ctx.fillStyle = brand;
    ctx.font = `bold 66px Inter, ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const priceStr = new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(property.price);
    ctx.fillText(priceStr, W / 2, textY);
    textY += 84;
  }

  // ── 9. Footer band ────────────────────────────────────────────────────────
  ctx.fillStyle = brand;
  ctx.fillRect(0, FOOTER_Y, W, FOOTER_H);

  // Tagline
  const taglineY = tenant.removeBranding
    ? FOOTER_Y + FOOTER_H / 2
    : FOOTER_Y + FOOTER_H / 2 - 32;

  ctx.fillStyle = onBrand;
  ctx.font = `bold 46px Inter, ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Visita virtual completa · Sin app · Sin instalación', W / 2, taglineY);

  if (!tenant.removeBranding) {
    ctx.fillStyle = `rgba(${onBrand === '#ffffff' ? '255,255,255' : '0,0,0'},0.55)`;
    ctx.font = `500 34px Inter, ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText('Powered by Immersphere Pro', W / 2, taglineY + 62);
  }

  // ── 10. Download ──────────────────────────────────────────────────────────
  await new Promise<void>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error('toBlob failed')); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const slug = property.title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 32) || property.id.slice(0, 8);
      a.download = `qr-kit-${slug}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      resolve();
    }, 'image/png');
  });
}
