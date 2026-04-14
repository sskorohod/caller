// Types, constants, and utilities for the Calls page
// Extracted from calls/page.tsx to reduce file size

export interface Call {
  id: string;
  direction: 'inbound' | 'outbound';
  status: string;
  from_number: string;
  to_number: string;
  duration_seconds: number | null;
  summary: string | null;
  sentiment: string | null;
  qa_score: number | null;
  cost_total: string | null;
  agent_profile_id: string | null;
  created_at: string;
}

export interface TranscriptEntry {
  role: string;
  content: string;
  translated?: string;
  timestamp?: string;
}

export interface RawTranscriptEntry {
  speaker?: string;
  role?: string;
  text?: string;
  content?: string;
  translated?: string;
  timestamp?: string;
}

export interface AiSession {
  id: string;
  transcript: TranscriptEntry[] | null;
  recording_url: string | null;
  summary: string | null;
  action_items: string[] | null;
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed' | null;
  qa_score: number | null;
  cost_total: string | null;
  total_turns: number | null;
  avg_latency_ms: number | null;
}

export interface CallDetail {
  call: Call;
  session: AiSession | null;
  events: unknown[];
}

export interface AgentOption {
  id: string;
  name: string;
}

export interface DashboardStats {
  total_calls: number;
  today_calls: number;
  week_calls: number;
  active_calls: number;
  success_rate: number;
  avg_duration_seconds: number;
  total_minutes_30d: number;
  direction_breakdown: Record<string, number>;
}

export interface AdvancedFilters {
  dateFrom: string;
  dateTo: string;
  agentId: string;
  sentimentPositive: boolean;
  sentimentNeutral: boolean;
  sentimentNegative: boolean;
  sentimentMixed: boolean;
  minDuration: string;
  maxDuration: string;
}

export const EMPTY_FILTERS: AdvancedFilters = {
  dateFrom: '', dateTo: '', agentId: '',
  sentimentPositive: false, sentimentNeutral: false, sentimentNegative: false, sentimentMixed: false,
  minDuration: '', maxDuration: '',
};

export const STATUS_COLORS: Record<string, string> = {
  completed:   'bg-[var(--th-success-bg)] text-[var(--th-success-text)]',
  failed:      'bg-[var(--th-error-bg)] text-[var(--th-error-text)]',
  in_progress: 'bg-[var(--th-info-bg)] text-[var(--th-info-text)]',
  initiated:   'bg-[var(--th-primary-bg)] text-[var(--th-primary-text)]',
  ringing:     'bg-[var(--th-warning-bg)] text-[var(--th-warning-text)]',
  cancelled:   'bg-[var(--th-surface)] text-[var(--th-text-muted)]',
  canceled:    'bg-[var(--th-surface)] text-[var(--th-text-muted)]',
  no_answer:   'bg-[var(--th-warning-bg)] text-[var(--th-warning-text)]',
};

export const STATUS_LABELS: Record<string, string> = {
  completed: 'Completed', failed: 'Failed', in_progress: 'In Progress',
  initiated: 'Initiated', ringing: 'Ringing', cancelled: 'Cancelled',
  canceled: 'Cancelled', no_answer: 'No Answer',
};

export const SENTIMENT_BADGE: Record<string, { cls: string; label: string; icon: string }> = {
  positive: { cls: 'bg-[var(--th-success-bg)] text-[var(--th-success-text)]', label: 'Positive', icon: '+' },
  negative: { cls: 'bg-[var(--th-error-bg)] text-[var(--th-error-text)]', label: 'Negative', icon: '−' },
  neutral:  { cls: 'bg-[var(--th-surface)] text-[var(--th-text-muted)]', label: 'Neutral', icon: '~' },
  mixed:    { cls: 'bg-[var(--th-warning-bg)] text-[var(--th-warning-text)]', label: 'Mixed', icon: '±' },
};

export const ROLE_LABELS: Record<string, string> = {
  you: 'You',
  other: 'Other party',
  caller: 'Caller',
  agent: 'Agent',
};

export function normalizeTranscript(raw: RawTranscriptEntry[]): TranscriptEntry[] {
  return raw.map(entry => {
    const rawRole = entry.role ?? entry.speaker ?? 'caller';
    const role = rawRole === 'subscriber' ? 'you'
      : rawRole === 'other' ? 'other'
      : rawRole === 'operator' ? 'you'
      : rawRole === 'agent' ? 'agent'
      : rawRole === 'caller' ? 'caller'
      : rawRole;
    return {
      role,
      content: entry.content ?? entry.text ?? '',
      translated: entry.translated,
      timestamp: entry.timestamp,
    };
  });
}

export function fmtDuration(s: number | null) {
  if (!s) return '—';
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function fmtDateShort(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
