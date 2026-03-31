import { createCipheriv, createDecipheriv, randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  return Buffer.from(env.ENCRYPTION_KEY, 'hex');
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decrypt(ciphertext: string): string {
  const buf = Buffer.from(ciphertext, 'base64');
  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final('utf8');
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const raw = randomBytes(32).toString('base64url');
  const key = `mcp_${raw}`;
  const prefix = key.slice(0, 12);
  const hash = hashApiKey(key);
  return { key, prefix, hash };
}

export function verifyApiKey(provided: string, storedHash: string): boolean {
  const hash = hashApiKey(provided);
  try {
    return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
  } catch {
    return false;
  }
}
