import type {
  OrganizationId,
  OrganizationProfileRevisionId,
} from "../../../organization-registry/index.js";
import type {
  OrganizationVerificationAttemptId,
  OrganizationVerificationRecordId,
  OrganizationVerificationRevisionId,
} from "../index.js";
import type {
  OrganizationVerificationFrozenEvidenceProjection,
  OrganizationVerificationSemanticEvidenceReference,
} from "./evidenceReference.js";
import type { OrganizationVerificationFrozenRegistryProjection } from "./frozenRegistryProjection.js";
import type { OrganizationVerificationFrozenSubmissionProjection } from "./frozenSubmissionProjection.js";
import type {
  EvidenceSnapshotBuilderVersion,
  EvidenceSnapshotContractVersion,
  EvidenceSnapshotCorrelationReference,
  EvidenceSnapshotFingerprint,
  EvidenceSnapshotId,
  EvidenceSnapshotIntegrityReference,
  EvidenceSnapshotManifestVersion,
  EvidenceSnapshotProvenanceReference,
  EvidenceSnapshotSourceDigest,
  EvidenceSnapshotVersion,
} from "./ids.js";
import type { OrganizationVerificationEvidenceSnapshotSourceManifest } from "./sourceManifest.js";

const evidenceSnapshotSeal = Symbol(
  "organization-verification-evidence-snapshot",
);

export interface OrganizationVerificationEvidenceSnapshotAttemptBinding {
  readonly attemptId: OrganizationVerificationAttemptId;
  readonly attemptCreatedAt: string;
}

export interface OrganizationVerificationEvidenceSnapshot {
  readonly evidenceSnapshotId: EvidenceSnapshotId;
  readonly evidenceSnapshotVersion: EvidenceSnapshotVersion;
  readonly snapshotContractVersion: EvidenceSnapshotContractVersion;
  readonly snapshotBuilderVersion: EvidenceSnapshotBuilderVersion;
  readonly manifestVersion: EvidenceSnapshotManifestVersion;
  readonly organizationId: OrganizationId;
  readonly recordId: OrganizationVerificationRecordId;
  readonly revisionId: OrganizationVerificationRevisionId;
  readonly profileRevisionId: OrganizationProfileRevisionId;
  readonly attemptBinding?: OrganizationVerificationEvidenceSnapshotAttemptBinding;
  readonly createdAt: string;
  readonly sourceCutoffAt?: string;
  readonly sourceManifest: OrganizationVerificationEvidenceSnapshotSourceManifest;
  readonly registryProjection: OrganizationVerificationFrozenRegistryProjection;
  readonly submissionProjection: OrganizationVerificationFrozenSubmissionProjection;
  readonly evidenceProjections: readonly OrganizationVerificationFrozenEvidenceProjection[];
  readonly evidenceReferences: readonly OrganizationVerificationSemanticEvidenceReference[];
  readonly sourceComplete: true;
  readonly sourceIntegrityValid: true;
  readonly sourceDigest: EvidenceSnapshotSourceDigest;
  readonly snapshotFingerprint: EvidenceSnapshotFingerprint;
  readonly provenanceReference: EvidenceSnapshotProvenanceReference;
  readonly correlationReference: EvidenceSnapshotCorrelationReference;
  readonly integrityReference: EvidenceSnapshotIntegrityReference;
  readonly [evidenceSnapshotSeal]: true;
}

export type OrganizationVerificationEvidenceSnapshotData = Omit<
  OrganizationVerificationEvidenceSnapshot,
  typeof evidenceSnapshotSeal
>;

export function createOrganizationVerificationEvidenceSnapshotInternal(
  data: OrganizationVerificationEvidenceSnapshotData,
): OrganizationVerificationEvidenceSnapshot {
  return Object.freeze({
    ...data,
    [evidenceSnapshotSeal]: true as const,
  });
}

export function readOrganizationVerificationEvidenceSnapshotInternal(
  value: unknown,
): OrganizationVerificationEvidenceSnapshot | undefined {
  if (
    typeof value !== "object" ||
    value === null ||
    (value as Partial<OrganizationVerificationEvidenceSnapshot>)[
      evidenceSnapshotSeal
    ] !== true ||
    !Object.isFrozen(value)
  ) {
    return undefined;
  }
  return value as OrganizationVerificationEvidenceSnapshot;
}
