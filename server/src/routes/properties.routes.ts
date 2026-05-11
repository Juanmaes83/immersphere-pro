import { Router, type NextFunction, type Request, type Response } from 'express';
import * as propertiesController from '../controllers/properties.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const propertiesRoutes = Router();

type AsyncController = (request: Request, response: Response) => Promise<void>;

function asyncHandler(controller: AsyncController) {
  return (request: Request, response: Response, next: NextFunction): void => {
    controller(request, response).catch(next);
  };
}

propertiesRoutes.get('/', asyncHandler(propertiesController.listProperties));
propertiesRoutes.get('/:id', asyncHandler(propertiesController.getPropertyById));
propertiesRoutes.post('/', requireAuth, asyncHandler(propertiesController.createProperty));
propertiesRoutes.put('/:id', requireAuth, asyncHandler(propertiesController.updateProperty));
propertiesRoutes.delete('/:id', requireAuth, asyncHandler(propertiesController.deleteProperty));
