import {
  evidenceSnapshotFailure,
  evidenceSnapshotSuccess,
  type EvidenceSnapshotDomainFailureCode,
  type EvidenceSnapshotDomainResult,
} from "./errors.js";

export const EVIDENCE_SNAPSHOT_CONTRACT_VERSION =
  "organization_verification.evidence_snapshot.v1" as const;
export const EVIDENCE_SNAPSHOT_BUILDER_VERSION =
  "organization_verification.evidence_snapshot_builder.v1" as const;
export const EVIDENCE_SNAPSHOT_MANIFEST_VERSION =
  "organization_verification.evidence_snapshot_manifest.v1" as const;
export const FROZEN_REGISTRY_PROJECTION_VERSION =
  "organization_verification.frozen_registry_projection.v1" as const;
export const FROZEN_SUBMISSION_PROJECTION_VERSION =
  "organization_verification.frozen_submission_projection.v1" as const;
export const FROZEN_EVIDENCE_PROJECTION_VERSION =
  "organization_verification.frozen_evidence_projection.v1" as const;
export const VERIFICATION_REVISION_SOURCE_CONTRACT_VERSION =
  "organization_verification.revision.v1" as const;

declare const evidenceSnapshotBrand: unique symbol;
type SnapshotOpaque<T extends string> = string & {
  readonly [evidenceSnapshotBrand]: T;
};

export type EvidenceSnapshotId = SnapshotOpaque<"EvidenceSnapshotId">;
export type EvidenceSnapshotVersion =
  SnapshotOpaque<"EvidenceSnapshotVersion">;
export type EvidenceSnapshotIntegrityReference =
  SnapshotOpaque<"EvidenceSnapshotIntegrityReference">;
export type EvidenceSnapshotProvenanceReference =
  SnapshotOpaque<"EvidenceSnapshotProvenanceReference">;
export type EvidenceSnapshotCorrelationReference =
  SnapshotOpaque<"EvidenceSnapshotCorrelationReference">;
export type EvidenceSnapshotSourceDigest =
  SnapshotOpaque<"EvidenceSnapshotSourceDigest">;
export type EvidenceSnapshotFingerprint =
  SnapshotOpaque<"EvidenceSnapshotFingerprint">;
export type EvidenceContentDigest = SnapshotOpaque<"EvidenceContentDigest">;
export type EvidenceReferenceId = SnapshotOpaque<"EvidenceReferenceId">;
export type EvidenceReferenceVersion =
  SnapshotOpaque<"EvidenceReferenceVersion">;
export type EvidenceKind = SnapshotOpaque<"EvidenceKind">;
export type EvidenceSourceAuthority =
  SnapshotOpaque<"EvidenceSourceAuthority">;
export type EvidenceCategory = SnapshotOpaque<"EvidenceCategory">;

export type EvidenceSnapshotContractVersion =
  typeof EVIDENCE_SNAPSHOT_CONTRACT_VERSION;
export type EvidenceSnapshotBuilderVersion =
  typeof EVIDENCE_SNAPSHOT_BUILDER_VERSION;
export type EvidenceSnapshotManifestVersion =
  typeof EVIDENCE_SNAPSHOT_MANIFEST_VERSION;
export type FrozenRegistryProjectionVersion =
  typeof FROZEN_REGISTRY_PROJECTION_VERSION;
export type FrozenSubmissionProjectionVersion =
  typeof FROZEN_SUBMISSION_PROJECTION_VERSION;
export type FrozenEvidenceProjectionVersion =
  typeof FROZEN_EVIDENCE_PROJECTION_VERSION;
export type VerificationRevisionSourceContractVersion =
  typeof VERIFICATION_REVISION_SOURCE_CONTRACT_VERSION;

const MUTABLE_POINTERS = new Set(["latest", "current", "head", "default"]);
const TOKEN_PATTERN = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export function isEvidenceSnapshotOpaqueIdentityInternal(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !MUTABLE_POINTERS.has(value.trim().toLowerCase())
  );
}

