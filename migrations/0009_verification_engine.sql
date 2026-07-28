-- Phase 6B additive Offer Verification Engine persistence.
--
-- This migration adds the private `verified` lifecycle value and isolated
-- verification history. It does not modify an existing offer or repurpose the
-- legacy `offer_verifications` document-manifest table.

ALTER TYPE public.offer_status
  ADD VALUE IF NOT EXISTS 'verified';

CREATE TABLE IF NOT EXISTS public.offer_submission_revisions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id varchar NOT NULL REFERENCES public.offers (id) ON DELETE RESTRICT,
  revision integer NOT NULL,
  submitted_record_version timestamp NOT NULL,
  input_snapshot jsonb NOT NULL,
  input_fingerprint char(64) NOT NULL,
  snapshot_schema_version varchar NOT NULL,
  submitted_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT offer_submission_revisions_revision_check
    CHECK (revision > 0),
  CONSTRAINT offer_submission_revisions_fingerprint_check
    CHECK (input_fingerprint ~ '^[a-f0-9]{64}$'),
  CONSTRAINT offer_submission_revisions_offer_revision_unique
    UNIQUE (offer_id, revision)
);

CREATE INDEX IF NOT EXISTS offer_submission_revisions_offer_idx
  ON public.offer_submission_revisions (offer_id, revision DESC);

