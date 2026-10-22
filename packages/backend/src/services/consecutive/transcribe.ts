/**
 * Live transcription of the call line with `gpt-live-transcribe` — port of aidispatch
 * agent/consecutive/transcribe.py (9e4b1eb) onto `ws`.
 *
 * Consecutive translation starts from text: only a finished thought can be translated, and only the text
 * tells that a thought is finished. This model listens to the line for the whole call and gives the text
 * piece by piece while the person is still speaking — long before it is clear the utterance is over.
 *
 * The line is shared by two: both speakers arrive mixed in one stream, so the session names both
 * languages of the pair at once. Where an utterance ends is decided by the turn-taking core, not the
 * model: it takes no speech threshold (`turn_detection`) at all, and the buffer is closed only by our commit.
 *
 * Everything said here about the protocol was checked on the live API on 2026-09-24 (aidispatch).
 */
import { setTimeout as delay } from 'node:timers/promises';
import pino from 'pino';
import { WebSocket } from 'ws';

export const log = pino({ name: 'consecutive' });

// With model= in the address the API rejects the session: the model is named only in session.update.
export const TRANSCRIBE_URL = 'wss://api.openai.com/v1/realtime?intent=transcription';
export const TRANSCRIBE_MODEL = 'gpt-live-transcribe';
export type TranscribeFormat = 'pcm24' | 'pcmu';
/** Twilio's own µ-law: the live API accepts it and transcribes the smoke scene as it does pcm24, at a sixth of the upload. */
export const TRANSCRIBE_FORMAT: TranscribeFormat = 'pcmu';
// Measured: the last word with its period comes 0.3–0.55 s after speech; the default delay gives 0.7–0.8 s.
export const DELAY = 'low';
export const RATE = 24000;             // pcm24: PCM16 mono
export const MIN_COMMIT_MS = 100;      // the server closes nothing shorter: error input_audio_buffer_commit_empty
// Audio the socket may hold unsent: beyond that the network clearly can't cope, and hoarding hurts.
const QUEUE_S = 8;
const WIRE_BYTES = 1.4;                // wire bytes per audio byte: base64 (4/3) plus the JSON around it
// Pauses before the reconnect attempts.
export const BACKOFF_S = [0.5, 1, 2] as const;
/**
 * Short-lived sessions tolerated in a row before the leg gives up. Its own constant rather than
 * BACKOFF_S.length: that array is the pause schedule, and tying the give-up count to it meant
 * lengthening one silently changed the other.
 */
const SHORT_SESSIONS_MAX = BACKOFF_S.length;
// A connection that lived less is no recovery.
const STABLE_S = 10;
// A stalled handshake must not hold call start or a reconnect for the OS's 75–130 s; aiohttp's session had a cap too.
export const HANDSHAKE_TIMEOUT_MS = 10_000;
export const CLOSE_TIMEOUT_S = 1.5;    // a socket that does not answer the close must not hold up the call teardown
const DROP_LOG_EVERY_S = 5;            // audio is lost at 50 frames a second; a log line every 5 s is enough
const COMMIT_EMPTY = 'input_audio_buffer_commit_empty';

const FORMATS = {
  pcm24: { wire: { type: 'audio/pcm', rate: RATE }, bytesPerS: RATE * 2 },
  pcmu: { wire: { type: 'audio/pcmu' }, bytesPerS: 8000 },            // G.711 µ-law: a byte a sample at 8 kHz
} satisfies Record<TranscribeFormat, { wire: { type: string; rate?: number }; bytesPerS: number }>;

export interface WsLike {
  readyState: number; bufferedAmount: number;
  send(data: string): void; close(): void;
  terminate?(): void;   // drop the connection at once (ws has it): for a close the server leaves unanswered
  on(event: 'open' | 'message' | 'close' | 'error', listener: (...args: any[]) => void): void;
}

