import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { env } from './config/env.js';
import { authRoutes } from './routes/auth.routes.js';
import { propertiesRoutes } from './routes/properties.routes.js';
import { subscriptionRoutes } from './routes/subscription.routes.js';
import { analyticsRoutes } from './routes/analytics.routes.js';
import { leadsRoutes } from './routes/leads.routes.js';
import { tenantsRoutes } from './routes/tenants.routes.js';
import { uploadsRoutes } from './routes/uploads.routes.js';
import { webhookRoutes } from './routes/webhook.routes.js';
import { chatRoutes } from './routes/chat.routes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export const prisma = new PrismaClient();

function isAllowedCorsOrigin(origin: string | undefined): boolean {
  if (!origin) return true;

  const configuredOrigins = env.CLIENT_ORIGIN
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (configuredOrigins.includes(origin)) return true;

  if (/^http:\/\/localhost:\d+$/.test(origin)) return true;

  if (/^https:\/\/imm(?:er|o)sphere.*\.vercel\.app$/.test(origin)) return true;

  return false;
}

const app = express();

app.use(
  cors({
    origin(origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) {
      if (isAllowedCorsOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true
  })
);

app.use('/api/webhooks', webhookRoutes);
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

app.get('/health', (_request, response) => {
  response.status(200).json({
    success: true,
    data: {
      status: 'ok',
      service: 'immersphere-pro-server',
      environment: env.NODE_ENV
    }
  });
});

app.get('/health/services', (_request, response) => {
  const stripeKey = env.STRIPE_SECRET_KEY;
  const stripeConfigured = Boolean(stripeKey && stripeKey.startsWith('sk_'));
  response.status(200).json({
    stripe: {
      configured: stripeConfigured,
      keyPrefix: stripeKey ? stripeKey.slice(0, 7) + '...' : '(vacío)',
      webhookSecret: Boolean(env.STRIPE_WEBHOOK_SECRET),
      prices: {
        professional: Boolean(env.STRIPE_PRICE_PROFESSIONAL),
        enterprise: Boolean(env.STRIPE_PRICE_ENTERPRISE)
      }
    },
    cloudinary: {
      configured: Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET),
      cloudName: env.CLOUDINARY_CLOUD_NAME || '(vacío)',
      apiKey: env.CLOUDINARY_API_KEY ? env.CLOUDINARY_API_KEY.slice(0, 6) + '...' : '(vacío)',
      apiSecret: env.CLOUDINARY_API_SECRET ? '***' + env.CLOUDINARY_API_SECRET.slice(-4) : '(vacío)'
    }
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/properties', propertiesRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/tenants', tenantsRoutes);
app.use('/api/chat', chatRoutes);

app.get('/sitemap.xml', async (_req, res) => {
  function escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Server-side slugify — mirrors client/src/utils/slugify.ts exactly.
   * Must stay in sync manually; no shared package between client and server.
   * "Gran Vía 32, Madrid" → "gran-via-32-madrid"
   */
  function slugify(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // strip combining diacriticals (accents, tildes…)
      .replace(/[^a-z0-9\s-]/g, '')   // keep alphanumeric + spaces + hyphens
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 60);
  }

  try {
    const rawAppUrl = (env.APP_URL ?? '').replace(/\/$/, '');

    const isLocalOrEmpty =
      !rawAppUrl ||
      rawAppUrl.includes('localhost') ||
      rawAppUrl.includes('127.0.0.1');

    if (isLocalOrEmpty) {
      console.warn(
        '[sitemap] APP_URL is local or empty ("%s"). Sitemap <loc> URLs will not be publicly accessible.',
        rawAppUrl
      );
    }

    const appUrl = rawAppUrl;

    // Only PUBLISHED properties without password protection
    // S3.2: include title so we can generate the canonical slug URL
    const properties = await prisma.property.findMany({
      where: { status: 'PUBLISHED', passwordHash: null },
      select: { id: true, title: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' }
    });

    const propertyUrls = properties.map((p) => {
      // S3.2: use slug URL as canonical so sitemap matches og:url and <link rel="canonical">
      const slug = slugify(p.title);
      const path = slug ? `/property/${p.id}/${slug}` : `/property/${p.id}`;
      const loc = escapeXml(`${appUrl}${path}`);
      const lastmod = p.updatedAt.toISOString().slice(0, 10);
      return `  <url><loc>${loc}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`;
    });

    const homeUrl = escapeXml(`${appUrl}/`);

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      `  <url><loc>${homeUrl}</loc><changefreq>monthly</changefreq><priority>1.0</priority></url>`,
      ...propertyUrls,
      '</urlset>'
    ].join('\n');

    res
      .header('Content-Type', 'application/xml; charset=utf-8')
      .header('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
      .send(xml);
  } catch (err) {
    console.error('[sitemap] Error generating sitemap:', err instanceof Error ? err.message : err);
    res
      .status(500)
      .header('Content-Type', 'application/xml; charset=utf-8')
      .send('<?xml version="1.0" encoding="UTF-8"?><error>Sitemap temporalmente no disponible</error>');
  }
});

app.use(notFoundHandler);
app.use(errorHandler);

async function startServer(): Promise<void> {
  await prisma.$connect();
  app.listen(env.PORT, () => {
    process.stdout.write('Immersphere Pro API escuchando en http://localhost:' + env.PORT + '\n');
  });
}

async function shutdown(): Promise<void> {
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', () => { shutdown().catch(() => process.exit(1)); });
process.on('SIGTERM', () => { shutdown().catch(() => process.exit(1)); });

startServer().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Error desconocido al iniciar servidor.';
  process.stderr.write(message + '\n');
  process.exit(1);
});

