export type OrganizationVerificationPolicyRuntimeContractFailureCode =
  | "invalid_runtime_contract_identity"
  | "invalid_runtime_contract_version"
  | "invalid_runtime_contract_digest"
  | "invalid_runtime_contract_timestamp"
  | "unauthentic_policy_set"
  | "unauthentic_policy_evaluation_input"
  | "unauthentic_rule_implementation"
  | "unauthentic_rule_implementation_set"
  | "policy_set_binding_mismatch"
  | "policy_set_fingerprint_mismatch"
  | "implementation_set_fingerprint_mismatch"
  | "rule_definition_mismatch"
  | "missing_rule_implementation"
  | "extra_rule_implementation"
  | "duplicate_rule_implementation"
  | "rule_implementation_version_mismatch"
  | "rule_implementation_policy_mismatch"
  | "invalid_execution_artifacts"
  | "missing_execution_artifact"
  | "duplicate_execution_artifact"
  | "execution_artifact_binding_mismatch"
  | "invalid_execution_artifact_chronology";

export type OrganizationVerificationPolicyRuntimeContractResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly code: OrganizationVerificationPolicyRuntimeContractFailureCode;
      readonly path?: string;
    };

export function runtimeContractSuccess<T>(
  value: T,
): OrganizationVerificationPolicyRuntimeContractResult<T> {
  return Object.freeze({ ok: true, value });
}

export function runtimeContractFailure<T>(
  code: OrganizationVerificationPolicyRuntimeContractFailureCode,
  path?: string,
): OrganizationVerificationPolicyRuntimeContractResult<T> {
  return Object.freeze(path ? { ok: false, code, path } : { ok: false, code });
}
