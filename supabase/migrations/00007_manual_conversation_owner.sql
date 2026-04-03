-- Add 'manual' to conversation_owner check constraints for manual dialer calls

-- calls.conversation_owner_requested
ALTER TABLE calls DROP CONSTRAINT IF EXISTS calls_conversation_owner_requested_check;
ALTER TABLE calls ADD CONSTRAINT calls_conversation_owner_requested_check
  CHECK (conversation_owner_requested IN ('internal', 'external', 'manual'));

-- calls.conversation_owner_actual
ALTER TABLE calls DROP CONSTRAINT IF EXISTS calls_conversation_owner_actual_check;
ALTER TABLE calls ADD CONSTRAINT calls_conversation_owner_actual_check
  CHECK (conversation_owner_actual IN ('internal', 'external', 'manual'));
