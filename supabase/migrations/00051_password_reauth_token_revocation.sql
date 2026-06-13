-- Security audit M1: re-auth on password change + token revocation.
--
-- password_set: false for magic-link-created accounts that hold a random,
-- unknown password; true once the user has chosen a real password (and for all
-- pre-existing accounts via the backfill below). /set-password requires the
-- current password whenever this is true, so a stolen session token alone can't
-- silently overwrite the account password.
--
-- tokens_valid_from: when set, session JWTs issued before this instant are
-- rejected (middleware/auth.ts). Advanced on a deliberate password change so a
-- previously-stolen token cannot outlive the change. NULL = no revocation point
-- (the default — nothing is forced to re-login on deploy).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_set      BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tokens_valid_from TIMESTAMPTZ;

-- Existing accounts are established; require the current password to change theirs.
UPDATE users SET password_set = true WHERE password_set = false;
