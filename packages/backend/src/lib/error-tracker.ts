import pino from 'pino';

const log = pino({ name: 'error-tracker' });

interface ErrorContext {
  callId?: string;
  workspaceId?: string;
  service?: string;
  [key: string]: unknown;
}

/**
 * Centralized error tracking. Logs with structured context.
 * Can be extended to send to Sentry, Datadog, etc.
 */
export function trackError(err: unknown, context: ErrorContext): void {
  log.error({ err, ...context }, `[${context.service || 'unknown'}] ${err instanceof Error ? err.message : String(err)}`);
}

export function trackWarn(message: string, context: ErrorContext): void {
  log.warn(context, `[${context.service || 'unknown'}] ${message}`);
}
