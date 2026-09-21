import { z } from 'zod';

const boolFromString = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((v) => v === true || v === 'true' || v === '1');

const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_NAME: z.string().default('beauty'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

const databaseSchema = z.object({
  DATABASE_URL: z.string().url(),
  DATABASE_SSL: boolFromString.default(false),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(20),
});

const redisSchema = z.object({
  REDIS_CACHE_URL: z.string().url(),
  REDIS_QUEUE_URL: z.string().url(),
});

const miniappAuthSchema = z.object({
  JWT_ACCESS_PRIVATE_KEY: z.string().min(1),
  JWT_ACCESS_PUBLIC_KEY: z.string().min(1),
  JWT_ACCESS_TTL_SEC: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL_SEC: z.coerce.number().int().positive().default(2_592_000),
  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
  MAX_BOT_TOKEN: z.string().min(1).optional(),
  MAX_PLATFORM_ENABLED: boolFromString.default(false),
  INITDATA_MAX_AGE_SEC: z.coerce.number().int().positive().default(86400),
});

const staffAuthSchema = z.object({
  STAFF_JWT_SECRET: z.string().min(32),
  STAFF_SESSION_TTL_SEC: z.coerce.number().int().positive().default(28800),
  STAFF_COOKIE_NAME: z.string().default('beauty_staff_session'),
  STAFF_COOKIE_SECURE: boolFromString.default(true),
  STAFF_COOKIE_DOMAIN: z.string().default('beautyadm.loomixx.ru'),
  /** 32-byte key, base64 — encrypts TOTP secrets at rest (AES-256-GCM). */
  TOTP_ENCRYPTION_KEY: z.string().refine((v) => Buffer.from(v, 'base64').length === 32, {
    message: 'must be 32 bytes encoded as base64',
  }),
  STAFF_TOTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  STAFF_LOCKOUT_SEC: z.coerce.number().int().positive().default(900),
});

const piiSchema = z.object({
  /** 32-byte key, base64 — encrypts personal data at rest (152-FZ). */
  PII_ENCRYPTION_KEY: z.string().refine((v) => Buffer.from(v, 'base64').length === 32, {
    message: 'must be 32 bytes encoded as base64',
  }),
});

const httpSchema = z.object({
  API_PORT: z.coerce.number().int().positive().default(3000),
  API_HOST: z.string().default('0.0.0.0'),
  /** Number of trusted reverse proxies in front of the API (Traefik = 1). */
  TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).default(1),
  CORS_MINIAPP_ORIGINS: z.string().default('https://beauty.loomixx.ru'),
  CORS_ADMIN_ORIGINS: z.string().default('https://beautyadm.loomixx.ru'),
  PUBLIC_MINIAPP_URL: z.string().url().default('https://beauty.loomixx.ru'),
  PUBLIC_ADMIN_URL: z.string().url().default('https://beautyadm.loomixx.ru'),
  PUBLIC_API_URL: z.string().url().default('https://beauty.loomixx.ru/api/v1'),
  INTERNAL_API_URL: z.string().url().default('https://beautyadm.loomixx.ru/api/v1'),
});

const paymentsSchema = z.object({
  YOOKASSA_SHOP_ID: z.string().optional(),
  YOOKASSA_SECRET_KEY: z.string().optional(),
  YOOKASSA_WEBHOOK_SECRET: z.string().optional(),
  PAYMENTS_ENABLED: boolFromString.default(false),
});

const storageSchema = z.object({
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default('ru-central1'),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_URL: z.string().url().optional(),
});

const aiSchema = z.object({
  AI_PROVIDER: z.enum(['yandex', 'gigachat', 'noop']).default('noop'),
  YANDEX_GPT_API_KEY: z.string().optional(),
  YANDEX_GPT_FOLDER_ID: z.string().optional(),
  GIGACHAT_CREDENTIALS: z.string().optional(),
});

const centrifugoSchema = z.object({
  CENTRIFUGO_API_URL: z.string().url().optional(),
  CENTRIFUGO_API_KEY: z.string().optional(),
  CENTRIFUGO_TOKEN_SECRET: z.string().optional(),
});

const observabilitySchema = z.object({
  SENTRY_DSN: z.string().url().optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  METRICS_TOKEN: z.string().min(16).optional(),
});

const opsSchema = z.object({
  BACKUP_TRIGGER_URL: z.string().url().optional(),
  BACKUP_TRIGGER_TOKEN: z.string().optional(),
  RESTART_TRIGGER_URL: z.string().url().optional(),
  RESTART_TRIGGER_TOKEN: z.string().optional(),
  PROMETHEUS_URL: z.string().url().optional(),
  ADMIN_IP_ALLOWLIST: z.string().default(''),
});

const contourSchema = z.enum(['miniapp', 'internal', 'worker', 'migrate', 'dev']);

const widgetSchema = z.object({
  /** Fallback origins allowed to embed the widget when a master has none set. */
  WIDGET_DEFAULT_ALLOWED_ORIGINS: z.string().default(''),
  WIDGET_REQUIRE_ORIGIN: boolFromString.default(true),
});

export const envSchema = baseSchema
  .merge(databaseSchema)
  .merge(redisSchema)
  .merge(miniappAuthSchema)
  .merge(staffAuthSchema)
  .merge(httpSchema)
  .merge(paymentsSchema)
  .merge(storageSchema)
  .merge(aiSchema)
  .merge(centrifugoSchema)
  .merge(observabilitySchema)
  .merge(opsSchema)
  .merge(widgetSchema)
  .merge(piiSchema)
  .extend({
    API_CONTOUR: contourSchema.default('dev'),
  });

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/**
 * Validates process.env once and fails fast.
 * Never read process.env directly outside this package.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  cached = parsed.data;
  return cached;
}

/** Test helper — reset cached env between suites. */
export function resetEnvCache(): void {
  cached = undefined;
}

export function parseCorsOrigins(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
