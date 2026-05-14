/**
 * Vercel Edge Middleware — Open Graph for public property pages.
 *
 * Social crawlers (WhatsApp, Facebook, LinkedIn, etc.) do not execute JavaScript.
 * When they fetch /property/:id they receive the blank index.html of the SPA.
 * This middleware intercepts those requests and returns a minimal HTML page
 * with populated Open Graph meta tags so link previews work correctly.
 *
 * Regular browser requests are passed through unchanged → SPA loads as normal.
 *
 * No external dependencies — uses only native Web APIs (Request, Response, fetch, URL).
 */

export const config = {
  matcher: ['/property/:path*', '/sitemap.xml']
};

/** Known social / messaging crawler User-Agent patterns. */
const BOT_UA_PATTERN =
  /WhatsApp|facebookexternalhit|Facebot|LinkedInBot|Twitterbot|Googlebot|Slackbot|Discordbot|TelegramBot|bingbot|DuckDuckBot|ia_archiver/i;

const TIMEOUT_MS = 4000;

function isCrawler(request: Request): boolean {
  const ua = request.headers.get('user-agent') ?? '';
  return BOT_UA_PATTERN.test(ua);
}

function extractPropertyId(pathname: string): string | null {
  // pathname is /property/<id> or /property/<id>/...
  const parts = pathname.split('/');
  // ['', 'property', '<id>', ...]
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

function buildOgHtml(opts: {
  title: string;
  description: string;
  image: string;
  canonicalUrl: string;
}): string {
  const title = escapeHtml(opts.title);
  const description = escapeHtml(opts.description.slice(0, 200));
  const image = opts.image ? escapeHtml(opts.image) : '';
  const url = escapeHtml(opts.canonicalUrl);
  const siteName = 'Immersphere Pro';

  const imageTag = image
    ? `
  <meta property="og:image" content="${image}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:image" content="${image}">
  <meta name="twitter:card" content="summary_large_image">`
    : `
  <meta name="twitter:card" content="summary">`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} · ${siteName}</title>
  <meta name="description" content="${description}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${siteName}">
  <meta property="og:url" content="${url}">
  <meta property="og:title" content="${title} · ${siteName}">
  <meta property="og:description" content="${description}">${imageTag}
  <meta name="twitter:title" content="${title} · ${siteName}">
  <meta name="twitter:description" content="${description}">
</head>
<body></body>
</html>`;
}

/**
 * Proxy /sitemap.xml from the Railway backend.
 * Vercel's catch-all rewrite (/* → /index.html) would otherwise swallow it.
 * The middleware intercepts before rewrites and returns the XML directly.
 */
async function proxySitemap(): Promise<Response> {
  const apiBase =
    process.env.API_BASE_URL ??
    'https://immersphere-pro-production.up.railway.app/api';

  // API_BASE_URL ends with /api — sitemap lives at the Express root
  const railwayBase = apiBase.replace(/\/api\/?$/, '');

  try {
    const upstream = await fetch(`${railwayBase}/sitemap.xml`, {
      signal: AbortSignal.timeout(5000)
    });

    if (!upstream.ok) {
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><error>Sitemap no disponible</error>',
        {
          status: 503,
          headers: { 'Content-Type': 'application/xml; charset=utf-8' }
        }
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
      {
        status: 503,
        headers: { 'Content-Type': 'application/xml; charset=utf-8' }
      }
    );
  }
}

export default async function middleware(request: Request): Promise<Response | undefined> {
  const url = new URL(request.url);

  // ── Sitemap proxy ─────────────────────────────────────────────────────────
  // Must run before the crawler check — all clients (bots + browsers) need it.
  if (url.pathname === '/sitemap.xml') {
    return proxySitemap();
  }

  // ── Open Graph — only act on known crawler requests ───────────────────────
  if (!isCrawler(request)) {
    return undefined; // pass through → Vercel rewrite serves index.html
  }
  const propertyId = extractPropertyId(url.pathname);

  if (!propertyId) {
    return undefined;
  }

  const apiBase =
    process.env.API_BASE_URL ??
    'https://immersphere-pro-production.up.railway.app/api';

  try {
    const res = await fetch(`${apiBase}/properties/${propertyId}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });

    if (!res.ok) {
      return undefined; // property not found or error → serve SPA
    }

    const body = await res.json() as {
      success: boolean;
      data: {
        id: string;
        title: string;
        description: string;
        coverImage: string;
        status: string;
        isPasswordProtected?: boolean;
      };
    };

    if (!body.success || !body.data) {
      return undefined;
    }

    const property = body.data;

    // Only serve OG for publicly published, non-password-protected properties
    if (property.status !== 'PUBLISHED' || property.isPasswordProtected) {
      return undefined;
    }

    const canonicalUrl = `${url.origin}${url.pathname}`;
    const title = property.title || 'Propiedad';
    const description =
      (property.description || 'Tour virtual inmersivo en Immersphere Pro').trim();
    const image = property.coverImage || '';

    const html = buildOgHtml({ title, description, image, canonicalUrl });

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 's-maxage=60, stale-while-revalidate=300'
      }
    });
  } catch {
    // API timeout, network error, JSON parse error → fall back to SPA
    return undefined;
  }
}