export interface TranscribeOptions {
  languages: string[]; apiKey: string; format?: TranscribeFormat;
  onDelta: (itemId: string, text: string) => void;
  onCompleted?: (itemId: string, text: string) => void;
  // default: new WebSocket(url, { headers, handshakeTimeout: HANDSHAKE_TIMEOUT_MS }) from 'ws'
  connect?: (url: string, headers: Record<string, string>) => WsLike;
  sleep?: (ms: number) => Promise<void>;   // the reconnect pauses and the close wait; tests make them instant
  acceptTimeoutMs?: number;   // how long start() waits for the server to accept the session; tests shorten it
  /**
   * The leg has stopped for good and no longer accepts audio. Not called by aclose(): a hang-up is
   * not a death. Without this the only sign was `alive` going false, which nothing watched — the
   * call went on deaf, push() returned without even its rate-limited warning, and five minutes
   * later the idle guard hung up a line whose silence had no explanation anywhere.
   */
  onDead?: (reason: string) => void;
  /** Call id, so the leg's own error lines can be attributed when several calls run at once. */
  callId?: string;
}

/**
 * One transcription session for the whole call: hears the line and gives the text by item (item_id).
 *
 * Pieces of text can be smaller than a word — "ар", "ивал" or a lone comma — and may come for an item even
 * after its commit. So each piece is passed on at once with its item_id, and the core glues them.
 *
 * The line must not stall on any failure: push and commit never wait for the socket and never throw, and a
 * socket dropped not by us is raised again by the leg itself. alive — the leg works or is coming back after
 * a drop; false — not up, closed, or gave up after three failed attempts.
 */
export class TranscribeLeg {
  alive = false;
  audioSeconds = 0;                    // what reached the socket — the price is per minute of it

  private languages: string[];
  private readonly apiKey: string;
  private readonly wireFormat: { type: string; rate?: number };
  private readonly bytesPerS: number;
  private readonly minCommitBytes: number;
  private readonly maxBuffered: number;
  private readonly onDelta: (itemId: string, text: string) => void;
  private readonly onCompleted?: (itemId: string, text: string) => void;
  private readonly connect: (url: string, headers: Record<string, string>) => WsLike;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly acceptTimeoutMs: number;
  private ws: WsLike | null = null;    // the socket coming up or in use; null between a drop and the next attempt
  private connected = false;           // the socket is up right now; between a drop and the reconnect it is not
  private closing = false;
  private uncommitted = 0;             // audio bytes since the last commit
  private commits = 0;
  private dropped = 0;
  private dropLoggedAt = -Infinity;
  private began = 0;                   // when the current session came up, s
  private short = 0;                   // short-lived sessions in a row
  private readonly onDead?: (reason: string) => void;
  private dead = false;                // die() is reported once; a dead leg cannot die again
  /** Module logger bound to the call, so lines from several concurrent calls can be told apart. */
  private readonly log: pino.Logger;

  constructor(opts: TranscribeOptions) {
    this.onDead = opts.onDead;
    this.log = opts.callId ? log.child({ callId: opts.callId }) : log;
    this.languages = unique(opts.languages);   // the pair without repeats, in the given order
    this.apiKey = opts.apiKey;
    const format = FORMATS[opts.format ?? TRANSCRIBE_FORMAT];
    this.wireFormat = format.wire;
    this.bytesPerS = format.bytesPerS;
    this.minCommitBytes = this.bytesPerS * MIN_COMMIT_MS / 1000;
    // aidispatch queued up to 400 frames of 20 ms; ws queues by itself, so the same 8 s is read off its backlog
    this.maxBuffered = this.bytesPerS * QUEUE_S * WIRE_BYTES;
    this.onDelta = opts.onDelta;
    this.onCompleted = opts.onCompleted;
    this.connect = opts.connect
      ?? ((url, headers) => new WebSocket(url, { headers, handshakeTimeout: HANDSHAKE_TIMEOUT_MS }));
    // the leg's own waits never hold the process: a script that calls aclose() exits at once
    this.sleep = opts.sleep ?? ((ms: number) => delay(ms, undefined, { ref: false }));
    this.acceptTimeoutMs = opts.acceptTimeoutMs ?? HANDSHAKE_TIMEOUT_MS;
  }

  /**
   * Resolves true once the socket is open and the server has accepted the session; false when it could not
   * come up — unreachable, refused or unanswered — and the call should fall back.
   */
  async start(): Promise<boolean> {
    if (this.closing) return false;
    if (!await this.open(true)) return false;
    if (this.closing) return false;    // the call ended while the socket was coming up: aclose() has closed it
    this.alive = true;
    log.info({ languages: this.languages }, 'transcribe leg up');
    return true;
  }

