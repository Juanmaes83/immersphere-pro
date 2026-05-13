import { Router } from 'express';
import {
  createLeadController,
  exportPropertyLeadsCsvController,
  getPropertyLeadsController
} from '../controllers/leads.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const leadsRoutes = Router();

leadsRoutes.post('/', createLeadController);
leadsRoutes.get('/properties/:propertyId', requireAuth, getPropertyLeadsController);
leadsRoutes.get('/properties/:propertyId/export.csv', requireAuth, exportPropertyLeadsCsvController);
