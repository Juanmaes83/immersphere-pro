import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../middleware/errorHandler.js';
import {
  getTenantSettings,
  getTenantUsage,
  updateTenantSettings
} from '../services/tenants.service.js';

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