export function isEvidenceSnapshotTokenInternal(
  value: unknown,
): value is string {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

export function isEvidenceSnapshotDigestInternal(
  value: unknown,
): value is string {
  return typeof value === "string" && SHA256_PATTERN.test(value);
}

function opaque<T extends string>(
  value: unknown,
  failure: EvidenceSnapshotDomainFailureCode,
): EvidenceSnapshotDomainResult<SnapshotOpaque<T>> {
  if (
    !isEvidenceSnapshotOpaqueIdentityInternal(value)
  ) {
    return evidenceSnapshotFailure(failure);
  }
  return evidenceSnapshotSuccess(value as SnapshotOpaque<T>);
}

function token<T extends string>(
  value: unknown,
  failure: EvidenceSnapshotDomainFailureCode,
): EvidenceSnapshotDomainResult<SnapshotOpaque<T>> {
  return isEvidenceSnapshotTokenInternal(value)
    ? evidenceSnapshotSuccess(value as SnapshotOpaque<T>)
    : evidenceSnapshotFailure(failure);
}

function digest<T extends string>(
  value: unknown,
  failure: EvidenceSnapshotDomainFailureCode,
): EvidenceSnapshotDomainResult<SnapshotOpaque<T>> {
  return isEvidenceSnapshotDigestInternal(value)
    ? evidenceSnapshotSuccess(value as SnapshotOpaque<T>)
    : evidenceSnapshotFailure(failure);
}

export const createEvidenceSnapshotId = (value: unknown) =>
  opaque<"EvidenceSnapshotId">(value, "invalid_evidence_snapshot_id");
export const createEvidenceSnapshotVersion = (value: unknown) =>
  opaque<"EvidenceSnapshotVersion">(value, "invalid_evidence_snapshot_version");
export const createEvidenceSnapshotIntegrityReference = (value: unknown) =>
  opaque<"EvidenceSnapshotIntegrityReference">(
    value,
    "invalid_snapshot_integrity_reference",
  );
export const createEvidenceSnapshotProvenanceReference = (value: unknown) =>
  opaque<"EvidenceSnapshotProvenanceReference">(
    value,
    "invalid_snapshot_provenance_reference",
  );
export const createEvidenceSnapshotCorrelationReference = (value: unknown) =>
  opaque<"EvidenceSnapshotCorrelationReference">(
    value,
    "invalid_snapshot_correlation_reference",
  );
export const createEvidenceReferenceId = (value: unknown) =>
  opaque<"EvidenceReferenceId">(value, "invalid_evidence_reference_id");
export const createEvidenceReferenceVersion = (value: unknown) =>
  opaque<"EvidenceReferenceVersion">(
    value,
    "invalid_evidence_reference_version",
  );
export const createEvidenceKind = (value: unknown) =>
  token<"EvidenceKind">(value, "invalid_evidence_kind");
export const createEvidenceSourceAuthority = (value: unknown) =>
  token<"EvidenceSourceAuthority">(
    value,
    "invalid_evidence_source_authority",
  );
export const createEvidenceCategory = (value: unknown) =>
  token<"EvidenceCategory">(value, "invalid_evidence_category");
export const createEvidenceSnapshotSourceDigest = (value: unknown) =>
  digest<"EvidenceSnapshotSourceDigest">(
    value,
    "invalid_snapshot_source_digest",
  );
export const createEvidenceSnapshotFingerprint = (value: unknown) =>
  digest<"EvidenceSnapshotFingerprint">(
    value,
    "snapshot_fingerprint_mismatch",
  );
export const createEvidenceContentDigest = (value: unknown) =>
  digest<"EvidenceContentDigest">(value, "evidence_digest_mismatch");

export function parseEvidenceSnapshotContractVersion(
  value: unknown,
): EvidenceSnapshotDomainResult<EvidenceSnapshotContractVersion> {
  return value === EVIDENCE_SNAPSHOT_CONTRACT_VERSION
    ? evidenceSnapshotSuccess(EVIDENCE_SNAPSHOT_CONTRACT_VERSION)
    : evidenceSnapshotFailure(
        "unsupported_evidence_snapshot_contract_version",
      );
}

export function parseEvidenceSnapshotBuilderVersion(
  value: unknown,
): EvidenceSnapshotDomainResult<EvidenceSnapshotBuilderVersion> {
  return value === EVIDENCE_SNAPSHOT_BUILDER_VERSION
    ? evidenceSnapshotSuccess(EVIDENCE_SNAPSHOT_BUILDER_VERSION)
    : evidenceSnapshotFailure("unsupported_snapshot_builder_version");
}

export function parseEvidenceSnapshotManifestVersion(
  value: unknown,
): EvidenceSnapshotDomainResult<EvidenceSnapshotManifestVersion> {
  return value === EVIDENCE_SNAPSHOT_MANIFEST_VERSION
    ? evidenceSnapshotSuccess(EVIDENCE_SNAPSHOT_MANIFEST_VERSION)
    : evidenceSnapshotFailure("unsupported_snapshot_manifest_version");
}

export function isCanonicalTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    return false;
  }
  return new Date(value).toISOString() === value;
}
