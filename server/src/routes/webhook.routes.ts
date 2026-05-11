import express, { Router } from 'express';
import { handleStripeWebhookController } from '../controllers/subscription.controller';

export const webhookRoutes = Router();
webhookRoutes.post('/stripe', express.raw({ type: 'application/json' }), handleStripeWebhookController);
