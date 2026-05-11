import { Router, type NextFunction, type Request, type Response } from 'express';
import * as tenantsController from '../controllers/tenants.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const tenantsRoutes = Router();

type AsyncController = (request: Request, response: Response) => Promise<void>;

function asyncHandler(controller: AsyncController) {
  return (request: Request, response: Response, next: NextFunction): void => {
    controller(request, response).catch(next);
  };
}

tenantsRoutes.get('/settings', requireAuth, asyncHandler(tenantsController.getTenantSettings));
tenantsRoutes.put('/settings', requireAuth, asyncHandler(tenantsController.updateTenantSettings));
