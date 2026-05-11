import { Router } from 'express';
import { createCheckoutSessionController, createCustomerPortalController, getCurrentSubscriptionController } from '../controllers/subscription.controller';
import { requireAuth } from '../middleware/auth';

export const subscriptionRoutes = Router();
subscriptionRoutes.get('/current', requireAuth, getCurrentSubscriptionController);
subscriptionRoutes.post('/create-checkout', requireAuth, createCheckoutSessionController);
subscriptionRoutes.post('/portal', requireAuth, createCustomerPortalController);
