import { prisma } from '../index.js';

const QUOTA_MB: Record<string, number | null> = {
  STARTER: 1024,
  PROFESSIONAL: 25600,
  ENTERPRISE: null
};

function getQuotaMb(plan: string): number | null {
  return Object.prototype.hasOwnProperty.call(QUOTA_MB, plan.toUpperCase())
    ? QUOTA_MB[plan.toUpperCase()]
    : QUOTA_MB['STARTER'];
}

export async function getTenantStorageUsageMb(tenantId: string): Promise<number> {
  const result = await prisma.asset.aggregate({
    _sum: { size: true },
    where: {
      space: {
        property: {
          tenantId
        }
      }
    }
  });

  return result._sum.size ?? 0;
}

export interface QuotaCheckResult {
  allowed: boolean;
  usedMb: number;
  quotaMb: number | null;
  plan: string;
}

export async function checkTenantStorageQuota(
  tenantId: string,
  incomingMb: number
): Promise<QuotaCheckResult> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true }
  });

  const plan = tenant?.plan ?? 'STARTER';
  const quotaMb = getQuotaMb(plan);
  const usedMb = await getTenantStorageUsageMb(tenantId);

  if (quotaMb === null) {
    return { allowed: true, usedMb, quotaMb, plan };
  }

  return {
    allowed: usedMb + incomingMb <= quotaMb,
    usedMb,
    quotaMb,
    plan
  };
}