  /**
   * Audio into the session, already in its format. Never waits for the socket: a network hiccup must not
   * slow down reading from the line.
   */
  push(audio: Buffer): void {
    if (!this.alive) return;
    const ws = this.ws;
    if (!this.connected || ws === null || ws.readyState !== WebSocket.OPEN) {
      this.drop(audio, 'reconnecting');
      return;
    }
    if (ws.bufferedAmount > this.maxBuffered) {
      this.drop(audio, 'socket is behind');
      return;
    }
    if (!this.send(ws, { type: 'input_audio_buffer.append', audio: audio.toString('base64') })) return;
    // Only what went to the server counts: we pay for what it heard, not for what got lost on the way.
    this.uncommitted += audio.length;
    this.audioSeconds += audio.length / this.bytesPerS;
  }

  /**
   * Close the current item: everything heard since the last commit becomes one utterance.
   *
   * The server takes nothing under 100 ms and answers with an error, so such a commit is not sent at all.
   * False — nothing went out: too little audio (the item just keeps growing), no socket, or the socket is behind.
   */
  commit(): boolean {
    const ws = this.ws;
    if (!this.alive || !this.connected || ws === null || ws.readyState !== WebSocket.OPEN
      || this.uncommitted < this.minCommitBytes) return false;
    const eventId = `commit-${this.commits + 1}`;   // the server names our commit by it in an error
    if (ws.bufferedAmount > this.maxBuffered) {
      log.warn({ eventId }, 'transcribe leg is behind, commit not sent');
      return false;
    }
    if (!this.send(ws, { type: 'input_audio_buffer.commit', event_id: eventId })) return false;
    this.commits += 1;
    this.uncommitted = 0;
    return true;
  }

  /** A new language pair: the live session gets it now, and every session after a reconnect gets it too. */
  setLanguages(languages: string[]): void {
    this.languages = unique(languages);
    const ws = this.ws;
    if (this.connected && ws !== null && ws.readyState === WebSocket.OPEN) this.send(ws, this.sessionUpdate());
  }

  private drop(audio: Buffer, why: string): void {
    this.dropped += audio.length;
    const t = now();
    if (t - this.dropLoggedAt >= DROP_LOG_EVERY_S) {
      this.dropLoggedAt = t;
      log.warn({ why, lostS: Math.round(this.dropped / this.bytesPerS * 10) / 10 }, 'transcribe leg drops audio');
    }
  }

  // --- the socket -----------------------------------------------------------------------------------

  private sessionUpdate(): object {
    // No speech threshold on purpose: the model rejects it, and the core sets utterance boundaries. No noise
    // reduction either: near_field holds on to the first voice on the line and mutes the second. Measured on a
    // run recording: with it the second speaker's whole reply vanished from 22 s of the call; without it,
    // everything came through word for word.
    return { type: 'session.update', session: { type: 'transcription', audio: { input: {
      format: this.wireFormat,
      transcription: { model: TRANSCRIBE_MODEL, languages: this.languages, delay: DELAY } } } } };
  }

