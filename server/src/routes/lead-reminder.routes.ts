import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { sendUnansweredLeadReminders } from '../services/lead-reminder.service.js';

export const leadReminderRoutes = Router();

/**
 * POST /api/lead-reminder/run
 *
 * Triggers the unanswered-lead reminder email batch.
 * Protected: SUPERADMIN only.
 */
leadReminderRoutes.post(
  '/run',
  requireAuth,
  (request: Request, _response: Response, next: NextFunction): void => {
    if (request.auth?.role !== 'SUPERADMIN') {
      next(new AppError(403, 'Acceso restringido a SUPERADMIN.'));
      return;
    }
    next();
  },
  async (_request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await sendUnansweredLeadReminders();
      response.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);
