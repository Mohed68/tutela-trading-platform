import type { OrganizationVerificationAttemptId } from "../../domain/ids.js";
import type { AttemptProcessState } from "../../domain/process.js";
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

export type AttemptLifecycleRequestedTransition =
  | "queued"
  | "running"
  | "completed";

export interface CreateAttemptLifecycleTransitionRecordInput
  extends AttemptLifecycleEvidenceArtifacts {
  readonly transitionId: string;
  readonly lifecycleExecutionId: string;
  readonly predecessorLifecycleExecutionVersion: number;
  readonly nextLifecycleExecutionVersion: number;
  readonly attemptId: OrganizationVerificationAttemptId;
  readonly predecessorAttemptState: AttemptProcessState;
  readonly requestedTransition: AttemptLifecycleRequestedTransition;
  readonly resultingAttemptState: AttemptProcessState;
  readonly occurredAt: string;
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly reasonReference?: string;
}

export interface OrganizationVerificationAttemptLifecycleTransitionRecord
  extends Readonly<CreateAttemptLifecycleTransitionRecordInput> {
  readonly provenanceReferences: readonly string[];
  readonly integrityReferences: readonly string[];
  readonly attemptLifecycleTransitionBindingFingerprint: string;
}

const transitionRecordSeal = Symbol(
  "organization-verification-attempt-lifecycle-transition-record",
);
const authenticTransitionRecords = new WeakSet<object>();

const ALLOWED_TRANSITIONS: Readonly<
  Record<AttemptProcessState, readonly AttemptProcessState[]>
> = Object.freeze({
  not_started: Object.freeze(["queued"] as const),
  queued: Object.freeze(["running"] as const),
  running: Object.freeze(["queued", "completed"] as const),
  completed: Object.freeze([] as const),
});

function optionalReferenceValid(value: unknown): boolean {
  return value === undefined || validAttemptLifecycleIdentity(value);
}

function sealTransitionRecord<
  T extends OrganizationVerificationAttemptLifecycleTransitionRecord,
>(record: T): T {
  Object.defineProperty(record, transitionRecordSeal, {
    value: true,
    enumerable: false,
    writable: false,
    configurable: false,
  });
  authenticTransitionRecords.add(record);
  return Object.freeze(record);
}

export function isOrganizationVerificationAttemptLifecycleTransitionRecord(
  value: unknown,
): value is OrganizationVerificationAttemptLifecycleTransitionRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    authenticTransitionRecords.has(value) &&
    Object.getOwnPropertyDescriptor(value, transitionRecordSeal)?.value ===
      true &&
    Object.isFrozen(value)
  );
}

export function createOrganizationVerificationAttemptLifecycleTransitionRecord(
  input: CreateAttemptLifecycleTransitionRecordInput,
): AttemptLifecycleContractResult<OrganizationVerificationAttemptLifecycleTransitionRecord> {
  if (
    !validAttemptLifecycleIdentity(input.transitionId) ||
    !validAttemptLifecycleIdentity(input.lifecycleExecutionId) ||
    !validAttemptLifecycleIdentity(input.attemptId) ||
    !validAttemptLifecycleVersion(
      input.predecessorLifecycleExecutionVersion,
    ) ||
    input.nextLifecycleExecutionVersion !==
      input.predecessorLifecycleExecutionVersion + 1 ||
    !validAttemptLifecycleTimestamp(input.occurredAt) ||
    !optionalReferenceValid(input.correlationId) ||
    !optionalReferenceValid(input.causationId) ||
    !optionalReferenceValid(input.reasonReference) ||
    input.requestedTransition !== input.resultingAttemptState ||
    !ALLOWED_TRANSITIONS[input.predecessorAttemptState].includes(
      input.resultingAttemptState,
    )
  ) {
    return contractFailure(
      input.nextLifecycleExecutionVersion !==
        input.predecessorLifecycleExecutionVersion + 1
        ? "version_continuity_mismatch"
        : "invalid_transition",
    );
  }
  const evidence = normalizeAttemptLifecycleEvidenceArtifacts(input);
  if (!evidence.ok) return evidence;
  const semantic = Object.freeze({
    transitionId: input.transitionId,
    lifecycleExecutionId: input.lifecycleExecutionId,
    predecessorLifecycleExecutionVersion:
      input.predecessorLifecycleExecutionVersion,
    nextLifecycleExecutionVersion: input.nextLifecycleExecutionVersion,
    attemptId: input.attemptId,
    predecessorAttemptState: input.predecessorAttemptState,
    requestedTransition: input.requestedTransition,
    resultingAttemptState: input.resultingAttemptState,
    occurredAt: input.occurredAt,
    provenanceReferences: evidence.value.provenanceReferences,
    integrityReferences: evidence.value.integrityReferences,
    ...(input.correlationId ? { correlationId: input.correlationId } : {}),
    ...(input.causationId ? { causationId: input.causationId } : {}),
    ...(input.reasonReference
      ? { reasonReference: input.reasonReference }
      : {}),
  });
  return contractSuccess(
    sealTransitionRecord({
      ...semantic,
      attemptLifecycleTransitionBindingFingerprint:
        fingerprintAttemptLifecycleValue({
          scope: "attempt_lifecycle_transition_binding",
          ...semantic,
        }),
    }),
  );
}

export function compareOrganizationVerificationAttemptLifecycleTransitionRecords(
  existing: OrganizationVerificationAttemptLifecycleTransitionRecord,
  candidate: OrganizationVerificationAttemptLifecycleTransitionRecord,
): AttemptLifecycleContractResult<"idempotent" | "distinct"> {
  if (
    !isOrganizationVerificationAttemptLifecycleTransitionRecord(existing) ||
    !isOrganizationVerificationAttemptLifecycleTransitionRecord(candidate)
  ) {
    return contractFailure("unauthentic_transition_record");
  }
  if (existing.transitionId === candidate.transitionId) {
    return existing.attemptLifecycleTransitionBindingFingerprint ===
      candidate.attemptLifecycleTransitionBindingFingerprint
      ? contractSuccess("idempotent")
      : contractFailure("transition_conflict");
  }
  if (
    existing.lifecycleExecutionId === candidate.lifecycleExecutionId &&
    existing.predecessorLifecycleExecutionVersion ===
      candidate.predecessorLifecycleExecutionVersion
  ) {
    return contractFailure("transition_branch_conflict");
  }
  return contractSuccess("distinct");
}
