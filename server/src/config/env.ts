import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const jwtExpiresInSchema = z.union([
  z.literal('15m'),
  z.literal('30m'),
  z.literal('1h'),
  z.literal('1d')
]);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria.'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET debe tener al menos 32 caracteres.'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET debe tener al menos 32 caracteres.'),
  JWT_ACCESS_EXPIRES_IN: jwtExpiresInSchema.default('15m'),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().positive().default(30),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12)
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  throw new Error(`Variables de entorno inválidas: ${parsedEnv.error.message}`);
}

export const env = parsedEnv.data;
