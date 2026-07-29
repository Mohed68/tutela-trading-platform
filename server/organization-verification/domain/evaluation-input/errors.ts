export type PolicyEvaluationInputDomainFailureCode =
  | "invalid_policy_evaluation_input_id"
  | "invalid_policy_evaluation_input_version"
  | "unsupported_policy_evaluation_input_contract_version"
  | "unsupported_policy_evaluation_input_builder_version"
  | "invalid_evaluation_context"
  | "unsupported_evaluation_context_version"
  | "invalid_evaluation_scope"
  | "unsupported_evaluation_scope_version"
  | "invalid_evaluation_execution_reference"
  | "invalid_evaluation_provenance_reference"
  | "invalid_evaluation_correlation_reference"
  | "invalid_evaluation_integrity_reference"
  | "invalid_evaluation_input_fingerprint"
  | "unauthentic_evaluation_projection"
  | "evaluation_projection_mismatch"
  | "evaluation_projection_fingerprint_mismatch"
  | "snapshot_reference_mismatch"
  | "organization_id_mismatch"
  | "verification_record_id_mismatch"
  | "verification_revision_id_mismatch"
  | "profile_revision_id_mismatch"
  | "attempt_id_required"
  | "attempt_id_mismatch"
  | "invalid_policy_set_binding"
  | "unsupported_policy_set_version"
  | "mutable_policy_set_pointer_rejected"
  | "evaluation_scope_exceeds_projection"
  | "invalid_evaluation_input_chronology"
  | "duplicate_policy_evaluation_input"
  | "conflicting_policy_evaluation_input"
  | "policy_evaluation_input_construction_failure";

export type PolicyEvaluationInputDomainResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly code: PolicyEvaluationInputDomainFailureCode;
      readonly path?: string;
    };

export function inputSuccess<T>(
  value: T,
): PolicyEvaluationInputDomainResult<T> {
  return Object.freeze({ ok: true, value });
}

export function inputFailure<T>(
  code: PolicyEvaluationInputDomainFailureCode,
  path?: string,
): PolicyEvaluationInputDomainResult<T> {
  return Object.freeze(path ? { ok: false, code, path } : { ok: false, code });
}
