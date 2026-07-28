import {
  policyFailure,
  policySuccess,
  type PolicyDomainFailureCode,
  type PolicyDomainResult,
} from "./errors.js";

export const POLICY_CONTRACT_VERSION =
  "organization_verification.policy_set.v1" as const;
export const RULE_CONTRACT_VERSION =
  "organization_verification.rule.v1" as const;
export const POLICY_EVALUATION_CONTRACT_VERSION =
  "organization_verification.policy_evaluation.v1" as const;
export const POLICY_EVALUATION_CONTEXT_VERSION =
  "organization_verification.policy_evaluation_context.v1" as const;

declare const policyIdentityBrand: unique symbol;
type PolicyOpaque<T extends string> = string & {
  readonly [policyIdentityBrand]: T;
};

export type OrganizationVerificationPolicySetId =
  PolicyOpaque<"OrganizationVerificationPolicySetId">;
export type OrganizationVerificationPolicySetVersion =
  PolicyOpaque<"OrganizationVerificationPolicySetVersion">;
export type OrganizationVerificationRuleId =
  PolicyOpaque<"OrganizationVerificationRuleId">;
export type OrganizationVerificationRuleVersion =
  PolicyOpaque<"OrganizationVerificationRuleVersion">;
export type OrganizationVerificationFindingId =
  PolicyOpaque<"OrganizationVerificationFindingId">;
export type OrganizationVerificationPolicyEvaluationCompletionId =
  PolicyOpaque<"OrganizationVerificationPolicyEvaluationCompletionId">;
export type OrganizationVerificationFindingIntegrityReference =
  PolicyOpaque<"OrganizationVerificationFindingIntegrityReference">;
export type OrganizationVerificationPolicySetIntegrityReference =
  PolicyOpaque<"OrganizationVerificationPolicySetIntegrityReference">;
export type OrganizationVerificationRuleIntegrityReference =
  PolicyOpaque<"OrganizationVerificationRuleIntegrityReference">;
export type OrganizationVerificationRuleEvaluationIntegrityReference =
  PolicyOpaque<"OrganizationVerificationRuleEvaluationIntegrityReference">;
export type OrganizationVerificationPolicyEvaluationIntegrityReference =
  PolicyOpaque<"OrganizationVerificationPolicyEvaluationIntegrityReference">;
export type OrganizationVerificationPolicyProvenanceReference =
  PolicyOpaque<"OrganizationVerificationPolicyProvenanceReference">;

export type PolicyContractVersion = typeof POLICY_CONTRACT_VERSION;
export type RuleContractVersion = typeof RULE_CONTRACT_VERSION;
export type PolicyEvaluationContractVersion =
  typeof POLICY_EVALUATION_CONTRACT_VERSION;
export type PolicyEvaluationContextVersion =
  typeof POLICY_EVALUATION_CONTEXT_VERSION;

const MUTABLE_POINTERS = new Set(["latest", "current", "head", "default"]);

function createOpaque<T extends string>(
  value: unknown,
  failure: PolicyDomainFailureCode,
): PolicyDomainResult<PolicyOpaque<T>> {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    MUTABLE_POINTERS.has(value.trim().toLowerCase())
  ) {
    return policyFailure(failure);
  }
  return policySuccess(value as PolicyOpaque<T>);
}

export const createOrganizationVerificationPolicySetId = (value: unknown) =>
  createOpaque<"OrganizationVerificationPolicySetId">(
    value,
    "invalid_policy_set_id",
  );
export const createOrganizationVerificationPolicySetVersion = (
  value: unknown,
) =>
  createOpaque<"OrganizationVerificationPolicySetVersion">(
    value,
    "invalid_policy_set_version",
  );
export const createOrganizationVerificationRuleId = (value: unknown) =>
  createOpaque<"OrganizationVerificationRuleId">(value, "invalid_rule_id");
export const createOrganizationVerificationRuleVersion = (value: unknown) =>
  createOpaque<"OrganizationVerificationRuleVersion">(
    value,
    "invalid_rule_version",
  );
export const createOrganizationVerificationFindingId = (value: unknown) =>
  createOpaque<"OrganizationVerificationFindingId">(
    value,
    "invalid_finding_id",
  );
export const createOrganizationVerificationPolicyEvaluationCompletionId = (
  value: unknown,
) =>
  createOpaque<"OrganizationVerificationPolicyEvaluationCompletionId">(
    value,
    "invalid_policy_evaluation_identity",
  );
export const createOrganizationVerificationFindingIntegrityReference = (
  value: unknown,
) =>
  createOpaque<"OrganizationVerificationFindingIntegrityReference">(
    value,
    "finding_identity_mismatch",
  );
export const createOrganizationVerificationPolicySetIntegrityReference = (
  value: unknown,
) =>
  createOpaque<"OrganizationVerificationPolicySetIntegrityReference">(
    value,
    "invalid_policy_set_id",
  );
export const createOrganizationVerificationRuleIntegrityReference = (
  value: unknown,
) =>
  createOpaque<"OrganizationVerificationRuleIntegrityReference">(
    value,
    "invalid_rule_id",
  );
export const createOrganizationVerificationRuleEvaluationIntegrityReference = (
  value: unknown,
) =>
  createOpaque<"OrganizationVerificationRuleEvaluationIntegrityReference">(
    value,
    "rule_result_integrity_invalid",
  );
export const createOrganizationVerificationPolicyEvaluationIntegrityReference =
  (value: unknown) =>
    createOpaque<"OrganizationVerificationPolicyEvaluationIntegrityReference">(
      value,
      "policy_evaluation_integrity_invalid",
    );
export const createOrganizationVerificationPolicyProvenanceReference = (
  value: unknown,
) =>
  createOpaque<"OrganizationVerificationPolicyProvenanceReference">(
    value,
    "invalid_policy_evaluation_identity",
  );

export function parsePolicyContractVersion(
  value: unknown,
): PolicyDomainResult<PolicyContractVersion> {
  return value === POLICY_CONTRACT_VERSION
    ? policySuccess(POLICY_CONTRACT_VERSION)
    : policyFailure("unsupported_policy_contract_version");
}

export function parseRuleContractVersion(
  value: unknown,
): PolicyDomainResult<RuleContractVersion> {
  return value === RULE_CONTRACT_VERSION
    ? policySuccess(RULE_CONTRACT_VERSION)
    : policyFailure("unsupported_rule_contract_version");
}

export function parsePolicyEvaluationContractVersion(
  value: unknown,
): PolicyDomainResult<PolicyEvaluationContractVersion> {
  return value === POLICY_EVALUATION_CONTRACT_VERSION
    ? policySuccess(POLICY_EVALUATION_CONTRACT_VERSION)
    : policyFailure("unsupported_policy_contract_version");
}

export function parsePolicyEvaluationContextVersion(
  value: unknown,
): PolicyDomainResult<PolicyEvaluationContextVersion> {
  return value === POLICY_EVALUATION_CONTEXT_VERSION
    ? policySuccess(POLICY_EVALUATION_CONTEXT_VERSION)
    : policyFailure("invalid_policy_evaluation_context_version");
}