  /**
   * One connection attempt: true once the socket is open and session.update went out. The call's first
   * session (awaitAccept) counts only once the server has accepted it; a reconnect sends and goes on.
   */
  private open(awaitAccept = false): Promise<boolean> {
    let ws: WsLike;
    try {
      ws = this.connect(TRANSCRIBE_URL, { Authorization: `Bearer ${this.apiKey}` });
    } catch (err) {
      log.warn(why(err), 'transcribe leg failed to connect');
      return Promise.resolve(false);
    }
    this.ws = ws;
    return new Promise<boolean>((resolve) => {
      let phase: 'connecting' | 'accepting' | 'up' = 'connecting';
      let timer: ReturnType<typeof setTimeout> | undefined;
      const up = (): void => {
        clearTimeout(timer);
        phase = 'up';
        resolve(true);
      };
      // Never came up: a failed attempt, a session refused or left unanswered — or aclose() cut it short (it
      // detaches the socket first, so there is nothing to log).
      const fail = (fields: object, message: string): void => {
        clearTimeout(timer);
        if (ws === this.ws) {
          this.ws = null;
          this.connected = false;
          closeQuietly(ws);
          log.warn(fields, message);
        }
        resolve(false);
      };
      const gone = (err?: unknown, closeCode?: number): void => {
        if (phase === 'up') this.lost(ws, err, closeCode);
        else fail({ ...why(err), closeCode }, 'transcribe leg failed to connect');
      };
      ws.on('open', () => {
        if (ws !== this.ws || phase !== 'connecting') return;
        try {
          ws.send(JSON.stringify(this.sessionUpdate()));
        } catch (err) {
          gone(err);
          return;
        }
        // A new session starts with an empty buffer: audio not committed on the old socket went with it, so
        // the commit count starts from zero — otherwise the core would get an error instead of an utterance.
        this.uncommitted = 0;
        this.connected = true;
        this.began = now();
        if (!awaitAccept) {
          up();
          return;
        }
        // The call's first session must be accepted before the call relies on it: one the server refuses (the
        // model not enabled for the key) would leave the call silent instead of falling back to the cascade.
        phase = 'accepting';
        timer = setTimeout(() => {
          fail({ timeoutMs: this.acceptTimeoutMs }, 'transcribe leg: session not accepted in time');
        }, this.acceptTimeoutMs).unref();
      });
      ws.on('message', (data: Buffer | string, isBinary?: boolean) => {
        if (ws !== this.ws || phase === 'connecting') return;
        if (phase === 'accepting' && !isBinary) {
          const event = parseEvent(data);
          if (event?.type === 'error') {
            // the code and type say why; the message is not logged
            const error = (event.error ?? {}) as { code?: unknown; type?: unknown };
            fail({ code: typeof error.code === 'string' ? error.code : undefined,
              type: typeof error.type === 'string' ? error.type : undefined }, 'transcribe leg: session refused');
            return;
          }
          if (event?.type === 'session.updated') up();
        }
        this.onMessage(data, isBinary === true);
      });
      // ws throws on an 'error' nobody listens to, so this listener stays for the socket's whole life
      ws.on('error', (err: unknown) => gone(err));
      ws.on('close', (closeCode?: number) => gone(undefined, closeCode));
    });
  }

  /** The session in use is gone: dropped by the server or failed on send. aclose() detaches its socket first. */
  /**
   * The leg has stopped for good. One place for it so the owner is always told, and told once:
   * every path that used to assign `alive = false` on a failure now comes through here. aclose()
   * does not — a hang-up is not a death, and reporting one would make every normal call end with a
   * dead transcriber.
   */
  private die(reason: string): void {
    this.alive = false;
    if (this.dead) return;
    this.dead = true;
    try {
      this.onDead?.(reason);
    } catch (err) {   // the owner's handler must not turn a dead leg into a dead call
      this.log.warn(why(err), 'transcribe leg: onDead handler failed');
    }
  }

  private lost(ws: WsLike, err?: unknown, closeCode?: number): void {
    if (ws !== this.ws) return;
    this.ws = null;
    this.connected = false;              // from this moment there is nowhere to put audio
    closeQuietly(ws);
    // a server that takes the connection and drops it at once would otherwise keep us in a loop forever
    this.short = now() - this.began < STABLE_S ? this.short + 1 : 0;
    if (this.short >= SHORT_SESSIONS_MAX) {
      this.log.error({ sessions: this.short }, 'transcribe leg: short-lived sessions in a row, giving up');
      this.die('short-lived sessions in a row');
      return;
    }
    log.warn({ ...why(err), closeCode }, 'transcribe leg lost the socket, reconnecting');
    this.reconnect().catch((e: unknown) => {
      this.log.error(why(e), 'transcribe leg stopped');
      this.connected = false;
      this.die('reconnect threw');
    });
  }

  /**
   * Three attempts per drop: a drop half an hour after the previous one is a new trouble, not the old one
   * going on. A close (aclose) is not a drop and ends the attempts.
   */
  private async reconnect(): Promise<void> {
    for (const [i, pause] of BACKOFF_S.entries()) {
      await this.sleep(pause * 1000);
      if (this.closing) return;
      if (await this.open()) {
        if (!this.closing) log.info({ attempt: i + 1 }, 'transcribe leg reconnected');
        return;
      }
      if (this.closing) return;
    }
    this.log.error({ attempts: BACKOFF_S.length }, 'transcribe leg gave up reconnecting; the call goes on without text');
    this.die('gave up reconnecting');
  }

  private send(ws: WsLike, event: object): boolean {
    try {
      ws.send(JSON.stringify(event));
      return true;
    } catch (err) {
      log.warn(why(err), 'transcribe leg send failed');
      this.lost(ws);
      return false;
    }
  }

