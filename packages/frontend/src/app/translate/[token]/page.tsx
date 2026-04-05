'use client';
import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { io as socketIO, Socket } from 'socket.io-client';

interface TranslationEntry {
  speaker: string;
  original: string;
  translated: string;
  timestamp: string;
}

interface InterimText {
  text: string;
  timestamp: string;
}

export default function LiveTranslatePage() {
  const params = useParams();
  const token = params.token as string;

  const [translations, setTranslations] = useState<TranslationEntry[]>([]);
  const [interim, setInterim] = useState<InterimText | null>(null);
  const [status, setStatus] = useState<'connecting' | 'live' | 'ended' | 'error'>('connecting');
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Missing token');
      setStatus('error');
      return;
    }

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || (typeof window !== 'undefined' ? window.location.origin : '');
    const s = socketIO(wsUrl, {
      path: '/socket.io',
      auth: { shareToken: token },
      transports: ['websocket'],
    });
    socketRef.current = s;

    s.on('connect', () => {
      // Join translate room using token — backend resolves call_id from token
      s.emit('call:translate:join:token', { token });
      setStatus('live');
    });

    s.on('connect_error', () => {
      setError('Connection failed');
      setStatus('error');
    });

    // Real-time translation events
    s.on('call:translation', (data: TranslationEntry) => {
      setTranslations(prev => [...prev, data]);
      setInterim(null);
    });

    // Interim transcript (live typing feel)
    s.on('call:transcript', (data: { text: string; isFinal: boolean; timestamp: string }) => {
      if (!data.isFinal) {
        setInterim({ text: data.text, timestamp: data.timestamp });
      } else {
        setInterim(null);
      }
    });

    // Call ended
    s.on('call:status', (data: { status: string }) => {
      if (data.status === 'completed' || data.status === 'failed') {
        setStatus('ended');
      }
    });

    return () => {
      s.disconnect();
    };
  }, [token]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [translations, interim]);

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-4xl mb-4">&#128683;</div>
          <h1 className="text-xl font-semibold text-white mb-2">Connection Error</h1>
          <p className="text-gray-400">{error || 'Unable to connect to translation session'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-950/90 backdrop-blur border-b border-gray-800 px-4 py-3">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-2">
            <span className="text-lg">&#127760;</span>
            <span className="font-semibold text-sm">Live Translator</span>
          </div>
          <div className="flex items-center gap-2">
            {status === 'live' && (
              <span className="flex items-center gap-1.5 text-xs text-green-400">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                Live
              </span>
            )}
            {status === 'ended' && (
              <span className="text-xs text-gray-500">Call ended</span>
            )}
            {status === 'connecting' && (
              <span className="text-xs text-yellow-400">Connecting...</span>
            )}
          </div>
        </div>
      </div>

      {/* Translations */}
      <div className="flex-1 overflow-y-auto px-4 py-4 max-w-2xl mx-auto w-full">
        {translations.length === 0 && !interim && status === 'live' && (
          <div className="text-center text-gray-500 mt-20">
            <div className="text-3xl mb-3">&#127911;</div>
            <p className="text-sm">Listening for conversation...</p>
            <p className="text-xs text-gray-600 mt-1">Translations will appear here in real-time</p>
          </div>
        )}

        {translations.map((entry, i) => (
          <div key={i} className="mb-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-gray-500 uppercase">
                {entry.speaker === 'subscriber' ? 'You' : 'Other'}
              </span>
              <span className="text-xs text-gray-600">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <div className="text-sm text-gray-400 mb-0.5">{entry.original}</div>
            <div className="text-base text-white font-medium">{entry.translated}</div>
          </div>
        ))}

        {/* Interim (live typing) */}
        {interim && (
          <div className="mb-4 opacity-60">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-gray-500">
                <span className="inline-block w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse mr-1" />
                Speaking...
              </span>
            </div>
            <div className="text-sm text-gray-400 italic">{interim.text}</div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Footer */}
      {status === 'ended' && translations.length > 0 && (
        <div className="border-t border-gray-800 px-4 py-3 text-center">
          <p className="text-xs text-gray-500">
            Session ended &middot; {translations.length} translations
          </p>
        </div>
      )}
    </div>
  );
}
