import {
  runtimeContractFailure,
  runtimeContractSuccess,
  type OrganizationVerificationPolicyRuntimeContractFailureCode,
  type OrganizationVerificationPolicyRuntimeContractResult,
} from "./errors.js";

export const ORGANIZATION_VERIFICATION_RULE_IMPLEMENTATION_CONTRACT_VERSION =
  "organization_verification.rule_implementation.v1" as const;
export const ORGANIZATION_VERIFICATION_RULE_IMPLEMENTATION_SET_CONTRACT_VERSION =
  "organization_verification.rule_implementation_set.v1" as const;
export const ORGANIZATION_VERIFICATION_EXECUTION_ARTIFACTS_CONTRACT_VERSION =
  "organization_verification.execution_artifacts.v1" as const;

declare const runtimeContractIdentityBrand: unique symbol;
type RuntimeContractOpaque<T extends string> = string & {
  readonly [runtimeContractIdentityBrand]: T;
};

export type OrganizationVerificationRuleImplementationVersion =
  RuntimeContractOpaque<"OrganizationVerificationRuleImplementationVersion">;
export type OrganizationVerificationRuleImplementationDigest =
  RuntimeContractOpaque<"OrganizationVerificationRuleImplementationDigest">;
export type OrganizationVerificationRuleImplementationFingerprint =
  RuntimeContractOpaque<"OrganizationVerificationRuleImplementationFingerprint">;
export type OrganizationVerificationRuleImplementationProvenanceReference =
  RuntimeContractOpaque<"OrganizationVerificationRuleImplementationProvenanceReference">;
export type OrganizationVerificationRuleImplementationIntegrityReference =
  RuntimeContractOpaque<"OrganizationVerificationRuleImplementationIntegrityReference">;
export type OrganizationVerificationRuleImplementationSetId =
  RuntimeContractOpaque<"OrganizationVerificationRuleImplementationSetId">;
export type OrganizationVerificationRuleImplementationSetVersion =
  RuntimeContractOpaque<"OrganizationVerificationRuleImplementationSetVersion">;
export type OrganizationVerificationRuleImplementationSetFingerprint =
  RuntimeContractOpaque<"OrganizationVerificationRuleImplementationSetFingerprint">;
export type OrganizationVerificationPolicySetFingerprint =
  RuntimeContractOpaque<"OrganizationVerificationPolicySetFingerprint">;
export type OrganizationVerificationExecutionId =
  RuntimeContractOpaque<"OrganizationVerificationExecutionId">;
export type OrganizationVerificationRuleResultId =
  RuntimeContractOpaque<"OrganizationVerificationRuleResultId">;
export type OrganizationVerificationExecutionArtifactProvenanceReference =
  RuntimeContractOpaque<"OrganizationVerificationExecutionArtifactProvenanceReference">;
export type OrganizationVerificationExecutionArtifactIntegrityReference =
  RuntimeContractOpaque<"OrganizationVerificationExecutionArtifactIntegrityReference">;
export type OrganizationVerificationExecutionArtifactsFingerprint =
  RuntimeContractOpaque<"OrganizationVerificationExecutionArtifactsFingerprint">;

export type OrganizationVerificationRuleImplementationContractVersion =
  typeof ORGANIZATION_VERIFICATION_RULE_IMPLEMENTATION_CONTRACT_VERSION;
export type OrganizationVerificationRuleImplementationSetContractVersion =
  typeof ORGANIZATION_VERIFICATION_RULE_IMPLEMENTATION_SET_CONTRACT_VERSION;
export type OrganizationVerificationExecutionArtifactsContractVersion =
  typeof ORGANIZATION_VERIFICATION_EXECUTION_ARTIFACTS_CONTRACT_VERSION;

const MUTABLE_POINTERS = new Set(["latest", "current", "default", "head"]);

function createIdentity<T extends string>(
  value: unknown,
): OrganizationVerificationPolicyRuntimeContractResult<
  RuntimeContractOpaque<T>
> {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    MUTABLE_POINTERS.has(value.trim().toLowerCase())
  ) {
    return runtimeContractFailure("invalid_runtime_contract_identity");
  }
  return runtimeContractSuccess(value as RuntimeContractOpaque<T>);
}

function createDigest<T extends string>(
  value: unknown,
  failure: OrganizationVerificationPolicyRuntimeContractFailureCode =
    "invalid_runtime_contract_digest",
): OrganizationVerificationPolicyRuntimeContractResult<
  RuntimeContractOpaque<T>
> {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) {
    return runtimeContractFailure(failure);
  }
  return runtimeContractSuccess(value as RuntimeContractOpaque<T>);
}

export const createOrganizationVerificationRuleImplementationVersion = (
  value: unknown,
) =>
  createIdentity<"OrganizationVerificationRuleImplementationVersion">(value);
export const createOrganizationVerificationRuleImplementationDigest = (
  value: unknown,
) => createDigest<"OrganizationVerificationRuleImplementationDigest">(value);
export const createOrganizationVerificationRuleImplementationProvenanceReference =
  (value: unknown) =>
    createIdentity<"OrganizationVerificationRuleImplementationProvenanceReference">(
      value,
    );
export const createOrganizationVerificationRuleImplementationIntegrityReference =
  (value: unknown) =>
    createIdentity<"OrganizationVerificationRuleImplementationIntegrityReference">(
      value,
    );
export const createOrganizationVerificationRuleImplementationSetId = (
  value: unknown,
) => createIdentity<"OrganizationVerificationRuleImplementationSetId">(value);
export const createOrganizationVerificationRuleImplementationSetVersion = (
  value: unknown,
) =>
  createIdentity<"OrganizationVerificationRuleImplementationSetVersion">(
    value,
  );
export const createOrganizationVerificationExecutionId = (value: unknown) =>
  createIdentity<"OrganizationVerificationExecutionId">(value);
export const createOrganizationVerificationRuleResultId = (value: unknown) =>
  createIdentity<"OrganizationVerificationRuleResultId">(value);
export const createOrganizationVerificationExecutionArtifactProvenanceReference =
  (value: unknown) =>
    createIdentity<"OrganizationVerificationExecutionArtifactProvenanceReference">(
      value,
    );
export const createOrganizationVerificationExecutionArtifactIntegrityReference =
  (value: unknown) =>
    createIdentity<"OrganizationVerificationExecutionArtifactIntegrityReference">(
      value,
    );

export function createOrganizationVerificationPolicySetFingerprint(
  value: unknown,
) {
  return createDigest<"OrganizationVerificationPolicySetFingerprint">(value);
}

export function createOrganizationVerificationRuleImplementationSetFingerprint(
  value: unknown,
) {
  return createDigest<"OrganizationVerificationRuleImplementationSetFingerprint">(
    value,
  );
}

export function createOrganizationVerificationRuleImplementationFingerprint(
  value: unknown,
) {
  return createDigest<"OrganizationVerificationRuleImplementationFingerprint">(
    value,
  );
}

export function createOrganizationVerificationExecutionArtifactsFingerprint(
  value: unknown,
) {
  return createDigest<"OrganizationVerificationExecutionArtifactsFingerprint">(
    value,
  );
}
