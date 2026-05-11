import { prisma } from '../index';
import { prisma } from '../index.js';
import { AppError } from '../middleware/errorHandler.js';

interface TenantSettingsInput {
  name: string;
  logoText: string;
  primaryColor: string;
}

export async function getTenantSettings(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { subscription: true }
  });

  if (!tenant) {
    throw new AppError(404, 'Tenant no encontrado.');
  }

  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    logoText: tenant.logoText,
    primaryColor: tenant.primaryColor,
    plan: tenant.plan,
    subscription: tenant.subscription
  };
}

export async function updateTenantSettings(tenantId: string, input: TenantSettingsInput) {
  const tenant = await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      name: input.name,
      logoText: input.logoText,
      primaryColor: input.primaryColor
    },
    include: { subscription: true }
  });

  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    logoText: tenant.logoText,
    primaryColor: tenant.primaryColor,
    plan: tenant.plan as Plan,
    subscription: tenant.subscription
  };
}
