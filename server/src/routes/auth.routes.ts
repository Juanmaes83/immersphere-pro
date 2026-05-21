import { Router, type NextFunction, type Request, type Response } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { authRateLimit } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/auth.js';

export const authRoutes = Router();

type AsyncController = (request: Request, response: Response) => Promise<void>;

function asyncHandler(controller: AsyncController) {
  return (request: Request, response: Response, next: NextFunction): void => {
    controller(request, response).catch(next);
  };
}

authRoutes.post('/register', authRateLimit, asyncHandler(authController.register));
authRoutes.post('/login', authRateLimit, asyncHandler(authController.login));
authRoutes.post('/refresh', asyncHandler(authController.refresh));
authRoutes.patch('/me/avatar', requireAuth, asyncHandler(authController.updateAvatar));

