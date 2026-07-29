import type {
  OrganizationId,
  OrganizationProfileRevisionId,
} from "../../../organization-registry/index.js";
import type {
  OrganizationVerificationAttemptId,
  OrganizationVerificationRecordId,
  OrganizationVerificationRevisionId,
} from "../index.js";
import {
  evidenceSnapshotFailure,
  evidenceSnapshotSuccess,
  type EvidenceSnapshotDomainResult,
} from "./errors.js";
import {
  EVIDENCE_SNAPSHOT_BUILDER_VERSION,
  EVIDENCE_SNAPSHOT_CONTRACT_VERSION,
  EVIDENCE_SNAPSHOT_MANIFEST_VERSION,
  isEvidenceSnapshotDigestInternal,
  isEvidenceSnapshotOpaqueIdentityInternal,
  isCanonicalTimestamp,
  parseEvidenceSnapshotBuilderVersion,
  parseEvidenceSnapshotContractVersion,
  parseEvidenceSnapshotManifestVersion,
  type EvidenceSnapshotBuilderVersion,
  type EvidenceSnapshotContractVersion,
  type EvidenceSnapshotCorrelationReference,
  type EvidenceSnapshotFingerprint,
  type EvidenceSnapshotId,
  type EvidenceSnapshotIntegrityReference,
  type EvidenceSnapshotManifestVersion,
  type EvidenceSnapshotProvenanceReference,
  type EvidenceSnapshotSourceDigest,
  type EvidenceSnapshotVersion,
} from "./ids.js";

export interface OrganizationVerificationEvidenceSnapshotAttemptBinding {
  readonly attemptId: OrganizationVerificationAttemptId;
  readonly attemptCreatedAt: string;
}

export interface OrganizationVerificationEvidenceSnapshotConstructionContext {
  readonly evidenceSnapshotId: EvidenceSnapshotId;
  readonly evidenceSnapshotVersion: EvidenceSnapshotVersion;
  readonly snapshotContractVersion: EvidenceSnapshotContractVersion;
  readonly snapshotBuilderVersion: EvidenceSnapshotBuilderVersion;
  readonly manifestVersion: EvidenceSnapshotManifestVersion;
  readonly organizationId: OrganizationId;
  readonly recordId: OrganizationVerificationRecordId;
  readonly revisionId: OrganizationVerificationRevisionId;
  readonly profileRevisionId: OrganizationProfileRevisionId;
  readonly createdAt: string;
  readonly sourceCutoffAt?: string;
  readonly sourceSelectionCompletedAt: string;
  readonly attemptBinding?: OrganizationVerificationEvidenceSnapshotAttemptBinding;
  readonly sourceComplete: true;
  readonly sourceIntegrityValid: true;
  readonly provenanceReference: EvidenceSnapshotProvenanceReference;
  readonly correlationReference: EvidenceSnapshotCorrelationReference;
  readonly integrityReference: EvidenceSnapshotIntegrityReference;
  readonly expectedSourceDigest?: EvidenceSnapshotSourceDigest;
  readonly expectedSnapshotFingerprint?: EvidenceSnapshotFingerprint;
}

export interface CreateOrganizationVerificationEvidenceSnapshotConstructionContextInput {
  readonly evidenceSnapshotId: EvidenceSnapshotId;
  readonly evidenceSnapshotVersion: EvidenceSnapshotVersion;
  readonly snapshotContractVersion: unknown;
  readonly snapshotBuilderVersion: unknown;
  readonly manifestVersion: unknown;
  readonly organizationId: OrganizationId;
  readonly recordId: OrganizationVerificationRecordId;
  readonly revisionId: OrganizationVerificationRevisionId;
  readonly profileRevisionId: OrganizationProfileRevisionId;
  readonly createdAt: unknown;
  readonly sourceCutoffAt?: unknown;
  readonly sourceSelectionCompletedAt: unknown;
  readonly attemptBinding?: {
    readonly attemptId: OrganizationVerificationAttemptId;
    readonly attemptCreatedAt: unknown;
  };
  readonly sourceComplete: unknown;
  readonly sourceIntegrityValid: unknown;
  readonly provenanceReference: EvidenceSnapshotProvenanceReference;
  readonly correlationReference: EvidenceSnapshotCorrelationReference;
  readonly integrityReference: EvidenceSnapshotIntegrityReference;
  readonly expectedSourceDigest?: EvidenceSnapshotSourceDigest;
  readonly expectedSnapshotFingerprint?: EvidenceSnapshotFingerprint;
}

