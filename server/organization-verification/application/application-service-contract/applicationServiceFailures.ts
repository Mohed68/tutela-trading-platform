import type { OrganizationVerificationPersistenceFailureCode } from "../persistence-contract/index.js";
import type { OrganizationVerificationReplayFailureCode } from "../replay-runtime/index.js";
import type { OrganizationVerificationWorkflowRuntimeFailure } from "../workflow-runtime/index.js";

export const ORGANIZATION_VERIFICATION_APPLICATION_FAILURE_CODES =
  Object.freeze([
    "invalid_application_request",
    "unauthentic_application_request",
    "application_identity_mismatch",
    "malformed_application_metadata",
    "application_integrity_failure",
    "verification_stream_already_exists",
    "invalid_start_expected_version",
    "invalid_workflow_genesis",
    "start_persistence_conflict",
    "verification_stream_not_found",
    "current_state_replay_failed",
    "expected_persistence_version_conflict",
    "expected_workflow_version_conflict",
    "expected_workflow_stage_conflict",
    "requested_step_not_allowed",
    "workflow_already_completed",
    "authority_execution_rejected",
    "workflow_step_execution_rejected",
    "persistence_append_rejected",
    "application_idempotency_conflict",
    "current_state_integrity_failure",
    "current_state_reconstruction_failure",
  ] as const);

export type OrganizationVerificationApplicationFailureCode =
  (typeof ORGANIZATION_VERIFICATION_APPLICATION_FAILURE_CODES)[number];

export interface OrganizationVerificationApplicationFailureDiagnostic {
  readonly safeIdentityReference?: string;
  readonly expectedPersistenceStreamVersion?: number;
  readonly actualPersistenceStreamVersion?: number;
  readonly expectedWorkflowVersion?: number;
  readonly actualWorkflowVersion?: number;
  readonly expectedWorkflowStage?: string;
  readonly actualWorkflowStage?: string;
  readonly lowerLayerCode?: string;
}

export interface OrganizationVerificationApplicationFailure {
  readonly code: OrganizationVerificationApplicationFailureCode;
  readonly diagnostic: OrganizationVerificationApplicationFailureDiagnostic;
}

export type OrganizationVerificationApplicationRequestCreationResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{
      ok: false;
      failure: OrganizationVerificationApplicationFailure;
    }>;

export function isOrganizationVerificationApplicationFailureCode(
  value: unknown,
): value is OrganizationVerificationApplicationFailureCode {
  return (
    typeof value === "string" &&
    ORGANIZATION_VERIFICATION_APPLICATION_FAILURE_CODES.some(
      (candidate) => candidate === value,
    )
  );
}

export const ORGANIZATION_VERIFICATION_PERSISTENCE_FAILURE_MAPPING =
  Object.freeze({
    stream_not_found: "verification_stream_not_found",
    expected_stream_version_conflict:
      "expected_persistence_version_conflict",
    evidence_identity_conflict: "application_idempotency_conflict",
    evidence_fingerprint_conflict: "application_idempotency_conflict",
    stream_identity_mismatch: "application_identity_mismatch",
    invalid_evidence_order: "persistence_append_rejected",
    unsupported_evidence_kind: "persistence_append_rejected",
    unauthentic_evidence: "application_integrity_failure",
    malformed_append_metadata: "persistence_append_rejected",
    stored_integrity_failure: "current_state_integrity_failure",
  } satisfies Readonly<
    Record<
      OrganizationVerificationPersistenceFailureCode,
      OrganizationVerificationApplicationFailureCode
    >
  >);

export const ORGANIZATION_VERIFICATION_REPLAY_FAILURE_MAPPING =
  Object.freeze({
    replay_stream_not_found_input: "verification_stream_not_found",
    replay_unauthentic_stream: "current_state_integrity_failure",
    replay_stream_integrity_failure: "current_state_integrity_failure",
    replay_missing_genesis: "current_state_reconstruction_failure",
    replay_duplicate_genesis: "current_state_reconstruction_failure",
    replay_invalid_genesis: "current_state_reconstruction_failure",
    replay_unexpected_evidence_kind: "current_state_reconstruction_failure",
    replay_incomplete_step_unit: "current_state_reconstruction_failure",
    replay_stage_mismatch: "current_state_reconstruction_failure",
    replay_authority_result_mismatch: "current_state_integrity_failure",
    replay_authority_fingerprint_mismatch: "current_state_integrity_failure",
    replay_step_record_mismatch: "current_state_reconstruction_failure",
    replay_workflow_version_conflict: "current_state_reconstruction_failure",
    replay_workflow_fingerprint_conflict: "current_state_integrity_failure",
    replay_lifecycle_version_conflict: "current_state_reconstruction_failure",
    replay_lifecycle_identity_conflict: "current_state_integrity_failure",
    replay_predecessor_conflict: "current_state_reconstruction_failure",
    replay_chronology_conflict: "current_state_reconstruction_failure",
    replay_duplicate_semantic_evidence: "current_state_integrity_failure",
    replay_competing_history: "current_state_integrity_failure",
    replay_evidence_after_completion: "current_state_reconstruction_failure",
    replay_reconstructed_integrity_failure:
      "current_state_integrity_failure",
  } satisfies Readonly<
    Record<
      OrganizationVerificationReplayFailureCode,
      OrganizationVerificationApplicationFailureCode
    >
  >);

export const ORGANIZATION_VERIFICATION_WORKFLOW_FAILURE_STAGE_MAPPING =
  Object.freeze({
    workflow_runtime: "workflow_step_execution_rejected",
    attempt_authority: "authority_execution_rejected",
    snapshot_authority: "authority_execution_rejected",
    projection_authority: "authority_execution_rejected",
    evaluation_input_authority: "authority_execution_rejected",
    policy_authority: "authority_execution_rejected",
    decision_trust_integration_authority: "authority_execution_rejected",
    workflow_step_record: "workflow_step_execution_rejected",
    next_workflow_execution: "workflow_step_execution_rejected",
  } satisfies Readonly<
    Record<
      OrganizationVerificationWorkflowRuntimeFailure["stage"],
      OrganizationVerificationApplicationFailureCode
    >
  >);

export function applicationFailureInternal(
  code: OrganizationVerificationApplicationFailureCode,
  diagnostic: OrganizationVerificationApplicationFailureDiagnostic = {},
): OrganizationVerificationApplicationFailure {
  return Object.freeze({
    code,
    diagnostic: Object.freeze({ ...diagnostic }),
  });
}
