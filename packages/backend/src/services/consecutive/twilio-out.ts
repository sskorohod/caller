import { FRAME_MS, LINE_RATE, pcmToMulaw } from './audio.js';

export const QUEUE_MS = 400;   // audio kept ahead at Twilio; the rest stays with us so a stop is instant

export interface TwilioSocketLike { readyState: number; send(data: string): void }

/**
 * The translator's voice on the call — what aidispatch's LiveKit track was.
 *
 * Twilio plays whatever it is sent and buffers the rest without limit, so the pace is
 * ours: a frame goes out only while less than QUEUE_MS is queued ahead of real time —
 * the 400 ms `rtc.AudioSource(queue_size_ms=400)` gave aidispatch. `clear` drops what
 * Twilio holds, which is what silences an interrupted translation at once.
 */
export class TwilioOut {
  private aheadUntil = 0;   // ms timestamp when the audio already sent finishes playing

  constructor(
    private readonly socket: TwilioSocketLike,
    private readonly streamSid: string,
    private readonly now: () => number = () => performance.now(),
    private readonly sleep: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms)),
  ) {}

  async write(frame: Buffer): Promise<void> {
    for (;;) {
      const lead = this.aheadUntil - this.now();
      if (lead <= QUEUE_MS) break;
      await this.sleep(Math.min(FRAME_MS, lead - QUEUE_MS));
    }
    // A closed call still keeps the pace: otherwise playback would spin through its buffer.
    if (this.socket.readyState === 1) {
      this.socket.send(JSON.stringify({
        event: 'media', streamSid: this.streamSid, media: { payload: pcmToMulaw(frame).toString('base64') },
      }));
    }
    this.aheadUntil = Math.max(this.aheadUntil, this.now()) + ((frame.length / 2) / LINE_RATE) * 1000;
  }

  clear(): void {
    this.aheadUntil = this.now();
    if (this.socket.readyState === 1) this.socket.send(JSON.stringify({ event: 'clear', streamSid: this.streamSid }));
  }
}