CREATE TABLE IF NOT EXISTS public.offer_verification_attempts (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id varchar NOT NULL,
  submission_revision integer NOT NULL,
  attempt_sequence integer NOT NULL DEFAULT 1,
  idempotency_key varchar NOT NULL,
  submitted_record_version timestamp NOT NULL,
  input_snapshot jsonb NOT NULL,
  input_fingerprint char(64) NOT NULL,
  snapshot_schema_version varchar NOT NULL,
  process_state varchar NOT NULL DEFAULT 'queued',
  decision varchar,
  confidence varchar,
  confidence_model_version varchar NOT NULL,
  engine_version varchar NOT NULL,
  technical_policy_version varchar NOT NULL,
  commercial_policy_version varchar NOT NULL,
  claim_token_hash char(64),
  claim_expires_at timestamp,
  queued_at timestamp NOT NULL DEFAULT now(),
  started_at timestamp,
  completed_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT offer_verification_attempts_submission_fk
    FOREIGN KEY (offer_id, submission_revision)
    REFERENCES public.offer_submission_revisions (offer_id, revision)
    ON DELETE RESTRICT,
  CONSTRAINT offer_verification_attempts_sequence_check
    CHECK (attempt_sequence > 0),
  CONSTRAINT offer_verification_attempts_fingerprint_check
    CHECK (input_fingerprint ~ '^[a-f0-9]{64}$'),
  CONSTRAINT offer_verification_attempts_process_check
    CHECK (process_state IN ('queued', 'running', 'completed')),
  CONSTRAINT offer_verification_attempts_decision_check
    CHECK (
      decision IS NULL
      OR decision IN ('approved', 'revision_required', 'manual_review')
    ),
  CONSTRAINT offer_verification_attempts_confidence_check
    CHECK (confidence IS NULL OR confidence IN ('HIGH', 'MEDIUM', 'LOW')),
  CONSTRAINT offer_verification_attempts_claim_hash_check
    CHECK (
      claim_token_hash IS NULL
      OR claim_token_hash ~ '^[a-f0-9]{64}$'
    ),
  CONSTRAINT offer_verification_attempts_state_consistency_check
    CHECK (
      (
        process_state = 'queued'
        AND decision IS NULL
        AND confidence IS NULL
        AND completed_at IS NULL
        AND claim_token_hash IS NULL
        AND claim_expires_at IS NULL
      )
      OR
      (
        process_state = 'running'
        AND decision IS NULL
        AND confidence IS NULL
        AND completed_at IS NULL
        AND claim_token_hash IS NOT NULL
        AND claim_expires_at IS NOT NULL
      )
      OR
      (
        process_state = 'completed'
        AND decision IS NOT NULL
        AND confidence IS NOT NULL
        AND completed_at IS NOT NULL
        AND claim_token_hash IS NULL
        AND claim_expires_at IS NULL
      )
    ),
  CONSTRAINT offer_verification_attempts_offer_revision_sequence_unique
    UNIQUE (offer_id, submission_revision, attempt_sequence),
  CONSTRAINT offer_verification_attempts_idempotency_unique
    UNIQUE (idempotency_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS offer_verification_attempts_active_unique
  ON public.offer_verification_attempts (offer_id, submission_revision)
  WHERE process_state IN ('queued', 'running');

CREATE INDEX IF NOT EXISTS offer_verification_attempts_offer_history_idx
  ON public.offer_verification_attempts (
    offer_id,
    submission_revision DESC,
    attempt_sequence DESC
  );

CREATE TABLE IF NOT EXISTS public.offer_verification_findings (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id varchar NOT NULL
    REFERENCES public.offer_verification_attempts (id) ON DELETE RESTRICT,
  evaluation_order integer NOT NULL,
  rule_id varchar NOT NULL,
  reason_code varchar NOT NULL,
  severity varchar NOT NULL,
  disposition varchar NOT NULL,
  policy_family varchar NOT NULL,
  policy_version varchar NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT offer_verification_findings_order_check
    CHECK (evaluation_order > 0),
  CONSTRAINT offer_verification_findings_rule_check
    CHECK (
      rule_id IN (
        'TECHNICAL-001', 'TECHNICAL-002', 'TECHNICAL-003',
        'TECHNICAL-004', 'TECHNICAL-005', 'TECHNICAL-006',
        'TECHNICAL-007', 'TECHNICAL-008', 'TECHNICAL-009',
        'TECHNICAL-010', 'TECHNICAL-011',
        'COMMERCIAL-001', 'COMMERCIAL-002', 'COMMERCIAL-014',
        'COMMERCIAL-015',
        'SYSTEM-001', 'SYSTEM-002', 'SYSTEM-003', 'SYSTEM-999'
      )
    ),
  CONSTRAINT offer_verification_findings_reason_check
    CHECK (
      reason_code IN (
        'MISSING_REQUIRED_FIELD', 'INVALID_OFFER_TYPE',
        'INVALID_COMMODITY', 'INVALID_QUANTITY', 'INVALID_UNIT',
        'INVALID_PRICE', 'INVALID_CURRENCY', 'INVALID_LOCATION',
        'INVALID_VALIDITY', 'EXPIRED_VALIDITY', 'SCHEMA_INCONSISTENCY',
        'UNSUPPORTED_COMMODITY', 'UNSUPPORTED_COMMERCIAL_MODEL',
        'UNIT_NOT_ALLOWED_FOR_COMMODITY',
        'CURRENCY_NOT_ALLOWED_BY_CURRENT_POLICY',
        'COMMERCIAL_POLICY_FAILED', 'POLICY_CONFIGURATION_UNAVAILABLE',
        'VALIDATION_DATA_UNAVAILABLE', 'OFFER_STATE_CONFLICT',
        'UNKNOWN_VALIDATION_ERROR'
      )
    ),
  CONSTRAINT offer_verification_findings_severity_check
    CHECK (severity IN ('INFO', 'WARNING', 'ERROR', 'CRITICAL')),
  CONSTRAINT offer_verification_findings_disposition_check
    CHECK (
      disposition IN ('owner_correctable', 'requires_platform_review')
    ),
  CONSTRAINT offer_verification_findings_policy_family_check
    CHECK (policy_family IN ('technical', 'commercial', 'system')),
  CONSTRAINT offer_verification_findings_attempt_order_unique
    UNIQUE (attempt_id, evaluation_order)
);

CREATE INDEX IF NOT EXISTS offer_verification_findings_attempt_idx
  ON public.offer_verification_findings (attempt_id, evaluation_order);

CREATE TABLE IF NOT EXISTS public.offer_verification_events (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id varchar NOT NULL
    REFERENCES public.offer_verification_attempts (id) ON DELETE RESTRICT,
  event_type varchar NOT NULL,
  occurred_at timestamp NOT NULL DEFAULT now(),
  actor_type varchar NOT NULL DEFAULT 'system',
  correlation_id varchar NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT offer_verification_events_type_check
    CHECK (
      event_type IN (
        'verification_queued',
        'verification_claimed',
        'verification_claim_expired',
        'verification_completed'
      )
    ),
  CONSTRAINT offer_verification_events_actor_check
    CHECK (actor_type = 'system')
);

CREATE INDEX IF NOT EXISTS offer_verification_events_attempt_idx
  ON public.offer_verification_events (attempt_id, occurred_at, id);

CREATE TABLE IF NOT EXISTS public.offer_verification_commands (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id varchar NOT NULL UNIQUE
    REFERENCES public.offer_verification_attempts (id) ON DELETE RESTRICT,
  offer_id varchar NOT NULL,
  submission_revision integer NOT NULL,
  idempotency_key varchar NOT NULL UNIQUE,
  correlation_id varchar NOT NULL,
  command_state varchar NOT NULL DEFAULT 'pending',
  available_at timestamp NOT NULL DEFAULT now(),
  claim_token_hash char(64),
  claim_expires_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  delivered_at timestamp,
  CONSTRAINT offer_verification_commands_submission_fk
    FOREIGN KEY (offer_id, submission_revision)
    REFERENCES public.offer_submission_revisions (offer_id, revision)
    ON DELETE RESTRICT,
  CONSTRAINT offer_verification_commands_state_check
    CHECK (command_state IN ('pending', 'processing', 'delivered')),
  CONSTRAINT offer_verification_commands_claim_hash_check
    CHECK (
      claim_token_hash IS NULL
      OR claim_token_hash ~ '^[a-f0-9]{64}$'
    ),
  CONSTRAINT offer_verification_commands_state_consistency_check
    CHECK (
      (
        command_state = 'pending'
        AND claim_token_hash IS NULL
        AND claim_expires_at IS NULL
        AND delivered_at IS NULL
      )
      OR
      (
        command_state = 'processing'
        AND claim_token_hash IS NOT NULL
        AND claim_expires_at IS NOT NULL
        AND delivered_at IS NULL
      )
      OR
      (
        command_state = 'delivered'
        AND claim_token_hash IS NULL
        AND claim_expires_at IS NULL
        AND delivered_at IS NOT NULL
      )
    )
);

CREATE INDEX IF NOT EXISTS offer_verification_commands_available_idx
  ON public.offer_verification_commands (command_state, available_at, created_at);

CREATE TABLE IF NOT EXISTS public.offer_workflow_transitions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_key varchar NOT NULL UNIQUE,
  attempt_id varchar NOT NULL UNIQUE
    REFERENCES public.offer_verification_attempts (id) ON DELETE RESTRICT,
  offer_id varchar NOT NULL,
  submission_revision integer NOT NULL,
  consumed_decision varchar NOT NULL,
  from_status varchar NOT NULL,
  to_status varchar NOT NULL,
  transition_result varchar NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT offer_workflow_transitions_submission_fk
    FOREIGN KEY (offer_id, submission_revision)
    REFERENCES public.offer_submission_revisions (offer_id, revision)
    ON DELETE RESTRICT,
  CONSTRAINT offer_workflow_transitions_decision_check
    CHECK (
      consumed_decision IN (
        'approved',
        'revision_required',
        'manual_review'
      )
    ),
  CONSTRAINT offer_workflow_transitions_result_check
    CHECK (transition_result IN ('applied', 'already_applied', 'stale')),
  CONSTRAINT offer_workflow_transitions_status_check
    CHECK (
      (consumed_decision = 'approved'
        AND from_status = 'submitted' AND to_status = 'verified')
      OR
      (consumed_decision = 'revision_required'
        AND from_status = 'submitted' AND to_status = 'draft')
      OR
      (consumed_decision = 'manual_review'
        AND from_status = 'submitted' AND to_status = 'submitted')
    )
);

CREATE INDEX IF NOT EXISTS offer_workflow_transitions_offer_idx
  ON public.offer_workflow_transitions (
    offer_id,
    submission_revision DESC,
    created_at DESC
  );