  private onMessage(data: Buffer | string, isBinary: boolean): void {
    if (isBinary) return;
    try {
      this.handle(JSON.parse(data.toString()));
    } catch (err) {
      // one broken frame is no reason to drop the session: a reconnect costs a hole in the text
      log.warn({ err: (err as Error)?.name }, 'transcribe leg skipped an event');
    }
  }

  private handle(event: unknown): void {
    if (typeof event !== 'object' || event === null || Array.isArray(event)) throw new TypeError('not an event');
    const e = event as Record<string, unknown>;
    const kind = String(e.type ?? '');
    if (kind === 'conversation.item.input_audio_transcription.delta') {
      this.call(this.onDelta, e.item_id, e.delta);
    } else if (kind === 'conversation.item.input_audio_transcription.completed') {
      if (this.onCompleted) this.call(this.onCompleted, e.item_id, e.transcript);
    } else if (kind === 'conversation.item.input_audio_transcription.failed') {
      log.warn({ itemId: e.item_id, event: JSON.stringify(e).slice(0, 300) }, 'transcribe leg: item failed');
    } else if (kind === 'input_audio_buffer.committed') {
      log.debug({ itemId: e.item_id }, 'transcribe leg: item committed');
    } else if (kind === 'session.created' || kind === 'session.updated') {
      log.debug({ kind }, 'transcribe leg: session event');
    } else if (kind === 'error') {
      const error = (e.error || {}) as Record<string, unknown>;
      if (error.code === COMMIT_EMPTY) {
        // a commit got ahead of the audio at the seam between utterances: the item just keeps growing
        log.info({ eventId: error.event_id }, 'transcribe leg: commit found the buffer too small');
      } else {
        log.warn({ event: JSON.stringify(e).slice(0, 300) }, 'transcribe leg error');
      }
    }
  }

  /** A failure in the translation core must not silence the transcription: the next piece is delivered anyway. */
  private call(callback: (itemId: string, text: string) => void, itemId: unknown, text: unknown): void {
    try {
      callback(String(itemId || ''), String(text || ''));
    } catch (err) {
      log.warn({ err: (err as Error)?.name }, 'transcribe leg callback failed');
    }
  }

  // --- the end --------------------------------------------------------------------------------------

  /** Close for good: no reconnects, and no longer than CLOSE_TIMEOUT_S. A repeated call does nothing. */
  async aclose(): Promise<void> {
    if (this.closing) return;
    this.closing = true;
    this.alive = false;
    this.connected = false;
    const ws = this.ws;
    this.ws = null;
    if (ws === null) return;
    // A socket still coming up is cut short too: the call ended, and leaving it would mean paying for an empty line.
    const closed = new Promise<boolean>(resolve => ws.on('close', () => resolve(true)));
    closeQuietly(ws);
    if (ws.readyState === WebSocket.CLOSED) return;
    if (await Promise.race([closed, this.sleep(CLOSE_TIMEOUT_S * 1000).then(() => false)])) return;
    // No answer to the close in time: drop the connection, or ws would keep it (and the process) for its own 30 s.
    try {
      ws.terminate?.();
    } catch {
      // the socket is gone anyway
    }
  }
}

/**
 * Why a connection failed, for the log: the error class, its code (ECONNREFUSED, ENOTFOUND…) and the HTTP
 * status when the server refused the upgrade — never the message, which can carry secrets.
 */
function why(err: unknown): { err?: string; code?: string | number; status?: number } {
  const e = (err ?? {}) as { name?: unknown; code?: unknown; message?: unknown };
  const status = typeof e.message === 'string' ? /Unexpected server response: (\d{3})/.exec(e.message)?.[1] : undefined;
  return {
    err: typeof e.name === 'string' ? e.name : undefined,
    code: typeof e.code === 'string' || typeof e.code === 'number' ? e.code : undefined,
    status: status === undefined ? undefined : Number(status),
  };
}

/** A text frame as an event object, or null when it is not one. */
function parseEvent(data: Buffer | string): Record<string, unknown> | null {
  try {
    const event: unknown = JSON.parse(data.toString());
    const isObject = typeof event === 'object' && event !== null && !Array.isArray(event);
    return isObject ? event as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function unique(languages: string[]): string[] {
  return [...new Set(languages)];
}

function closeQuietly(ws: WsLike): void {
  try {
    ws.close();
  } catch {
    // a socket that fails even to close is gone anyway
  }
}

function now(): number {
  return performance.now() / 1000;
}
