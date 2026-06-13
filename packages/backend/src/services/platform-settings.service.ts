import { db } from '../config/db.js';
import { platformSettings } from '../db/schema.js';
import { eq } from 'drizzle-orm';

// Values in platform_settings are jsonb with two historical encodings:
// raw values (3.0, {…}) and JSON-string-encoded ('"3.0"'). The readers
// below tolerate both.

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { value: unknown; at: number }>();

export async function getPlatformSetting(key: string): Promise<unknown> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const [row] = await db.select({ value: platformSettings.value })
    .from(platformSettings)
    .where(eq(platformSettings.key, key))
    .limit(1);
  const value = row?.value ?? null;
  cache.set(key, { value, at: Date.now() });
  return value;
}

function decode(value: unknown): unknown {
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return value; }
  }
  return value;
}

export async function getNumericSetting(key: string, fallback: number): Promise<number> {
  const raw = await getPlatformSetting(key);
  if (raw == null) return fallback;
  const parsed = Number(decode(raw));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function getStringSetting(key: string, fallback: string): Promise<string> {
  const raw = await getPlatformSetting(key);
  if (raw == null) return fallback;
  const decoded = decode(raw);
  return typeof decoded === 'string' && decoded.trim() ? decoded : fallback;
}

export function invalidatePlatformSettingsCache(key?: string): void {
  if (key) cache.delete(key);
  else cache.clear();
}
