import type { OrganizationId } from "../../../organization-registry/index.js";
import {
  isOrganizationVerificationAttempt,
  type OrganizationVerificationAttempt,
} from "../../domain/attempt.js";
import type {
  OrganizationVerificationAttemptId,
  OrganizationVerificationRecordId,
  OrganizationVerificationRevisionId,
  VerificationAttemptSequence,
} from "../../domain/ids.js";
import {
  isOrganizationVerificationRecord,
  type OrganizationVerificationRecord,
} from "../../domain/record.js";
import type { OrganizationVerificationRevision } from "../../domain/revision.js";
import { isOrganizationVerificationRevision } from "../../domain/submission.js";
import {
  normalizeAttemptLifecycleEvidenceArtifacts,
  validAttemptLifecycleIdentity,
  validAttemptLifecycleTimestamp,
  validAttemptLifecycleVersion,
  type AttemptLifecycleEvidenceArtifacts,
} from "./attemptLifecycleArtifacts.js";
import { fingerprintAttemptLifecycleValue } from "./attemptLifecycleCanonicalization.js";
import {
  contractFailure,
  contractSuccess,
  type AttemptLifecycleContractResult,
} from "./attemptLifecycleErrors.js";
import {
  compareOrganizationVerificationAttemptLifecycleTransitionRecords,
  isOrganizationVerificationAttemptLifecycleTransitionRecord,
  type OrganizationVerificationAttemptLifecycleTransitionRecord,
} from "./attemptLifecycleTransitionRecord.js";

export interface CreateAttemptLifecycleExecutionInput
  extends AttemptLifecycleEvidenceArtifacts {
  readonly lifecycleExecutionId: string;
  readonly lifecycleExecutionVersion: number;
  readonly organizationId: OrganizationId;
  readonly recordId: OrganizationVerificationRecordId;
  readonly revisionId: OrganizationVerificationRevisionId;
  readonly attemptId: OrganizationVerificationAttemptId;
  readonly attemptSequence: VerificationAttemptSequence;
  readonly record: OrganizationVerificationRecord;
  readonly revision: OrganizationVerificationRevision;
  readonly attempt: OrganizationVerificationAttempt;
  readonly transitionRecords: readonly OrganizationVerificationAttemptLifecycleTransitionRecord[];
  readonly createdAt: string;
  readonly lastTransitionAt?: string;
}

export interface OrganizationVerificationAttemptLifecycleExecution
  extends Readonly<CreateAttemptLifecycleExecutionInput> {
  readonly transitionRecords: readonly OrganizationVerificationAttemptLifecycleTransitionRecord[];
  readonly provenanceReferences: readonly string[];
  readonly integrityReferences: readonly string[];
  readonly attemptLifecycleExecutionFingerprint: string;
}

const lifecycleExecutionSeal = Symbol(
  "organization-verification-attempt-lifecycle-execution",
);
const authenticLifecycleExecutions = new WeakSet<object>();

function sealLifecycleExecution<
  T extends OrganizationVerificationAttemptLifecycleExecution,
>(execution: T): T {
  Object.defineProperty(execution, lifecycleExecutionSeal, {
    value: true,
    enumerable: false,
    writable: false,
    configurable: false,
  });
  authenticLifecycleExecutions.add(execution);
  return Object.freeze(execution);
}

export function isOrganizationVerificationAttemptLifecycleExecution(
  value: unknown,
): value is OrganizationVerificationAttemptLifecycleExecution {
  return (
    typeof value === "object" &&
    value !== null &&
    authenticLifecycleExecutions.has(value) &&
    Object.getOwnPropertyDescriptor(value, lifecycleExecutionSeal)?.value ===
      true &&
    Object.isFrozen(value)
  );
}

function attemptTimestampMatches(
  attempt: OrganizationVerificationAttempt,
  record: OrganizationVerificationAttemptLifecycleTransitionRecord,
): boolean {
  if (record.resultingAttemptState === "queued") {
    return attempt.queuedAt === record.occurredAt;
  }
  if (record.resultingAttemptState === "running") {
    return attempt.startedAt === record.occurredAt;
  }
  if (record.resultingAttemptState === "completed") {
    return attempt.completedAt === record.occurredAt;
  }
  return false;
}

function validateIdentity(
  input: CreateAttemptLifecycleExecutionInput,
): AttemptLifecycleContractResult<true> {
  if (!isOrganizationVerificationRecord(input.record)) {
    return contractFailure("unauthentic_record");
  }
  if (!isOrganizationVerificationRevision(input.revision)) {
    return contractFailure("unauthentic_revision");
  }
  if (!isOrganizationVerificationAttempt(input.attempt)) {
    return contractFailure("unauthentic_attempt");
  }
  if (
    input.record.organizationId !== input.organizationId ||
    input.revision.organizationId !== input.record.organizationId
  ) {
    return contractFailure("organization_mismatch");
  }
  if (
    input.record.recordId !== input.recordId ||
    input.revision.recordId !== input.record.recordId ||
    input.attempt.recordId !== input.record.recordId
  ) {
    return contractFailure("record_mismatch");
  }
  if (
    input.revision.revisionId !== input.revisionId ||
    input.attempt.revisionId !== input.revision.revisionId ||
    !input.record.revisions.some(
      (reference) =>
        reference.revisionId === input.revision.revisionId &&
        reference.sequence === input.revision.sequence,
    )
  ) {
    return contractFailure("revision_mismatch");
  }
  if (
    input.attempt.attemptId !== input.attemptId ||
    !input.record.attempts.some(
      (reference) =>
        reference.attemptId === input.attempt.attemptId &&
        reference.revisionId === input.attempt.revisionId &&
        reference.sequence === input.attempt.sequence,
    )
  ) {
    return contractFailure("attempt_mismatch");
  }
  if (input.attempt.sequence !== input.attemptSequence) {
    return contractFailure("attempt_sequence_mismatch");
  }
  return contractSuccess(true);
}

