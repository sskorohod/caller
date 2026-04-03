'use client';
import { useRef, useCallback, useState } from 'react';
import { useSocket } from './socket';

// ─── Mulaw Decode Table ─────────────────────────────────────────────────────
// Convert 8-bit mulaw to 16-bit linear PCM, then normalize to Float32 [-1, 1]

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

function decodeMulaw(mulawBytes: Uint8Array): Float32Array {
  const pcm = new Float32Array(mulawBytes.length);
  for (let i = 0; i < mulawBytes.length; i++) {
    pcm[i] = MULAW_DECODE_TABLE[mulawBytes[i]] / 32768;
  }
  return pcm;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export type AudioChannel = 'both' | 'caller' | 'agent';

export function useCallAudio(callId: string) {
  const { socket } = useSocket();
  const [isListening, setIsListening] = useState(false);
  const [channel, setChannelState] = useState<AudioChannel>('both');
  const [volume, setVolumeState] = useState(0.8);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const nextPlayTimeRef = useRef(0);
  const channelRef = useRef<AudioChannel>('both');
  const bufferQueue = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);

  const JITTER_BUFFER = 3; // accumulate N chunks before starting playback

  const processQueue = useCallback(() => {
    const ctx = audioCtxRef.current;
    const gain = gainNodeRef.current;
    if (!ctx || !gain || bufferQueue.current.length === 0) {
      isPlayingRef.current = false;
      return;
    }

    isPlayingRef.current = true;
    const pcm = bufferQueue.current.shift()!;

    const audioBuffer = ctx.createBuffer(1, pcm.length, 8000);
    audioBuffer.getChannelData(0).set(pcm);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(gain);

    // Schedule playback
    const now = ctx.currentTime;
    if (nextPlayTimeRef.current < now) {
      nextPlayTimeRef.current = now + 0.05; // small initial delay
    }

    source.start(nextPlayTimeRef.current);
    nextPlayTimeRef.current += pcm.length / 8000;

    source.onended = () => {
      if (bufferQueue.current.length > 0) {
        processQueue();
      } else {
        isPlayingRef.current = false;
      }
    };
  }, []);

  const handleAudioEvent = useCallback((data: { source: string; payload: string }) => {
    const ch = channelRef.current;
    if (ch !== 'both' && data.source !== ch) return;

    const mulaw = base64ToUint8Array(data.payload);
    const pcm = decodeMulaw(mulaw);
    bufferQueue.current.push(pcm);

    if (!isPlayingRef.current && bufferQueue.current.length >= JITTER_BUFFER) {
      processQueue();
    }
  }, [processQueue]);

  const startListening = useCallback((ch: AudioChannel = 'both') => {
    if (!socket || isListening) return;

    // AudioContext must be created from user gesture
    const ctx = new AudioContext({ sampleRate: 8000 });
    const gain = ctx.createGain();
    gain.gain.value = volume;
    gain.connect(ctx.destination);

    audioCtxRef.current = ctx;
    gainNodeRef.current = gain;
    nextPlayTimeRef.current = 0;
    bufferQueue.current = [];
    isPlayingRef.current = false;
    channelRef.current = ch;

    socket.emit('call:listen:start', { call_id: callId, channel: ch });
    socket.on('call:audio', handleAudioEvent);

    setIsListening(true);
    setChannelState(ch);
  }, [socket, callId, isListening, volume, handleAudioEvent]);

  const stopListening = useCallback(() => {
    if (!socket) return;

    socket.emit('call:listen:stop', { call_id: callId });
    socket.off('call:audio', handleAudioEvent);

    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    gainNodeRef.current = null;
    bufferQueue.current = [];
    isPlayingRef.current = false;

    setIsListening(false);
  }, [socket, callId, handleAudioEvent]);

  const setChannel = useCallback((ch: AudioChannel) => {
    channelRef.current = ch;
    setChannelState(ch);
    if (socket && isListening) {
      socket.emit('call:listen:channel', { call_id: callId, channel: ch });
    }
  }, [socket, callId, isListening]);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = v;
    }
  }, []);

  return {
    isListening,
    channel,
    volume,
    startListening,
    stopListening,
    setChannel,
    setVolume,
  };
}
