import { Router } from 'express';
import {
  createViewerEventController,
  getPropertySummaryController
} from '../controllers/analytics.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const analyticsRoutes = Router();

analyticsRoutes.post('/events', createViewerEventController);
analyticsRoutes.get('/properties/:propertyId/summary', requireAuth, getPropertySummaryController);
