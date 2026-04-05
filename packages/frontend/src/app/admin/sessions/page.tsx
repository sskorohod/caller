'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Session {
  id: string;
  subscriber_id: string;
  duration_seconds: number;
  minutes_used: string;
  cost_usd: string;
  status: string;
  transcript: any[];
  created_at: string;
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stats, setStats] = useState<{ avg_duration: string; total_sessions: number; total_minutes: string }>({ avg_duration: '0', total_sessions: 0, total_minutes: '0' });
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ sessions: Session[]; stats: typeof stats }>('/admin/sessions?limit=100')
      .then(r => { setSessions(r.sessions); setStats(r.stats); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center opacity-50">Loading...</div>;

  const statCards = [
    { label: 'Total Sessions', value: stats.total_sessions.toString(), icon: 'call' },
    { label: 'Avg Duration', value: `${Math.round(parseFloat(stats.avg_duration || '0') / 60)}m`, icon: 'schedule' },
    { label: 'Total Minutes', value: parseFloat(stats.total_minutes || '0').toFixed(0), icon: 'timer' },
  ];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-headline font-bold">Sessions</h1>

      <div className="grid grid-cols-3 gap-4">
        {statCards.map(c => (
          <div key={c.label} className="glass-panel rounded-2xl p-5">
            <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: '#c2c6d6' }}>{c.label}</div>
            <div className="text-2xl font-headline font-bold" style={{ color: '#adc6ff' }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ color: '#c2c6d6' }}>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Duration</th>
              <th className="px-4 py-3 font-medium">Minutes</th>
              <th className="px-4 py-3 font-medium">Cost</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map(s => (
              <>
                <tr key={s.id} className="cursor-pointer hover:bg-white/5 border-t" style={{ borderColor: 'rgba(66,71,84,0.15)' }}
                  onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
                  <td className="px-4 py-3">{new Date(s.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 font-mono">{Math.floor(s.duration_seconds / 60)}m {s.duration_seconds % 60}s</td>
                  <td className="px-4 py-3 font-mono">{parseFloat(s.minutes_used).toFixed(1)}</td>
                  <td className="px-4 py-3 font-mono" style={{ color: '#4ade80' }}>${parseFloat(s.cost_usd).toFixed(3)}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-xs" style={s.status === 'completed' ? { background: 'rgba(74,222,128,0.1)', color: '#4ade80' } : { background: 'rgba(251,191,36,0.1)', color: '#fbbf24' }}>{s.status}</span>
                  </td>
                </tr>
                {expanded === s.id && s.transcript && (
                  <tr key={`${s.id}-t`}><td colSpan={5} className="px-4 py-4" style={{ background: 'rgba(22,28,40,0.5)' }}>
                    <div className="text-xs font-bold uppercase mb-2" style={{ color: '#c2c6d6' }}>Transcript</div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {(Array.isArray(s.transcript) ? s.transcript : []).map((t: any, i: number) => (
                        <div key={i} className="text-xs">
                          <span className="font-bold" style={{ color: t.speaker === 'subscriber' ? '#adc6ff' : '#d0bcff' }}>{t.speaker}:</span>{' '}
                          <span>{t.text}</span>
                          {t.translated && <span className="italic ml-2" style={{ color: '#c2c6d6' }}>&rarr; {t.translated}</span>}
                        </div>
                      ))}
                      {(!s.transcript || (Array.isArray(s.transcript) && s.transcript.length === 0)) && <p className="opacity-50">No transcript data</p>}
                    </div>
                  </td></tr>
                )}
              </>
            ))}
            {sessions.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center opacity-50">No sessions yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