export function createOrganizationVerificationEvidenceSnapshotConstructionContext(
  input: CreateOrganizationVerificationEvidenceSnapshotConstructionContextInput,
): EvidenceSnapshotDomainResult<OrganizationVerificationEvidenceSnapshotConstructionContext> {
  if (!isEvidenceSnapshotOpaqueIdentityInternal(input.evidenceSnapshotId)) {
    return evidenceSnapshotFailure("invalid_evidence_snapshot_id");
  }
  if (!isEvidenceSnapshotOpaqueIdentityInternal(input.evidenceSnapshotVersion)) {
    return evidenceSnapshotFailure("invalid_evidence_snapshot_version");
  }
  if (!isEvidenceSnapshotOpaqueIdentityInternal(input.organizationId)) {
    return evidenceSnapshotFailure("organization_id_mismatch");
  }
  if (!isEvidenceSnapshotOpaqueIdentityInternal(input.recordId)) {
    return evidenceSnapshotFailure("verification_record_id_mismatch");
  }
  if (!isEvidenceSnapshotOpaqueIdentityInternal(input.revisionId)) {
    return evidenceSnapshotFailure("verification_revision_id_mismatch");
  }
  if (!isEvidenceSnapshotOpaqueIdentityInternal(input.profileRevisionId)) {
    return evidenceSnapshotFailure("profile_revision_id_mismatch");
  }
  const contract = parseEvidenceSnapshotContractVersion(
    input.snapshotContractVersion,
  );
  if (!contract.ok) return contract;
  const builder = parseEvidenceSnapshotBuilderVersion(
    input.snapshotBuilderVersion,
  );
  if (!builder.ok) return builder;
  const manifest = parseEvidenceSnapshotManifestVersion(input.manifestVersion);
  if (!manifest.ok) return manifest;
  if (
    !isCanonicalTimestamp(input.createdAt) ||
    !isCanonicalTimestamp(input.sourceSelectionCompletedAt) ||
    (input.sourceCutoffAt !== undefined &&
      !isCanonicalTimestamp(input.sourceCutoffAt)) ||
    Date.parse(input.sourceSelectionCompletedAt) >
      Date.parse(input.createdAt) ||
    (input.sourceCutoffAt !== undefined &&
      Date.parse(input.sourceCutoffAt) > Date.parse(input.createdAt))
  ) {
    return evidenceSnapshotFailure("invalid_snapshot_chronology");
  }
  if (input.sourceComplete !== true) {
    return evidenceSnapshotFailure("snapshot_source_incomplete");
  }
  if (input.sourceIntegrityValid !== true) {
    return evidenceSnapshotFailure("snapshot_source_integrity_invalid");
  }
  if (
    !isEvidenceSnapshotOpaqueIdentityInternal(input.provenanceReference) ||
    !isEvidenceSnapshotOpaqueIdentityInternal(input.correlationReference) ||
    !isEvidenceSnapshotOpaqueIdentityInternal(input.integrityReference) ||
    (input.expectedSourceDigest !== undefined &&
      !isEvidenceSnapshotDigestInternal(input.expectedSourceDigest)) ||
    (input.expectedSnapshotFingerprint !== undefined &&
      !isEvidenceSnapshotDigestInternal(input.expectedSnapshotFingerprint))
  ) {
    return evidenceSnapshotFailure("evidence_snapshot_construction_failure");
  }

  let attemptBinding:
    | OrganizationVerificationEvidenceSnapshotAttemptBinding
    | undefined;
  if (input.attemptBinding !== undefined) {
    if (
      !isEvidenceSnapshotOpaqueIdentityInternal(input.attemptBinding.attemptId) ||
      !isCanonicalTimestamp(input.attemptBinding.attemptCreatedAt) ||
      Date.parse(input.attemptBinding.attemptCreatedAt) >
        Date.parse(input.createdAt)
    ) {
      return evidenceSnapshotFailure("attempt_id_mismatch");
    }
    attemptBinding = Object.freeze({
      attemptId: input.attemptBinding.attemptId,
      attemptCreatedAt: input.attemptBinding.attemptCreatedAt,
    });
  }

  return evidenceSnapshotSuccess(
    Object.freeze({
      evidenceSnapshotId: input.evidenceSnapshotId,
      evidenceSnapshotVersion: input.evidenceSnapshotVersion,
      snapshotContractVersion: EVIDENCE_SNAPSHOT_CONTRACT_VERSION,
      snapshotBuilderVersion: EVIDENCE_SNAPSHOT_BUILDER_VERSION,
      manifestVersion: EVIDENCE_SNAPSHOT_MANIFEST_VERSION,
      organizationId: input.organizationId,
      recordId: input.recordId,
      revisionId: input.revisionId,
      profileRevisionId: input.profileRevisionId,
      createdAt: input.createdAt,
      ...(input.sourceCutoffAt
        ? { sourceCutoffAt: input.sourceCutoffAt }
        : {}),
      sourceSelectionCompletedAt: input.sourceSelectionCompletedAt,
      ...(attemptBinding ? { attemptBinding } : {}),
      sourceComplete: true as const,
      sourceIntegrityValid: true as const,
      provenanceReference: input.provenanceReference,
      correlationReference: input.correlationReference,
      integrityReference: input.integrityReference,
      ...(input.expectedSourceDigest
        ? { expectedSourceDigest: input.expectedSourceDigest }
        : {}),
      ...(input.expectedSnapshotFingerprint
        ? { expectedSnapshotFingerprint: input.expectedSnapshotFingerprint }
        : {}),
    }),
  );
}
