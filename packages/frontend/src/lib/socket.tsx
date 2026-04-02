'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './auth-context';

interface SocketState {
  socket: Socket | null;
  connected: boolean;
}

const SocketContext = createContext<SocketState>({ socket: null, connected: false });

export function SocketProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token || typeof window === 'undefined') return;

    const s = io(window.location.origin, {
      auth: { token },
      transports: ['polling', 'websocket'],
      path: '/socket.io/',
    });

    s.on('connect', () => { console.log('[Socket.IO] Connected'); setConnected(true); });
    s.on('disconnect', (reason) => { console.log('[Socket.IO] Disconnected:', reason); setConnected(false); });
    s.on('connect_error', (err) => { console.error('[Socket.IO] Error:', err.message); });

    setSocket(s);
    return () => { s.disconnect(); };
  }, [token]);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() { return useContext(SocketContext); }
