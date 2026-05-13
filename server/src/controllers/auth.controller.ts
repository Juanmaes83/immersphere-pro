import type { Request, Response } from 'express';
import { z } from 'zod';
import * as authService from '../services/auth.service.js';

const registerSchema = z.object({
  tenantName: z.string().trim().min(2, 'El nombre del tenant debe tener al menos 2 caracteres.'),
  email: z.string().trim().email('El email no tiene un formato válido.'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
  name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres.')
});

const loginSchema = z.object({
  email: z.string().trim().email('El email no tiene un formato válido.'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.')
});

const refreshSchema = z.object({
  refreshToken: z.string().min(32, 'Refresh token inválido.')
});

export async function register(request: Request, response: Response): Promise<void> {
  const input = registerSchema.parse(request.body);
  const data = await authService.register(input);

  response.status(201).json({
    success: true,
    data
  });
}

export async function login(request: Request, response: Response): Promise<void> {
  const input = loginSchema.parse(request.body);
  const data = await authService.login(input);

  response.status(200).json({
    success: true,
    data
  });
}

export async function refresh(request: Request, response: Response): Promise<void> {
  const input = refreshSchema.parse(request.body);
  const data = await authService.refresh(input);

  response.status(200).json({
    success: true,
    data
  });
}

