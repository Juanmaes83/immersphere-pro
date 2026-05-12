import { Router, type NextFunction, type Request, type Response } from 'express';
import * as authController from '../controllers/auth.controller.js';

export const authRoutes = Router();

type AsyncController = (request: Request, response: Response) => Promise<void>;

function asyncHandler(controller: AsyncController) {
  return (request: Request, response: Response, next: NextFunction): void => {
    controller(request, response).catch(next);
  };
}

authRoutes.post('/register', asyncHandler(authController.register));
authRoutes.post('/login', asyncHandler(authController.login));
authRoutes.post('/refresh', asyncHandler(authController.refresh));

