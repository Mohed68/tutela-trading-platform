import {
  inputFailure,
  inputSuccess,
  type PolicyEvaluationInputDomainResult,
} from "./errors.js";

export const POLICY_EVALUATION_INPUT_CONTRACT_VERSION =
  "organization_verification.policy_evaluation_input.v1" as const;
export const POLICY_EVALUATION_INPUT_BUILDER_VERSION =
  "organization_verification.policy_evaluation_input_builder.v1" as const;
export const EVALUATION_CONTEXT_CONTRACT_VERSION =
  "organization_verification.evaluation_context.v1" as const;
export const EVALUATION_SCOPE_CONTRACT_VERSION =
  "organization_verification.evaluation_scope.v1" as const;
export const ORGANIZATION_VERIFICATION_EVALUATION_CAPABILITY =
  "organization_verification" as const;

declare const evaluationInputBrand: unique symbol;
type InputOpaque<T extends string> = string & {
  readonly [evaluationInputBrand]: T;
};

export type OrganizationVerificationPolicyEvaluationInputId =
  InputOpaque<"OrganizationVerificationPolicyEvaluationInputId">;
export type OrganizationVerificationPolicyEvaluationInputVersion =
  InputOpaque<"OrganizationVerificationPolicyEvaluationInputVersion">;
export type OrganizationVerificationEvaluationExecutionReference =
  InputOpaque<"OrganizationVerificationEvaluationExecutionReference">;
export type OrganizationVerificationEvaluationProvenanceReference =
  InputOpaque<"OrganizationVerificationEvaluationProvenanceReference">;
export type OrganizationVerificationEvaluationCorrelationReference =
  InputOpaque<"OrganizationVerificationEvaluationCorrelationReference">;
export type OrganizationVerificationEvaluationIntegrityReference =
  InputOpaque<"OrganizationVerificationEvaluationIntegrityReference">;
export type OrganizationVerificationPolicyEvaluationInputFingerprint =
  InputOpaque<"OrganizationVerificationPolicyEvaluationInputFingerprint">;
export type PolicyEvaluationInputContractVersion =
  typeof POLICY_EVALUATION_INPUT_CONTRACT_VERSION;
export type PolicyEvaluationInputBuilderVersion =
  typeof POLICY_EVALUATION_INPUT_BUILDER_VERSION;
export type EvaluationContextContractVersion =
  typeof EVALUATION_CONTEXT_CONTRACT_VERSION;
export type EvaluationScopeContractVersion =
  typeof EVALUATION_SCOPE_CONTRACT_VERSION;
export type OrganizationVerificationEvaluationCapability =
  typeof ORGANIZATION_VERIFICATION_EVALUATION_CAPABILITY;

const POINTERS = new Set(["latest", "current", "head", "default"]);
const DIGEST = /^[a-f0-9]{64}$/;

export function isExactEvaluationInputIdentityInternal(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !POINTERS.has(value.trim().toLowerCase())
  );
}

export function isEvaluationInputDigestInternal(
  value: unknown,
): value is string {
  return typeof value === "string" && DIGEST.test(value);
}

export function isCanonicalEvaluationInputTimestampInternal(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

function opaque<T extends string>(
  value: unknown,
  code:
    | "invalid_policy_evaluation_input_id"
    | "invalid_policy_evaluation_input_version"
    | "invalid_evaluation_execution_reference"
    | "invalid_evaluation_provenance_reference"
    | "invalid_evaluation_correlation_reference"
    | "invalid_evaluation_integrity_reference",
): PolicyEvaluationInputDomainResult<InputOpaque<T>> {
  return isExactEvaluationInputIdentityInternal(value)
    ? inputSuccess(value as InputOpaque<T>)
    : inputFailure(code);
}

export const createOrganizationVerificationPolicyEvaluationInputId = (
  value: unknown,
) =>
  opaque<"OrganizationVerificationPolicyEvaluationInputId">(
    value,
    "invalid_policy_evaluation_input_id",
  );
export const createOrganizationVerificationPolicyEvaluationInputVersion = (
  value: unknown,
) =>
  opaque<"OrganizationVerificationPolicyEvaluationInputVersion">(
    value,
    "invalid_policy_evaluation_input_version",
  );
export const createOrganizationVerificationEvaluationExecutionReference = (
  value: unknown,
) =>
  opaque<"OrganizationVerificationEvaluationExecutionReference">(
    value,
    "invalid_evaluation_execution_reference",
  );
export const createOrganizationVerificationEvaluationProvenanceReference = (
  value: unknown,
) =>
  opaque<"OrganizationVerificationEvaluationProvenanceReference">(
    value,
    "invalid_evaluation_provenance_reference",
  );
export const createOrganizationVerificationEvaluationCorrelationReference = (
  value: unknown,
) =>
  opaque<"OrganizationVerificationEvaluationCorrelationReference">(
    value,
    "invalid_evaluation_correlation_reference",
  );
export const createOrganizationVerificationEvaluationIntegrityReference = (
  value: unknown,
) =>
  opaque<"OrganizationVerificationEvaluationIntegrityReference">(
    value,
    "invalid_evaluation_integrity_reference",
  );

export function parsePolicyEvaluationInputContractVersion(
  value: unknown,
): PolicyEvaluationInputDomainResult<PolicyEvaluationInputContractVersion> {
  return value === POLICY_EVALUATION_INPUT_CONTRACT_VERSION
    ? inputSuccess(POLICY_EVALUATION_INPUT_CONTRACT_VERSION)
    : inputFailure("unsupported_policy_evaluation_input_contract_version");
}

export function parsePolicyEvaluationInputBuilderVersion(
  value: unknown,
): PolicyEvaluationInputDomainResult<PolicyEvaluationInputBuilderVersion> {
  return value === POLICY_EVALUATION_INPUT_BUILDER_VERSION
    ? inputSuccess(POLICY_EVALUATION_INPUT_BUILDER_VERSION)
    : inputFailure("unsupported_policy_evaluation_input_builder_version");
}

export function createPolicyEvaluationInputFingerprintInternal(
  value: string,
): OrganizationVerificationPolicyEvaluationInputFingerprint {
  return value as OrganizationVerificationPolicyEvaluationInputFingerprint;
}
