import rateLimit from 'express-rate-limit';

export const leadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Demasiadas solicitudes. Inténtalo de nuevo en 15 minutos.'
  }
});

export const analyticsRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Demasiadas solicitudes de analytics. Inténtalo más tarde.'
  }
});

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Demasiados intentos de autenticación. Inténtalo de nuevo en 15 minutos.'
  }
});

export const unlockRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Demasiados intentos de contraseña. Inténtalo de nuevo en 15 minutos.'
  }
});

export const viewRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Demasiadas peticiones de vista.'
  }
});
