import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { env } from './config/env.js';
import { authRoutes } from './routes/auth.routes.js';
import { propertiesRoutes } from './routes/properties.routes.js';
import { subscriptionRoutes } from './routes/subscription.routes.js';
import { analyticsRoutes } from './routes/analytics.routes.js';
import { tenantsRoutes } from './routes/tenants.routes.js';
import { uploadsRoutes } from './routes/uploads.routes.js';
import { webhookRoutes } from './routes/webhook.routes.js';
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

  if (/^https:\/\/immersphere.*\.vercel\.app$/.test(origin)) return true;

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

app.use('/api/auth', authRoutes);
app.use('/api/properties', propertiesRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/tenants', tenantsRoutes);

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

