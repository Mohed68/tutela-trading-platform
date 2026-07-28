import {
  policyFailure,
  policySuccess,
  type PolicyDomainResult,
} from "./errors.js";

export const ORGANIZATION_VERIFICATION_FINDING_SEVERITIES = [
  "informational",
  "low",
  "medium",
  "high",
  "critical",
] as const;

declare const findingSeverityBrand: unique symbol;
type FindingSeverityLiteral =
  (typeof ORGANIZATION_VERIFICATION_FINDING_SEVERITIES)[number];
export type OrganizationVerificationFindingSeverity = FindingSeverityLiteral & {
  readonly [findingSeverityBrand]: "OrganizationVerificationFindingSeverity";
};

export function parseOrganizationVerificationFindingSeverity(
  value: unknown,
): PolicyDomainResult<OrganizationVerificationFindingSeverity> {
  return ORGANIZATION_VERIFICATION_FINDING_SEVERITIES.includes(value as never)
    ? policySuccess(value as OrganizationVerificationFindingSeverity)
    : policyFailure("invalid_finding_severity");
}
