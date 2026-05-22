// LOCAL STRING ENUMS AUTH START
type Plan = string;
const Plan = {
  STARTER: "STARTER",
  PROFESSIONAL: "PROFESSIONAL",
  ENTERPRISE: "ENTERPRISE"
} as const;

type Role = string;
const Role = {
  SUPERADMIN: "SUPERADMIN",
  TENANTADMIN: "TENANTADMIN",
  AGENT: "AGENT",
  VIEWER: "VIEWER"
} as const;

type SubscriptionStatus = string;
const SubscriptionStatus = {
  TRIAL: "TRIAL",
  ACTIVE: "ACTIVE",
  PAST_DUE: "PAST_DUE",
  CANCELED: "CANCELED",
  EXPIRED: "EXPIRED"
} as const;
// LOCAL STRING ENUMS AUTH END
import { prisma } from '../index.js';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';

interface RegisterInput {
  tenantName: string;
  email: string;
  password: string;
  name: string;
}

interface LoginInput {
  email: string;
  password: string;
}

interface RefreshInput {
  refreshToken: string;
}

interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
  role: Role;
  tenant: {
    id: string;
    name: string;
    slug: string;
    logoText: string;
    primaryColor: string;
    plan: Plan;
  };
}

interface AuthResponse {
  user: AuthenticatedUser;
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

function slugify(value: string): string {
  const slug = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug.length > 0 ? slug : 'tenant';
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function serializeUser(user: {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
  role: Role;
  tenant: {
    id: string;
    name: string;
    slug: string;
    logoText: string;
    primaryColor: string;
    plan: Plan;
  };
}): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    role: user.role,
    tenant: {
      id: user.tenant.id,
      name: user.tenant.name,
      slug: user.tenant.slug,
      logoText: user.tenant.logoText,
      primaryColor: user.tenant.primaryColor,
      plan: user.tenant.plan
    }
  };
}

async function createUniqueTenantSlug(tenantName: string): Promise<string> {
  const baseSlug = slugify(tenantName);
  const existingTenant = await prisma.tenant.findUnique({ where: { slug: baseSlug } });

  if (!existingTenant) return baseSlug;

  return `${baseSlug}-${crypto.randomBytes(3).toString('hex')}`;
}

function createAccessToken(user: { id: string; tenantId: string; role: Role }): string {
  const options: SignOptions = {
    subject: user.id,
    expiresIn: env.JWT_ACCESS_EXPIRES_IN
  };

  return jwt.sign(
    {
      tenantId: user.tenantId,
      role: user.role
    },
    env.JWT_ACCESS_SECRET,
    options
  );
}

async function createTokenPair(user: { id: string; tenantId: string; role: Role }): Promise<AuthResponse['tokens']> {
  const accessToken = createAccessToken(user);
  const refreshToken = crypto.randomBytes(64).toString('hex');
  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      tokenHash,
      userId: user.id,
      tenantId: user.tenantId,
      expiresAt
    }
  });

  return { accessToken, refreshToken };
}

// ─────────────────────────────────────────────────────────────────────────────
// Demo property seed — se llama tras el registro para que el nuevo tenant
// tenga una propiedad de ejemplo funcional con 5 panoramas 360°.
// Fallo silencioso: si algo falla, el usuario ya está registrado y logueado.
// ─────────────────────────────────────────────────────────────────────────────
const DEMO_CDN = 'https://d8j0ntlcm91z4.cloudfront.net/user_32tIBn1VWPFRvRlTsdl6JD8uoae/';
const DEMO_PANORAMAS = {
  entrada:    `${DEMO_CDN}hf_20260519_065419_c846af98-8c61-4ea9-ba78-e3b3b7f81b84.png`,
  salon:      `${DEMO_CDN}hf_20260519_071439_c326a27b-7139-4e2a-9a23-0f498086c353.png`,
  cocina:     `${DEMO_CDN}hf_20260519_065854_8f2cf8c6-be3f-46f4-98ca-7e30610122b8.png`,
  dormitorio: `${DEMO_CDN}hf_20260519_065953_2ad41767-3adc-423c-9b45-7512e671a623.png`,
  terraza:    `${DEMO_CDN}hf_20260519_070109_6a94d0f4-93d3-400a-af08-1e17114e8fdb.png`,
};
const DEMO_COVER = `${DEMO_CDN}hf_20260519_070355_e40cedac-0bf1-402d-bca4-0556062e3aeb_min.webp`;

