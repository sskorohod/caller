import { Client as MinioClient } from 'minio';
import pino from 'pino';
import { env } from '../config/env.js';

const logger = pino({ name: 'recording-storage' });

let minioClient: MinioClient | null = null;

/** Check if MinIO is configured */
export function isMinioConfigured(): boolean {
  return !!(env.MINIO_ENDPOINT && env.MINIO_ACCESS_KEY && env.MINIO_SECRET_KEY);
}

/** Get or create MinIO client */
function getClient(): MinioClient {
  if (!minioClient) {
    if (!isMinioConfigured()) {
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

/** Ensure bucket exists */
async function ensureBucket(): Promise<void> {
  const client = getClient();
  const exists = await client.bucketExists(env.MINIO_BUCKET);
  if (!exists) {
    await client.makeBucket(env.MINIO_BUCKET);
    logger.info({ bucket: env.MINIO_BUCKET }, 'Created MinIO bucket');
  }
}

/**
 * Download recording from Twilio and upload to MinIO.
 * Returns the object key on success, or null if MinIO not configured.
 */
export async function storeRecording(params: {
  twilioRecordingUrl: string;
  callSid: string;
  recordingSid: string;
  workspaceId: string;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
}): Promise<string | null> {
  if (!isMinioConfigured()) return null;

  try {
    await ensureBucket();

    // Download from Twilio (requires Basic Auth with AccountSid:AuthToken)
    const mp3Url = params.twilioRecordingUrl.endsWith('.mp3')
      ? params.twilioRecordingUrl
      : `${params.twilioRecordingUrl}.mp3`;

    const headers: Record<string, string> = {};
    if (params.twilioAccountSid && params.twilioAuthToken) {
      headers['Authorization'] = 'Basic ' + Buffer.from(`${params.twilioAccountSid}:${params.twilioAuthToken}`).toString('base64');
    }

    const response = await fetch(mp3Url, { headers });
    if (!response.ok) {
      throw new Error(`Failed to download recording: ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const key = `${params.workspaceId}/${date}/${params.callSid}_${params.recordingSid}.mp3`;

    // Upload to MinIO
    const client = getClient();
    await client.putObject(env.MINIO_BUCKET, key, buffer, buffer.length, {
      'Content-Type': 'audio/mpeg',
      'x-amz-meta-call-sid': params.callSid,
      'x-amz-meta-recording-sid': params.recordingSid,
      'x-amz-meta-workspace-id': params.workspaceId,
    });

    logger.info({ key, size: buffer.length }, 'Recording stored in MinIO');
    return key;
  } catch (err) {
    logger.error({ err, callSid: params.callSid }, 'Failed to store recording in MinIO');
    return null;
  }
}

/**
 * Generate a presigned URL for playback (default 1 hour expiry).
 */
export async function getPresignedUrl(objectKey: string, expirySeconds = 3600): Promise<string> {
  const client = getClient();
  return client.presignedGetObject(env.MINIO_BUCKET, objectKey, expirySeconds);
}

/**
 * Delete a recording from MinIO.
 */
export async function deleteRecording(objectKey: string): Promise<void> {
  if (!isMinioConfigured()) return;
  try {
    const client = getClient();
    await client.removeObject(env.MINIO_BUCKET, objectKey);
    logger.info({ key: objectKey }, 'Recording deleted from MinIO');
  } catch (err) {
    logger.error({ err, key: objectKey }, 'Failed to delete recording from MinIO');
  }
}

/**
 * Test MinIO connection — returns true if connection works.
 */
export async function testConnection(): Promise<boolean> {
  try {
    const client = getClient();
    await client.listBuckets();
    return true;
  } catch {
    return false;
  }
}
