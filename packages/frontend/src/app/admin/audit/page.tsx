'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useIsMobile } from '@/lib/useBreakpoint';

interface AuditEntry {
  id: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  details: any;
  ip_address: string | null;
  created_at: string;
}

const ACTION_COLORS: Record<string, string> = {
  balance_added: '#4ade80',
  subscriber_blocked: '#f87171',
  subscriber_unblocked: '#4ade80',
  settings_changed: '#adc6ff',
  provider_updated: '#d0bcff',
  promo_created: '#fbbf24',
};

export default function AuditPage() {
  const isMobile = useIsMobile();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const params = filter ? `?action=${filter}` : '';
    api.get<{ logs: AuditEntry[] }>(`/admin/audit${params}&limit=100`)
      .then(r => setLogs(r.logs)).catch(() => {}).finally(() => setLoading(false));
  }, [filter]);

  if (loading) return <div className="p-8 text-center opacity-50">Loading...</div>;

  return (
    <div className="px-3 py-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <h1 className="text-xl md:text-2xl font-headline font-bold">Audit Log</h1>
        <select value={filter} onChange={e => setFilter(e.target.value)}
          className="px-3 py-1.5 min-h-[44px] md:min-h-0 rounded-lg text-sm" style={{ background: '#2f3542', color: '#dde2f3', border: 'none', outline: 'none' }}>
          <option value="">All Actions</option>
          <option value="balance_added">Balance Added</option>
          <option value="subscriber_blocked">Blocked</option>
          <option value="subscriber_unblocked">Unblocked</option>
          <option value="settings_changed">Settings Changed</option>
          <option value="provider_updated">Provider Updated</option>
          <option value="promo_created">Promo Created</option>
        </select>
      </div>

      {isMobile ? (
        <div className="space-y-2">
          {logs.map(log => (
            <div key={log.id} className="glass-panel rounded-xl p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ color: ACTION_COLORS[log.action] ?? '#c2c6d6', background: `${ACTION_COLORS[log.action] ?? '#c2c6d6'}15` }}>
                  {log.action}
                </span>
                <span className="text-xs shrink-0" style={{ color: '#c2c6d6' }}>{new Date(log.created_at).toLocaleString()}</span>
              </div>
              {log.resource_type && (
                <div className="font-mono text-xs" style={{ color: '#c2c6d6' }}>
                  {log.resource_type}/{log.resource_id?.slice(0, 8)}
                </div>
              )}
              {log.details && (
                <div className="text-xs break-all" style={{ color: '#c2c6d6' }}>
                  {JSON.stringify(log.details).slice(0, 120)}
                </div>
              )}
              {log.ip_address && (
                <div className="font-mono text-xs" style={{ color: '#c2c6d6' }}>IP: {log.ip_address}</div>
              )}
            </div>
          ))}
          {logs.length === 0 && <div className="text-center py-8 opacity-50 text-sm">No audit entries yet</div>}
        </div>
      ) : (
        <div className="glass-panel rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ color: '#c2c6d6' }}>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Resource</th>
                <th className="px-4 py-3 font-medium">Details</th>
                <th className="px-4 py-3 font-medium">IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} className="border-t" style={{ borderColor: 'rgba(66,71,84,0.15)' }}>
                  <td className="px-4 py-3 text-xs" style={{ color: '#c2c6d6' }}>{new Date(log.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ color: ACTION_COLORS[log.action] ?? '#c2c6d6', background: `${ACTION_COLORS[log.action] ?? '#c2c6d6'}15` }}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: '#c2c6d6' }}>
                    {log.resource_type && `${log.resource_type}/${log.resource_id?.slice(0, 8)}`}
                  </td>
                  <td className="px-4 py-3 text-xs max-w-xs truncate" style={{ color: '#c2c6d6' }}>
                    {log.details ? JSON.stringify(log.details).slice(0, 80) : '-'}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: '#c2c6d6' }}>{log.ip_address ?? '-'}</td>
                </tr>
              ))}
              {logs.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center opacity-50">No audit entries yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
