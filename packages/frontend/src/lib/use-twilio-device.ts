'use client';
import { useRef, useCallback, useState } from 'react';
import { Device, Call } from '@twilio/voice-sdk';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('caller_token');
}

export function useTwilioDevice() {
  const deviceRef = useRef<Device | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  const initDevice = useCallback(async () => {
    if (deviceRef.current) return deviceRef.current;

    // Fetch voice token
    const token = getToken();
    const res = await fetch(`${API_BASE}/calls/voice-token`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to get voice token');
    const data = await res.json();

    const device = new Device(data.token, {
      logLevel: 1,
      codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
    });

    device.on('registered', () => {
      setIsReady(true);
    });

    device.on('incoming', (call: Call) => {
      // Auto-accept incoming calls (takeover)
      call.accept();
      setActiveCall(call);

      call.on('disconnect', () => {
        setActiveCall(null);
        setIsMuted(false);
      });

      call.on('cancel', () => {
        setActiveCall(null);
        setIsMuted(false);
      });
    });

    device.on('tokenWillExpire', async () => {
      // Refresh token
      try {
        const res = await fetch(`${API_BASE}/calls/voice-token`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (res.ok) {
          const data = await res.json();
          device.updateToken(data.token);
        }
      } catch { /* ignore refresh errors */ }
    });

    device.on('error', (err) => {
      console.error('[TwilioDevice] Error:', err);
    });

    await device.register();
    deviceRef.current = device;

    return device;
  }, []);

  const makeCall = useCallback(async (params: Record<string, string>) => {
    const device = deviceRef.current || await initDevice();
    const call = await device.connect({ params });
    setActiveCall(call);

    call.on('disconnect', () => {
      setActiveCall(null);
      setIsMuted(false);
    });

    return call;
  }, [initDevice]);

  const hangup = useCallback(() => {
    if (activeCall) {
      activeCall.disconnect();
      setActiveCall(null);
      setIsMuted(false);
    }
  }, [activeCall]);

  const toggleMute = useCallback(() => {
    if (activeCall) {
      const newMuted = !isMuted;
      activeCall.mute(newMuted);
      setIsMuted(newMuted);
    }
  }, [activeCall, isMuted]);

  const destroyDevice = useCallback(() => {
    if (deviceRef.current) {
      deviceRef.current.destroy();
      deviceRef.current = null;
      setIsReady(false);
      setActiveCall(null);
      setIsMuted(false);
    }
  }, []);

  return {
    isReady,
    activeCall,
    isMuted,
    initDevice,
    makeCall,
    hangup,
    toggleMute,
    destroyDevice,
  };
}
