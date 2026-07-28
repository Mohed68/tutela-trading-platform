import type { OrganizationId } from "../../organization-registry/index.js";
import type { OrganizationVerificationDraft } from "./draft.js";
import {
  domainFailure,
  domainSuccess,
  type CoreDomainResult,
} from "./errors.js";
import type {
  OrganizationVerificationAttemptId,
  OrganizationVerificationDraftId,
  OrganizationVerificationRecordId,
  OrganizationVerificationRevisionId,
  VerificationAttemptSequence,
  VerificationRevisionSequence,
} from "./ids.js";

export interface VerificationRevisionReference {
  readonly revisionId: OrganizationVerificationRevisionId;
  readonly sequence: VerificationRevisionSequence;
}

export interface VerificationAttemptReference {
  readonly attemptId: OrganizationVerificationAttemptId;
  readonly revisionId: OrganizationVerificationRevisionId;
  readonly sequence: VerificationAttemptSequence;
}

export interface OrganizationVerificationRecord {
  readonly recordId: OrganizationVerificationRecordId;
  readonly organizationId: OrganizationId;
  readonly currentDraftId?: OrganizationVerificationDraftId;
  readonly revisions: readonly VerificationRevisionReference[];
  readonly attempts: readonly VerificationAttemptReference[];
  readonly concurrencyVersion: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateVerificationRecordInput {
  readonly recordId: OrganizationVerificationRecordId;
  readonly organizationId: OrganizationId;
  readonly createdAt: string;
}

function validTimestamp(value: string): boolean {
  return value.length > 0 && Number.isFinite(Date.parse(value));
}

export function createOrganizationVerificationRecord(
  input: CreateVerificationRecordInput,
): CoreDomainResult<OrganizationVerificationRecord> {
  if (
    typeof input.organizationId !== "string" ||
    input.organizationId.trim().length === 0 ||
    !validTimestamp(input.createdAt)
  ) {
    return domainFailure("invalid_opaque_identifier");
  }
  return domainSuccess(
    Object.freeze({
      recordId: input.recordId,
      organizationId: input.organizationId,
      revisions: Object.freeze([]),
      attempts: Object.freeze([]),
      concurrencyVersion: 1,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
    }),
  );
}

export function attachDraftToRecord(
  record: OrganizationVerificationRecord,
  draft: OrganizationVerificationDraft,
): CoreDomainResult<OrganizationVerificationRecord> {
  if (draft.recordId !== record.recordId) {
    return domainFailure("record_id_mismatch");
  }
  if (draft.organizationId !== record.organizationId) {
    return domainFailure("organization_id_mismatch");
  }
  return domainSuccess(
    Object.freeze({
      ...record,
      currentDraftId: draft.draftId,
      concurrencyVersion: record.concurrencyVersion + 1,
      updatedAt: draft.updatedAt,
      revisions: Object.freeze([...record.revisions]),
      attempts: Object.freeze([...record.attempts]),
    }),
  );
}

export function appendRevisionReference(
  record: OrganizationVerificationRecord,
  reference: VerificationRevisionReference,
  submittedAt: string,
): CoreDomainResult<OrganizationVerificationRecord> {
  const last = record.revisions.at(-1);
  const expected = last ? Number(last.sequence) + 1 : 1;
  if (Number(reference.sequence) !== expected) {
    return domainFailure("non_monotonic_revision_sequence");
  }
  if (
    record.revisions.some(
      (existing) => existing.revisionId === reference.revisionId,
    )
  ) {
    return domainFailure("non_monotonic_revision_sequence");
  }
  return domainSuccess(
    Object.freeze({
      ...record,
      currentDraftId: undefined,
      revisions: Object.freeze([
        ...record.revisions,
        Object.freeze({ ...reference }),
      ]),
      attempts: Object.freeze([...record.attempts]),
      concurrencyVersion: record.concurrencyVersion + 1,
      updatedAt: submittedAt,
    }),
  );
}

export function appendAttemptReference(
  record: OrganizationVerificationRecord,
  reference: VerificationAttemptReference,
  createdAt: string,
): CoreDomainResult<OrganizationVerificationRecord> {
  const last = record.attempts.at(-1);
  const expected = last ? Number(last.sequence) + 1 : 1;
  if (Number(reference.sequence) !== expected) {
    return domainFailure("invalid_attempt_sequence");
  }
  if (
    !record.revisions.some(
      (revision) => revision.revisionId === reference.revisionId,
    ) ||
    record.attempts.some(
      (existing) => existing.attemptId === reference.attemptId,
    )
  ) {
    return domainFailure("record_id_mismatch");
  }
  return domainSuccess(
    Object.freeze({
      ...record,
      revisions: Object.freeze([...record.revisions]),
      attempts: Object.freeze([
        ...record.attempts,
        Object.freeze({ ...reference }),
      ]),
      concurrencyVersion: record.concurrencyVersion + 1,
      updatedAt: createdAt,
    }),
  );
}
