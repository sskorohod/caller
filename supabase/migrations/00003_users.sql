-- ============================================================
-- Caller Platform: Users table for self-hosted auth
-- ============================================================

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_users_email on users(email);

-- Keep updated_at in sync
create trigger trg_users_updated
  before update on users
  for each row execute function update_updated_at();
