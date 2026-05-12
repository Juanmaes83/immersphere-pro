import { Router } from 'express';
import {
  getTenantSettingsController,
  getTenantUsageController,
  updateTenantSettingsController
} from '../controllers/tenants.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const tenantsRoutes = Router();

tenantsRoutes.get('/settings', requireAuth, getTenantSettingsController);
tenantsRoutes.put('/settings', requireAuth, updateTenantSettingsController);
tenantsRoutes.get('/usage', requireAuth, getTenantUsageController);

