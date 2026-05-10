import { Worker, Queue } from 'bullmq';
import { eq } from 'drizzle-orm';
import { redis } from '../config/redis.js';
import { db } from '../config/db.js';
import { missions } from '../db/schema.js';
import * as missionService from '../services/mission.service.js';
import pino from 'pino';

const logger = pino({ name: 'mission-scheduled-worker' });

interface MissionScheduledJobData {
  workspaceId: string;
  missionId: string;
}

export const missionScheduledQueue = new Queue<MissionScheduledJobData>('mission-scheduled', {
  connection: redis,
});

export function startMissionScheduledWorker(): Worker {
  const worker = new Worker<MissionScheduledJobData>(
    'mission-scheduled',
    async (job) => {
      const { workspaceId, missionId } = job.data;

      // Sanity check: only fire if the mission is still scheduled. If the user
      // manually retried, cancelled, or already completed it, skip silently.
      const [m] = await db.select({ status: missions.status }).from(missions).where(eq(missions.id, missionId));
      if (!m) {
        logger.warn({ missionId }, 'Scheduled mission not found, skipping');
        return;
      }
      if (m.status !== 'scheduled') {
        logger.info({ missionId, status: m.status }, 'Scheduled mission no longer scheduled, skipping');
        return;
      }

      logger.info({ missionId }, 'Firing scheduled mission');
      await missionService.executeMission(workspaceId, missionId);
    },
    { connection: redis, concurrency: 5 },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, missionId: job?.data?.missionId, err }, 'Scheduled mission job failed');
  });

  return worker;
}

export async function queueMissionScheduledRun(
  workspaceId: string,
  missionId: string,
  delayMs: number,
): Promise<void> {
  // Re-postponing should override the prior delay. BullMQ's add() is a no-op
  // if a job with the same id already exists, so remove it first.
  await cancelMissionScheduledRun(missionId);
  await missionScheduledQueue.add(
    'fire',
    { workspaceId, missionId },
    {
      delay: Math.max(0, delayMs),
      jobId: `mission-${missionId}`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { age: 3600 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  );
}

export async function cancelMissionScheduledRun(missionId: string): Promise<void> {
  try {
    const job = await missionScheduledQueue.getJob(`mission-${missionId}`);
    if (job) await job.remove();
  } catch (err) {
    logger.warn({ err, missionId }, 'Failed to cancel scheduled mission job');
  }
}
