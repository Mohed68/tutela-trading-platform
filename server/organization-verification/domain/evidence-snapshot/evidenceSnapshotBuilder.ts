import type {
  OrganizationVerificationEvidenceSnapshot,
  OrganizationVerificationEvidenceSnapshotData,
} from "./evidenceSnapshot.js";
import {
  createOrganizationVerificationEvidenceSnapshotInternal,
  readOrganizationVerificationEvidenceSnapshotInternal,
} from "./evidenceSnapshot.js";
import {
  freezeOrganizationVerificationEvidenceSet,
  type OrganizationVerificationSemanticEvidenceReferenceInput,
} from "./evidenceReference.js";
import {
  evidenceSnapshotFailure,
  evidenceSnapshotSuccess,
  type EvidenceSnapshotDomainResult,
} from "./errors.js";
import {
  freezeOrganizationVerificationRegistryProjection,
  type OrganizationVerificationRegistrySnapshotSource,
} from "./frozenRegistryProjection.js";
import {
  freezeOrganizationVerificationSubmissionProjection,
  type OrganizationVerificationSubmissionSnapshotSource,
} from "./frozenSubmissionProjection.js";
import {
  computeEvidenceSnapshotFingerprintInternal,
  computeEvidenceSnapshotSourceDigestInternal,
} from "./snapshotCanonicalization.js";
import type { OrganizationVerificationEvidenceSnapshotConstructionContext } from "./snapshotConstructionContext.js";
import { createOrganizationVerificationEvidenceSnapshotSourceManifestInternal } from "./sourceManifest.js";

export interface BuildOrganizationVerificationEvidenceSnapshotInput {
  readonly context: OrganizationVerificationEvidenceSnapshotConstructionContext;
  readonly registrySource: OrganizationVerificationRegistrySnapshotSource;
  readonly submissionSource: OrganizationVerificationSubmissionSnapshotSource;
  readonly evidenceReferences: readonly OrganizationVerificationSemanticEvidenceReferenceInput[];
  readonly existingSnapshot?: unknown;
}

function sameEvidenceSet(
  required: readonly unknown[],
  provided: readonly { readonly revisionEvidenceReferenceId: unknown }[],
): "same" | "missing" | "extra" {
  const expected = new Set(required.map(String));
  const actual = new Set(provided.map((item) => String(item.revisionEvidenceReferenceId)));
  if ([...expected].some((id) => !actual.has(id))) return "missing";
  if ([...actual].some((id) => !expected.has(id))) return "extra";
  return "same";
}

function sourceDigestInput(
  data: Pick<
    OrganizationVerificationEvidenceSnapshotData,
    | "registryProjection"
    | "submissionProjection"
    | "evidenceProjections"
    | "sourceManifest"
  >,
): unknown {
  return {
    registryProjection: data.registryProjection,
    submissionProjection: data.submissionProjection,
    evidenceProjections: data.evidenceProjections,
    sourceManifest: data.sourceManifest,
  };
}

function fingerprintInput(
  data: Omit<
    OrganizationVerificationEvidenceSnapshotData,
    "snapshotFingerprint"
  >,
): unknown {
  return data;
}

function semanticIdentityInput(
  snapshot: OrganizationVerificationEvidenceSnapshot,
): unknown {
  const {
    evidenceSnapshotId: _id,
    snapshotFingerprint: _fingerprint,
    ...semantic
  } = snapshot;
  return semantic;
}

