import {
  bindingFailure,
  bindingSuccess,
  type OrganizationVerificationDecisionTrustBindingResult,
} from "./errors.js";

export const ORGANIZATION_VERIFICATION_DECISION_TRUST_BINDING_CONTRACT_VERSION =
  "organization-verification-decision-trust-binding/v1" as const;

export type OrganizationVerificationDecisionTrustBindingContractVersion =
  typeof ORGANIZATION_VERIFICATION_DECISION_TRUST_BINDING_CONTRACT_VERSION;

declare const decisionTrustBindingBrand: unique symbol;
type Opaque<T extends string> = string & {
  readonly [decisionTrustBindingBrand]: T;
};

export type OrganizationVerificationDecisionTrustBindingId =
  Opaque<"OrganizationVerificationDecisionTrustBindingId">;
export type OrganizationVerificationDecisionTrustBindingProvenanceReference =
  Opaque<"OrganizationVerificationDecisionTrustBindingProvenanceReference">;
export type OrganizationVerificationDecisionTrustBindingIntegrityReference =
  Opaque<"OrganizationVerificationDecisionTrustBindingIntegrityReference">;
export type CompletionBindingFingerprint =
  Opaque<"CompletionBindingFingerprint">;
export type DecisionBindingFingerprint = Opaque<"DecisionBindingFingerprint">;
export type TrustBindingFingerprint = Opaque<"TrustBindingFingerprint">;

function validOpaque(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !["latest", "current", "head"].includes(value.trim().toLowerCase())
  );
}

function createOpaque<T extends string>(
  value: unknown,
): OrganizationVerificationDecisionTrustBindingResult<Opaque<T>> {
  return validOpaque(value)
    ? bindingSuccess(value as Opaque<T>)
    : bindingFailure("invalid_binding_artifacts");
}

function createFingerprint<T extends string>(
  value: unknown,
): OrganizationVerificationDecisionTrustBindingResult<Opaque<T>> {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value)
    ? bindingSuccess(value as Opaque<T>)
    : bindingFailure("invalid_binding_artifacts");
}

export const createOrganizationVerificationDecisionTrustBindingId = (
  value: unknown,
) =>
  createOpaque<"OrganizationVerificationDecisionTrustBindingId">(value);

export const createOrganizationVerificationDecisionTrustBindingProvenanceReference =
  (value: unknown) =>
    createOpaque<"OrganizationVerificationDecisionTrustBindingProvenanceReference">(
      value,
    );

export const createOrganizationVerificationDecisionTrustBindingIntegrityReference =
  (value: unknown) =>
    createOpaque<"OrganizationVerificationDecisionTrustBindingIntegrityReference">(
      value,
    );

export const createCompletionBindingFingerprint = (value: unknown) =>
  createFingerprint<"CompletionBindingFingerprint">(value);

export const createDecisionBindingFingerprint = (value: unknown) =>
  createFingerprint<"DecisionBindingFingerprint">(value);

export const createTrustBindingFingerprint = (value: unknown) =>
  createFingerprint<"TrustBindingFingerprint">(value);
