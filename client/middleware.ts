/**
 * Vercel Edge Middleware — Open Graph injection + sitemap proxy.
 *
 * For every /property/:id request this middleware:
 *   1. Fetches property data from the Railway backend API.
 *   2. Fetches the Vite-built index.html from this Vercel deployment.
 *   3. Injects OG / Twitter / canonical meta tags into <head>.
 *   4. Returns the enriched HTML to ALL clients — crawlers AND browsers.
 *
 * Benefits over UA-based detection:
 *   - view-source shows real OG tags (user-visible test).
 *   - No regex maintenance as new crawlers appear.
 *   - Google receives the same HTML as any other client.
 *   - SPA still hydrates correctly (all assets remain in the HTML).
 *
 * /sitemap.xml requests are proxied to Railway, bypassing the
 * Vercel catch-all rewrite (/* → /index.html).
 *
 * On any error this middleware returns undefined, which triggers
 * Vercel's catch-all rewrite and serves the plain SPA index.html.
 *
 * No external dependencies — only native Web Edge APIs.
 */

export const config = {
  matcher: ['/property/:path*', '/sitemap.xml']
};

const TIMEOUT_MS = 4000;

// ── Types ────────────────────────────────────────────────────────────────────

type PropertyData = {
  id: string;
  title: string;
  description: string;
  coverImage: string;
  status: string;
  isPasswordProtected?: boolean;
  price?: number;
  area?: number;
  rooms?: number;
  bathrooms?: number;
  tenant?: {
    name?: string;
    removeBranding?: boolean;
    primaryColor?: string;
  };
};

type PropertyApiResponse = {
  success: boolean;
  data: PropertyData;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractPropertyId(pathname: string): string | null {
  // pathname is /property/<id> or /property/<id>/...
  const parts = pathname.split('/');
  const id = parts[2];
  return id && id.length > 0 ? id : null;
}

/**
 * Edge-compatible slugify — mirrors client/src/utils/slugify.ts exactly.
 * Uses only built-in JS/V8 APIs (safe for Vercel Edge Runtime).
 * "Gran Vía 32, Madrid" → "gran-via-32-madrid"
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacriticals
    .replace(/[^a-z0-9\s-]/g, '')    // keep alphanumeric + spaces + hyphens
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
}

/**
 * Return the canonical slug URL for a property.
 * - If the incoming pathname already has a slug segment, keep it as-is.
 * - Otherwise compute the slug from the property title and append it.
 * - Falls back to the ID-only path if the title produces an empty slug.
 */
function buildCanonicalUrl(origin: string, pathname: string, propertyId: string, title: string): string {
  const parts = pathname.split('/').filter(Boolean); // ['property', 'UUID'] or ['property', 'UUID', 'slug']
  const hasSlugSegment = parts.length >= 3;
  if (hasSlugSegment) {
    // URL already contains a slug — respect it as canonical
    return `${origin}${pathname}`;
  }
  // ID-only path — compute and append the slug
  const slug = slugify(title);
  return slug
    ? `${origin}/property/${propertyId}/${slug}`
    : `${origin}/property/${propertyId}`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Apply a Cloudinary transform so the OG image is exactly 1200×630.
 * c_fill  — crop to fill the canvas (no letterboxing)
 * w_1200,h_630 — standard social-share dimensions
 * q_auto,f_auto — best quality + format for the requesting client
 *
 * Non-Cloudinary URLs are returned unchanged.
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
  return raw;
}

function buildOgTags(opts: {
  ogTitle: string;
  description: string;
  image: string;
  imageAlt: string;
  canonicalUrl: string;
  siteName: string;
}): string {
  const title       = escapeHtml(opts.ogTitle);
  const description = escapeHtml(opts.description.slice(0, 200));
  const canonicalUrl = escapeHtml(opts.canonicalUrl);
  const siteName    = escapeHtml(opts.siteName);
  const imageAlt    = escapeHtml(opts.imageAlt);

  const imageBlock = opts.image
    ? `  <meta property="og:image"        content="${escapeHtml(opts.image)}">
  <meta property="og:image:width"  content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt"    content="${imageAlt}">
  <meta name="twitter:image"       content="${escapeHtml(opts.image)}">
  <meta name="twitter:card"        content="summary_large_image">`
    : `  <meta name="twitter:card" content="summary">`;

  return `  <!-- Open Graph — injected by Vercel Edge Middleware -->
  <link rel="canonical" href="${canonicalUrl}">
  <meta name="description" content="${description}">
  <meta property="og:type"        content="website">
  <meta property="og:site_name"   content="${siteName}">
  <meta property="og:url"         content="${canonicalUrl}">
  <meta property="og:title"       content="${title}">
  <meta property="og:description" content="${description}">
${imageBlock}
  <meta name="twitter:title"       content="${title}">
  <meta name="twitter:description" content="${description}">`;
}

/**
 * Inject OG tags and update <title> in the Vite index.html string.
 * Uses simple string replacement — no DOM parser required.
 */
function injectOgIntoHtml(html: string, title: string, ogTags: string): string {
  // Replace <title>…</title> with the property title
  const withTitle = html.replace(
    /<title>[^<]*<\/title>/,
    `<title>${escapeHtml(title)} · Immersphere Pro</title>`
  );
  // Inject OG tags immediately before </head>
  return withTitle.replace('</head>', `${ogTags}\n</head>`);
}

// ── Sitemap proxy ─────────────────────────────────────────────────────────────

async function proxySitemap(): Promise<Response> {
  const apiBase =
    process.env.API_BASE_URL ??
    'https://immersphere-pro-production.up.railway.app/api';

  // API_BASE_URL ends with /api — sitemap is served at the Express root
  const railwayBase = apiBase.replace(/\/api\/?$/, '');

  try {
    const upstream = await fetch(`${railwayBase}/sitemap.xml`, {
      signal: AbortSignal.timeout(5000)
    });

    if (!upstream.ok) {
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><error>Sitemap no disponible</error>',
        { status: 503, headers: { 'Content-Type': 'application/xml; charset=utf-8' } }
      );
    }

    const xml = await upstream.text();

    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
      }
    });
  } catch {
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><error>Sitemap temporalmente no disponible</error>',
      { status: 503, headers: { 'Content-Type': 'application/xml; charset=utf-8' } }
    );
  }
}

