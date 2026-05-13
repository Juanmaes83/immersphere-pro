import {
  Router, type Request, type Response } from 'express';
import {
  listProperties,
  getPropertyById,
  unlockProperty,
  createProperty,
  updateProperty,
  deleteProperty,
  listPropertySpaces,
  createPropertySpace,
  updatePropertySpace,
  deletePropertySpace,
  listSpaceAssets,
  createSpaceAsset,
  updateSpaceAsset,
  deleteSpaceAsset
} from '../controllers/properties.controller.js';
import { exportPropertyTourController } from '../controllers/tour.controller.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { enforcePropertyLimit } from '../middleware/planLimits.js';
import { env } from '../config/env.js';
import { prisma } from '../index.js';

export const propertiesRoutes = Router();

// Public embed endpoint — CORS open for third-party iframes
propertiesRoutes.get('/:propertyId/embed', async (req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { propertyId } = req.params;
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true, title: true, status: true }
  });
  if (!property || property.status !== 'PUBLISHED') {
    res.status(404).json({ success: false, error: 'Propiedad no encontrada o no publicada.' });
    return;
  }
  const appUrl = env.APP_URL.replace(/\/$/, '');
  const embedUrl = `${appUrl}/embed/${propertyId}`;
  const iframeCode = `<iframe src="${embedUrl}" width="100%" height="600" frameborder="0" allow="fullscreen" loading="lazy" title="${property.title}"></iframe>`;
  res.status(200).json({ success: true, data: { embedUrl, iframeCode, propertyTitle: property.title } });
});

propertiesRoutes.get('/', requireAuth, listProperties);
propertiesRoutes.post('/', requireAuth, enforcePropertyLimit, createProperty);

propertiesRoutes.get('/:propertyId/export-tour', requireAuth, exportPropertyTourController);

propertiesRoutes.get('/:propertyId/spaces', requireAuth, listPropertySpaces);
propertiesRoutes.post('/:propertyId/spaces', requireAuth, createPropertySpace);
propertiesRoutes.put('/:propertyId/spaces/:spaceId', requireAuth, updatePropertySpace);
propertiesRoutes.delete('/:propertyId/spaces/:spaceId', requireAuth, deletePropertySpace);

propertiesRoutes.get('/:propertyId/spaces/:spaceId/assets', requireAuth, listSpaceAssets);
propertiesRoutes.post('/:propertyId/spaces/:spaceId/assets', requireAuth, createSpaceAsset);
propertiesRoutes.put('/:propertyId/spaces/:spaceId/assets/:assetId', requireAuth, updateSpaceAsset);
propertiesRoutes.delete('/:propertyId/spaces/:spaceId/assets/:assetId', requireAuth, deleteSpaceAsset);

propertiesRoutes.get('/:id', optionalAuth, getPropertyById);
propertiesRoutes.post('/:id/unlock', unlockProperty);
propertiesRoutes.put('/:id', requireAuth, updateProperty);
propertiesRoutes.delete('/:id', requireAuth, deleteProperty);
