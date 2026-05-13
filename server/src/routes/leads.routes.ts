import { Router } from 'express';
import {
  createLeadController,
  exportPropertyLeadsCsvController,
  getPropertyLeadsController,
  getAllLeadsController,
  exportAllLeadsCsvController,
  getLeadsCountController
} from '../controllers/leads.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { leadRateLimit } from '../middleware/rateLimit.js';

export const leadsRoutes = Router();

leadsRoutes.post('/', leadRateLimit, createLeadController);
leadsRoutes.get('/count', requireAuth, getLeadsCountController);
leadsRoutes.get('/', requireAuth, getAllLeadsController);
leadsRoutes.get('/export.csv', requireAuth, exportAllLeadsCsvController);
leadsRoutes.get('/properties/:propertyId', requireAuth, getPropertyLeadsController);
leadsRoutes.get('/properties/:propertyId/export.csv', requireAuth, exportPropertyLeadsCsvController);
