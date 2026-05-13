import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../middleware/errorHandler.js';
import {
  getTenantSettings,
  getTenantUsage,
  updateTenantSettings
} from '../services/tenants.service.js';
import { checkTenantStorageQuota } from '../services/quota.service.js';

function getTenantId(request: Request): string {
  const tenantId = request.auth?.tenantId;

  if (!tenantId) {
    throw new AppError(401, 'AutenticaciÃ³n requerida.');
  }

  return tenantId;
}

export async function getTenantSettingsController(
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = getTenantId(request);
    const settings = await getTenantSettings(tenantId);

    response.status(200).json({
      success: true,
      data: settings
    });
  } catch (error) {
    next(error);
  }
}

export async function updateTenantSettingsController(
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = getTenantId(request);
    const settings = await updateTenantSettings(tenantId, request.body);

    response.status(200).json({
      success: true,
      data: settings
    });
  } catch (error) {
    next(error);
  }
}

export async function getTenantUsageController(
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = getTenantId(request);
    const usage = await getTenantUsage(tenantId);

    response.status(200).json({
      success: true,
      data: usage
    });
  } catch (error) {
    next(error);
  }
}

export async function getTenantStorageController(
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = getTenantId(request);
    const quota = await checkTenantStorageQuota(tenantId, 0);
    const isUnlimited = quota.quotaMb === null;
    const percentageUsed = isUnlimited || quota.quotaMb === 0
      ? 0
      : Math.min(100, Math.round((quota.usedMb / quota.quotaMb!) * 100));

    response.status(200).json({
      success: true,
      data: {
        plan: quota.plan,
        usedMb: Math.round(quota.usedMb * 100) / 100,
        limitMb: quota.quotaMb,
        remainingMb: isUnlimited ? null : Math.max(0, Math.round((quota.quotaMb! - quota.usedMb) * 100) / 100),
        percentageUsed,
        isUnlimited
      }
    });
  } catch (error) {
    next(error);
  }
}

