import {
  policyFailure,
  policySuccess,
  type PolicyDomainResult,
} from "./errors.js";

declare const reasonCodeBrand: unique symbol;
declare const policyCategoryBrand: unique symbol;

export type OrganizationVerificationReasonCode = string & {
  readonly [reasonCodeBrand]: "OrganizationVerificationReasonCode";
};
export type OrganizationVerificationPolicyCategory = string & {
  readonly [policyCategoryBrand]: "OrganizationVerificationPolicyCategory";
};

const REASON_CODE_PATTERN =
  /^organization_verification\.[a-z0-9]+(?:_[a-z0-9]+)*\.[a-z0-9]+(?:_[a-z0-9]+)*$/;
const CATEGORY_PATTERN =
  /^organization_verification\.[a-z0-9]+(?:_[a-z0-9]+)*$/;
const FORBIDDEN_POINTERS = new Set(["latest", "current", "head", "default"]);

export function createOrganizationVerificationReasonCode(
  value: unknown,
): PolicyDomainResult<OrganizationVerificationReasonCode> {
  if (
    typeof value !== "string" ||
    !REASON_CODE_PATTERN.test(value) ||
    FORBIDDEN_POINTERS.has(value.toLowerCase())
  ) {
    return policyFailure("invalid_reason_code");
  }
  return policySuccess(value as OrganizationVerificationReasonCode);
}

export function createOrganizationVerificationPolicyCategory(
  value: unknown,
): PolicyDomainResult<OrganizationVerificationPolicyCategory> {
  if (
    typeof value !== "string" ||
    !CATEGORY_PATTERN.test(value) ||
    FORBIDDEN_POINTERS.has(value.toLowerCase())
  ) {
    return policyFailure("invalid_policy_category");
  }
  return policySuccess(value as OrganizationVerificationPolicyCategory);
}
