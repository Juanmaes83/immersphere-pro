/**
 * Vercel Serverless Function (Node.js runtime)
 * GET /api/property/:id
 *
 * Returns a minimal HTML page with server-side Open Graph meta tags.
 * Only reached by social-media bot crawlers (WhatsApp, Telegram, Twitter/X,
 * LinkedIn, Discord, Slack…) thanks to the conditional rewrite in vercel.json.
 *
 * Human users are always served the SPA via the catch-all rewrite in
 * vercel.json and are never sent through this function.
 *
 * OG image strategy (in priority order):
 *  1. property.coverImage → Cloudinary c_fill,w_1200,h_630 transform
 *  2. First non-placeholder asset thumbnail → same transform if Cloudinary
 *  3. Generated branded image via /api/og?title=...&price=...&area=...
 */

// ─── Config ──────────────────────────────────────────────────────────────────

// Reuse the same API base that the client build uses.
// On Vercel, all env vars (including VITE_-prefixed ones) are available to
// serverless functions — the VITE_ restriction only applies to the browser bundle.
const API_BASE = (
  process.env.VITE_API_BASE_URL ??
  'https://immersphere-pro-production.up.railway.app/api'
).replace(/\/$/, '');

/** CDN cache for 1 hour; serve stale while refreshing for 24 h. */
const OG_CACHE = 'public, s-maxage=3600, stale-while-revalidate=86400';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AssetShape {
  type?: string;
  url?: string;
  thumbnail?: string;
}

interface SpaceShape {
  assets?: AssetShape[];
}

interface PropertyShape {
  id: string;
  title: string;
  description?: string;
  price?: number;
  area?: number;
  rooms?: number;
  bathrooms?: number;
  coverImage?: string;
  type?: string;
  tenant?: {
    name?: string;
    primaryColor?: string;
    removeBranding?: boolean;
  };
  spaces?: SpaceShape[];
}

