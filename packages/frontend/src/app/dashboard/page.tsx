'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface Stats {
  total_calls: number;
  active_calls: number;
  minutes_used: number;
  agents_count: number;
}

interface RecentCall {
  id: string;
  direction: string;
  status: string;
  phone_number_to: string;
  phone_number_from: string;
  duration_seconds: number | null;
  created_at: string;
}

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-[#e2e8f0] p-5 shadow-[0_1px_3px_rgba(0,0,0,.04)]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-[#475569]">{label}</span>
        <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center`} />
      </div>
      <div className="text-2xl font-bold text-[#0f172a]">{value}</div>
      {sub && <div className="text-xs text-[#94a3b8] mt-1">{sub}</div>}
    </div>
  );
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    completed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    in_progress: 'bg-blue-100 text-blue-700',
    initiated: 'bg-purple-100 text-purple-700',
    ringing: 'bg-yellow-100 text-yellow-700',
    cancelled: 'bg-gray-100 text-gray-600',
  };
  return map[status] ?? 'bg-gray-100 text-gray-600';
}

function fmtDuration(sec: number | null) {
  if (!sec) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function OverviewPage() {
  const { workspace } = useAuth();
  const [calls, setCalls] = useState<RecentCall[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ calls: RecentCall[]; total: number }>('/calls?limit=8')
      .then(r => setCalls(r?.calls ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalCalls = calls.length;
  const activeCalls = calls.filter(c => c.status === 'in_progress').length;
  const totalMinutes = Math.round(calls.reduce((a, c) => a + (c.duration_seconds ?? 0), 0) / 60);

  return (
    <div className="space-y-7">
      {/* Welcome */}
      <div>
        <h2 className="text-xl font-bold text-[#0f172a]">Good {getTimeOfDay()}, {workspace?.name ?? 'there'} 👋</h2>
        <p className="text-sm text-[#94a3b8] mt-1">Here's what's happening with your AI phone agents.</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-5">
        <KpiCard label="Total Calls" value={String(totalCalls)} sub="All time" color="bg-[#eef2ff]" />
        <KpiCard label="Active Now" value={String(activeCalls)} sub="In progress" color="bg-[#dcfce7]" />
        <KpiCard label="Minutes Used" value={String(totalMinutes)} sub="This session" color="bg-[#fef3c7]" />
        <KpiCard label="Agents" value="—" sub="Configure below" color="bg-[#fce7f3]" />
      </div>

      {/* Recent Calls */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,.04)]">
        <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#0f172a]">Recent Calls</h2>
          <a href="/dashboard/calls" className="text-xs text-[#6366f1] hover:text-[#4f46e5] font-medium">View all →</a>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="w-8 h-8 bg-slate-100 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-slate-100 rounded w-1/4" />
                  <div className="h-2.5 bg-slate-100 rounded w-1/3" />
                </div>
                <div className="h-5 bg-slate-100 rounded w-20" />
              </div>
            ))}
          </div>
        ) : calls.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 bg-[#f1f5f9] rounded-2xl flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-[#94a3b8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-[#475569]">No calls yet</p>
            <p className="text-xs text-[#94a3b8] mt-1 max-w-xs">Connect Twilio and create an agent to start making AI-powered calls.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-[#f8fafc] border-b border-[#e2e8f0]">
              <tr>
                {['Phone Number', 'Direction', 'Status', 'Duration', 'Date'].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-[#94a3b8] uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {calls.map(call => (
                <tr key={call.id} className="hover:bg-[#f8fafc] transition-colors">
                  <td className="px-6 py-3.5 text-sm font-medium text-[#0f172a]">
                    {call.direction === 'outbound' ? call.phone_number_to : call.phone_number_from}
                  </td>
                  <td className="px-6 py-3.5">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${call.direction === 'outbound' ? 'bg-[#eef2ff] text-[#6366f1]' : 'bg-[#f0fdf4] text-[#16a34a]'}`}>
                      {call.direction === 'outbound' ? '↑ Out' : '↓ In'}
                    </span>
                  </td>
                  <td className="px-6 py-3.5">
                    <span className={`inline-flex text-xs px-2.5 py-0.5 rounded-full font-medium ${statusBadge(call.status)}`}>
                      {call.status}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-sm text-[#475569]">{fmtDuration(call.duration_seconds)}</td>
                  <td className="px-6 py-3.5 text-sm text-[#94a3b8]">{fmtDate(call.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
