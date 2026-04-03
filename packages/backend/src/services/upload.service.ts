import { Client as MinioClient } from 'minio';
import pino from 'pino';
import { env } from '../config/env.js';

const logger = pino({ name: 'upload-service' });
const BUCKET = 'caller-uploads';
const ALLOWED_MIMES = ['image/png', 'image/jpeg', 'image/webp'];

let minioClient: MinioClient | null = null;

function getClient(): MinioClient {
  if (!minioClient) {
    if (!env.MINIO_ENDPOINT || !env.MINIO_ACCESS_KEY || !env.MINIO_SECRET_KEY) {
      throw new Error('MinIO is not configured');
    }
    minioClient = new MinioClient({
      endPoint: env.MINIO_ENDPOINT,
      port: env.MINIO_PORT,
      useSSL: env.MINIO_USE_SSL as unknown as boolean,
      accessKey: env.MINIO_ACCESS_KEY,
      secretKey: env.MINIO_SECRET_KEY,
    });
  }
  return minioClient;
}

async function ensureBucket(): Promise<void> {
  const client = getClient();
  const exists = await client.bucketExists(BUCKET);
  if (!exists) {
    await client.makeBucket(BUCKET);
    logger.info({ bucket: BUCKET }, 'Created uploads bucket');
  }
}

/**
 * Upload an avatar image to MinIO.
 * Returns the object key (path) for storage in DB.
 */
export async function uploadAvatar(
  workspaceId: string,
  agentId: string,
  buffer: Buffer,
  mimetype: string,
): Promise<string> {
  if (!ALLOWED_MIMES.includes(mimetype)) {
    throw new Error(`Unsupported image type: ${mimetype}. Allowed: ${ALLOWED_MIMES.join(', ')}`);
  }

  await ensureBucket();

  const ext = mimetype === 'image/png' ? 'png' : mimetype === 'image/webp' ? 'webp' : 'jpg';
  const key = `avatars/${workspaceId}/${agentId}_${Date.now()}.${ext}`;

  const client = getClient();
  await client.putObject(BUCKET, key, buffer, buffer.length, {
    'Content-Type': mimetype,
  });

  logger.info({ key, size: buffer.length }, 'Avatar uploaded');
  return key;
}

/**
 * Get a presigned URL for an avatar (1 hour expiry).
 */
export async function getAvatarUrl(objectKey: string, expirySeconds = 3600): Promise<string> {
  const client = getClient();
  return client.presignedGetObject(BUCKET, objectKey, expirySeconds);
}

/**
 * Delete an avatar from MinIO.
 */
export async function deleteAvatar(objectKey: string): Promise<void> {
  try {
    const client = getClient();
    await client.removeObject(BUCKET, objectKey);
    logger.info({ key: objectKey }, 'Avatar deleted');
  } catch (err) {
    logger.error({ err, key: objectKey }, 'Failed to delete avatar');
  }
}

/**
 * Check if a path is a MinIO object key (vs a static URL like /avatars/default-1.png).
 */
export function isMinioPath(avatarUrl: string | null): boolean {
  return !!avatarUrl && avatarUrl.startsWith('avatars/');
}
