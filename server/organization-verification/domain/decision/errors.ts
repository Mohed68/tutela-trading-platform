export type DecisionDomainFailureCode =
  | "evaluation_incomplete"
  | "evaluation_integrity_invalid"
  | "contradictory_evaluation_classification"
  | "missing_evaluation_classification"
  | "unsupported_evaluation_classification"
  | "attempt_not_completed"
  | "attempt_id_mismatch"
  | "verification_record_id_mismatch"
  | "verification_revision_id_mismatch"
  | "organization_id_mismatch"
  | "snapshot_id_mismatch"
  | "snapshot_fingerprint_mismatch"
  | "policy_set_reference_invalid"
  | "policy_set_version_invalid"
  | "decision_engine_version_invalid"
  | "decision_id_invalid"
  | "duplicate_decision_for_completion"
  | "conflicting_decision_for_completion"
  | "decision_context_invalid"
  | "invalid_decision_timestamp";

export type DecisionDomainResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: DecisionDomainFailureCode };

export const decisionSuccess = <T>(value: T): DecisionDomainResult<T> =>
  Object.freeze({ ok: true, value });
export const decisionFailure = <T>(
  code: DecisionDomainFailureCode,
): DecisionDomainResult<T> => Object.freeze({ ok: false, code });
