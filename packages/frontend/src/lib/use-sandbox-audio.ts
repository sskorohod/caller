'use client';
import { useCallback, useRef, useState } from 'react';

// Online Sandbox audio hook — mic capture (→ mulaw 8 kHz over a raw WebSocket
// to the backend Grok bridge) + playback of Grok's mulaw audio via Web Audio.
// Mirrors the codec used by the phone translator so the backend Grok session is
// unchanged. The mulaw decode + Web-Audio scheduling are ported from
// use-call-audio.ts (the listen-in player).

// ─── Mulaw decode (Grok → browser) ──────────────────────────────────────────
const MULAW_DECODE_TABLE = new Int16Array(256);
(function buildTable() {
  for (let i = 0; i < 256; i++) {
    let mu = ~i & 0xff;
    const sign = mu & 0x80;
    mu &= 0x7f;
    const exponent = (mu >> 4) & 0x07;
    const mantissa = mu & 0x0f;
    let sample = ((mantissa << 3) + 0x84) << exponent;
    sample -= 0x84;
    MULAW_DECODE_TABLE[i] = sign ? -sample : sample;
  }
})();

function decodeMulaw(bytes: Uint8Array): Float32Array {
  const pcm = new Float32Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) pcm[i] = MULAW_DECODE_TABLE[bytes[i]] / 32768;
  return pcm;
}

// ─── Mulaw encode (browser mic → Grok) ───────────────────────────────────────
function linearToMulaw(sample: number): number {
  const BIAS = 0x84;
  const CLIP = 32635;
  let sign = (sample >> 8) & 0x80;
  if (sign) sample = -sample;
  if (sample > CLIP) sample = CLIP;
  sample += BIAS;
  let exponent = 7;
  for (let expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; exponent--, expMask >>= 1) {}
  const mantissa = (sample >> (exponent + 3)) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
}

