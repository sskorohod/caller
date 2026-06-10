-- Centralize provider management under a single platform admin.
--
-- Before: every signup owns a workspace with role='owner', and the /admin panel
-- + provider credentials were gated only by role='owner' — so any user could
-- reach them. Provider credentials lived per-workspace (BYOK).
-- After: one user.is_admin account manages all infrastructure providers; their
-- workspace holds the platform credentials; every other workspace's infra creds
-- are consolidated into the admin workspace.
--
-- Telegram is intentionally NOT centralized: its credential carries a per-user
-- chat_id (notification recipient), so it stays workspace-scoped.

-- 1. Admin flag on users.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- 2. Designate the platform admin.
--    Prefer the owner of the workspace that holds the platform Stripe account;
--    otherwise fall back to the earliest-created user (the bootstrap account).
UPDATE users SET is_admin = true
WHERE id = (
  SELECT wm.user_id FROM workspace_members wm
  WHERE wm.role = 'owner'
    AND wm.workspace_id = (
      SELECT (value #>> '{}')::uuid FROM platform_settings
      WHERE key = 'platform_stripe_workspace_id'
    )
  LIMIT 1
);

UPDATE users SET is_admin = true
WHERE id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM users WHERE is_admin = true);

-- 3. Consolidate infrastructure provider credentials into the admin workspace.
--    (telegram excluded — per-user notification channel.)
WITH admin_ws AS (
  SELECT wm.workspace_id AS id
  FROM workspace_members wm
  JOIN users u ON u.id = wm.user_id
  WHERE u.is_admin = true AND wm.role = 'owner'
  LIMIT 1
),
picks AS (
  SELECT DISTINCT ON (pc.provider)
    pc.provider, pc.credential_data, pc.is_verified, pc.verified_at, pc.created_at
  FROM provider_credentials pc
  WHERE pc.workspace_id <> (SELECT id FROM admin_ws)
    AND pc.provider <> 'telegram'
  ORDER BY pc.provider, pc.updated_at DESC
)
INSERT INTO provider_credentials (workspace_id, provider, credential_data, is_verified, verified_at, created_at, updated_at)
SELECT (SELECT id FROM admin_ws), p.provider, p.credential_data, p.is_verified, p.verified_at, p.created_at, now()
FROM picks p
WHERE (SELECT id FROM admin_ws) IS NOT NULL
ON CONFLICT (workspace_id, provider) DO NOTHING;

-- 4. Remove the now-migrated per-workspace infrastructure credentials.
DELETE FROM provider_credentials pc
USING (
  SELECT wm.workspace_id AS id
  FROM workspace_members wm
  JOIN users u ON u.id = wm.user_id
  WHERE u.is_admin = true AND wm.role = 'owner'
  LIMIT 1
) admin_ws
WHERE pc.workspace_id <> admin_ws.id
  AND pc.provider <> 'telegram';
