-- Security audit follow-up: make Stripe deposit credits idempotent.
--
-- A replayed/retried checkout.session.completed (including the retry triggered
-- by the webhook-handler rollback fix) must never double-credit a workspace.
-- This partial unique index lets creditDeposit claim each Stripe checkout once
-- via ON CONFLICT DO NOTHING. It is intentionally narrow:
--   - WHERE reference_type='stripe_checkout' so usage rows (which legitimately
--     share a reference_id across STT/LLM/TTS/telephony) are unaffected;
--   - reference_id IS NOT NULL so manual admin credits/refunds without a
--     reference are unaffected.

CREATE UNIQUE INDEX IF NOT EXISTS uniq_deposit_tx_stripe_checkout
  ON deposit_transactions (reference_id)
  WHERE reference_type = 'stripe_checkout' AND reference_id IS NOT NULL;
