'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { io as socketIO, Socket } from 'socket.io-client';

// ─── Types ──────────────────────────────────────────────────────────────────

interface TranscriptEntry {
  role: 'agent' | 'caller' | 'system';
  content: string;
  timestamp?: string;
}

interface CallData {
  id: string;
  direction: string;
  status: string;
  from_number: string;
  to_number: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function MonitorPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const callId = params.id as string;
  const token = searchParams.get('token') ?? '';

  const [callData, setCallData] = useState<CallData | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [status, setStatus] = useState<string>('loading');
  const [error, setError] = useState<string | null>(null);
  const [instruction, setInstruction] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);

  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

  // ─── Load call data ────────────────────────────────────────────────────

  useEffect(() => {
    if (!callId || !token) {
      setError('Missing call ID or token');
      return;
    }

    fetch(`${API_BASE}/calls/${callId}/live-public?token=${encodeURIComponent(token)}`)
      .then(async res => {
        if (!res.ok) throw new Error(res.status === 403 ? 'Link expired' : 'Call not found');
        return res.json();
      })
      .then(data => {
        setCallData(data.call);
        setStatus(data.call.status);
        if (data.session?.transcript && Array.isArray(data.session.transcript)) {
          setTranscript(data.session.transcript.map((e: any) => ({
            role: e.role ?? e.speaker ?? 'caller',
            content: e.content ?? e.text ?? '',
            timestamp: e.timestamp,
          })));
        }
      })
      .catch(err => setError(err.message));
  }, [callId, token]);

  // ─── Socket.IO ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!callId || !token || error) return;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || (typeof window !== 'undefined' ? window.location.origin : '');
    const s = socketIO(wsUrl, {
      path: '/socket.io',
      auth: { shareToken: token },
      transports: ['websocket'],
    });

    s.on('connect', () => {
      s.emit('call:join', { call_id: callId });
      s.emit('call:translate:join', { call_id: callId });
    });

    s.on('call:transcript', (data: { call_id: string; speaker: string; text: string; timestamp: string }) => {
      if (data.call_id !== callId || !data.text) return;
      const role = data.speaker === 'operator' ? 'agent' : data.speaker === 'system' ? 'system' : 'caller';
      setTranscript(prev => {
        // Skip if operator text already added via translation
        if (role === 'agent' && prev.length > 0) {
          const last = prev[prev.length - 1];
          if (last.role === 'agent') return prev;
        }
        return [...prev, { role: role as TranscriptEntry['role'], content: data.text, timestamp: data.timestamp }];
      });
    });

    // Operator translations (arrive before call:transcript in streaming mode)
    s.on('call:translation', (data: { call_id: string; speaker: string; original: string; translated: string; timestamp: string }) => {
      if (data.call_id !== callId) return;
      setTranscript(prev => {
        // Merge with last operator entry or create new
        if (prev.length > 0) {
          const last = prev[prev.length - 1];
          if (last.role === 'agent') {
            const updated = [...prev];
            updated[prev.length - 1] = {
              ...last,
              content: last.content + ' ' + data.original,
            };
            return updated;
          }
        }
        return [...prev, { role: 'agent' as TranscriptEntry['role'], content: data.original, timestamp: data.timestamp }];
      });
    });

    s.on('call:status', (data: { call_id: string; status: string }) => {
      if (data.call_id !== callId) return;
      setStatus(data.status);
    });

    setSocket(s);
    return () => { s.disconnect(); };
  }, [callId, token, error]);

  // ─── Auto-scroll ──────────────────────────────────────────────────────

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // ─── Send instruction ─────────────────────────────────────────────────

  const sendInstruction = useCallback(() => {
    if (!instruction.trim() || !socket) return;
    socket.emit('call:instruction', { call_id: callId, text: instruction.trim() });
    setTranscript(prev => [...prev, {
      role: 'system',
      content: instruction.trim(),
      timestamp: new Date().toISOString(),
    }]);
    setInstruction('');
  }, [instruction, socket, callId]);

  // ─── Render ───────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-4xl mb-4">🔗</div>
          <h1 className="text-xl font-bold mb-2">{error}</h1>
          <p className="text-gray-400 text-sm">This monitoring link may have expired.</p>
        </div>
      </div>
    );
  }

  const isActive = status === 'ringing' || status === 'in_progress';
  const phone = callData
    ? (callData.direction === 'outbound' ? callData.to_number : callData.from_number)
    : '';

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 bg-gray-900 border-b border-gray-800 flex items-center justify-between min-h-[56px]">
        <div className="min-w-0">
          <div className="text-sm md:text-sm font-mono font-bold truncate">{phone || 'Loading...'}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : status === 'completed' ? 'bg-gray-500' : 'bg-yellow-500'}`} />
            <span className="text-xs text-gray-400 capitalize">{status}</span>
          </div>
        </div>
        <div className="text-xs text-gray-500">
          {callData?.direction === 'outbound' ? '↗ Out' : '↙ In'}
        </div>
      </div>

      {/* Transcript */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-3 space-y-2.5 md:space-y-2">
        {transcript.length === 0 && isActive && (
          <div className="flex items-center justify-center h-32">
            <div className="text-center text-gray-500">
              <div className="w-8 h-8 mx-auto border-2 border-green-500 border-t-transparent rounded-full animate-spin mb-2" />
              <div className="text-sm">Waiting for conversation...</div>
            </div>
          </div>
        )}

        {transcript.map((entry, i) => {
          if (entry.role === 'system') {
            return (
              <div key={i} className="flex justify-center">
                <div className="px-3 py-1.5 md:py-1 rounded-full bg-amber-900/30 text-amber-400 text-xs">
                  {entry.content}
                </div>
              </div>
            );
          }

          const isAgent = entry.role === 'agent';
          return (
            <div key={i} className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[88%] md:max-w-[85%] rounded-2xl px-3.5 py-2.5 md:py-2 ${
                isAgent
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-gray-800 text-gray-100 rounded-bl-sm'
              }`}>
                <div className="text-[15px] md:text-sm leading-relaxed">{entry.content}</div>
                {entry.timestamp && (
                  <div className={`text-[10px] mt-0.5 ${isAgent ? 'text-blue-200/50' : 'text-gray-500'}`}>
                    {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={transcriptEndRef} />
      </div>

      {/* Instruction input (only when active) */}
      {isActive && (
        <div className="shrink-0 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-gray-900 border-t border-gray-800">
          <div className="flex gap-2">
            <input
              type="text"
              value={instruction}
              onChange={e => setInstruction(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendInstruction()}
              placeholder="Send instruction to agent..."
              className="flex-1 px-3 py-2.5 min-h-[44px] rounded-xl bg-gray-800 text-white text-base md:text-sm border border-gray-700 focus:outline-none focus:border-blue-500 placeholder-gray-500"
            />
            <button
              onClick={sendInstruction}
              disabled={!instruction.trim()}
              className="px-4 py-2.5 min-h-[44px] rounded-xl bg-blue-600 text-white text-sm font-medium disabled:opacity-30 active:bg-blue-700 active:scale-95 transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      )}

      {/* Call ended */}
      {status === 'completed' && (
        <div className="shrink-0 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-gray-900 border-t border-gray-800 text-center">
          <div className="text-gray-400 text-sm">Call ended</div>
        </div>
      )}
    </div>
  );
}
