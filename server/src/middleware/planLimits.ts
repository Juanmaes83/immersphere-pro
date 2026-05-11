import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../index';
import { AppError } from './errorHandler';

function getPropertyLimitByPlan(plan: string): number {
  const normalizedPlan = plan.toUpperCase();
  if (normalizedPlan === 'ENTERPRISE') return Number.MAX_SAFE_INTEGER;
  if (normalizedPlan === 'PROFESSIONAL') return 50;
  return 10;
}

export async function enforcePropertyLimit(
  request: Request,
  _response: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = request.auth?.tenantId;
    if (!tenantId) {
      next(new AppError(401, 'Autenticacion requerida.'));
      return;
    }
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true }
    });
    if (!tenant) {
      next(new AppError(404, 'Tenant no encontrado.'));
      return;
    }
    const propertyLimit = getPropertyLimitByPlan(tenant.plan);
    const propertiesUsed = await prisma.property.count({
      where: { tenantId }
    });
    if (propertiesUsed >= propertyLimit) {
      next(
        new AppError(
          403,
          'Tu plan ' + tenant.plan + ' permite un maximo de ' + propertyLimit + ' propiedades.'
        )
      );
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
}

export { getPropertyLimitByPlan };