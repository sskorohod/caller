import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),

  REDIS_URL: z.string().default('redis://localhost:6379'),

  ENCRYPTION_KEY: z.string().regex(/^[0-9a-f]{64}$/, 'Must be 32-byte hex string (64 chars)'),

  TWILIO_WEBHOOK_SECRET: z.string().min(1),

  API_DOMAIN: z.string().min(1).default('localhost:3001'),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export const env = envSchema.parse(process.env);
