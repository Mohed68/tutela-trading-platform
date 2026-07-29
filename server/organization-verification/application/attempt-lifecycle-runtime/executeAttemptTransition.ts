import {
  isOrganizationVerificationAttempt,
  transitionAttemptProcess,
} from "../../domain/attempt.js";
import type {
  CompletionReference,
  OrganizationVerificationAttemptId,
  OrganizationVerificationRecordId,
  OrganizationVerificationRevisionId,
  VerificationAttemptSequence,
} from "../../domain/ids.js";
import {
  createOrganizationVerificationAttemptLifecycleExecution,
  createOrganizationVerificationAttemptLifecycleTransitionRecord,
  isOrganizationVerificationAttemptLifecycleExecution,
  type AttemptLifecycleEvidenceArtifacts,
  type AttemptLifecycleRequestedTransition,
  type OrganizationVerificationAttemptLifecycleExecution,
} from "../attempt-lifecycle-contract/index.js";
import { fingerprintAttemptLifecycleRuntime } from "./attemptLifecycleRuntimeFingerprint.js";
import {
  runtimeFailure,
  runtimeSuccess,
  type AttemptLifecycleRuntimeResult,
} from "./attemptLifecycleRuntimeErrors.js";
import {
  createAttemptLifecycleTransitionExecutionInternal,
  type OrganizationVerificationAttemptLifecycleTransitionExecution,
} from "./attemptLifecycleTransitionExecution.js";

export interface ExecuteAttemptTransitionInput
  extends AttemptLifecycleEvidenceArtifacts {
  readonly predecessorLifecycleExecution: OrganizationVerificationAttemptLifecycleExecution;
  readonly lifecycleExecutionId: string;
  readonly expectedPredecessorLifecycleExecutionVersion: number;
  readonly nextLifecycleExecutionVersion: number;
  readonly transitionId: string;
  readonly requestedTransition: AttemptLifecycleRequestedTransition;
  readonly expectedPredecessorAttemptState:
    OrganizationVerificationAttemptLifecycleExecution["attempt"]["processState"];
  readonly expectedResultingAttemptState:
    OrganizationVerificationAttemptLifecycleExecution["attempt"]["processState"];
  readonly recordId: OrganizationVerificationRecordId;
  readonly revisionId: OrganizationVerificationRevisionId;
  readonly attemptId: OrganizationVerificationAttemptId;
  readonly attemptSequence: VerificationAttemptSequence;
  readonly occurredAt: string;
  readonly completionReference?: CompletionReference;
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly reasonReference?: string;
}