async function seedDemoPropertyForTenant(tenantId: string): Promise<void> {
  try {
    // 1. Propiedad
    const property = await prisma.property.create({
      data: {
        tenantId,
        title:       'Ático Lumière — Ejemplo de tour inmersivo',
        description: 'Esta propiedad es un ejemplo incluido en tu cuenta. Explora el viewer, los hotspots y el plano interactivo. Puedes editarla o eliminarla cuando quieras.',
        type:        'APARTMENT',
        status:      'PUBLISHED',
        price:       485000,
        area:        127,
        rooms:       3,
        bathrooms:   2,
        address:     'Barcelona, Catalunya',
        coverImage:  DEMO_COVER,
      },
    });

    // 2. Espacios en orden
    const spaceDefs = [
      { key: 'entrada',    name: 'Entrada',     order: 1, guidedDuration: 8,  storySubheadline: 'Cada mañana empieza aquí.',                storyHighlight: 'El umbral que marca el ritmo del día.',       ctaLabel: 'Explorar disponibilidad', ctaSubtext: 'Sin compromiso · respuesta en 24h',     floorplanPin: { x: 22, y: 48 } },
      { key: 'salon',      name: 'Salón',        order: 2, guidedDuration: 14, storySubheadline: 'La conversación siempre empieza aquí.',      storyHighlight: 'Luz natural todo el día.',                    ctaLabel: 'Hablar con el asesor',    ctaSubtext: 'Disponible ahora · sin esperas',        floorplanPin: { x: 45, y: 42 } },
      { key: 'cocina',     name: 'Cocina',       order: 3, guidedDuration: 9,  storySubheadline: 'La conversación acaba siempre aquí.',        storyHighlight: 'Diseñada para cocinar y quedarse.',           ctaLabel: 'Solicitar dossier',       ctaSubtext: 'PDF completo · enviado al instante',    floorplanPin: { x: 68, y: 38 } },
      { key: 'dormitorio', name: 'Dormitorio',   order: 4, guidedDuration: 11, storySubheadline: 'El silencio también forma parte del espacio.', storyHighlight: 'Orientación este. La primera luz sin alarma.', ctaLabel: 'Solicitar dossier completo', ctaSubtext: 'Memoria de calidades incluida',        floorplanPin: { x: 72, y: 65 } },
      { key: 'terraza',    name: 'Terraza',      order: 5, guidedDuration: 18, storySubheadline: 'La ciudad desde otro ritmo.',                storyHighlight: '38m² sobre Barcelona.',                       ctaLabel: 'Solicitar visita presencial', ctaSubtext: 'Agenda en 2 min · sin desplazamiento', floorplanPin: { x: 48, y: 75 } },
    ];

    const spaceIds: Record<string, string> = {};
    for (const def of spaceDefs) {
      const space = await prisma.space.create({
        data: {
          propertyId:       property.id,
          name:             def.name,
          order:            def.order,
          status:           'ACTIVE',
          guidedDuration:   def.guidedDuration,
          storySubheadline: def.storySubheadline,
          storyHighlight:   def.storyHighlight,
          ctaLabel:         def.ctaLabel,
          ctaSubtext:       def.ctaSubtext,
          floorplanPin:     def.floorplanPin,
        },
      });
      spaceIds[def.key] = space.id;
    }

    // 3. Assets + hotspots por espacio
    const assetDefs: Array<{
      key: string;
      hotspots: Array<{ label: string; type: string; position: { x: number; y: number }; targetKey: string | null }>;
    }> = [
      { key: 'entrada',    hotspots: [{ label: 'Salón',   type: 'navigation', position: { x: 38, y: 68 }, targetKey: 'salon'   }, { label: 'Terraza', type: 'navigation', position: { x: 62, y: 68 }, targetKey: 'terraza' }] },
      { key: 'salon',      hotspots: [{ label: 'Cocina',  type: 'navigation', position: { x: 35, y: 70 }, targetKey: 'cocina'  }, { label: 'Dormitorio', type: 'navigation', position: { x: 65, y: 70 }, targetKey: 'dormitorio' }] },
      { key: 'cocina',     hotspots: [{ label: 'Salón',   type: 'navigation', position: { x: 38, y: 70 }, targetKey: 'salon'   }, { label: 'Terraza', type: 'navigation', position: { x: 62, y: 62 }, targetKey: 'terraza' }] },
      { key: 'dormitorio', hotspots: [{ label: 'Terraza', type: 'navigation', position: { x: 50, y: 68 }, targetKey: 'terraza' }] },
      { key: 'terraza',    hotspots: [{ label: 'Solicitar visita', type: 'cta', position: { x: 50, y: 72 }, targetKey: null }, { label: 'Entrada', type: 'navigation', position: { x: 30, y: 62 }, targetKey: 'entrada' }] },
    ];

    for (const def of assetDefs) {
      const panoramaUrl = DEMO_PANORAMAS[def.key as keyof typeof DEMO_PANORAMAS];
      const asset = await prisma.asset.create({
        data: {
          spaceId:   spaceIds[def.key],
          type:      'panorama_360',
          url:       panoramaUrl,
          thumbnail: panoramaUrl,
          format:    'png',
          size:      0,
        },
      });

      for (const h of def.hotspots) {
        await prisma.hotspot.create({
          data: {
            assetId:       asset.id,
            label:         h.label,
            type:          h.type,
            position:      JSON.stringify(h.position),
            body:          '',
            metric:        '',
            ...(h.targetKey ? { targetSpaceId: spaceIds[h.targetKey] } : {}),
          },
        });
      }
    }
  } catch (error) {
    // Seed silencioso — el registro ya fue exitoso, no bloqueamos al usuario
    console.warn('[seed-demo] No se pudo crear la propiedad demo:', (error as Error).message);
  }
}

