import { prisma } from '../index.js';
type Plan = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED';

export interface TenantSettingsUpdateInput {
  name?: string;
  logoText?: string;
  logoUrl?: string;
  primaryColor?: string;
  webhookUrl?: string;
}

export interface TenantPlanUpdateInput {
  plan: string;
  subscriptionStatus?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

function normalizePlan(value?: string): Plan {
  const normalized = (value || 'STARTER').toUpperCase();
  const allowed: Plan[] = ['STARTER', 'PROFESSIONAL', 'ENTERPRISE'];

  return allowed.includes(normalized as Plan) ? (normalized as Plan) : 'STARTER';
}

function normalizeSubscriptionStatus(value?: string): SubscriptionStatus {
  const normalized = (value || 'TRIAL').toUpperCase();
  const allowed: SubscriptionStatus[] = ['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED'];

  return allowed.includes(normalized as SubscriptionStatus)
    ? (normalized as SubscriptionStatus)
    : 'TRIAL';
}

function getPropertyLimitByPlan(plan: string): number {
  const normalizedPlan = normalizePlan(plan);

  if (normalizedPlan === 'ENTERPRISE') {
    return Number.MAX_SAFE_INTEGER;
  }

  if (normalizedPlan === 'PROFESSIONAL') {
    return 50;
  }

  return 10;
}

function normalizeLogoText(value: string | undefined, fallback: string): string {
  const normalized = value?.trim().slice(0, 3).toUpperCase();

  return normalized || fallback || 'IP';
}

function normalizePrimaryColor(value: string | undefined, fallback: string): string {
  if (!value) {
    return fallback || '#7C3AED';
  }

  const isHex = /^#[0-9A-Fa-f]{6}$/.test(value.trim());

  return isHex ? value.trim() : fallback || '#7C3AED';
}

function serializeTenantSettings(tenant: {
  id: string;
  name: string;
  slug: string;
  logoText: string;
  logoUrl: string;
  primaryColor: string;
  webhookUrl: string;
  plan: string;
  createdAt: Date;
  subscription: {
    id: string;
    stripeCustomerId: string;
    stripeSubscriptionId: string;
    plan: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  } | null;
}) {
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    logoText: tenant.logoText,
    logoUrl: tenant.logoUrl,
    primaryColor: tenant.primaryColor,
    webhookUrl: tenant.webhookUrl,
    plan: tenant.plan,
    createdAt: tenant.createdAt,
    subscription: tenant.subscription
      ? {
          id: tenant.subscription.id,
          stripeCustomerId: tenant.subscription.stripeCustomerId,
          stripeSubscriptionId: tenant.subscription.stripeSubscriptionId,
          plan: tenant.subscription.plan,
          status: tenant.subscription.status,
          createdAt: tenant.subscription.createdAt,
          updatedAt: tenant.subscription.updatedAt
        }
      : null
  };
}

export async function getTenantSettings(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      subscription: true
    }
  });

  if (!tenant) {
    throw new Error('Tenant no encontrado.');
  }

  return serializeTenantSettings(tenant);
}

export async function updateTenantSettings(tenantId: string, input: TenantSettingsUpdateInput) {
  const currentTenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      subscription: true
    }
  });

  if (!currentTenant) {
    throw new Error('Tenant no encontrado.');
  }

  const tenant = await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      name: input.name?.trim() || currentTenant.name,
      logoText: normalizeLogoText(input.logoText, currentTenant.logoText),
      logoUrl: input.logoUrl !== undefined ? input.logoUrl.trim() : currentTenant.logoUrl,
      primaryColor: normalizePrimaryColor(input.primaryColor, currentTenant.primaryColor),
      webhookUrl: input.webhookUrl !== undefined ? input.webhookUrl.trim() : currentTenant.webhookUrl
    },
    include: {
      subscription: true
    }
  });

  return serializeTenantSettings(tenant);
}

export async function updateTenantPlan(tenantId: string, input: TenantPlanUpdateInput) {
  const plan = normalizePlan(input.plan);
  const status = normalizeSubscriptionStatus(input.subscriptionStatus);

  const tenant = await prisma.$transaction(async (tx: any) => {
    await tx.tenant.update({
      where: { id: tenantId },
      data: {
        plan
      }
    });

    await tx.subscription.upsert({
      where: { tenantId },
      create: {
        tenantId,
        stripeCustomerId: input.stripeCustomerId ?? '',
        stripeSubscriptionId: input.stripeSubscriptionId ?? '',
        plan,
        status
      },
      update: {
        stripeCustomerId: input.stripeCustomerId,
        stripeSubscriptionId: input.stripeSubscriptionId,
        plan,
        status
      }
    });

    return tx.tenant.findUnique({
      where: { id: tenantId },
      include: {
        subscription: true
      }
    });
  });

  if (!tenant) {
    throw new Error('Tenant no encontrado después de actualizar el plan.');
  }

  return serializeTenantSettings(tenant);
}

export async function getTenantPropertyLimit(tenantId: string): Promise<number> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      plan: true
    }
  });

  if (!tenant) {
    throw new Error('Tenant no encontrado.');
  }

  return getPropertyLimitByPlan(tenant.plan);
}

export async function getTenantUsage(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      plan: true
    }
  });

  if (!tenant) {
    throw new Error('Tenant no encontrado.');
  }

  const propertiesUsed = await prisma.property.count({
    where: { tenantId }
  });

  const propertyLimit = getPropertyLimitByPlan(tenant.plan);
  const isUnlimited = propertyLimit === Number.MAX_SAFE_INTEGER;

  return {
    plan: tenant.plan,
    propertiesUsed,
    propertyLimit: isUnlimited ? null : propertyLimit,
    remaining: isUnlimited ? null : Math.max(propertyLimit - propertiesUsed, 0),
    canCreateMore: isUnlimited || propertiesUsed < propertyLimit
  };
}

export const getSettings = getTenantSettings;
export const updateSettings = updateTenantSettings;

export async function getPublicTenantProfile(slug: string) {
  const { AppError } = await import('../middleware/errorHandler.js');

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: {
      name: true,
      slug: true,
      logoText: true,
      logoUrl: true,
      primaryColor: true,
      properties: {
        where: { status: 'PUBLISHED' },
        select: {
          id: true,
          title: true,
          description: true,
          type: true,
          price: true,
          area: true,
          rooms: true,
          bathrooms: true,
          coverImage: true,
          address: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (!tenant) {
    throw new AppError(404, 'Agencia no encontrada.');
  }

  return {
    name: tenant.name,
    slug: tenant.slug,
    logoText: tenant.logoText,
    logoUrl: tenant.logoUrl,
    primaryColor: tenant.primaryColor,
    properties: tenant.properties
  };
}

