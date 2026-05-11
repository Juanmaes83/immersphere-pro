import { prisma } from '../index';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../index.js';
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

export async function register(input: RegisterInput): Promise<AuthResponse> {
  const normalizedEmail = input.email.toLowerCase();
  const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (existingUser) {
    throw new AppError(409, 'Ya existe un usuario con ese email.');
  }

  const slug = await createUniqueTenantSlug(input.tenantName);
  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_SALT_ROUNDS);
  const logoText = input.tenantName.slice(0, 2).toUpperCase() || 'IP';

  const user = await prisma.$transaction(async (transaction) => {
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
