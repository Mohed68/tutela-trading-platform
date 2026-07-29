import type {
  ActorAuthorityReference,
  OrganizationId,
  OrganizationProfileFingerprint,
  OrganizationProfileRevisionId,
  OrganizationProfileRevisionSequence,
} from "../../../organization-registry/index.js";
import type {
  CorrelationId,
  DeclaredVerificationInputs,
  OrganizationEvidenceReferenceId,
  OrganizationVerificationRecordId,
  OrganizationVerificationRevision,
  OrganizationVerificationRevisionId,
  SubmissionIdempotencyKey,
  VerificationRevisionSequence,
} from "../index.js";
import {
  evidenceSnapshotFailure,
  evidenceSnapshotSuccess,
  type EvidenceSnapshotDomainResult,
} from "./errors.js";
import {
  FROZEN_SUBMISSION_PROJECTION_VERSION,
  VERIFICATION_REVISION_SOURCE_CONTRACT_VERSION,
  isCanonicalTimestamp,
  type EvidenceSnapshotIntegrityReference,
  type EvidenceSnapshotProvenanceReference,
  type FrozenSubmissionProjectionVersion,
  type VerificationRevisionSourceContractVersion,
} from "./ids.js";

export interface OrganizationVerificationFrozenSubmissionProjection {
  readonly projectionVersion: FrozenSubmissionProjectionVersion;
  readonly verificationSourceContractVersion: VerificationRevisionSourceContractVersion;
  readonly organizationId: OrganizationId;
  readonly recordId: OrganizationVerificationRecordId;
  readonly revisionId: OrganizationVerificationRevisionId;
  readonly profileRevisionId: OrganizationProfileRevisionId;
  readonly profileRevisionSequence: OrganizationProfileRevisionSequence;
  readonly profileFingerprint: OrganizationProfileFingerprint;
  readonly revisionSequence: VerificationRevisionSequence;
  readonly declaredInputs: DeclaredVerificationInputs;
  readonly evidenceReferenceIds: readonly OrganizationEvidenceReferenceId[];
  readonly submissionActorAuthorityReference: ActorAuthorityReference;
  readonly submittedAt: string;
  readonly submissionIdempotencyKey: SubmissionIdempotencyKey;
  readonly correlationId: CorrelationId;
  readonly supersedesRevisionId?: OrganizationVerificationRevisionId;
  readonly provenanceReference: EvidenceSnapshotProvenanceReference;
  readonly integrityReference: EvidenceSnapshotIntegrityReference;
}

export interface OrganizationVerificationSubmissionSnapshotSource {
  readonly revision: OrganizationVerificationRevision;
  readonly verificationSourceContractVersion: unknown;
  readonly provenanceReference: EvidenceSnapshotProvenanceReference;
  readonly integrityReference: EvidenceSnapshotIntegrityReference;
}

function exactText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !["latest", "current", "head", "default"].includes(
      value.trim().toLowerCase(),
    )
  );
}

function copyDeclaredInputs(
  source: DeclaredVerificationInputs,
): EvidenceSnapshotDomainResult<DeclaredVerificationInputs> {
  if (!source || !Array.isArray(source.sections)) {
    return evidenceSnapshotFailure("submission_projection_mismatch");
  }
  const sectionKeys = new Set<string>();
  const sections = [];
  for (const section of source.sections) {
    if (
      !section ||
      !exactText(section.key) ||
      sectionKeys.has(section.key) ||
      !Array.isArray(section.values)
    ) {
      return evidenceSnapshotFailure("submission_projection_mismatch");
    }
    sectionKeys.add(section.key);
    const valueKeys = new Set<string>();
    const values = [];
    for (const item of section.values) {
      if (
        !item ||
        !exactText(item.key) ||
        valueKeys.has(item.key) ||
        typeof item.value !== "string"
      ) {
        return evidenceSnapshotFailure("submission_projection_mismatch");
      }
      valueKeys.add(item.key);
      values.push(Object.freeze({ key: item.key, value: item.value }));
    }
    values.sort((left, right) =>
      `${left.key}\u0000${left.value}`.localeCompare(
        `${right.key}\u0000${right.value}`,
      ),
    );
    sections.push(
      Object.freeze({
        key: section.key,
        values: Object.freeze(values),
      }),
    );
  }
  sections.sort((left, right) => left.key.localeCompare(right.key));
  return evidenceSnapshotSuccess(
    Object.freeze({ sections: Object.freeze(sections) }),
  );
}

