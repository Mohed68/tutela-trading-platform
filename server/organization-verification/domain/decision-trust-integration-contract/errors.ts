export type OrganizationVerificationDecisionTrustBindingFailureCode =
  | "unauthentic_runtime_execution"
  | "unauthentic_input_binding"
  | "unauthentic_decision"
  | "unauthentic_trust_status"
  | "invalid_binding_artifacts"
  | "runtime_execution_mismatch"
  | "evaluation_input_mismatch"
  | "organization_id_mismatch"
  | "verification_record_id_mismatch"
  | "verification_revision_id_mismatch"
  | "attempt_id_mismatch"
  | "snapshot_id_mismatch"
  | "snapshot_fingerprint_mismatch"
  | "policy_set_mismatch"
  | "completion_mismatch"
  | "decision_mismatch"
  | "trust_status_mismatch"
  | "invalid_binding_chronology"
  | "completion_binding_fingerprint_mismatch"
  | "decision_binding_fingerprint_mismatch"
  | "trust_binding_fingerprint_mismatch"
  | "duplicate_binding"
  | "conflicting_binding";

export type OrganizationVerificationDecisionTrustBindingResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{
      ok: false;
      code: OrganizationVerificationDecisionTrustBindingFailureCode;
      path?: string;
    }>;

export function bindingSuccess<T>(
  value: T,
): OrganizationVerificationDecisionTrustBindingResult<T> {
  return Object.freeze({ ok: true, value });
}

export function bindingFailure<T>(
  code: OrganizationVerificationDecisionTrustBindingFailureCode,
  path?: string,
): OrganizationVerificationDecisionTrustBindingResult<T> {
  return Object.freeze({
    ok: false,
    code,
    ...(path === undefined ? {} : { path }),
  });
}
