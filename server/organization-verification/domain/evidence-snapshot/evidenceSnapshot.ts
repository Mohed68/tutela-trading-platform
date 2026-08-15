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
import { evidenceSnapshotFailure, evidenceSnapshotSuccess, type EvidenceSnapshotDomainResult } from "./errors.js";
import { computeEvidenceSnapshotFingerprintInternal } from "./snapshotCanonicalization.js";
import { deepFreezeDurableValue, hasExactDurableKeys, isDurableIdentity, isDurableJsonValue, isDurablePlainObject, isDurablePositiveVersion, isDurableTimestamp } from "../durableRehydrationValidation.js";

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
  const snapshot = {
    ...data,
  } as OrganizationVerificationEvidenceSnapshot;
  Object.defineProperty(snapshot, evidenceSnapshotSeal, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return Object.freeze(snapshot);
}

function isDurableEvidenceSnapshotData(value: unknown): value is OrganizationVerificationEvidenceSnapshotData {
  if (!isDurablePlainObject(value) || !isDurableJsonValue(value)) return false;
  const required = ["evidenceSnapshotId", "evidenceSnapshotVersion", "snapshotContractVersion", "snapshotBuilderVersion", "manifestVersion", "organizationId", "recordId", "revisionId", "profileRevisionId", "createdAt", "sourceManifest", "registryProjection", "submissionProjection", "evidenceProjections", "evidenceReferences", "sourceComplete", "sourceIntegrityValid", "sourceDigest", "snapshotFingerprint", "provenanceReference", "correlationReference", "integrityReference"];
  if (!hasExactDurableKeys(value, required, ["attemptBinding", "sourceCutoffAt"])) return false;
  return required.filter((key) => !["evidenceSnapshotVersion", "sourceManifest", "registryProjection", "submissionProjection", "evidenceProjections", "evidenceReferences", "sourceComplete", "sourceIntegrityValid", "createdAt"].includes(key))
    .every((key) => isDurableIdentity(value[key])) && isDurableIdentity(value.evidenceSnapshotVersion) &&
    value.sourceComplete === true && value.sourceIntegrityValid === true && isDurableTimestamp(value.createdAt) &&
    (value.sourceCutoffAt === undefined || isDurableTimestamp(value.sourceCutoffAt)) && Array.isArray(value.evidenceProjections) && Array.isArray(value.evidenceReferences);
}

export function rehydrateOrganizationVerificationEvidenceSnapshot(
  durableData: unknown,
): EvidenceSnapshotDomainResult<OrganizationVerificationEvidenceSnapshot> {
  if (!isDurableEvidenceSnapshotData(durableData)) return evidenceSnapshotFailure("evidence_snapshot_construction_failure");
  const { snapshotFingerprint, ...semantic } = durableData;
  if (computeEvidenceSnapshotFingerprintInternal(semantic) !== snapshotFingerprint) return evidenceSnapshotFailure("snapshot_fingerprint_mismatch");
  return evidenceSnapshotSuccess(createOrganizationVerificationEvidenceSnapshotInternal(deepFreezeDurableValue({ ...durableData })));
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

export function isOrganizationVerificationEvidenceSnapshot(
  value: unknown,
): value is OrganizationVerificationEvidenceSnapshot {
  return (
    readOrganizationVerificationEvidenceSnapshotInternal(value) !== undefined
  );
}
