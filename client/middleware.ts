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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildOgTags(opts: {
  title: string;
  description: string;
  image: string;
  canonicalUrl: string;
}): string {
  const title = escapeHtml(opts.title);
  const description = escapeHtml(opts.description.slice(0, 200));
  const canonicalUrl = escapeHtml(opts.canonicalUrl);
  const siteName = 'Immersphere Pro';

  const imageBlock = opts.image
    ? `  <meta property="og:image" content="${escapeHtml(opts.image)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:image" content="${escapeHtml(opts.image)}">
  <meta name="twitter:card" content="summary_large_image">`
    : `  <meta name="twitter:card" content="summary">`;

  return `  <!-- Open Graph — injected by Vercel Edge Middleware -->
  <link rel="canonical" href="${canonicalUrl}">
  <meta name="description" content="${description}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${siteName}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
${imageBlock}
  <meta name="twitter:title" content="${title}">
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
    const indexRes = await fetch(`${url.origin}/index.html`, {
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });

    if (!indexRes.ok) return undefined;

    const indexHtml = await indexRes.text();

    // Step 3 — build and inject OG tags
    const canonicalUrl = `${url.origin}${url.pathname}`;
    const title = property.title || 'Propiedad';
    const description = (
      property.description || 'Tour virtual inmersivo en Immersphere Pro'
    ).trim();

    // Use coverImage when available; fall back to the branded OG image generator.
    // /api/og is a Vercel Edge Function that returns a 1200×630 PNG.
    const fallbackOgImage = `${url.origin}/api/og?title=${encodeURIComponent(title)}`;
    const image = property.coverImage || fallbackOgImage;

    const ogTags = buildOgTags({ title, description, image, canonicalUrl });
    const enrichedHtml = injectOgIntoHtml(indexHtml, title, ogTags);

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
