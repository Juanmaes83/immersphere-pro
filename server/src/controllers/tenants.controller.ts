import type { Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler.js';
import * as tenantsService from '../services/tenants.service.js';

const tenantSettingsSchema = z.object({
  name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres.'),
  logoText: z.string().trim().min(1).max(3, 'El logoText debe tener máximo 3 caracteres.').transform((value) => value.toUpperCase()),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'El color primario debe ser HEX, ejemplo #7C3AED.')
});

export async function getTenantSettings(request: Request, response: Response): Promise<void> {
  if (!request.auth) {
    throw new AppError(401, 'Usuario no autenticado.');
  }

  const data = await tenantsService.getTenantSettings(request.auth.tenantId);

  response.status(200).json({
    success: true,
    data
  });
}

export async function updateTenantSettings(request: Request, response: Response): Promise<void> {
  if (!request.auth) {
    throw new AppError(401, 'Usuario no autenticado.');
  }

  const input = tenantSettingsSchema.parse(request.body);
  const data = await tenantsService.updateTenantSettings(request.auth.tenantId, input);

  response.status(200).json({
    success: true,
    data
  });
}
