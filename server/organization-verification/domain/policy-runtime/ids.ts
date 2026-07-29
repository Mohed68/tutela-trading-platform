import {
  policyRuntimeFailure,
  policyRuntimeSuccess,
  type OrganizationVerificationPolicyRuntimeResult,
} from "./errors.js";

export const ORGANIZATION_VERIFICATION_POLICY_RUNTIME_EXECUTION_CONTRACT_VERSION =
  "organization_verification.policy_runtime_execution.v1" as const;
export const ORGANIZATION_VERIFICATION_POLICY_RUNTIME_EXECUTOR_VERSION =
  "organization_verification.policy_runtime_executor.v1" as const;

declare const policyRuntimeIdentityBrand: unique symbol;
type PolicyRuntimeOpaque<T extends string> = string & {
  readonly [policyRuntimeIdentityBrand]: T;
};

export type OrganizationVerificationPolicyRuntimeExecutionFingerprint =
  PolicyRuntimeOpaque<"OrganizationVerificationPolicyRuntimeExecutionFingerprint">;
export type OrganizationVerificationPolicyRuntimeExecutionContractVersion =
  typeof ORGANIZATION_VERIFICATION_POLICY_RUNTIME_EXECUTION_CONTRACT_VERSION;
export type OrganizationVerificationPolicyRuntimeExecutorVersion =
  typeof ORGANIZATION_VERIFICATION_POLICY_RUNTIME_EXECUTOR_VERSION;

export function createOrganizationVerificationPolicyRuntimeExecutionFingerprint(
  value: unknown,
): OrganizationVerificationPolicyRuntimeResult<OrganizationVerificationPolicyRuntimeExecutionFingerprint> {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value)
    ? policyRuntimeSuccess(
        value as OrganizationVerificationPolicyRuntimeExecutionFingerprint,
      )
    : policyRuntimeFailure("execution_fingerprint_mismatch");
}
