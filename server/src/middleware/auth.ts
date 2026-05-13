import type { NextFunction, Request, Response } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from './errorHandler.js';

export type Role = 'SUPERADMIN' | 'TENANTADMIN' | 'AGENT' | 'CLIENT' | 'VISITOR';

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        tenantId: string;
        role: Role;
      };
    }
  }
}

interface AccessTokenPayload extends JwtPayload {
  sub: string;
  tenantId: string;
  role: Role;
}

function isAccessTokenPayload(payload: string | JwtPayload): payload is AccessTokenPayload {
  return (
    typeof payload !== 'string' &&
    typeof payload.sub === 'string' &&
    typeof payload.tenantId === 'string' &&
    typeof payload.role === 'string'
  );
}

export function requireAuth(request: Request, _response: Response, next: NextFunction): void {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith('Bearer ')) {
    next(new AppError(401, 'Token de acceso no proporcionado.'));
    return;
  }

  const accessToken = authorization.replace('Bearer ', '').trim();

  try {
    const payload = jwt.verify(accessToken, env.JWT_ACCESS_SECRET);

    if (!isAccessTokenPayload(payload)) {
      next(new AppError(401, 'Token de acceso inválido.'));
      return;
    }

    request.auth = {
      userId: payload.sub,
      tenantId: payload.tenantId,
      role: payload.role
    };

    next();
  } catch {
    next(new AppError(401, 'Token de acceso expirado o inválido.'));
  }
}

