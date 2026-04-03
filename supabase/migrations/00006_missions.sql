-- Mission Chat: AI-assigned phone call tasks
CREATE TABLE missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  agent_profile_id UUID REFERENCES agent_profiles(id),
  target_phone TEXT,
  goal TEXT,
  context JSONB DEFAULT '{}',
  fallback_action TEXT DEFAULT 'report',
  call_id UUID REFERENCES calls(id),
  outcome JSONB,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  retry_at TIMESTAMPTZ,
  notification_sent BOOLEAN DEFAULT false
);

CREATE TABLE mission_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'chat',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_missions_workspace ON missions(workspace_id);
CREATE INDEX idx_missions_status ON missions(workspace_id, status);
CREATE INDEX idx_missions_scheduled ON missions(status, scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX idx_mission_messages_mission ON mission_messages(mission_id);
