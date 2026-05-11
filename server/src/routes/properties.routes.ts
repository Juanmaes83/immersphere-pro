import { Router } from 'express';
import {
  listProperties,
  getPropertyById,
  createProperty,
  updateProperty,
  deleteProperty
} from '../controllers/properties.controller';
import { requireAuth } from '../middleware/auth';
import { enforcePropertyLimit } from '../middleware/planLimits';

export const propertiesRoutes = Router();

propertiesRoutes.get('/', listProperties);
propertiesRoutes.get('/:id', getPropertyById);
propertiesRoutes.post('/', requireAuth, enforcePropertyLimit, createProperty);
propertiesRoutes.put('/:id', requireAuth, updateProperty);
propertiesRoutes.delete('/:id', requireAuth, deleteProperty);