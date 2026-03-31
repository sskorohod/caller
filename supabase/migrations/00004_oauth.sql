-- OAuth 2.0 Authorization Server
-- Allows external apps (ChatGPT GPT Actions) to connect via OAuth

create table if not exists oauth_clients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  client_id text not null unique,
  client_secret_hash text not null,
  redirect_uris text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_oauth_clients_workspace on oauth_clients(workspace_id);
create index if not exists idx_oauth_clients_client_id on oauth_clients(client_id);

-- Short-lived authorization codes (10 min TTL)
create table if not exists oauth_codes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  client_id text not null,
  code text not null unique,
  redirect_uri text not null,
  state text,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_oauth_codes_code on oauth_codes(code);
create index if not exists idx_oauth_codes_expires on oauth_codes(expires_at);
