import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  PORT: z.coerce.number().default(3011),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),

  REDIS_URL: z.string().default('redis://localhost:6379'),

  ENCRYPTION_KEY: z.string().regex(/^[0-9a-f]{64}$/, 'Must be 32-byte hex string (64 chars)'),

  TWILIO_WEBHOOK_SECRET: z.string().default(''), // optional at startup, configure later in dashboard

  API_DOMAIN: z.string().min(1).default('localhost:3011'),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // MinIO / S3 storage (optional — if not set, recordings stay on Twilio)
  MINIO_ENDPOINT: z.string().default(''),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_ACCESS_KEY: z.string().default(''),
  MINIO_SECRET_KEY: z.string().default(''),
  MINIO_USE_SSL: z.string().transform(v => v === 'true').default('false'),
  MINIO_BUCKET: z.string().default('caller-recordings'),
});

export const env = envSchema.parse(process.env);