// ── Main middleware ───────────────────────────────────────────────────────────

export default async function middleware(request: Request): Promise<Response | undefined> {
  const url = new URL(request.url);

  // ── /sitemap.xml — proxy to Railway ───────────────────────────────────────
  if (url.pathname === '/sitemap.xml') {
    return proxySitemap();
  }

  // ── /property/:id — OG injection for all clients ─────────────────────────
  const propertyId = extractPropertyId(url.pathname);
  if (!propertyId) return undefined;

  const apiBase =
    process.env.API_BASE_URL ??
    'https://immersphere-pro-production.up.railway.app/api';

  try {
    // Step 1 — fetch property data from Railway
    const apiRes = await fetch(`${apiBase}/properties/${propertyId}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });

    if (!apiRes.ok) return undefined; // 404, 5xx → SPA handles it

    const body = await apiRes.json() as PropertyApiResponse;

    if (!body.success || !body.data) return undefined;

    const property = body.data;

    // Non-published or password-protected: let SPA handle auth/404 flow
    if (property.status !== 'PUBLISHED' || property.isPasswordProtected) {
      return undefined;
    }

    // Step 2 — fetch the Vite-built index.html from this Vercel deployment.
    // /index.html is a static file — it doesn't match the middleware matcher,
    // so this fetch is served directly by Vercel's CDN with no recursion.
    const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    const indexRes = await fetch(`${url.origin}/index.html`, {
      headers: bypassSecret ? { 'x-vercel-protection-bypass': bypassSecret } : {},
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });

    if (!indexRes.ok) return undefined;

    const indexHtml = await indexRes.text();

    // Step 3 — build and inject OG tags
    const propertyTitle = property.title || 'Propiedad';
    // S3.2: canonical always resolves to the slug URL.
    // If the request already carries /property/UUID/slug → keep it.
    // If the request is /property/UUID (no slug) → compute and append.
    const canonicalUrl = buildCanonicalUrl(url.origin, url.pathname, propertyId, propertyTitle);
    const description = (
      property.description || 'Tour virtual inmersivo en Immersphere Pro'
    ).trim();

    // ── Enriched og:title: "Title · 350.000 € · Tour Inmersivo 360°"
    const priceStr = property.price
      ? new Intl.NumberFormat('es-ES').format(property.price) + ' €'
      : '';
    const ogTitle = [propertyTitle, priceStr, 'Tour Inmersivo 360°']
      .filter(Boolean)
      .join(' · ');

    // ── og:site_name respects white-label removeBranding
    const siteName = property.tenant?.removeBranding
      ? (property.tenant?.name || 'Tour Inmersivo')
      : 'Immersphere Pro';

    // ── OG image: Cloudinary-transformed to exactly 1200×630
    // Fallback: branded generator /api/og with price + area for richer image
    const fallbackParams = new URLSearchParams({ title: propertyTitle });
    if (property.price) fallbackParams.set('price', String(property.price));
    if (property.area)  fallbackParams.set('area',  String(property.area));
    const fallbackOgImage = `${url.origin}/api/og?${fallbackParams.toString()}`;
    const rawImage = property.coverImage || fallbackOgImage;
    const image = toCloudinaryOg(rawImage);

    const ogTags = buildOgTags({
      ogTitle,
      description,
      image,
      imageAlt: ogTitle,
      canonicalUrl,
      siteName,
    });
    const enrichedHtml = injectOgIntoHtml(indexHtml, propertyTitle, ogTags);

    return new Response(enrichedHtml, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        // Cache at CDN: 60 s fresh, up to 5 min stale-while-revalidate
        'Cache-Control': 's-maxage=60, stale-while-revalidate=300'
      }
    });
  } catch {
    // Timeout, network error, JSON parse error, etc.
    // Fall through to Vercel catch-all → serves plain index.html
    return undefined;
  }
}
