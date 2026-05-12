import express, { Router } from 'express';
import { handleStripeWebhookController } from '../controllers/subscription.controller.js';

export const webhookRoutes = Router();
webhookRoutes.post('/stripe', express.raw({ type: 'application/json' }), handleStripeWebhookController);

