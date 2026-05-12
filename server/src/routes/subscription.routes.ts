import { Router } from 'express';
import { createCheckoutSessionController, createCustomerPortalController, getCurrentSubscriptionController } from '../controllers/subscription.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const subscriptionRoutes = Router();
subscriptionRoutes.get('/current', requireAuth, getCurrentSubscriptionController);
subscriptionRoutes.post('/create-checkout', requireAuth, createCheckoutSessionController);
subscriptionRoutes.post('/portal', requireAuth, createCustomerPortalController);

