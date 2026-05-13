import { Router } from 'express';
import {
  createLeadController,
  getPropertyLeadsController
} from '../controllers/leads.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const leadsRoutes = Router();

leadsRoutes.post('/', createLeadController);
leadsRoutes.get('/properties/:propertyId', requireAuth, getPropertyLeadsController);
