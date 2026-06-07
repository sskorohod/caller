export interface Workspace {
  id: string;
  name: string;
  industry: string | null;
  timezone: string | null;
  conversation_owner_default: string;
  allow_inbound_external_handoff: boolean;
  call_recording_disclosure: boolean;
  ai_disclosure: boolean;
  inbound_auto_answer_delay_seconds: number;
}

export type AccentColor = 'indigo' | 'blue' | 'emerald' | 'purple' | 'amber';