/** Decimate Float32 from inRate to 8 kHz and mulaw-encode (voice MVP — no anti-alias filter). */
function encodeChunk(float32: Float32Array, inRate: number): Uint8Array {
  const ratio = inRate / 8000;
  const outLen = Math.floor(float32.length / ratio);
  const out = new Uint8Array(outLen);
  for (let i = 0; i < outLen; i++) {
    let s = float32[Math.floor(i * ratio)];
    s = Math.max(-1, Math.min(1, s)) * 32767;
    out[i] = linearToMulaw(s | 0);
  }
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export type SandboxStatus = 'idle' | 'connecting' | 'live' | 'ended' | 'limit' | 'denied' | 'error';
export type SandboxMode = 'echo' | 'simulation' | 'support';
export interface TranscriptLine { role: 'user' | 'assistant'; text: string }

export function useSandboxAudio() {
  const [status, setStatus] = useState<SandboxStatus>('idle');
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [liveLine, setLiveLine] = useState<TranscriptLine | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  // playback
  const playCtxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const queueRef = useRef<Float32Array[]>([]);
  const nextPlayRef = useRef(0);
  const playingRef = useRef(false);
  const JITTER = 3;

  const processQueue = useCallback(() => {
    const ctx = playCtxRef.current;
    const gain = gainRef.current;
    if (!ctx || !gain || queueRef.current.length === 0) {
      playingRef.current = false;
      return;
    }
    playingRef.current = true;
    const pcm = queueRef.current.shift()!;
    const buf = ctx.createBuffer(1, pcm.length, 8000);
    buf.getChannelData(0).set(pcm);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(gain);
    const now = ctx.currentTime;
    if (nextPlayRef.current < now) nextPlayRef.current = now + 0.05;
    src.start(nextPlayRef.current);
    nextPlayRef.current += pcm.length / 8000;
    src.onended = () => {
      if (queueRef.current.length > 0) processQueue();
      else playingRef.current = false;
    };
  }, []);

  const enqueueAudio = useCallback((b64: string) => {
    queueRef.current.push(decodeMulaw(base64ToBytes(b64)));
    if (!playingRef.current && queueRef.current.length >= JITTER) processQueue();
  }, [processQueue]);

  const stop = useCallback(() => {
    try { procRef.current?.disconnect(); } catch { /* ignore */ }
    try { micStreamRef.current?.getTracks().forEach(t => t.stop()); } catch { /* ignore */ }
    try { micCtxRef.current?.close(); } catch { /* ignore */ }
    try { playCtxRef.current?.close(); } catch { /* ignore */ }
    try { wsRef.current?.close(); } catch { /* ignore */ }
    procRef.current = null;
    micStreamRef.current = null;
    micCtxRef.current = null;
    playCtxRef.current = null;
    gainRef.current = null;
    wsRef.current = null;
    queueRef.current = [];
    playingRef.current = false;
    setStatus(prev => (prev === 'limit' || prev === 'denied' || prev === 'error' ? prev : 'ended'));
  }, []);

  const start = useCallback(async (mode: SandboxMode, lang: string, token: string) => {
    setError(null);
    setLines([]);
    setLiveLine(null);
    setStatus('connecting');

    // 1. Mic permission first (clear UX on denial).
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch {
      setStatus('denied');
      return;
    }
    micStreamRef.current = stream;

    // 2. Open the raw WebSocket to the backend Grok bridge (through the tunnel).
    //    Auth (JWT) is sent as the first message, not in the URL.
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${window.location.host}/webhooks/ws/sandbox`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onmessage = (ev) => {
      let msg: any;
      try { msg = JSON.parse(ev.data); } catch { return; }
      switch (msg.type) {
        case 'session':
          if (typeof msg.remainingSeconds === 'number') setRemainingSeconds(msg.remainingSeconds);
          break;
        case 'ready':
          setStatus('live');
          break;
        case 'audio':
          if (msg.payload) enqueueAudio(msg.payload);
          break;
        case 'transcript':
          if (msg.final) {
            setLines(prev => [...prev, { role: msg.role, text: msg.text }]);
            if (msg.role === 'assistant') setLiveLine(null);
          } else {
            setLiveLine({ role: msg.role, text: msg.text });
          }
          break;
        case 'limit':
          setStatus('limit');
          setRemainingSeconds(0);
          stop();
          break;
        case 'error':
          setError(msg.message || 'Session error');
          setStatus('error');
          stop();
          break;
      }
    };

    ws.onerror = () => {
      if (wsRef.current === ws) { setError('Connection failed'); setStatus('error'); }
    };

    ws.onclose = () => {
      if (wsRef.current === ws) {
        setStatus(prev => (prev === 'limit' || prev === 'denied' || prev === 'error' ? prev : 'ended'));
      }
    };

    ws.onopen = () => {
      // 3. Authenticate first — backend waits for this before starting Grok.
      ws.send(JSON.stringify({ type: 'start', token, mode, lang }));

      // 4. Wire up playback context.
      const playCtx = new AudioContext({ sampleRate: 8000 });
      const gain = playCtx.createGain();
      gain.gain.value = 1;
      gain.connect(playCtx.destination);
      playCtxRef.current = playCtx;
      gainRef.current = gain;
      nextPlayRef.current = 0;

      // 5. Wire up mic capture → mulaw → WS.
      const micCtx = new AudioContext();
      micCtxRef.current = micCtx;
      const source = micCtx.createMediaStreamSource(stream);
      const proc = micCtx.createScriptProcessor(4096, 1, 1);
      procRef.current = proc;
      proc.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const input = e.inputBuffer.getChannelData(0);
        const mulaw = encodeChunk(input, micCtx.sampleRate);
        ws.send(JSON.stringify({ type: 'audio', payload: bytesToBase64(mulaw) }));
      };
      source.connect(proc);
      proc.connect(micCtx.destination); // required for onaudioprocess to fire in some browsers
    };
  }, [enqueueAudio, stop]);

  return { status, lines, liveLine, remainingSeconds, error, start, stop };
}
