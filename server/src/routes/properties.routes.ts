import { Router } from 'express';
import {
  listProperties,
  getPropertyById,
  createProperty,
  updateProperty,
  deleteProperty
} from '../controllers/properties.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { enforcePropertyLimit } from '../middleware/planLimits.js';

export const propertiesRoutes = Router();

propertiesRoutes.get('/', requireAuth, listProperties);
propertiesRoutes.get('/:id', requireAuth, getPropertyById);
propertiesRoutes.post('/', requireAuth, enforcePropertyLimit, createProperty);
propertiesRoutes.put('/:id', requireAuth, updateProperty);
propertiesRoutes.delete('/:id', requireAuth, deleteProperty);
