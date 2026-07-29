export type OrganizationVerificationPolicyRuntimeFailureCode =
  | "unauthentic_evaluation_input"
  | "unauthentic_policy_set"
  | "unauthentic_rule_implementation_set"
  | "unauthentic_execution_artifacts"
  | "evaluation_input_policy_mismatch"
  | "policy_set_fingerprint_mismatch"
  | "rule_implementation_set_mismatch"
  | "execution_artifacts_mismatch"
  | "invalid_execution_chronology"
  | "policy_input_adaptation_failure"
  | "fact_view_adaptation_failure"
  | "rule_execution_contract_failure"
  | "rule_execution_failure"
  | "finding_construction_failure"
  | "rule_result_construction_failure"
  | "policy_completion_failure"
  | "execution_fingerprint_mismatch";

export type OrganizationVerificationPolicyRuntimeResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly code: OrganizationVerificationPolicyRuntimeFailureCode;
      readonly path?: string;
      readonly cause?: string;
    };

export function policyRuntimeSuccess<T>(
  value: T,
): OrganizationVerificationPolicyRuntimeResult<T> {
  return Object.freeze({ ok: true, value });
}

export function policyRuntimeFailure<T>(
  code: OrganizationVerificationPolicyRuntimeFailureCode,
  options?: Readonly<{ path?: string; cause?: string }>,
): OrganizationVerificationPolicyRuntimeResult<T> {
  return Object.freeze({
    ok: false,
    code,
    ...(options?.path ? { path: options.path } : {}),
    ...(options?.cause ? { cause: options.cause } : {}),
  });
}
