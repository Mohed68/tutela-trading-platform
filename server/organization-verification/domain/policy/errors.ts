export type PolicyDomainFailureCode =
  | "invalid_policy_set_id"
  | "invalid_policy_set_version"
  | "unsupported_policy_contract_version"
  | "invalid_policy_set_status"
  | "invalid_policy_category"
  | "invalid_rule_id"
  | "invalid_rule_version"
  | "unsupported_rule_contract_version"
  | "invalid_reason_code"
  | "invalid_finding_id"
  | "invalid_finding_severity"
  | "unsupported_finding_disposition"
  | "invalid_policy_evaluation_context_version"
  | "invalid_policy_evaluation_identity"
  | "invalid_policy_evaluation_timestamp"
  | "policy_set_rule_mismatch"
  | "policy_set_version_mismatch"
  | "duplicate_rule_reference"
  | "required_rule_missing"
  | "unauthorized_rule_result"
  | "duplicate_rule_result"
  | "conflicting_rule_result"
  | "rule_result_incomplete"
  | "rule_result_integrity_invalid"
  | "finding_identity_mismatch"
  | "finding_rule_mismatch"
  | "finding_policy_mismatch"
  | "duplicate_finding"
  | "organization_id_mismatch"
  | "verification_record_id_mismatch"
  | "verification_revision_id_mismatch"
  | "attempt_id_mismatch"
  | "snapshot_id_mismatch"
  | "snapshot_fingerprint_mismatch"
  | "policy_evaluation_incomplete"
  | "policy_evaluation_integrity_invalid"
  | "contradictory_finding_disposition"
  | "policy_evaluation_error"
  | "invalid_evaluation_chronology"
  | "duplicate_policy_evaluation_completion"
  | "conflicting_policy_evaluation_completion"
  | "normalized_evaluation_adapter_failure";

export type PolicyDomainResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly code: PolicyDomainFailureCode;
      readonly path?: string;
    };

export function policySuccess<T>(value: T): PolicyDomainResult<T> {
  return Object.freeze({ ok: true, value });
}

export function policyFailure<T>(
  code: PolicyDomainFailureCode,
  path?: string,
): PolicyDomainResult<T> {
  return Object.freeze(path ? { ok: false, code, path } : { ok: false, code });
}
