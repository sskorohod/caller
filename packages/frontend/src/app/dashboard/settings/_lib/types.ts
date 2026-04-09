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

export interface Provider {
  provider: string;
  is_verified: boolean;
  updated_at: string | null;
}

export interface TwilioPhone {
  sid: string;
  phone_number: string;
  friendly_name: string;
  voice_enabled: boolean;
}

export interface TelephonyConnection {
  id: string;
  phone_number: string;
  friendly_name: string | null;
  inbound_enabled: boolean;
  outbound_enabled: boolean;
  ai_answering_enabled: boolean;
  default_agent_profile_id: string | null;
  created_at: string;
}

export interface SimpleAgent {
  id: string;
  name: string;
}

export interface OAuthClient {
  id: string;
  name: string;
  client_id: string;
  redirect_uris: string[];
  created_at: string;
}

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export type SectionId = 'general' | 'appearance' | 'providers' | 'api-keys' | 'oauth' | 'compliance';

export type ProviderConfig = Record<string, 'platform' | 'own'>;

export type AccentColor = 'indigo' | 'blue' | 'emerald' | 'purple' | 'amber';
