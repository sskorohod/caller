/**
 * Is our own voice echoing on the line: does the line repeat the envelope of our audio at a constant lag?
 * Port of aidispatch agent/consecutive/echo.py.
 *
 * The text echo filter cuts words that match our recent translation out of the transcript. Where there is no
 * echo it only harms: people repeat days and numbers after the interpreter, and those words were lost
 * ("Got it, Thursday afternoon then" became "Got it, then").
 *
 * Correlation, not level. On seven live aidispatch calls (a conference does not return a participant's own
 * audio, phones cancel their own echo) the correlation of the line and our envelopes in 10 s windows never
 * rose above 0.59, while an echo repeats our speech at one and the same lag: 0.88–0.92 in the rehearsal scene.
 * Level lies: the other side starts answering as soon as we stop, and by level their voice is indistinguishable
 * from echo (a level-based meter called 5 of those 7 calls echo). An echo below the line noise does not
 * repeat our envelope, and the transcriber does not hear it either.
 *
 * Echo once found stays until the end of the call: it is a property of the line (speakerphone) and does not
 * go away by itself, while windows where people talk over our translation correlate lower and would switch
 * the filter off mid-call. Without the filter the core keeps its safety net: the intent judge checks five
 * words over our translation and takes a piece of our own translation for an "uh-huh".
 */
import { dbfs, SILENT_DBFS } from './audio.js';

export const ACTIVE_DBFS = -45;          // our frame carries sound, not a pause between words
// Echo lag up to 1 s (20 ms frames), as in aidispatch, and enough here: our envelope is paced at line rate (the
// queue in EchoMeter), so the output queue ahead of playout is not part of the lag, only the phone round trip
// is. A wider search finds more chance correlations: with 100 lags, false echo in synthetic scenes rose from 10%
// to 36% (a person answering right after us) and from 26% to 45% (a person talking over us).
export const MAX_LAG = 50;
export const WINDOW = 500;               // decide on the last 10 s of the line
export const MIN_ACTIVE = 75;            // 1.5 s of our audio in the window: with less it is too early to judge
export const ECHO_CORRELATION = 0.7;     // the line repeats our audio: echo. Live calls up to 0.59, echo 0.88–0.92
export const DECIDE_EVERY = 10;          // recompute every 10 line frames (200 ms)

const SPAN = WINDOW + MAX_LAG;           // frames of each envelope kept

/**
 * Envelopes (dBFS per 20 ms frame) of our audio and of the line. present: null — too early to judge,
 * true/false — echo or not; true holds until the end of the call.
 *
 * The clock is the line: its frames arrive exactly in real time. Our audio is handed out in batches (the output
 * takes up to 0.4 s at once), so our frames wait in their own queue and one is taken per line frame: the
 * envelope moves at the pace the audio actually sounds.
 */
export class EchoMeter {
  present: boolean | null = null;
  correlation: number | null = null;
  returnDb: number | null = null;

  private readonly queued: number[] = [];
  // Both envelopes oldest first, one entry per line frame, at most SPAN (deque(maxlen) in echo.py).
  private readonly oursEnv = new Float64Array(SPAN);
  private readonly lineEnv = new Float64Array(SPAN);
  private size = 0;
  private frames = 0;
  // Scratch for decide(), reused: it runs every 200 ms of every live call.
  private readonly active = new Int32Array(WINDOW);
  private readonly dx = new Float64Array(WINDOW);
  private readonly diff = new Float64Array(WINDOW);

  /** 20 ms of PCM16 8 kHz that we sent. */
  ours(frame: Buffer): void {
    this.queued.push(dbfs(frame));
  }

  /** 20 ms of PCM16 8 kHz from the line. */
  line(frame: Buffer): void {
    if (this.size === SPAN) {            // full: drop the oldest frame of both
      this.oursEnv.copyWithin(0, 1);
      this.lineEnv.copyWithin(0, 1);
      this.size--;
    }
    this.oursEnv[this.size] = this.queued.shift() ?? SILENT_DBFS;
    this.lineEnv[this.size] = dbfs(frame);
    this.size++;
    this.frames++;
    if (this.frames % DECIDE_EVERY === 0) this.decide();
  }

  private decide(): void {
    if (this.present) return;   // echo found: the line keeps it to the end of the call, nothing left to measure
    const ours = this.oursEnv, line = this.lineEnv, active = this.active, dx = this.dx;
    const n = this.size - MAX_LAG;
    if (n <= 0) return;
    let m = 0;
    for (let i = 0; i < n; i++) if (ours[i] > ACTIVE_DBFS) active[m++] = i;
    if (m < MIN_ACTIVE) return;
    // x = our active frames, centred once; y = the line at the same frames shifted by the lag. Pearson per lag.
    let sum = 0;
    for (let k = 0; k < m; k++) sum += ours[active[k]];
    const mx = sum / m;
    let sxx = 0;
    for (let k = 0; k < m; k++) { dx[k] = ours[active[k]] - mx; sxx += dx[k] * dx[k]; }
    let best = 0, bestLag = 0;
    for (let lag = 0; lag <= MAX_LAG; lag++) {
      let sy = 0;
      for (let k = 0; k < m; k++) sy += line[lag + active[k]];
      const my = sy / m;
      let syy = 0, sxy = 0;
      for (let k = 0; k < m; k++) {
        const dy = line[lag + active[k]] - my;
        syy += dy * dy;
        sxy += dx[k] * dy;
      }
      if (sxx === 0 || syy === 0) continue;   // a flat line (silence alone) repeats nothing
      const r = sxy / Math.sqrt(sxx * syy);
      if (r > best) { best = r; bestLag = lag; }
    }
    this.correlation = Math.round(best * 100) / 100;
    // for the report card: how much quieter than us our voice came back at that lag
    const diff = this.diff;
    for (let k = 0; k < m; k++) diff[k] = line[bestLag + active[k]] - ours[active[k]];
    this.returnDb = Math.round(median(diff.subarray(0, m)) * 10) / 10;
    this.present = best >= ECHO_CORRELATION;
  }
}

/** np.median: the middle value, or the mean of the two middle ones for an even count. Sorts in place. */
function median(values: Float64Array): number {
  values.sort();
  const mid = values.length >> 1;
  return values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
}
