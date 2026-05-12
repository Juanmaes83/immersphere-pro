import { prisma } from '../index.js';
import { Prisma } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env.js';

export class AppError extends Error {
  public readonly statusCode: number;

  public constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
  }
}

export function notFoundHandler(request: Request, response: Response): void {
  response.status(404).json({
    success: false,
    error: `Ruta no encontrada: ${request.method} ${request.originalUrl}`
  });
}

export function errorHandler(
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction
): void {
  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      success: false,
      error: error.message
    });
    return;
  }

  if (error instanceof ZodError) {
    response.status(400).json({
      success: false,
      error: error.issues.map((issue) => issue.message).join(' ')
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const message = error.code === 'P2002' ? 'Ya existe un registro con esos datos Ãºnicos.' : 'Error de base de datos.';
    response.status(400).json({
      success: false,
      error: message
    });
    return;
  }

  const fallbackMessage = env.NODE_ENV === 'development' && error instanceof Error
    ? error.message
    : 'Error interno del servidor.';

  response.status(500).json({
    success: false,
    error: fallbackMessage
  });
}