export async function register(input: RegisterInput): Promise<AuthResponse> {
  const normalizedEmail = input.email.toLowerCase();
  const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (existingUser) {
    throw new AppError(409, 'Ya existe un usuario con ese email.');
  }

  const slug = await createUniqueTenantSlug(input.tenantName);
  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_SALT_ROUNDS);
  const logoText = input.tenantName.slice(0, 2).toUpperCase() || 'IP';

  const user = await prisma.$transaction(async (transaction: any) => {
    const tenant = await transaction.tenant.create({
      data: {
        name: input.tenantName,
        slug,
        logoText,
        primaryColor: '#7C3AED',
        plan: Plan.STARTER
      }
    });

    await transaction.subscription.create({
      data: {
        tenantId: tenant.id,
        plan: Plan.STARTER,
        status: SubscriptionStatus.TRIAL
      }
    });

    return transaction.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name: input.name,
        role: Role.TENANTADMIN,
        tenantId: tenant.id
      },
      include: {
        tenant: true
      }
    });
  });

  // Seed demo property en background — fallo silencioso
  void seedDemoPropertyForTenant(user.tenant.id);

  const tokens = await createTokenPair(user);

  return {
    user: serializeUser(user),
    tokens
  };
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
    include: { tenant: true }
  });

  if (!user) {
    throw new AppError(401, 'Email o contraseña incorrectos.');
  }

  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);

  if (!passwordMatches) {
    throw new AppError(401, 'Email o contraseña incorrectos.');
  }

  const tokens = await createTokenPair(user);

  return {
    user: serializeUser(user),
    tokens
  };
}

export async function refresh(input: RefreshInput): Promise<AuthResponse> {
  const tokenHash = hashToken(input.refreshToken);
  const storedToken = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: {
      user: {
        include: {
          tenant: true
        }
      }
    }
  });

  if (!storedToken || storedToken.revokedAt || storedToken.expiresAt <= new Date()) {
    throw new AppError(401, 'Refresh token inválido o expirado.');
  }

  await prisma.refreshToken.update({
    where: { id: storedToken.id },
    data: { revokedAt: new Date() }
  });

  const tokens = await createTokenPair(storedToken.user);

  return {
    user: serializeUser(storedToken.user),
    tokens
  };
}



