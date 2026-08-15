import {
  domainFailure,
  domainSuccess,
  type CoreDomainResult,
} from "./errors.js";
import type {
  CompletionReference,
  CorrelationId,
  OrganizationVerificationAttemptId,
  SnapshotFingerprint,
  SnapshotId,
  VerificationAttemptSequence,
} from "./ids.js";
import {
  appendAttemptReference,
  isOrganizationVerificationRecord,
  type OrganizationVerificationRecord,
} from "./record.js";
import type { OrganizationVerificationRevision } from "./revision.js";
import { isOrganizationVerificationRevision } from "./submission.js";
import {
  validateAttemptProcessTransition,
  type AttemptProcessState,
} from "./process.js";
import {
  hasExactDurableKeys,
  isDurableIdentity,
  isDurablePlainObject,
  isDurablePositiveVersion,
  isDurableTimestamp,
} from "./durableRehydrationValidation.js";

export interface OrganizationVerificationAttempt {
  readonly attemptId: OrganizationVerificationAttemptId;
  readonly recordId: OrganizationVerificationRecord["recordId"];
  readonly revisionId: OrganizationVerificationRevision["revisionId"];
  readonly sequence: VerificationAttemptSequence;
  readonly processState: AttemptProcessState;
  readonly snapshotId?: SnapshotId;
  readonly snapshotFingerprint?: SnapshotFingerprint;
  readonly createdAt: string;
  readonly queuedAt?: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly completionReference?: CompletionReference;
  readonly correlationId: CorrelationId;
}

export interface CreateAttemptInput {
  readonly attemptId: OrganizationVerificationAttemptId;
  readonly sequence: VerificationAttemptSequence;
  readonly snapshotId?: SnapshotId;
  readonly snapshotFingerprint?: SnapshotFingerprint;
  readonly createdAt: string;
  readonly correlationId: CorrelationId;
}

export interface AttemptCreationResult {
  readonly attempt: OrganizationVerificationAttempt;
  readonly record: OrganizationVerificationRecord;
}

const attemptAuthenticitySeal = Symbol(
  "organization-verification-attempt-authenticity",
);
const authenticAttempts = new WeakSet<object>();

function sealOrganizationVerificationAttempt<T extends OrganizationVerificationAttempt>(
  attempt: T,
): T {
  Object.defineProperty(attempt, attemptAuthenticitySeal, {
    value: true,
    enumerable: false,
    writable: false,
    configurable: false,
  });
  authenticAttempts.add(attempt);
  return Object.freeze(attempt);
}

export function isOrganizationVerificationAttempt(
  value: unknown,
): value is OrganizationVerificationAttempt {
  return (
    typeof value === "object" &&
    value !== null &&
    authenticAttempts.has(value) &&
    Object.getOwnPropertyDescriptor(value, attemptAuthenticitySeal)?.value ===
      true &&
    Object.isFrozen(value)
  );
}

function isDurableAttempt(value: unknown): value is OrganizationVerificationAttempt {
  if (!isDurablePlainObject(value)) return false;
  const required = ["attemptId", "recordId", "revisionId", "sequence", "processState", "createdAt", "correlationId"];
  const optional = ["snapshotId", "snapshotFingerprint", "queuedAt", "startedAt", "completedAt", "completionReference"];
  if (!hasExactDurableKeys(value, required, optional)) return false;
  return ["attemptId", "recordId", "revisionId", "correlationId", "snapshotId", "snapshotFingerprint", "completionReference"]
    .every((key) => value[key] === undefined || isDurableIdentity(value[key])) &&
    isDurablePositiveVersion(value.sequence) &&
    ["not_started", "queued", "running", "completed"].includes(String(value.processState)) &&
    ["createdAt", "queuedAt", "startedAt", "completedAt"].every((key) => value[key] === undefined || isDurableTimestamp(value[key]));
}

export function rehydrateOrganizationVerificationAttempt(
  durableData: unknown,
): CoreDomainResult<OrganizationVerificationAttempt> {
  if (!isDurableAttempt(durableData)) return domainFailure("mutable_input_rejected");
  return domainSuccess(sealOrganizationVerificationAttempt({ ...durableData }));
}

export function createAttemptForRevision(
  record: OrganizationVerificationRecord,
  revision: OrganizationVerificationRevision,
  input: CreateAttemptInput,
): CoreDomainResult<AttemptCreationResult> {
  if (
    !isOrganizationVerificationRecord(record) ||
    !isOrganizationVerificationRevision(revision)
  ) {
    return domainFailure("mutable_input_rejected");
  }
  if (revision.recordId !== record.recordId) {
    return domainFailure("record_id_mismatch");
  }
  if (revision.organizationId !== record.organizationId) {
    return domainFailure("organization_id_mismatch");
  }
  if (
    !record.revisions.some(
      (reference) => reference.revisionId === revision.revisionId,
    )
  ) {
    return domainFailure("record_id_mismatch");
  }
  const expectedSequence = record.attempts.length + 1;
  if (Number(input.sequence) !== expectedSequence) {
    return domainFailure("invalid_attempt_sequence");
  }
  if (!Number.isFinite(Date.parse(input.createdAt))) {
    return domainFailure("mutable_input_rejected");
  }
  const attempt: OrganizationVerificationAttempt =
    sealOrganizationVerificationAttempt({
      attemptId: input.attemptId,
      recordId: record.recordId,
      revisionId: revision.revisionId,
      sequence: input.sequence,
      processState: "not_started",
      ...(input.snapshotId ? { snapshotId: input.snapshotId } : {}),
      ...(input.snapshotFingerprint
        ? { snapshotFingerprint: input.snapshotFingerprint }
        : {}),
      createdAt: input.createdAt,
      correlationId: input.correlationId,
    });
  const updatedRecord = appendAttemptReference(
    record,
    {
      attemptId: attempt.attemptId,
      revisionId: attempt.revisionId,
      sequence: attempt.sequence,
    },
    attempt.createdAt,
  );
  if (!updatedRecord.ok) return updatedRecord;
  return domainSuccess(
    Object.freeze({ attempt, record: updatedRecord.value }),
  );
}

export interface AttemptTransitionInput {
  readonly nextState: AttemptProcessState;
  readonly at: string;
  readonly completionReference?: CompletionReference;
}

export function transitionAttemptProcess(
  current: OrganizationVerificationAttempt,
  input: AttemptTransitionInput,
): CoreDomainResult<OrganizationVerificationAttempt> {
  if (!isOrganizationVerificationAttempt(current)) {
    return domainFailure("mutable_input_rejected");
  }
  if (!Number.isFinite(Date.parse(input.at))) {
    return domainFailure("mutable_input_rejected");
  }
  const transition = validateAttemptProcessTransition(
    current.processState,
    input.nextState,
  );
  if (!transition.ok) return transition;
  if (
    input.nextState === "completed" &&
    input.completionReference === undefined
  ) {
    return domainFailure("mutable_input_rejected");
  }
  if (
    input.nextState !== "completed" &&
    input.completionReference !== undefined
  ) {
    return domainFailure("mutable_input_rejected");
  }
  return domainSuccess(
    sealOrganizationVerificationAttempt({
      ...current,
      processState: input.nextState,
      ...(input.nextState === "queued" ? { queuedAt: input.at } : {}),
      ...(input.nextState === "running" ? { startedAt: input.at } : {}),
      ...(input.nextState === "completed"
        ? {
            completedAt: input.at,
            completionReference: input.completionReference,
          }
        : {}),
    }),
  );
}