function copyAuthority(
  source: ActorAuthorityReference,
): EvidenceSnapshotDomainResult<ActorAuthorityReference> {
  if (
    !source ||
    !exactText(source.actorId) ||
    !exactText(source.authorityReferenceId) ||
    !exactText(source.authorityVersion) ||
    !exactText(source.organizationScope) ||
    !isCanonicalTimestamp(source.issuedAt) ||
    !Array.isArray(source.delegatedScopes) ||
    source.delegatedScopes.some((scope) => !exactText(scope))
  ) {
    return evidenceSnapshotFailure("submission_projection_mismatch");
  }
  return evidenceSnapshotSuccess(
    Object.freeze({
      actorId: source.actorId,
      authorityReferenceId: source.authorityReferenceId,
      authorityVersion: source.authorityVersion,
      organizationScope: source.organizationScope,
      issuedAt: source.issuedAt,
      delegatedScopes: Object.freeze(
        [...source.delegatedScopes].sort((left, right) =>
          left.localeCompare(right),
        ),
      ),
    }),
  );
}

export function freezeOrganizationVerificationSubmissionProjection(
  source: OrganizationVerificationSubmissionSnapshotSource,
  snapshotCreatedAt: string,
): EvidenceSnapshotDomainResult<OrganizationVerificationFrozenSubmissionProjection> {
  const revision = source.revision;
  if (
    source.verificationSourceContractVersion !==
      VERIFICATION_REVISION_SOURCE_CONTRACT_VERSION ||
    !revision ||
    !exactText(revision.organizationId) ||
    !exactText(revision.recordId) ||
    !exactText(revision.revisionId) ||
    !exactText(revision.profileRevisionId) ||
    !Number.isSafeInteger(revision.profileRevisionSequence) ||
    Number(revision.profileRevisionSequence) <= 0 ||
    !exactText(revision.profileFingerprint) ||
    !Number.isSafeInteger(revision.sequence) ||
    Number(revision.sequence) <= 0 ||
    !Array.isArray(revision.evidenceReferenceIds) ||
    revision.evidenceReferenceIds.some((reference) => !exactText(reference)) ||
    new Set(revision.evidenceReferenceIds).size !==
      revision.evidenceReferenceIds.length ||
    !isCanonicalTimestamp(revision.submittedAt) ||
    Date.parse(revision.submittedAt) > Date.parse(snapshotCreatedAt) ||
    !exactText(revision.submissionIdempotencyKey) ||
    !exactText(revision.correlationId) ||
    !exactText(source.provenanceReference) ||
    !exactText(source.integrityReference) ||
    (revision.supersedesRevisionId !== undefined &&
      !exactText(revision.supersedesRevisionId))
  ) {
    return evidenceSnapshotFailure("submission_projection_mismatch");
  }
  const declaredInputs = copyDeclaredInputs(revision.declaredInputs);
  if (!declaredInputs.ok) return declaredInputs;
  const authority = copyAuthority(
    revision.submissionActorAuthorityReference,
  );
  if (!authority.ok) return authority;
  if (authority.value.organizationScope !== revision.organizationId) {
    return evidenceSnapshotFailure("organization_id_mismatch");
  }

  return evidenceSnapshotSuccess(
    Object.freeze({
      projectionVersion: FROZEN_SUBMISSION_PROJECTION_VERSION,
      verificationSourceContractVersion:
        VERIFICATION_REVISION_SOURCE_CONTRACT_VERSION,
      organizationId: revision.organizationId,
      recordId: revision.recordId,
      revisionId: revision.revisionId,
      profileRevisionId: revision.profileRevisionId,
      profileRevisionSequence: revision.profileRevisionSequence,
      profileFingerprint: revision.profileFingerprint,
      revisionSequence: revision.sequence,
      declaredInputs: declaredInputs.value,
      evidenceReferenceIds: Object.freeze(
        [...revision.evidenceReferenceIds].sort((left, right) =>
          String(left).localeCompare(String(right)),
        ),
      ),
      submissionActorAuthorityReference: authority.value,
      submittedAt: revision.submittedAt,
      submissionIdempotencyKey: revision.submissionIdempotencyKey,
      correlationId: revision.correlationId,
      ...(revision.supersedesRevisionId
        ? { supersedesRevisionId: revision.supersedesRevisionId }
        : {}),
      provenanceReference: source.provenanceReference,
      integrityReference: source.integrityReference,
    }),
  );
}
