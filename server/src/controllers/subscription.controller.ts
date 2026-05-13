import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler.js';
import {
  createCheckoutSession,
  createCustomerPortalSession,
  getCurrentSubscription,
  handleStripeWebhook
} from '../services/subscription.service.js';

const createCheckoutSchema = z.object({
  plan: z.string().transform((value) => value.toUpperCase())
});

function getAuthenticatedContext(request: Request): { userId: string; tenantId: string } {
  const userId = request.auth?.userId;
  const tenantId = request.auth?.tenantId;

  if (!userId || !tenantId) {
    throw new AppError(401, 'Autenticación requerida.');
  }

  return { userId, tenantId };
}

export async function getCurrentSubscriptionController(
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { tenantId } = getAuthenticatedContext(request);
    const subscription = await getCurrentSubscription(tenantId);

    response.status(200).json({
      success: true,
      data: subscription
    });
  } catch (error) {
    next(error);
  }
}

export async function createCheckoutSessionController(
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { userId, tenantId } = getAuthenticatedContext(request);
    const parsedBody = createCheckoutSchema.safeParse(request.body);

    if (!parsedBody.success) {
      throw new AppError(400, 'Plan de suscripción inválido.');
    }

    const checkout = await createCheckoutSession({
      tenantId,
      userId,
      plan: parsedBody.data.plan
    });

    response.status(200).json({
      success: true,
      data: checkout
    });
  } catch (error) {
    next(error);
  }
}

export async function createCustomerPortalController(
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { userId, tenantId } = getAuthenticatedContext(request);
    const portal = await createCustomerPortalSession({ tenantId, userId });

    response.status(200).json({
      success: true,
      data: portal
    });
  } catch (error) {
    next(error);
  }
}

export async function handleStripeWebhookController(
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> {
  try {
    const signature = request.headers['stripe-signature'];

    if (typeof signature !== 'string') {
      throw new AppError(400, 'Firma de Stripe no proporcionada.');
    }

    if (!Buffer.isBuffer(request.body)) {
      throw new AppError(400, 'El webhook de Stripe requiere raw body.');
    }

    const result = await handleStripeWebhook(request.body, signature);

    response.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

