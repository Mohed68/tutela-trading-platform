import {
  persistenceFailure,
  persistenceSuccess,
  type OrganizationVerificationPersistenceResult,
} from "./persistenceErrors.js";
import {
  sameOrganizationVerificationWorkflowStreamIdentity,
} from "./persistenceStreamIdentity.js";
import {
  isOrganizationVerificationStoredEvidence,
  type OrganizationVerificationStoredEvidence,
} from "./storedEvidence.js";

export type OrganizationVerificationStoredEvidenceConflictClassification =
  | "none"
  | "duplicate_append_idempotent"
  | "evidence_identity_conflict"
  | "evidence_fingerprint_conflict"
  | "stream_identity_mismatch";

export function classifyOrganizationVerificationStoredEvidenceConflict(
  existing: OrganizationVerificationStoredEvidence,
  incoming: OrganizationVerificationStoredEvidence,
): OrganizationVerificationPersistenceResult<OrganizationVerificationStoredEvidenceConflictClassification> {
  if (
    !isOrganizationVerificationStoredEvidence(existing) ||
    !isOrganizationVerificationStoredEvidence(incoming)
  ) {
    return persistenceFailure("unauthentic_evidence");
  }
  if (
    !sameOrganizationVerificationWorkflowStreamIdentity(
      existing.streamIdentity,
      incoming.streamIdentity,
    )
  ) {
    return persistenceSuccess("stream_identity_mismatch");
  }
  if (existing.evidenceEntryId === incoming.evidenceEntryId) {
    return persistenceSuccess(
      existing.storedEvidenceFingerprint ===
        incoming.storedEvidenceFingerprint
        ? "duplicate_append_idempotent"
        : "evidence_identity_conflict",
    );
  }
  if (
    existing.evidenceKind === incoming.evidenceKind &&
    existing.semanticArtifactIdentity ===
      incoming.semanticArtifactIdentity &&
    existing.artifactVersionOrSequence ===
      incoming.artifactVersionOrSequence
  ) {
    return persistenceSuccess(
      existing.artifactFingerprint === incoming.artifactFingerprint
        ? "evidence_identity_conflict"
        : "evidence_fingerprint_conflict",
    );
  }
  return persistenceSuccess("none");
}