interface ApiEnvelope {
  success: boolean;
  data?: PropertyShape;
  error?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Minimal HTML-escape for attribute values and text nodes. */
function esc(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Apply Cloudinary OG transform to a Cloudinary URL.
 * c_fill — crop to fill the canvas
 * w_1200,h_630 — standard OG image dimensions
 * q_auto,f_auto — Cloudinary's auto quality and format selection
 */
function toCloudinaryOg(raw: string): string {
  if (
    raw.includes('res.cloudinary.com') &&
    raw.includes('/image/upload/')
  ) {
    return raw.replace(
      '/image/upload/',
      '/image/upload/c_fill,w_1200,h_630,q_auto,f_auto/'
    );
  }
  return raw; // Non-Cloudinary URLs returned as-is
}

/** Returns true for data URIs and demo placeholder URLs. */
function isPlaceholderUrl(url: string): boolean {
  return url.startsWith('data:') || url.startsWith('demo://');
}

/**
 * Pick the best available OG image from the property data.
 * Falls back to the branded generated image at /api/og.
 */
function pickOgImage(property: PropertyShape, fallback: string): string {
  // 1. coverImage
  const cover = property.coverImage?.trim() ?? '';
  if (cover && !isPlaceholderUrl(cover)) {
    return toCloudinaryOg(cover);
  }

  // 2. First real asset thumbnail
  for (const space of property.spaces ?? []) {
    for (const asset of space.assets ?? []) {
      const t = asset.thumbnail?.trim() ?? '';
      if (t && !isPlaceholderUrl(t)) return toCloudinaryOg(t);
    }
  }

  // 3. First panorama URL
  for (const space of property.spaces ?? []) {
    for (const asset of space.assets ?? []) {
      const u = asset.url?.trim() ?? '';
      if (
        u &&
        !isPlaceholderUrl(u) &&
        String(asset.type ?? '').toUpperCase() === 'PANORAMA_360'
      ) {
        return toCloudinaryOg(u);
      }
    }
  }

  // 4. Generated branded OG image
  return fallback;
}

/** Build the full OG HTML page. */
function buildOgHtml(
  property: PropertyShape,
  canonicalUrl: string,
  origin: string
): string {
  // ── Title: "Property · Price · Tour Inmersivo 360°"
  const priceFormatted = property.price
    ? new Intl.NumberFormat('es-ES').format(property.price) + ' €'
    : '';
  const ogTitle = [property.title, priceFormatted, 'Tour Inmersivo 360°']
    .filter(Boolean)
    .join(' · ');

  // ── Description: description excerpt + stats
  const descExcerpt = (property.description ?? '').trim().slice(0, 110);
  const stats = [
    property.area    ? `${property.area} m²`       : '',
    property.rooms   ? `${property.rooms} hab.`     : '',
    property.bathrooms ? `${property.bathrooms} baños` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const ogDescription =
    [descExcerpt, stats].filter(Boolean).join(' — ') ||
    'Tour virtual inmersivo 360°';

  // ── Site name respects white-label
  const siteName = property.tenant?.removeBranding
    ? property.tenant?.name ?? 'Tour Inmersivo'
    : 'Immersphere Pro';

  // ── OG image: Cloudinary URL or branded fallback via /api/og
  const generatedParams = new URLSearchParams({ title: property.title });
  if (property.price) generatedParams.set('price', String(property.price));
  if (property.area)  generatedParams.set('area',  String(property.area));
  const fallbackImage = `${origin}/api/og?${generatedParams.toString()}`;
  const ogImage = pickOgImage(property, fallbackImage);

  // ── Escape everything for HTML attribute insertion
  const T  = esc(ogTitle);
  const D  = esc(ogDescription);
  const S  = esc(siteName);
  const U  = esc(canonicalUrl);
  const Img = esc(ogImage);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${T}</title>
  <meta name="description" content="${D}" />

  <!-- ── Open Graph (WhatsApp, Telegram, LinkedIn, Facebook, Discord, Slack) -->
  <meta property="og:type"        content="website" />
  <meta property="og:site_name"   content="${S}" />
  <meta property="og:url"         content="${U}" />
  <meta property="og:title"       content="${T}" />
  <meta property="og:description" content="${D}" />
  <meta property="og:image"       content="${Img}" />
  <meta property="og:image:width"  content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt"   content="${T}" />

  <!-- ── Twitter / X -->
  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:title"       content="${T}" />
  <meta name="twitter:description" content="${D}" />
  <meta name="twitter:image"       content="${Img}" />

  <!-- ── Redirect human browsers to the SPA (bots ignore redirects) -->
  <link rel="canonical" href="${U}" />
  <meta http-equiv="refresh" content="0;url=${U}" />
</head>
<body style="margin:0;background:#0f172a;color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:2rem">
  <div>
    <p style="opacity:.45;font-size:13px;margin:0 0 10px">Redirigiendo al tour inmersivo…</p>
    <a href="${U}" style="color:#7c3aed;font-weight:900;text-decoration:none">${T}</a>
  </div>
  <script>window.location.replace(${JSON.stringify(canonicalUrl)});</script>
</body>
</html>`;
}

// ─── Vercel handler ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  // Vercel populates req.query with dynamic-route segments.
  // api/property/[id].ts → req.query.id = the path segment.
  const rawId: unknown = req.query?.id;
  const propertyId =
    typeof rawId === 'string'
      ? rawId
      : Array.isArray(rawId) && typeof rawId[0] === 'string'
        ? rawId[0]
        : null;

  if (!propertyId || !/^[\w-]{1,64}$/.test(propertyId)) {
    res.statusCode = 400;
    res.end('Invalid property ID');
    return;
  }

  // Reconstruct origin from Vercel-forwarded headers
  const host =
    (req.headers['x-forwarded-host'] as string | undefined) ??
    (req.headers['host'] as string | undefined) ??
    'immersphere.pro';
  const proto =
    (req.headers['x-forwarded-proto'] as string | undefined) ?? 'https';
  const origin = `${proto}://${host}`;
  const canonicalUrl = `${origin}/property/${propertyId}`;

  // ── Fetch property from Express API ──────────────────────────────────────
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => { controller.abort(); }, 8000);

    let apiRes: Response;
    try {
      apiRes = await fetch(`${API_BASE}/properties/${propertyId}`, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!apiRes.ok) {
      // Unknown property — send the bot to the SPA; it'll handle the 404 UI
      res.statusCode = 302;
      res.setHeader('Location', canonicalUrl);
      res.end();
      return;
    }

    const envelope: ApiEnvelope = await apiRes.json() as ApiEnvelope;
    if (!envelope.success || !envelope.data) {
      res.statusCode = 302;
      res.setHeader('Location', canonicalUrl);
      res.end();
      return;
    }

    const html = buildOgHtml(envelope.data, canonicalUrl, origin);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', OG_CACHE);
    // Don't let search engines index this intermediary redirect page
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.end(html);
  } catch {
    // Network error or timeout — redirect gracefully
    res.statusCode = 302;
    res.setHeader('Location', canonicalUrl);
    res.end();
  }
}
