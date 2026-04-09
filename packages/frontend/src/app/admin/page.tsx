'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';

interface DashboardData {
  kpi: {
    total_revenue: number;
    minutes_used: number;
    total_sessions: number;
    margin: number;
    estimated_cost: number;
  };
  revenue_by_day: Array<{ date: string; revenue: string; minutes: string; sessions: string }>;
  recent_sessions: Array<{ id: string; duration_seconds: number; minutes_used: string; cost_usd: string; status: string; created_at: string }>;
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<DashboardData>('/admin/dashboard').then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center opacity-50">Loading dashboard...</div>;
  if (!data) return <div className="p-8 text-center opacity-50">Failed to load</div>;

  const kpiCards = [
    { label: 'Total Revenue', value: `$${(data.kpi.total_revenue ?? 0).toFixed(2)}`, icon: 'payments', color: '#4d8eff' },
    { label: 'Minutes Used', value: (data.kpi.minutes_used ?? 0).toFixed(0), icon: 'schedule', color: '#d0bcff' },
    { label: 'Margin', value: `${data.kpi.margin ?? 0}%`, icon: 'trending_up', color: (data.kpi.margin ?? 0) > 70 ? '#4ade80' : '#fbbf24' },
    { label: 'Sessions', value: (data.kpi.total_sessions ?? 0).toString(), icon: 'call', color: '#a4c9ff' },
  ];

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-headline font-bold">Dashboard</h1>
        <p className="text-sm mt-1" style={{ color: '#c2c6d6' }}>Last 30 days overview</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiCards.map((card) => (
          <div key={card.label} className="glass-panel rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute top-3 right-3">
              <span className="material-symbols-outlined text-xl" style={{ color: card.color, opacity: 0.5 }}>{card.icon}</span>
            </div>
            <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: '#c2c6d6' }}>{card.label}</div>
            <div className="text-2xl font-headline font-bold" style={{ color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Revenue Chart */}
      {data.revenue_by_day.length > 0 && (
        <div className="glass-panel rounded-2xl p-6">
          <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: '#c2c6d6' }}>Revenue by Day</h3>
          <div className="flex items-end gap-1 h-32">
            {data.revenue_by_day.map((day, i) => {
              const maxRev = Math.max(...data.revenue_by_day.map(d => parseFloat(d.revenue)), 0.01);
              const height = (parseFloat(day.revenue) / maxRev) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${day.date}: $${parseFloat(day.revenue).toFixed(2)}`}>
                  <div className="w-full rounded-t" style={{ height: `${Math.max(height, 2)}%`, background: 'linear-gradient(to top, #4d8eff, #adc6ff)', minHeight: '2px' }} />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-[10px]" style={{ color: '#c2c6d6' }}>
            <span>{data.revenue_by_day[0]?.date}</span>
            <span>{data.revenue_by_day[data.revenue_by_day.length - 1]?.date}</span>
          </div>
        </div>
      )}

      {/* Recent Sessions */}
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: '#c2c6d6' }}>Recent Sessions</h3>
          <Link href="/admin/sessions" className="text-xs" style={{ color: '#adc6ff' }}>View all</Link>
        </div>
        <div className="space-y-2">
          {data.recent_sessions.slice(0, 10).map((sess) => (
            <div key={sess.id} className="flex justify-between items-center text-sm py-1.5 border-b" style={{ borderColor: 'rgba(66, 71, 84, 0.15)' }}>
              <span className="text-xs" style={{ color: '#c2c6d6' }}>{new Date(sess.created_at).toLocaleString()}</span>
              <span className="font-mono text-xs">{Math.floor(sess.duration_seconds / 60)}m {sess.duration_seconds % 60}s</span>
              <span className="font-mono text-xs" style={{ color: '#4ade80' }}>${parseFloat(sess.cost_usd).toFixed(3)}</span>
            </div>
          ))}
          {data.recent_sessions.length === 0 && <p className="text-sm opacity-50">No sessions yet</p>}
        </div>
      </div>
    </div>
  );
}
