-- Phase 6D narrow immutability hardening for Phase 6 verification records.
--
-- These guards affect only tables introduced by migration 0009. They do not
-- inspect or modify legacy business rows. Recovery-owned integration cleanup
-- may use the explicit session-local maintenance flag.

CREATE OR REPLACE FUNCTION public.tutela_reject_verification_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('tutela.verification_maintenance', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'VERIFICATION_HISTORY_IS_APPEND_ONLY'
    USING ERRCODE = '55000';
END;
$$;

CREATE OR REPLACE FUNCTION public.tutela_guard_verification_attempt_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('tutela.verification_maintenance', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'VERIFICATION_ATTEMPT_DELETION_FORBIDDEN'
      USING ERRCODE = '55000';
  END IF;

  IF OLD.process_state = 'completed' THEN
    RAISE EXCEPTION 'COMPLETED_VERIFICATION_ATTEMPT_IS_IMMUTABLE'
      USING ERRCODE = '55000';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.offer_id IS DISTINCT FROM OLD.offer_id
    OR NEW.submission_revision IS DISTINCT FROM OLD.submission_revision
    OR NEW.attempt_sequence IS DISTINCT FROM OLD.attempt_sequence
    OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
    OR NEW.submitted_record_version IS DISTINCT FROM OLD.submitted_record_version
    OR NEW.input_snapshot IS DISTINCT FROM OLD.input_snapshot
    OR NEW.input_fingerprint IS DISTINCT FROM OLD.input_fingerprint
    OR NEW.snapshot_schema_version IS DISTINCT FROM OLD.snapshot_schema_version
    OR NEW.confidence_model_version IS DISTINCT FROM OLD.confidence_model_version
    OR NEW.engine_version IS DISTINCT FROM OLD.engine_version
    OR NEW.technical_policy_version IS DISTINCT FROM OLD.technical_policy_version
    OR NEW.commercial_policy_version IS DISTINCT FROM OLD.commercial_policy_version
    OR NEW.queued_at IS DISTINCT FROM OLD.queued_at
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'VERIFICATION_ATTEMPT_IDENTITY_IS_IMMUTABLE'
      USING ERRCODE = '55000';
  END IF;

  IF NOT (
    (OLD.process_state = 'queued' AND NEW.process_state = 'running')
    OR
    (
      OLD.process_state = 'running'
      AND NEW.process_state IN ('queued', 'completed')
    )
  ) THEN
    RAISE EXCEPTION 'INVALID_VERIFICATION_PROCESS_TRANSITION'
      USING ERRCODE = '55000';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tutela_guard_verification_command_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('tutela.verification_maintenance', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'VERIFICATION_COMMAND_DELETION_FORBIDDEN'
      USING ERRCODE = '55000';
  END IF;

  IF OLD.command_state = 'delivered' THEN
    RAISE EXCEPTION 'DELIVERED_VERIFICATION_COMMAND_IS_IMMUTABLE'
      USING ERRCODE = '55000';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.attempt_id IS DISTINCT FROM OLD.attempt_id
    OR NEW.offer_id IS DISTINCT FROM OLD.offer_id
    OR NEW.submission_revision IS DISTINCT FROM OLD.submission_revision
    OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
    OR NEW.correlation_id IS DISTINCT FROM OLD.correlation_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'VERIFICATION_COMMAND_IDENTITY_IS_IMMUTABLE'
      USING ERRCODE = '55000';
  END IF;

  IF NOT (
    (OLD.command_state = 'pending' AND NEW.command_state = 'processing')
    OR
    (
      OLD.command_state = 'processing'
      AND NEW.command_state IN ('pending', 'delivered')
    )
  ) THEN
    RAISE EXCEPTION 'INVALID_VERIFICATION_COMMAND_TRANSITION'
      USING ERRCODE = '55000';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS
  offer_submission_revisions_immutable
  ON public.offer_submission_revisions;
CREATE TRIGGER offer_submission_revisions_immutable
BEFORE UPDATE OR DELETE ON public.offer_submission_revisions
FOR EACH ROW
EXECUTE FUNCTION public.tutela_reject_verification_history_mutation();

DROP TRIGGER IF EXISTS
  offer_verification_attempts_guard
  ON public.offer_verification_attempts;
CREATE TRIGGER offer_verification_attempts_guard
BEFORE UPDATE OR DELETE ON public.offer_verification_attempts
FOR EACH ROW
EXECUTE FUNCTION public.tutela_guard_verification_attempt_mutation();

DROP TRIGGER IF EXISTS
  offer_verification_findings_immutable
  ON public.offer_verification_findings;
CREATE TRIGGER offer_verification_findings_immutable
BEFORE UPDATE OR DELETE ON public.offer_verification_findings
FOR EACH ROW
EXECUTE FUNCTION public.tutela_reject_verification_history_mutation();

DROP TRIGGER IF EXISTS
  offer_verification_events_immutable
  ON public.offer_verification_events;
CREATE TRIGGER offer_verification_events_immutable
BEFORE UPDATE OR DELETE ON public.offer_verification_events
FOR EACH ROW
EXECUTE FUNCTION public.tutela_reject_verification_history_mutation();

DROP TRIGGER IF EXISTS
  offer_verification_commands_guard
  ON public.offer_verification_commands;
CREATE TRIGGER offer_verification_commands_guard
BEFORE UPDATE OR DELETE ON public.offer_verification_commands
FOR EACH ROW
EXECUTE FUNCTION public.tutela_guard_verification_command_mutation();

DROP TRIGGER IF EXISTS
  offer_workflow_transitions_immutable
  ON public.offer_workflow_transitions;
CREATE TRIGGER offer_workflow_transitions_immutable
BEFORE UPDATE OR DELETE ON public.offer_workflow_transitions
FOR EACH ROW
EXECUTE FUNCTION public.tutela_reject_verification_history_mutation();
