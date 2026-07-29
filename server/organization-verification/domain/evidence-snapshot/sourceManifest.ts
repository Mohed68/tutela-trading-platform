import type {
  OrganizationId,
  OrganizationProfileRevisionId,
  RegistryContractVersion,
} from "../../../organization-registry/index.js";
import type {
  OrganizationVerificationAttemptId,
  OrganizationVerificationRecordId,
  OrganizationVerificationRevisionId,
} from "../index.js";
import type { OrganizationVerificationSemanticEvidenceReference } from "./evidenceReference.js";
import type {
  EvidenceSnapshotCorrelationReference,
  EvidenceSnapshotIntegrityReference,
  EvidenceSnapshotManifestVersion,
  EvidenceSnapshotProvenanceReference,
  VerificationRevisionSourceContractVersion,
} from "./ids.js";

export interface OrganizationVerificationEvidenceSnapshotSourceManifest {
  readonly manifestVersion: EvidenceSnapshotManifestVersion;
  readonly organizationId: OrganizationId;
  readonly recordId: OrganizationVerificationRecordId;
  readonly revisionId: OrganizationVerificationRevisionId;
  readonly profileRevisionId: OrganizationProfileRevisionId;
  readonly attemptId?: OrganizationVerificationAttemptId;
  readonly registrySourceContractVersion: RegistryContractVersion;
  readonly verificationSourceContractVersion: VerificationRevisionSourceContractVersion;
  readonly evidenceReferences: readonly OrganizationVerificationSemanticEvidenceReference[];
  readonly sourceSelectionCompletedAt: string;
  readonly sourceComplete: true;
  readonly sourceIntegrityValid: true;
  readonly provenanceReference: EvidenceSnapshotProvenanceReference;
  readonly correlationReference: EvidenceSnapshotCorrelationReference;
  readonly integrityReference: EvidenceSnapshotIntegrityReference;
}

export function createOrganizationVerificationEvidenceSnapshotSourceManifestInternal(
  input: OrganizationVerificationEvidenceSnapshotSourceManifest,
): OrganizationVerificationEvidenceSnapshotSourceManifest {
  return Object.freeze({
    ...input,
    evidenceReferences: Object.freeze([...input.evidenceReferences]),
  });
}
