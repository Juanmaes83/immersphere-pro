import type { Request, Response } from 'express';
import { buildPropertyTourZip } from '../services/tour.service.js';

export async function exportPropertyTourController(request: Request, response: Response): Promise<void> {
  const { propertyId } = request.params;
  const tenantId = request.auth!.tenantId;

  const result = await buildPropertyTourZip(tenantId, propertyId);

  if (!result) {
    response.status(404).json({ success: false, error: 'No se encontró un asset Gaussian Splat en esta propiedad.' });
    return;
  }

  response.setHeader('Content-Type', 'application/zip');
  response.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
  response.setHeader('Content-Length', result.buffer.length);
  response.end(result.buffer);
}