export function buildOrganizationVerificationEvidenceSnapshot(
  input: BuildOrganizationVerificationEvidenceSnapshotInput,
): EvidenceSnapshotDomainResult<OrganizationVerificationEvidenceSnapshot> {
  const { context } = input;
  if (!Object.isFrozen(context)) {
    return evidenceSnapshotFailure("evidence_snapshot_construction_failure");
  }
  const registry = freezeOrganizationVerificationRegistryProjection(
    input.registrySource,
    context.createdAt,
  );
  if (!registry.ok) return registry;
  const submission = freezeOrganizationVerificationSubmissionProjection(
    input.submissionSource,
    context.createdAt,
  );
  if (!submission.ok) return submission;
  const evidence = freezeOrganizationVerificationEvidenceSet(
    input.evidenceReferences,
    context.createdAt,
    context.correlationReference,
  );
  if (!evidence.ok) return evidence;

  if (registry.value.organizationId !== submission.value.organizationId) {
    return evidenceSnapshotFailure("organization_id_mismatch");
  }
  if (submission.value.organizationId !== context.organizationId) {
    return evidenceSnapshotFailure("organization_id_mismatch");
  }
  if (submission.value.recordId !== context.recordId) {
    return evidenceSnapshotFailure("verification_record_id_mismatch");
  }
  if (submission.value.revisionId !== context.revisionId) {
    return evidenceSnapshotFailure("verification_revision_id_mismatch");
  }
  if (submission.value.profileRevisionId !== context.profileRevisionId) {
    return evidenceSnapshotFailure("profile_revision_id_mismatch");
  }
  if (
    registry.value.profileRevisionId !== submission.value.profileRevisionId ||
    registry.value.profileRevisionSequence !==
      submission.value.profileRevisionSequence ||
    registry.value.profileFingerprint !== submission.value.profileFingerprint
  ) {
    return evidenceSnapshotFailure("profile_revision_id_mismatch");
  }
  if (
    String(submission.value.correlationId) !==
    String(context.correlationReference)
  ) {
    return evidenceSnapshotFailure("evidence_snapshot_construction_failure");
  }

  const evidenceSet = sameEvidenceSet(
    submission.value.evidenceReferenceIds,
    evidence.value.semanticReferences,
  );
  if (evidenceSet === "missing") {
    return evidenceSnapshotFailure("required_evidence_reference_missing");
  }
  if (evidenceSet === "extra") {
    return evidenceSnapshotFailure("unauthorized_evidence_reference");
  }
  if (
    context.attemptBinding &&
    Date.parse(context.attemptBinding.attemptCreatedAt) <
      Date.parse(submission.value.submittedAt)
  ) {
    return evidenceSnapshotFailure("attempt_id_mismatch");
  }

  const sourceManifest =
    createOrganizationVerificationEvidenceSnapshotSourceManifestInternal({
      manifestVersion: context.manifestVersion,
      organizationId: submission.value.organizationId,
      recordId: submission.value.recordId,
      revisionId: submission.value.revisionId,
      profileRevisionId: submission.value.profileRevisionId,
      ...(context.attemptBinding
        ? { attemptId: context.attemptBinding.attemptId }
        : {}),
      registrySourceContractVersion: registry.value.registryContractVersion,
      verificationSourceContractVersion:
        submission.value.verificationSourceContractVersion,
      evidenceReferences: evidence.value.semanticReferences,
      sourceSelectionCompletedAt: context.sourceSelectionCompletedAt,
      sourceComplete: true,
      sourceIntegrityValid: true,
      provenanceReference: context.provenanceReference,
      correlationReference: context.correlationReference,
      integrityReference: context.integrityReference,
    });

  const sourceDigest = computeEvidenceSnapshotSourceDigestInternal(
    sourceDigestInput({
      registryProjection: registry.value,
      submissionProjection: submission.value,
      evidenceProjections: evidence.value.evidenceProjections,
      sourceManifest,
    }),
  );
  if (
    context.expectedSourceDigest !== undefined &&
    context.expectedSourceDigest !== sourceDigest
  ) {
    return evidenceSnapshotFailure("snapshot_fingerprint_mismatch");
  }

  const withoutFingerprint: Omit<
    OrganizationVerificationEvidenceSnapshotData,
    "snapshotFingerprint"
  > = {
    evidenceSnapshotId: context.evidenceSnapshotId,
    evidenceSnapshotVersion: context.evidenceSnapshotVersion,
    snapshotContractVersion: context.snapshotContractVersion,
    snapshotBuilderVersion: context.snapshotBuilderVersion,
    manifestVersion: context.manifestVersion,
    organizationId: submission.value.organizationId,
    recordId: submission.value.recordId,
    revisionId: submission.value.revisionId,
    profileRevisionId: submission.value.profileRevisionId,
    ...(context.attemptBinding
      ? { attemptBinding: context.attemptBinding }
      : {}),
    createdAt: context.createdAt,
    ...(context.sourceCutoffAt
      ? { sourceCutoffAt: context.sourceCutoffAt }
      : {}),
    sourceManifest,
    registryProjection: registry.value,
    submissionProjection: submission.value,
    evidenceProjections: evidence.value.evidenceProjections,
    evidenceReferences: evidence.value.semanticReferences,
    sourceComplete: true,
    sourceIntegrityValid: true,
    sourceDigest,
    provenanceReference: context.provenanceReference,
    correlationReference: context.correlationReference,
    integrityReference: context.integrityReference,
  };
  const snapshotFingerprint =
    computeEvidenceSnapshotFingerprintInternal(
      fingerprintInput(withoutFingerprint),
    );
  if (
    context.expectedSnapshotFingerprint !== undefined &&
    context.expectedSnapshotFingerprint !== snapshotFingerprint
  ) {
    return evidenceSnapshotFailure("snapshot_fingerprint_mismatch");
  }

  const candidate = createOrganizationVerificationEvidenceSnapshotInternal({
    ...withoutFingerprint,
    snapshotFingerprint,
  });

  if (input.existingSnapshot !== undefined) {
    const existing = readOrganizationVerificationEvidenceSnapshotInternal(
      input.existingSnapshot,
    );
    if (!existing) {
      return evidenceSnapshotFailure("unauthentic_evidence_snapshot");
    }
    if (
      existing.evidenceSnapshotId === candidate.evidenceSnapshotId &&
      existing.snapshotFingerprint === candidate.snapshotFingerprint
    ) {
      return evidenceSnapshotSuccess(existing);
    }
    const existingSemantic = JSON.stringify(semanticIdentityInput(existing));
    const candidateSemantic = JSON.stringify(semanticIdentityInput(candidate));
    if (
      existing.evidenceSnapshotId !== candidate.evidenceSnapshotId &&
      existingSemantic === candidateSemantic
    ) {
      return evidenceSnapshotFailure("duplicate_evidence_snapshot");
    }
    return evidenceSnapshotFailure("conflicting_evidence_snapshot");
  }

  return evidenceSnapshotSuccess(candidate);
}
