import {
  integrationFailure,
  integrationSuccess,
  type OrganizationVerificationDecisionTrustIntegrationResult,
} from "./decisionTrustIntegrationErrors.js";

export const ORGANIZATION_VERIFICATION_DECISION_TRUST_INTEGRATION_EXECUTION_CONTRACT_VERSION =
  "organization-verification-decision-trust-integration-execution/v1" as const;

export type OrganizationVerificationDecisionTrustIntegrationExecutionContractVersion =
  typeof ORGANIZATION_VERIFICATION_DECISION_TRUST_INTEGRATION_EXECUTION_CONTRACT_VERSION;

declare const decisionTrustIntegrationBrand: unique symbol;
type Opaque<T extends string> = string & {
  readonly [decisionTrustIntegrationBrand]: T;
};

export type OrganizationVerificationDecisionTrustIntegrationExecutionId =
  Opaque<"OrganizationVerificationDecisionTrustIntegrationExecutionId">;
export type OrganizationVerificationDecisionTrustIntegrationExecutionProvenanceReference =
  Opaque<"OrganizationVerificationDecisionTrustIntegrationExecutionProvenanceReference">;
export type OrganizationVerificationDecisionTrustIntegrationExecutionIntegrityReference =
  Opaque<"OrganizationVerificationDecisionTrustIntegrationExecutionIntegrityReference">;
export type OrganizationVerificationDecisionTrustIntegrationExecutionFingerprint =
  Opaque<"OrganizationVerificationDecisionTrustIntegrationExecutionFingerprint">;

function validOpaque(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !["latest", "current", "head"].includes(value.trim().toLowerCase())
  );
}

function createOpaque<T extends string>(
  value: unknown,
): OrganizationVerificationDecisionTrustIntegrationResult<Opaque<T>> {
  return validOpaque(value)
    ? integrationSuccess(value as Opaque<T>)
    : integrationFailure({
        stage: "execution",
        code: "invalid_execution_artifacts",
      });
}

export const createOrganizationVerificationDecisionTrustIntegrationExecutionId =
  (value: unknown) =>
    createOpaque<"OrganizationVerificationDecisionTrustIntegrationExecutionId">(
      value,
    );

export const createOrganizationVerificationDecisionTrustIntegrationExecutionProvenanceReference =
  (value: unknown) =>
    createOpaque<"OrganizationVerificationDecisionTrustIntegrationExecutionProvenanceReference">(
      value,
    );

export const createOrganizationVerificationDecisionTrustIntegrationExecutionIntegrityReference =
  (value: unknown) =>
    createOpaque<"OrganizationVerificationDecisionTrustIntegrationExecutionIntegrityReference">(
      value,
    );

export function createOrganizationVerificationDecisionTrustIntegrationExecutionFingerprint(
  value: unknown,
): OrganizationVerificationDecisionTrustIntegrationResult<OrganizationVerificationDecisionTrustIntegrationExecutionFingerprint> {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value)
    ? integrationSuccess(
        value as OrganizationVerificationDecisionTrustIntegrationExecutionFingerprint,
      )
    : integrationFailure({
        stage: "execution",
        code: "invalid_execution_artifacts",
      });
}
