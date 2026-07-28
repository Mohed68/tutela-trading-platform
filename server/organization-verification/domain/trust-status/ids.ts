import {
  trustStatusFailure,
  trustStatusSuccess,
  type TrustStatusDomainResult,
} from "./errors.js";

declare const trustStatusBrand: unique symbol;
type Opaque<T extends string> = string & {
  readonly [trustStatusBrand]: T;
};

export type TrustStatusProjectionId = Opaque<"TrustStatusProjectionId">;
export type DecisionApplicabilityId = Opaque<"DecisionApplicabilityId">;
export type InvalidationFactId = Opaque<"InvalidationFactId">;
export type ExpiryFactId = Opaque<"ExpiryFactId">;
export type TrustStatusIntegrityReference =
  Opaque<"TrustStatusIntegrityReference">;
export type TrustStatusProvenanceReference =
  Opaque<"TrustStatusProvenanceReference">;
export type TrustStatusSourceAuthorityReference =
  Opaque<"TrustStatusSourceAuthorityReference">;
export type TrustStatusDeriverVersion = Opaque<"TrustStatusDeriverVersion">;
export type TrustStatusSourceFactsVersion =
  Opaque<"TrustStatusSourceFactsVersion">;
export type DecisionApplicabilityVersion =
  Opaque<"DecisionApplicabilityVersion">;

export const TRUST_STATUS_DERIVER_VERSION =
  "organization-verification-trust-status-deriver/v1" as TrustStatusDeriverVersion;
export const TRUST_STATUS_SOURCE_FACTS_VERSION =
  "organization-verification-trust-source-facts/v1" as TrustStatusSourceFactsVersion;
export const DECISION_APPLICABILITY_VERSION =
  "organization-verification-decision-applicability/v1" as DecisionApplicabilityVersion;

function createOpaque<T extends string>(
  value: unknown,
): TrustStatusDomainResult<Opaque<T>> {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    ["latest", "current", "head"].includes(value.trim().toLowerCase())
  ) {
    return trustStatusFailure("invalid_opaque_identifier");
  }
  return trustStatusSuccess(value as Opaque<T>);
}

function createExactVersion<T extends string>(
  value: unknown,
  expected: T,
  failure:
    | "unsupported_trust_source_facts_version"
    | "unsupported_trust_deriver_version"
    | "invalid_decision_applicability",
): TrustStatusDomainResult<Opaque<T>> {
  return value === expected
    ? trustStatusSuccess(value as Opaque<T>)
    : trustStatusFailure(failure);
}

export const createTrustStatusProjectionId = (value: unknown) =>
  createOpaque<"TrustStatusProjectionId">(value);
export const createDecisionApplicabilityId = (value: unknown) =>
  createOpaque<"DecisionApplicabilityId">(value);
export const createInvalidationFactId = (value: unknown) =>
  createOpaque<"InvalidationFactId">(value);
export const createExpiryFactId = (value: unknown) =>
  createOpaque<"ExpiryFactId">(value);
export const createTrustStatusIntegrityReference = (value: unknown) =>
  createOpaque<"TrustStatusIntegrityReference">(value);
export const createTrustStatusProvenanceReference = (value: unknown) =>
  createOpaque<"TrustStatusProvenanceReference">(value);
export const createTrustStatusSourceAuthorityReference = (value: unknown) =>
  createOpaque<"TrustStatusSourceAuthorityReference">(value);

export const createTrustStatusDeriverVersion = (value: unknown) =>
  createExactVersion(
    value,
    TRUST_STATUS_DERIVER_VERSION,
    "unsupported_trust_deriver_version",
  );
export const createTrustStatusSourceFactsVersion = (value: unknown) =>
  createExactVersion(
    value,
    TRUST_STATUS_SOURCE_FACTS_VERSION,
    "unsupported_trust_source_facts_version",
  );
export const createDecisionApplicabilityVersion = (value: unknown) =>
  createExactVersion(
    value,
    DECISION_APPLICABILITY_VERSION,
    "invalid_decision_applicability",
  );
