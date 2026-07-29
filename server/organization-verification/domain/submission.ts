import type {
  ActorAuthorityReference,
  OrganizationProfileFingerprint,
  OrganizationProfileRevisionId,
  OrganizationProfileRevisionSequence,
} from "../../organization-registry/index.js";
import {
  copyDeclaredInputs,
  type OrganizationVerificationDraft,
} from "./draft.js";
import {
  domainFailure,
  domainSuccess,
  type CoreDomainResult,
} from "./errors.js";
import { freezeEvidenceReferenceSet } from "./evidenceReferences.js";
import type {
  CorrelationId,
  DraftVersion,
  OrganizationVerificationRevisionId,
  SubmissionIdempotencyKey,
  VerificationRevisionSequence,
} from "./ids.js";
import {
  appendRevisionReference,
  isOrganizationVerificationRecord,
  type OrganizationVerificationRecord,
} from "./record.js";
import type { OrganizationVerificationRevision } from "./revision.js";

const revisionAuthenticitySeal = Symbol(
  "organization-verification-revision-authenticity",
);
const authenticRevisions = new WeakSet<object>();

function sealOrganizationVerificationRevision<T extends OrganizationVerificationRevision>(
  revision: T,
): T {
  Object.defineProperty(revision, revisionAuthenticitySeal, {
    value: true,
    enumerable: false,
    writable: false,
    configurable: false,
  });
  authenticRevisions.add(revision);
  return Object.freeze(revision);
}

export function isOrganizationVerificationRevision(
  value: unknown,
): value is OrganizationVerificationRevision {
  return (
    typeof value === "object" &&
    value !== null &&
    authenticRevisions.has(value) &&
    Object.getOwnPropertyDescriptor(value, revisionAuthenticitySeal)?.value ===
      true &&
    Object.isFrozen(value)
  );
}

export interface OrganizationVerificationSubmission {
  readonly draftId: OrganizationVerificationDraft["draftId"];
  readonly expectedDraftVersion: DraftVersion;
  readonly revisionId: OrganizationVerificationRevisionId;
  readonly revisionSequence: VerificationRevisionSequence;
  readonly profileRevisionId: OrganizationProfileRevisionId;
  readonly profileRevisionSequence: OrganizationProfileRevisionSequence;
  readonly profileFingerprint: OrganizationProfileFingerprint;
  readonly submissionActorAuthorityReference: ActorAuthorityReference;
  readonly submittedAt: string;
  readonly submissionIdempotencyKey: SubmissionIdempotencyKey;
  readonly correlationId: CorrelationId;
}

export interface SubmissionResult {
  readonly revision: OrganizationVerificationRevision;
  readonly record: OrganizationVerificationRecord;
}

export function submitDraftToRevision(
  record: OrganizationVerificationRecord,
  draft: OrganizationVerificationDraft,
  submission: OrganizationVerificationSubmission,
): CoreDomainResult<SubmissionResult> {
  if (!isOrganizationVerificationRecord(record)) {
    return domainFailure("mutable_input_rejected");
  }
  if (draft.recordId !== record.recordId) {
    return domainFailure("record_id_mismatch");
  }
  if (
    draft.organizationId !== record.organizationId ||
    submission.submissionActorAuthorityReference.organizationScope !==
      record.organizationId
  ) {
    return domainFailure("organization_id_mismatch");
  }
  if (
    record.currentDraftId !== draft.draftId ||
    submission.draftId !== draft.draftId ||
    submission.expectedDraftVersion !== draft.draftVersion
  ) {
    return domainFailure("draft_version_mismatch");
  }
  if (
    submission.profileRevisionId !== draft.profileRevisionId ||
    submission.profileRevisionSequence !== draft.profileRevisionSequence ||
    submission.profileFingerprint !== draft.profileFingerprint
  ) {
    return domainFailure("profile_revision_mismatch");
  }
  const expectedSequence = record.revisions.length + 1;
  if (Number(submission.revisionSequence) !== expectedSequence) {
    return domainFailure("non_monotonic_revision_sequence");
  }
  if (!Number.isFinite(Date.parse(submission.submittedAt))) {
    return domainFailure("mutable_input_rejected");
  }
  const declaredInputs = copyDeclaredInputs(draft.declaredInputs);
  if (!declaredInputs.ok) return declaredInputs;
  const evidenceReferences = freezeEvidenceReferenceSet(
    draft.evidenceReferenceIds,
  );
  if (!evidenceReferences.ok) return evidenceReferences;

  const revision: OrganizationVerificationRevision =
    sealOrganizationVerificationRevision({
      revisionId: submission.revisionId,
      recordId: record.recordId,
      organizationId: record.organizationId,
      profileRevisionId: draft.profileRevisionId,
      profileRevisionSequence: draft.profileRevisionSequence,
      profileFingerprint: draft.profileFingerprint,
      sequence: submission.revisionSequence,
      declaredInputs: declaredInputs.value,
      evidenceReferenceIds: evidenceReferences.value,
      submissionActorAuthorityReference: Object.freeze({
        ...submission.submissionActorAuthorityReference,
        delegatedScopes: Object.freeze([
          ...submission.submissionActorAuthorityReference.delegatedScopes,
        ]),
      }),
      submittedAt: submission.submittedAt,
      submissionIdempotencyKey: submission.submissionIdempotencyKey,
      correlationId: submission.correlationId,
      ...(record.revisions.at(-1)
        ? { supersedesRevisionId: record.revisions.at(-1)!.revisionId }
        : {}),
    });
  const updatedRecord = appendRevisionReference(
    record,
    { revisionId: revision.revisionId, sequence: revision.sequence },
    revision.submittedAt,
  );
  if (!updatedRecord.ok) return updatedRecord;
  return domainSuccess(
    Object.freeze({ revision, record: updatedRecord.value }),
  );
}
