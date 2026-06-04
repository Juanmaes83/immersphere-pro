import "dotenv/config";
import { z } from "zod";

const booleanEnv = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off", ""].includes(normalized)) return false;
  return value;
}, z.boolean());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
  APP_URL: z.string().default("http://localhost:5173"),
  API_URL: z.string().default("http://localhost:4000"),
  DATABASE_URL: z.string().default("file:./dev.db"),
  JWT_ACCESS_SECRET: z.string().default("immersphere_access_secret_dev_change_in_production_64_chars"),
  JWT_REFRESH_SECRET: z.string().default("immersphere_refresh_secret_dev_change_in_production_64_chars"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().positive().default(30),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().positive().default(12),
  STRIPE_SECRET_KEY: z.string().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().default(""),
  STRIPE_PRICE_STARTER: z.string().default(""),
  STRIPE_PRICE_PROFESSIONAL: z.string().default(""),
  STRIPE_PRICE_ENTERPRISE: z.string().default(""),
  CLOUDINARY_CLOUD_NAME: z.string().default(""),
  CLOUDINARY_API_KEY: z.string().default(""),
  CLOUDINARY_API_SECRET: z.string().default(""),
  CLOUDINARY_FOLDER: z.string().default("immersphere-pro"),
  LEAD_NOTIFICATION_WEBHOOK_URL: z.string().default(""),
  RESEND_API_KEY: z.string().default(""),
  RESEND_FROM_EMAIL: z.string().default("noreply@immersphere.io"),
  ANTHROPIC_API_KEY: z.string().default(""),
  ANTHROPIC_MODEL: z.string().default(""),
  CAPTURE_AI_MODEL_TIER: z.enum(["cheap", "balanced", "premium"]).default("cheap"),
  AI_PROCESSING_MAX_ASSETS: z.coerce.number().int().positive().default(10),
  AI_PROCESSING_MAX_RUNS: z.coerce.number().int().positive().default(10),
  CAPTURE_AI_DAILY_RUN_LIMIT_STARTER: z.coerce.number().int().nonnegative().default(5),
  CAPTURE_AI_DAILY_RUN_LIMIT_PRO: z.coerce.number().int().nonnegative().default(30),
  CAPTURE_AI_DAILY_RUN_LIMIT_ENTERPRISE: z.coerce.number().int().nonnegative().default(150),
  CAPTURE_AI_DEFAULT_DAILY_RUN_LIMIT: z.coerce.number().int().nonnegative().default(10),
  CAPTURE_AI_COST_INPUT_PER_MILLION_USD: z.coerce.number().nonnegative().default(1),
  CAPTURE_AI_COST_OUTPUT_PER_MILLION_USD: z.coerce.number().nonnegative().default(5),
  CAPTURE_AI_USAGE_WARNING_THRESHOLD: z.coerce.number().min(0).max(1).default(0.8),
  CAPTURE_AI_DISABLE_PROCESSING: booleanEnv.default(false)
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  throw new Error("Variables de entorno invalidas: " + JSON.stringify(parsedEnv.error.format(), null, 2));
}

export type Env = z.infer<typeof envSchema>;
export const env = parsedEnv.data;
