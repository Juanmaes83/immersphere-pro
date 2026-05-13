import { Router } from 'express';
import {
  getTenantSettingsController,
  getTenantStorageController,
  getTenantUsageController,
  updateTenantSettingsController,
  getPublicTenantProfileController
} from '../controllers/tenants.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const tenantsRoutes = Router();

tenantsRoutes.get('/public/:slug', getPublicTenantProfileController);
tenantsRoutes.get('/settings', requireAuth, getTenantSettingsController);
tenantsRoutes.put('/settings', requireAuth, updateTenantSettingsController);
tenantsRoutes.get('/usage', requireAuth, getTenantUsageController);
tenantsRoutes.get('/storage', requireAuth, getTenantStorageController);

