import { Router } from 'express';
import {
  listProperties,
  getPropertyById,
  createProperty,
  updateProperty,
  deleteProperty,
  listPropertySpaces,
  createPropertySpace,
  updatePropertySpace,
  deletePropertySpace
} from '../controllers/properties.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { enforcePropertyLimit } from '../middleware/planLimits.js';

export const propertiesRoutes = Router();

propertiesRoutes.get('/', requireAuth, listProperties);
propertiesRoutes.post('/', requireAuth, enforcePropertyLimit, createProperty);

propertiesRoutes.get('/:propertyId/spaces', requireAuth, listPropertySpaces);
propertiesRoutes.post('/:propertyId/spaces', requireAuth, createPropertySpace);
propertiesRoutes.put('/:propertyId/spaces/:spaceId', requireAuth, updatePropertySpace);
propertiesRoutes.delete('/:propertyId/spaces/:spaceId', requireAuth, deletePropertySpace);

propertiesRoutes.get('/:id', requireAuth, getPropertyById);
propertiesRoutes.put('/:id', requireAuth, updateProperty);
propertiesRoutes.delete('/:id', requireAuth, deleteProperty);
