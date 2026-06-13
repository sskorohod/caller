import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';

/**
 * Short-lived signed token authenticating a Twilio Media Stream WebSocket
 * upgrade. The token is generated server-side when we build the `<Stream url>`
 * and verified in the media-stream handler before any billable session starts.
 *
 * Without this, the WS endpoint trusts only the call UUID — which leaks to any
 * holder of a (publicly shareable) translator live link, allowing forged audio
 * injection and unbounded, platform-billed Grok/xAI spend.
 *
 * The token binds the exact stream id (the URL path segment, e.g. `<uuid>` or
 * `<uuid>-callee`) to an expiry, signed with HMAC-SHA256 keyed by
 * ENCRYPTION_KEY. The TTL only needs to cover ring time + call setup; we use a
 * generous window to tolerate long ring/answer delays and clock skew.
 */
const STREAM_TOKEN_TTL_MS = 6 * 60 * 60 * 1000; // 6h

export function signStreamToken(streamId: string): string {
  const exp = Date.now() + STREAM_TOKEN_TTL_MS;
  const mac = createHmac('sha256', env.ENCRYPTION_KEY)
    .update(`${streamId}:${exp}`)
    .digest('hex');
  return `${exp}.${mac}`;
}

export function verifyStreamToken(streamId: string, token: string | undefined | null): boolean {
  if (!token) return false;
  const dot = token.indexOf('.');
  if (dot <= 0) return false;
  const exp = Number(token.slice(0, dot));
  const mac = token.slice(dot + 1);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;

  const expected = createHmac('sha256', env.ENCRYPTION_KEY)
    .update(`${streamId}:${exp}`)
    .digest('hex');
  try {
    const a = Buffer.from(mac, 'hex');
    const b = Buffer.from(expected, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Extract the stream id (the part the handler parses from the path, e.g.
 * `<uuid>` or `<uuid>-callee`) from a media-stream WS URL. Twilio strips query
 * strings from <Stream> URLs, so the token is delivered as a <Parameter> and
 * must bind to this exact id.
 */
export function streamIdFromUrl(wsUrl: string): string {
  return wsUrl.split('/media-stream/')[1]?.split(/[?#]/)[0] ?? '';
}
