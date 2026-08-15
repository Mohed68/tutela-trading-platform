-- Phase 8E.0 additive Organization Verification durable evidence persistence.
-- Replay remains the sole authoritative state reconstruction mechanism.

CREATE TABLE public.organization_verification_persistence_streams (
  stream_identity_fingerprint varchar PRIMARY KEY,
  workflow_execution_id varchar NOT NULL,
  organization_id varchar NOT NULL,
  record_id varchar NOT NULL,
  revision_id varchar NOT NULL,
  attempt_id varchar NOT NULL,
  current_stream_version integer NOT NULL DEFAULT 0,
  head_evidence_entry_id varchar,
  created_at timestamptz NOT NULL,
  creation_fingerprint varchar NOT NULL,
  CONSTRAINT organization_verification_stream_version_check
    CHECK (current_stream_version >= 0),
  CONSTRAINT organization_verification_stream_head_check
    CHECK (
      (current_stream_version = 0 AND head_evidence_entry_id IS NULL)
      OR (current_stream_version > 0 AND head_evidence_entry_id IS NOT NULL)
    ),
  CONSTRAINT organization_verification_stream_fingerprint_check
    CHECK (stream_identity_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  CONSTRAINT organization_verification_stream_creation_fingerprint_check
    CHECK (creation_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  CONSTRAINT organization_verification_stream_workflow_unique
    UNIQUE (workflow_execution_id)
);

CREATE TABLE public.organization_verification_persistence_appends (
  append_id varchar PRIMARY KEY,
  stream_identity_fingerprint varchar NOT NULL
    REFERENCES public.organization_verification_persistence_streams
      (stream_identity_fingerprint) ON DELETE RESTRICT,
  append_batch_fingerprint varchar NOT NULL,
  expected_stream_version integer NOT NULL,
  resulting_stream_version integer NOT NULL,
  expected_head_evidence_entry_id varchar,
  resulting_head_evidence_entry_id varchar NOT NULL,
  appended_at timestamptz NOT NULL,
  appended_at_value text NOT NULL,
  provenance_references jsonb NOT NULL,
  integrity_references jsonb NOT NULL,
  append_receipt_fingerprint varchar NOT NULL,
  CONSTRAINT organization_verification_append_versions_check
    CHECK (
      expected_stream_version >= 0
      AND resulting_stream_version > expected_stream_version
    ),
  CONSTRAINT organization_verification_append_expected_head_check
    CHECK (
      (expected_stream_version = 0 AND expected_head_evidence_entry_id IS NULL)
      OR (expected_stream_version > 0 AND expected_head_evidence_entry_id IS NOT NULL)
    ),
  CONSTRAINT organization_verification_append_batch_fingerprint_check
    CHECK (append_batch_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  CONSTRAINT organization_verification_append_timestamp_value_check
    CHECK (length(appended_at_value) > 0),
  CONSTRAINT organization_verification_append_receipt_fingerprint_check
    CHECK (append_receipt_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  CONSTRAINT organization_verification_append_stream_version_unique
    UNIQUE (stream_identity_fingerprint, resulting_stream_version)
);

CREATE INDEX organization_verification_appends_stream_idx
  ON public.organization_verification_persistence_appends
    (stream_identity_fingerprint, resulting_stream_version);

CREATE TABLE public.organization_verification_durable_evidence (
  evidence_entry_id varchar PRIMARY KEY,
  stream_identity_fingerprint varchar NOT NULL
    REFERENCES public.organization_verification_persistence_streams
      (stream_identity_fingerprint) ON DELETE RESTRICT,
  stream_position integer NOT NULL,
  predecessor_evidence_entry_id varchar,
  append_id varchar NOT NULL
    REFERENCES public.organization_verification_persistence_appends
      (append_id) ON DELETE RESTRICT,
  evidence_kind varchar NOT NULL,
  semantic_artifact_identity varchar NOT NULL,
  artifact_version_kind varchar NOT NULL,
  artifact_version_or_sequence varchar NOT NULL,
  artifact_fingerprint varchar NOT NULL,
  artifact_occurred_at timestamptz NOT NULL,
  appended_at timestamptz NOT NULL,
  provenance_references jsonb NOT NULL,
  integrity_references jsonb NOT NULL,
  stored_evidence_fingerprint varchar NOT NULL,
  durable_contract_version varchar NOT NULL,
  durable_payload_fingerprint varchar NOT NULL,
  canonical_durable_envelope text NOT NULL,
  CONSTRAINT organization_verification_evidence_position_check
    CHECK (stream_position > 0),
  CONSTRAINT organization_verification_evidence_predecessor_check
    CHECK (
      (stream_position = 1 AND predecessor_evidence_entry_id IS NULL)
      OR (stream_position > 1 AND predecessor_evidence_entry_id IS NOT NULL)
    ),
  CONSTRAINT organization_verification_evidence_kind_check
    CHECK (evidence_kind IN (
      'workflow_genesis',
      'attempt_lifecycle_execution',
      'evidence_snapshot',
      'evaluation_projection',
      'policy_evaluation_input',
      'policy_runtime_execution',
      'decision_trust_integration_execution',
      'workflow_step_record'
    )),
  CONSTRAINT organization_verification_evidence_version_kind_check
    CHECK (artifact_version_kind IN ('number', 'string')),
  CONSTRAINT organization_verification_evidence_contract_check
    CHECK (durable_contract_version = 'organization-verification-durable-evidence/v1'),
  CONSTRAINT organization_verification_evidence_artifact_fingerprint_check
    CHECK (artifact_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  CONSTRAINT organization_verification_evidence_stored_fingerprint_check
    CHECK (stored_evidence_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  CONSTRAINT organization_verification_evidence_payload_fingerprint_check
    CHECK (durable_payload_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  CONSTRAINT organization_verification_evidence_stream_position_unique
    UNIQUE (stream_identity_fingerprint, stream_position),
  CONSTRAINT organization_verification_evidence_semantic_unique
    UNIQUE (
      stream_identity_fingerprint,
      evidence_kind,
      semantic_artifact_identity,
      artifact_version_kind,
      artifact_version_or_sequence
    )
);

CREATE INDEX organization_verification_evidence_stream_order_idx
  ON public.organization_verification_durable_evidence
    (stream_identity_fingerprint, stream_position);

CREATE INDEX organization_verification_evidence_append_idx
  ON public.organization_verification_durable_evidence (append_id);