function validateHistory(
  input: CreateAttemptLifecycleExecutionInput,
): AttemptLifecycleContractResult<
  readonly OrganizationVerificationAttemptLifecycleTransitionRecord[]
> {
  const unique: OrganizationVerificationAttemptLifecycleTransitionRecord[] = [];
  for (const candidate of input.transitionRecords) {
    if (
      !isOrganizationVerificationAttemptLifecycleTransitionRecord(candidate)
    ) {
      return contractFailure("unauthentic_transition_record");
    }
    const duplicate = unique.find(
      (record) => record.transitionId === candidate.transitionId,
    );
    if (duplicate) {
      const comparison =
        compareOrganizationVerificationAttemptLifecycleTransitionRecords(
          duplicate,
          candidate,
        );
      if (!comparison.ok) return comparison;
      continue;
    }
    for (const existing of unique) {
      const comparison =
        compareOrganizationVerificationAttemptLifecycleTransitionRecords(
          existing,
          candidate,
        );
      if (!comparison.ok) return comparison;
    }
    unique.push(candidate);
  }
  for (let index = 0; index < unique.length; index += 1) {
    const record = unique[index]!;
    const previous = unique[index - 1];
    if (
      record.lifecycleExecutionId !== input.lifecycleExecutionId ||
      record.attemptId !== input.attemptId
    ) {
      return contractFailure("attempt_mismatch");
    }
    if (
      record.predecessorLifecycleExecutionVersion !== index + 1 ||
      record.nextLifecycleExecutionVersion !== index + 2
    ) {
      return contractFailure("version_continuity_mismatch");
    }
    if (
      previous &&
      record.predecessorAttemptState !== previous.resultingAttemptState
    ) {
      return contractFailure("state_continuity_mismatch");
    }
    if (
      Date.parse(record.occurredAt) <
      Date.parse(previous?.occurredAt ?? input.createdAt)
    ) {
      return contractFailure("chronology_mismatch");
    }
  }
  if (input.lifecycleExecutionVersion !== unique.length + 1) {
    return contractFailure("version_continuity_mismatch");
  }
  const last = unique.at(-1);
  if (
    (last === undefined && input.lastTransitionAt !== undefined) ||
    (last !== undefined &&
      (input.lastTransitionAt !== last.occurredAt ||
        last.resultingAttemptState !== input.attempt.processState ||
        !attemptTimestampMatches(input.attempt, last)))
  ) {
    return contractFailure(
      last !== undefined &&
        last.resultingAttemptState !== input.attempt.processState
        ? "state_continuity_mismatch"
        : "chronology_mismatch",
    );
  }
  return contractSuccess(Object.freeze([...unique]));
}

export function createOrganizationVerificationAttemptLifecycleExecution(
  input: CreateAttemptLifecycleExecutionInput,
): AttemptLifecycleContractResult<OrganizationVerificationAttemptLifecycleExecution> {
  if (
    !validAttemptLifecycleIdentity(input.lifecycleExecutionId) ||
    !validAttemptLifecycleVersion(input.lifecycleExecutionVersion) ||
    !validAttemptLifecycleTimestamp(input.createdAt) ||
    (input.lastTransitionAt !== undefined &&
      !validAttemptLifecycleTimestamp(input.lastTransitionAt)) ||
    !Array.isArray(input.transitionRecords)
  ) {
    return contractFailure("invalid_artifacts");
  }
  const identity = validateIdentity(input);
  if (!identity.ok) return identity;
  const evidence = normalizeAttemptLifecycleEvidenceArtifacts(input);
  if (!evidence.ok) return evidence;
  const history = validateHistory(input);
  if (!history.ok) return history;
  const semantic = Object.freeze({
    lifecycleExecutionId: input.lifecycleExecutionId,
    lifecycleExecutionVersion: input.lifecycleExecutionVersion,
    organizationId: input.organizationId,
    recordId: input.recordId,
    revisionId: input.revisionId,
    attemptId: input.attemptId,
    attemptSequence: input.attemptSequence,
    currentAttemptState: input.attempt.processState,
    attemptCreatedAt: input.attempt.createdAt,
    transitionFingerprints: Object.freeze(
      history.value.map(
        (record) => record.attemptLifecycleTransitionBindingFingerprint,
      ),
    ),
    createdAt: input.createdAt,
    ...(input.lastTransitionAt
      ? { lastTransitionAt: input.lastTransitionAt }
      : {}),
    provenanceReferences: evidence.value.provenanceReferences,
    integrityReferences: evidence.value.integrityReferences,
  });
  return contractSuccess(
    sealLifecycleExecution({
      lifecycleExecutionId: input.lifecycleExecutionId,
      lifecycleExecutionVersion: input.lifecycleExecutionVersion,
      organizationId: input.organizationId,
      recordId: input.recordId,
      revisionId: input.revisionId,
      attemptId: input.attemptId,
      attemptSequence: input.attemptSequence,
      record: input.record,
      revision: input.revision,
      attempt: input.attempt,
      transitionRecords: history.value,
      createdAt: input.createdAt,
      ...(input.lastTransitionAt
        ? { lastTransitionAt: input.lastTransitionAt }
        : {}),
      provenanceReferences: evidence.value.provenanceReferences,
      integrityReferences: evidence.value.integrityReferences,
      attemptLifecycleExecutionFingerprint: fingerprintAttemptLifecycleValue({
        scope: "attempt_lifecycle_execution",
        ...semantic,
      }),
    }),
  );
}
