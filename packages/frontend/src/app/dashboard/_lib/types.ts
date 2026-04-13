export interface DashboardStats {
  total_calls: number;
  today_calls: number;
  week_calls: number;
  active_calls: number;
  success_rate: number;
  status_breakdown: Record<string, number>;
  direction_breakdown: Record<string, number>;
  sentiment_breakdown: Record<string, number>;
  avg_duration_seconds: number;
  total_minutes_30d: number;
  cost_total_30d: number;
  cost_llm_30d: number;
  cost_tts_30d: number;
  cost_stt_30d: number;
  cost_telephony_30d: number;
  avg_qa_score: number;
  total_turns_30d: number;
  daily_calls: { day: string; count: number }[];
  top_agents: { agent_profile_id: string; count: number }[];
}

export interface RecentCall {
  id: string;
  direction: string;
  status: string;
  phone_number_to?: string;
  phone_number_from?: string;
  to_number?: string;
  from_number?: string;
  duration_seconds: number | null;
  cost_total: string | null;
  summary?: string | null;
  sentiment?: string | null;
  agent_profile_id?: string | null;
  created_at: string;
}

export interface Agent {
  id: string;
  name: string;
  is_active: boolean;
}

export interface TelConnection {
  phone_number: string;
  inbound_enabled: boolean;
  outbound_enabled: boolean;
  ai_answering_enabled: boolean;
}