export function executeOrganizationVerificationAttemptTransition(
  input: ExecuteAttemptTransitionInput,
): AttemptLifecycleRuntimeResult<OrganizationVerificationAttemptLifecycleTransitionExecution> {
  const predecessor = input.predecessorLifecycleExecution;
  if (!isOrganizationVerificationAttemptLifecycleExecution(predecessor)) {
    return runtimeFailure({
      stage: "runtime",
      code: "unauthentic_lifecycle_execution",
    });
  }
  const attempt = predecessor.attempt;
  if (
    predecessor.lifecycleExecutionId !== input.lifecycleExecutionId ||
    predecessor.lifecycleExecutionVersion !==
      input.expectedPredecessorLifecycleExecutionVersion ||
    input.nextLifecycleExecutionVersion !==
      input.expectedPredecessorLifecycleExecutionVersion + 1 ||
    predecessor.recordId !== input.recordId ||
    predecessor.revisionId !== input.revisionId ||
    predecessor.attemptId !== input.attemptId ||
    predecessor.attemptSequence !== input.attemptSequence ||
    attempt.processState !== input.expectedPredecessorAttemptState ||
    input.expectedResultingAttemptState !== input.requestedTransition
  ) {
    return runtimeFailure({ stage: "runtime", code: "continuity_mismatch" });
  }
  if (
    !Number.isFinite(Date.parse(input.occurredAt)) ||
    Date.parse(input.occurredAt) < Date.parse(predecessor.createdAt) ||
    (predecessor.lastTransitionAt !== undefined &&
      Date.parse(input.occurredAt) <
        Date.parse(predecessor.lastTransitionAt))
  ) {
    return runtimeFailure({ stage: "runtime", code: "chronology_mismatch" });
  }
  const transitioned = transitionAttemptProcess(attempt, {
    nextState: input.requestedTransition,
    at: input.occurredAt,
    ...(input.completionReference !== undefined
      ? { completionReference: input.completionReference }
      : {}),
  });
  if (!transitioned.ok) {
    return runtimeFailure({
      stage: "domain_transition",
      code: transitioned.code,
    });
  }
  if (
    !isOrganizationVerificationAttempt(transitioned.value) ||
    transitioned.value.attemptId !== attempt.attemptId ||
    transitioned.value.recordId !== attempt.recordId ||
    transitioned.value.revisionId !== attempt.revisionId ||
    transitioned.value.sequence !== attempt.sequence ||
    transitioned.value.processState !== input.expectedResultingAttemptState ||
    (input.requestedTransition === "completed" &&
      transitioned.value.completionReference !== input.completionReference)
  ) {
    return runtimeFailure({
      stage: "runtime",
      code: "resulting_attempt_authenticity_failed",
    });
  }
  const transitionRecord =
    createOrganizationVerificationAttemptLifecycleTransitionRecord({
      transitionId: input.transitionId,
      lifecycleExecutionId: input.lifecycleExecutionId,
      predecessorLifecycleExecutionVersion:
        input.expectedPredecessorLifecycleExecutionVersion,
      nextLifecycleExecutionVersion: input.nextLifecycleExecutionVersion,
      attemptId: input.attemptId,
      predecessorAttemptState: input.expectedPredecessorAttemptState,
      requestedTransition: input.requestedTransition,
      resultingAttemptState: transitioned.value.processState,
      occurredAt: input.occurredAt,
      provenanceReferences: input.provenanceReferences,
      integrityReferences: input.integrityReferences,
      ...(input.correlationId !== undefined
        ? { correlationId: input.correlationId }
        : {}),
      ...(input.causationId !== undefined
        ? { causationId: input.causationId }
        : {}),
      ...(input.reasonReference !== undefined
        ? { reasonReference: input.reasonReference }
        : {}),
    });
  if (!transitionRecord.ok) {
    return runtimeFailure({
      stage: "transition_record",
      code: transitionRecord.code,
    });
  }
  const nextExecution =
    createOrganizationVerificationAttemptLifecycleExecution({
      lifecycleExecutionId: input.lifecycleExecutionId,
      lifecycleExecutionVersion: input.nextLifecycleExecutionVersion,
      organizationId: predecessor.organizationId,
      recordId: predecessor.recordId,
      revisionId: predecessor.revisionId,
      attemptId: predecessor.attemptId,
      attemptSequence: predecessor.attemptSequence,
      record: predecessor.record,
      revision: predecessor.revision,
      attempt: transitioned.value,
      transitionRecords: [
        ...predecessor.transitionRecords,
        transitionRecord.value,
      ],
      createdAt: predecessor.createdAt,
      lastTransitionAt: input.occurredAt,
      provenanceReferences: predecessor.provenanceReferences,
      integrityReferences: predecessor.integrityReferences,
    });
  if (!nextExecution.ok) {
    return runtimeFailure({
      stage: "next_execution",
      code: nextExecution.code,
    });
  }
  return runtimeSuccess(
    createAttemptLifecycleTransitionExecutionInternal({
      lifecycleExecutionId: input.lifecycleExecutionId,
      transitionId: input.transitionId,
      predecessorLifecycleExecutionVersion:
        input.expectedPredecessorLifecycleExecutionVersion,
      nextLifecycleExecutionVersion: input.nextLifecycleExecutionVersion,
      predecessorAttempt: attempt,
      resultingAttempt: transitioned.value,
      transitionRecord: transitionRecord.value,
      nextLifecycleExecution: nextExecution.value,
      occurredAt: input.occurredAt,
      attemptLifecycleTransitionExecutionFingerprint:
        fingerprintAttemptLifecycleRuntime({
          scope: "attempt_lifecycle_transition_execution",
          predecessorExecutionFingerprint:
            predecessor.attemptLifecycleExecutionFingerprint,
          transitionRecordFingerprint:
            transitionRecord.value
              .attemptLifecycleTransitionBindingFingerprint,
          nextExecutionFingerprint:
            nextExecution.value.attemptLifecycleExecutionFingerprint,
          lifecycleExecutionId: input.lifecycleExecutionId,
          transitionId: input.transitionId,
          predecessorLifecycleExecutionVersion:
            input.expectedPredecessorLifecycleExecutionVersion,
          nextLifecycleExecutionVersion: input.nextLifecycleExecutionVersion,
          predecessorAttemptId: attempt.attemptId,
          predecessorAttemptState: attempt.processState,
          resultingAttemptId: transitioned.value.attemptId,
          resultingAttemptState: transitioned.value.processState,
          occurredAt: input.occurredAt,
        }),
    }),
  );
}
