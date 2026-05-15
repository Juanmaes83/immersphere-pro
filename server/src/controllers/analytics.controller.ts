import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../index.js';
import { AppError } from '../middleware/errorHandler.js';
import { createViewerEvent, getPropertyAnalyticsSummary, getTenantAnalyticsSummary } from '../services/analytics.service.js';

const ALLOWED_EVENT_TYPES = new Set([
  'viewer_open',
  'space_change',
  'hotspot_click',
  'viewer_drag',
  'lead_cta',
  'asset_load_error',
  'viewer_whatsapp_click',
  'tour_start',
  'tour_step',
  'tour_complete'
]);

export async function createViewerEventController(
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { propertyId, spaceId, assetId, type, label, payload, sessionId } = request.body;
    let { tenantId } = request.body;

    if (!propertyId || typeof propertyId !== 'string') {
      response.status(400).json({ success: false, error: 'propertyId requerido.' });
      return;
    }
    if (!type || !ALLOWED_EVENT_TYPES.has(type)) {
      response.status(400).json({ success: false, error: `Tipo de evento inválido: ${type}` });
      return;
    }

    if (!tenantId || typeof tenantId !== 'string') {
      const property = await prisma.property.findUnique({
        where: { id: propertyId },
        select: { tenantId: true }
      });
      if (!property) {
        response.status(404).json({ success: false, error: 'Propiedad no encontrada.' });
        return;
      }
      tenantId = property.tenantId;
    }

    await createViewerEvent({
      tenantId,
      propertyId,
      spaceId: spaceId ?? undefined,
      assetId: assetId ?? undefined,
      type,
      label: label ?? undefined,
      payload: payload && typeof payload === 'object' ? payload : undefined,
      sessionId: sessionId ?? undefined
    });

    response.status(201).json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function getPropertySummaryController(
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = request.auth?.tenantId;
    if (!tenantId) {
      throw new AppError(401, 'Autenticación requerida.');
    }

    const { propertyId } = request.params;

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { tenantId: true }
    });

    if (!property || property.tenantId !== tenantId) {
      throw new AppError(404, 'Propiedad no encontrada.');
    }

    const summary = await getPropertyAnalyticsSummary(propertyId);

    response.status(200).json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
}

export async function getTenantSummaryController(
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = request.auth?.tenantId;
    if (!tenantId) {
      throw new AppError(401, 'Autenticación requerida.');
    }

    const summary = await getTenantAnalyticsSummary(tenantId);
    response.status(200).json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
}
