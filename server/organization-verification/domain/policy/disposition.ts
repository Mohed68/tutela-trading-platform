import {
  policyFailure,
  policySuccess,
  type PolicyDomainResult,
} from "./errors.js";

export const ORGANIZATION_VERIFICATION_FINDING_DISPOSITIONS = [
  "satisfied",
  "informational",
  "revision_required",
  "manual_review_required",
  "rejection_required",
  "evaluation_error",
] as const;

declare const findingDispositionBrand: unique symbol;
type FindingDispositionLiteral =
  (typeof ORGANIZATION_VERIFICATION_FINDING_DISPOSITIONS)[number];
export type OrganizationVerificationFindingDisposition =
  FindingDispositionLiteral & {
    readonly [findingDispositionBrand]: "OrganizationVerificationFindingDisposition";
  };

export function parseOrganizationVerificationFindingDisposition(
  value: unknown,
): PolicyDomainResult<OrganizationVerificationFindingDisposition> {
  return ORGANIZATION_VERIFICATION_FINDING_DISPOSITIONS.includes(value as never)
    ? policySuccess(value as OrganizationVerificationFindingDisposition)
    : policyFailure("unsupported_finding_disposition");
}

export function isAuthorityBearingDisposition(
  value: OrganizationVerificationFindingDisposition,
): boolean {
  return (
    value === "revision_required" ||
    value === "manual_review_required" ||
    value === "rejection_required"
  );
}
