'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Call {
  id: string;
  direction: 'inbound' | 'outbound';
  status: string;
  phone_number_to: string;
  phone_number_from: string;
  duration_seconds: number | null;
  summary: string | null;
  sentiment_score: number | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  completed:   'bg-green-100 text-green-700',
  failed:      'bg-red-100 text-red-700',
  in_progress: 'bg-blue-100 text-blue-700',
  initiated:   'bg-purple-100 text-purple-700',
  ringing:     'bg-yellow-100 text-yellow-700',
  cancelled:   'bg-gray-100 text-gray-500',
  no_answer:   'bg-orange-100 text-orange-600',
};

function fmtDuration(s: number | null) {
  if (!s) return '—';
  return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
}

export default function CallsPage() {
  const [calls, setCalls]       = useState<Call[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [filter, setFilter]     = useState('all');
  const [selected, setSelected] = useState<Call | null>(null);

  useEffect(() => {
    api.get<{ calls: Call[]; total: number }>('/calls?limit=100')
      .then(r => setCalls(r?.calls ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = calls.filter(c => {
    const matchSearch = !search || c.phone_number_to?.includes(search) || c.phone_number_from?.includes(search);
    const matchFilter = filter === 'all' || c.direction === filter || c.status === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#0f172a]">Calls</h2>
          <p className="text-sm text-[#94a3b8] mt-0.5">{calls.length} total calls</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,.04)]">
        {/* Filters */}
        <div className="px-5 py-4 border-b border-[#e2e8f0] flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by phone number..."
              className="w-full pl-9 pr-3.5 py-2 rounded-lg border border-[#e2e8f0] text-sm text-[#0f172a] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1] transition-colors"
            />
          </div>
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-[#e2e8f0] text-sm text-[#475569] focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1] bg-white"
          >
            <option value="all">All calls</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
          <div className="ml-auto text-xs text-[#94a3b8]">{filtered.length} results</div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex gap-4 animate-pulse">
                <div className="w-24 h-3.5 bg-slate-100 rounded" />
                <div className="w-16 h-3.5 bg-slate-100 rounded" />
                <div className="w-20 h-3.5 bg-slate-100 rounded" />
                <div className="w-12 h-3.5 bg-slate-100 rounded" />
                <div className="w-28 h-3.5 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16">
            <p className="text-sm text-[#475569] font-medium">No calls found</p>
            <p className="text-xs text-[#94a3b8] mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                <tr>
                  {['Phone Number','Direction','Status','Duration','Date',''].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-[#94a3b8] uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {filtered.map(call => (
                  <tr key={call.id} className="hover:bg-[#f8fafc] transition-colors cursor-pointer" onClick={() => setSelected(call)}>
                    <td className="px-5 py-3.5 text-sm font-medium text-[#0f172a]">
                      {call.direction === 'outbound' ? call.phone_number_to : call.phone_number_from}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${call.direction === 'outbound' ? 'bg-[#eef2ff] text-[#6366f1]' : 'bg-[#f0fdf4] text-[#16a34a]'}`}>
                        {call.direction === 'outbound' ? '↑ Out' : '↓ In'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[call.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {call.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-[#475569]">{fmtDuration(call.duration_seconds)}</td>
                    <td className="px-5 py-3.5 text-sm text-[#94a3b8]">{fmtDate(call.created_at)}</td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs text-[#6366f1] hover:text-[#4f46e5]">Details →</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#e2e8f0]">
              <div>
                <h2 className="text-base font-semibold text-[#0f172a]">Call Details</h2>
                <p className="text-xs text-[#94a3b8] mt-0.5">{fmtDate(selected.created_at)}</p>
              </div>
              <button onClick={() => setSelected(null)} className="p-1.5 hover:bg-[#f1f5f9] rounded-lg transition-colors">
                <svg className="w-4 h-4 text-[#94a3b8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {[
                ['From', selected.phone_number_from],
                ['To', selected.phone_number_to],
                ['Direction', selected.direction],
                ['Status', selected.status],
                ['Duration', fmtDuration(selected.duration_seconds)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between items-center py-2 border-b border-[#f1f5f9] last:border-0">
                  <span className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wide">{label}</span>
                  <span className="text-sm text-[#0f172a] font-medium">{value || '—'}</span>
                </div>
              ))}
              {selected.summary && (
                <div className="rounded-xl bg-[#f8fafc] p-4">
                  <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wide mb-2">AI Summary</p>
                  <p className="text-sm text-[#475569] leading-relaxed">{selected.summary}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
