import {
  isOrganizationVerificationAttemptLifecycleExecution,
  type OrganizationVerificationAttemptLifecycleExecution,
} from "../attempt-lifecycle-contract/index.js";
import {
  isOrganizationVerificationAttemptLifecycleTransitionExecution,
} from "../attempt-lifecycle-runtime/index.js";
import {
  isOrganizationVerificationEvidenceAppendReceipt,
  isOrganizationVerificationWorkflowStreamIdentity,
  type OrganizationVerificationDurableEvidence,
  type OrganizationVerificationEvidenceAppendReceipt,
  type OrganizationVerificationWorkflowStreamIdentity,
} from "../persistence-contract/index.js";
import {
  isOrganizationVerificationReplayExecution,
  type OrganizationVerificationReplayDiagnostics,
  type OrganizationVerificationReplayEvidenceBinding,
  type OrganizationVerificationReplayExecution,
} from "../replay-runtime/index.js";
import {
  isOrganizationVerificationWorkflowExecution,
  isOrganizationVerificationWorkflowStepRecord,
  type OrganizationVerificationWorkflowExecution,
  type OrganizationVerificationWorkflowStep,
  type OrganizationVerificationWorkflowStepRecord,
} from "../workflow-contract/index.js";
import {
  isOrganizationVerificationWorkflowStepExecution,
  type OrganizationVerificationWorkflowAuthorityResult,
  type OrganizationVerificationWorkflowStepExecution,
} from "../workflow-runtime/index.js";
import {
  isOrganizationVerificationDecisionTrustIntegrationExecution,
} from "../../domain/decision-trust-integration/index.js";
import {
  isOrganizationVerificationPolicyEvaluationInput,
} from "../../domain/evaluation-input/index.js";
import {
  isOrganizationVerificationEvaluationProjection,
} from "../../domain/evaluation-projection/index.js";
import {
  isOrganizationVerificationEvidenceSnapshot,
} from "../../domain/evidence-snapshot/index.js";
import {
  isOrganizationVerificationPolicyEvaluationExecution,
} from "../../domain/policy-runtime/index.js";
import {
  isApplicationResultAuthenticInternal,
  sealApplicationResultInternal,
} from "./applicationServiceAuthenticity.js";
import {
  type OrganizationVerificationApplicationFailure,
} from "./applicationServiceFailures.js";
import {
  isOrganizationVerificationApplicationExecution,
  type OrganizationVerificationApplicationExecution,
} from "./applicationServiceExecutions.js";

interface StartSuccess {
  readonly applicationExecution: OrganizationVerificationApplicationExecution;
  readonly committedWorkflowGenesis: OrganizationVerificationWorkflowExecution;
  readonly appendReceipt: OrganizationVerificationEvidenceAppendReceipt;
  readonly resultingPersistenceStreamVersion: number;
  readonly replayExecution: OrganizationVerificationReplayExecution;
  readonly currentWorkflowExecution: OrganizationVerificationWorkflowExecution;
  readonly currentLifecycleExecution: OrganizationVerificationAttemptLifecycleExecution;
}

export type StartOrganizationVerificationResult =
  | Readonly<StartSuccess & { outcome: "start_completed" }>
  | Readonly<StartSuccess & { outcome: "start_idempotent" }>
  | Readonly<{
      outcome: "start_rejected";
      applicationExecution: OrganizationVerificationApplicationExecution;
      failure: OrganizationVerificationApplicationFailure;
    }>;

type PersistedAuthorityEvidence = Exclude<
  OrganizationVerificationDurableEvidence,
  | Readonly<{ evidenceKind: "workflow_genesis"; artifact: unknown }>
  | Readonly<{ evidenceKind: "workflow_step_record"; artifact: unknown }>
>;

export type OrganizationVerificationPersistedWorkflowAuthorityResult =
  PersistedAuthorityEvidence["artifact"];

interface AdvanceSuccessBase {
  readonly applicationExecution: OrganizationVerificationApplicationExecution;
  readonly previousPersistenceStreamVersion: number;
  readonly resultingPersistenceStreamVersion: number;
  readonly previousWorkflowVersion: number;
  readonly resultingWorkflowVersion: number;
  readonly executedWorkflowStep: OrganizationVerificationWorkflowStep;
  readonly workflowStepRecord: OrganizationVerificationWorkflowStepRecord;
  readonly appendReceipt: OrganizationVerificationEvidenceAppendReceipt;
  readonly currentWorkflowExecution: OrganizationVerificationWorkflowExecution;
  readonly currentLifecycleExecution: OrganizationVerificationAttemptLifecycleExecution;
  readonly terminalCoordinationReached: boolean;
}

interface AdvanceCompletedSuccess extends AdvanceSuccessBase {
  readonly authorityResult: OrganizationVerificationWorkflowAuthorityResult;
  readonly workflowStepExecution: OrganizationVerificationWorkflowStepExecution;
  readonly replayExecution: OrganizationVerificationReplayExecution;
}

interface AdvanceIdempotentSuccess extends AdvanceSuccessBase {
  readonly persistedAuthorityResult: OrganizationVerificationPersistedWorkflowAuthorityResult;
  readonly replayExecution: OrganizationVerificationReplayExecution;
}

export type AdvanceOrganizationVerificationWorkflowResult =
  | Readonly<AdvanceCompletedSuccess & { outcome: "advance_completed" }>
  | Readonly<AdvanceIdempotentSuccess & { outcome: "advance_idempotent" }>
  | Readonly<{
      outcome: "advance_rejected";
      applicationExecution: OrganizationVerificationApplicationExecution;
      failure: OrganizationVerificationApplicationFailure;
    }>;

export interface OrganizationVerificationStateReadDiagnostics {
  readonly totalEvidenceEntriesConsumed: number;
  readonly totalWorkflowStepsReconstructed: number;
  readonly fullStreamConsumed: true;
}

export type LoadOrganizationVerificationStateResult =
  | Readonly<{
      outcome: "state_found";
      applicationExecution: OrganizationVerificationApplicationExecution;
      streamIdentity: OrganizationVerificationWorkflowStreamIdentity;
      persistenceStreamVersion: number;
      evidenceStreamFingerprint: string;
      replayExecution: OrganizationVerificationReplayExecution;
      currentWorkflowExecution: OrganizationVerificationWorkflowExecution;
      currentLifecycleExecution: OrganizationVerificationAttemptLifecycleExecution;
      terminalCoordinationReached: boolean;
      diagnostics: OrganizationVerificationStateReadDiagnostics;
    }>
  | Readonly<{
      outcome: "state_not_found";
      applicationExecution: OrganizationVerificationApplicationExecution;
      streamIdentity: OrganizationVerificationWorkflowStreamIdentity;
    }>
  | Readonly<{
      outcome: "state_rejected";
      applicationExecution: OrganizationVerificationApplicationExecution;
      failure: OrganizationVerificationApplicationFailure;
    }>;

export type ReplayOrganizationVerificationHistoryResult =
  | Readonly<{
      outcome: "history_replayed";
      applicationExecution: OrganizationVerificationApplicationExecution;
      streamIdentity: OrganizationVerificationWorkflowStreamIdentity;
      persistenceStreamVersion: number;
      evidenceStreamFingerprint: string;
      replayExecution: OrganizationVerificationReplayExecution;
      authorityResultBindings: readonly OrganizationVerificationReplayEvidenceBinding[];
      workflowStepRecordBindings: readonly OrganizationVerificationWorkflowStepRecord[];
      diagnostics: OrganizationVerificationReplayDiagnostics;
      fullStreamConsumed: true;
    }>
  | Readonly<{
      outcome: "history_not_found";
      applicationExecution: OrganizationVerificationApplicationExecution;
      streamIdentity: OrganizationVerificationWorkflowStreamIdentity;
    }>
  | Readonly<{
      outcome: "history_rejected";
      applicationExecution: OrganizationVerificationApplicationExecution;
      failure: OrganizationVerificationApplicationFailure;
    }>;

export type OrganizationVerificationApplicationServiceResult =
  | StartOrganizationVerificationResult
  | AdvanceOrganizationVerificationWorkflowResult
  | LoadOrganizationVerificationStateResult
  | ReplayOrganizationVerificationHistoryResult;

function authenticExecution(
  execution: OrganizationVerificationApplicationExecution,
  outcome: OrganizationVerificationApplicationServiceResult["outcome"],
): boolean {
  return (
    isOrganizationVerificationApplicationExecution(execution) &&
    execution.outcome === outcome
  );
}

export function createStartOrganizationVerificationSuccessInternal(
  outcome: "start_completed" | "start_idempotent",
  value: StartSuccess,
): StartOrganizationVerificationResult | undefined {
  const replay = value.replayExecution;
  if (
    !authenticExecution(value.applicationExecution, outcome) ||
    !isOrganizationVerificationWorkflowExecution(
      value.committedWorkflowGenesis,
    ) ||
    value.committedWorkflowGenesis.workflowExecutionVersion !== 1 ||
    !isOrganizationVerificationReplayExecution(replay) ||
    value.currentWorkflowExecution !==
      replay.reconstructedWorkflowExecution ||
    value.currentLifecycleExecution !==
      replay.reconstructedAttemptLifecycleExecution ||
    !semanticallySameWorkflowExecution(
      value.committedWorkflowGenesis,
      replay.reconstructedWorkflowExecution,
    ) ||
    !isOrganizationVerificationEvidenceAppendReceipt(value.appendReceipt) ||
    replay.persistenceStreamVersion !==
      value.resultingPersistenceStreamVersion ||
    replay.streamIdentity.streamIdentityFingerprint !==
      value.appendReceipt.streamIdentity.streamIdentityFingerprint ||
    replay.sourceEvidenceStreamFingerprint.trim().length === 0 ||
    value.appendReceipt.resultingStreamVersion !==
      value.resultingPersistenceStreamVersion ||
    value.applicationExecution.previousPersistenceStreamVersion !== 0 ||
    value.applicationExecution.resultingPersistenceStreamVersion !==
      value.resultingPersistenceStreamVersion ||
    value.applicationExecution.previousWorkflowVersion !== 0 ||
    value.applicationExecution.resultingWorkflowVersion !== 1 ||
    !hasExactCanonicalFingerprintBinding(
      value.applicationExecution,
      [
        value.committedWorkflowGenesis.workflowExecutionFingerprint,
        value.appendReceipt.appendReceiptFingerprint,
        replay.replayRequestFingerprint,
        replay.replayExecutionId,
        replay.replayFingerprint,
        replay.sourceEvidenceStreamFingerprint,
        replay.reconstructedWorkflowExecution.workflowExecutionFingerprint,
        replay.reconstructedAttemptLifecycleExecution
          .attemptLifecycleExecutionFingerprint,
      ],
    ) ||
    value.appendReceipt.outcome !==
      (outcome === "start_completed"
        ? "appended"
        : "duplicate_append_idempotent")
  ) {
    return undefined;
  }
  return sealApplicationResultInternal({ outcome, ...value });
}

function validAdvanceBase(
  outcome: "advance_completed" | "advance_idempotent",
  value: AdvanceSuccessBase,
): boolean {
  return (
    authenticExecution(value.applicationExecution, outcome) &&
    isOrganizationVerificationWorkflowStepRecord(value.workflowStepRecord) &&
    isOrganizationVerificationWorkflowExecution(
      value.currentWorkflowExecution,
    ) &&
    isOrganizationVerificationAttemptLifecycleExecution(
      value.currentLifecycleExecution,
    ) &&
    isOrganizationVerificationEvidenceAppendReceipt(value.appendReceipt) &&
    value.previousWorkflowVersion + 1 === value.resultingWorkflowVersion &&
    value.workflowStepRecord.predecessorWorkflowExecutionVersion ===
      value.previousWorkflowVersion &&
    value.workflowStepRecord.nextWorkflowExecutionVersion ===
      value.resultingWorkflowVersion &&
    value.workflowStepRecord.requestedStep === value.executedWorkflowStep &&
    value.previousPersistenceStreamVersion + 2 ===
      value.resultingPersistenceStreamVersion &&
    value.appendReceipt.previousStreamVersion ===
      value.previousPersistenceStreamVersion &&
    value.appendReceipt.resultingStreamVersion ===
      value.resultingPersistenceStreamVersion &&
    value.applicationExecution.requestIdentity.trim().length > 0 &&
    value.applicationExecution.previousPersistenceStreamVersion ===
      value.previousPersistenceStreamVersion &&
    value.applicationExecution.resultingPersistenceStreamVersion ===
      value.resultingPersistenceStreamVersion &&
    value.applicationExecution.previousWorkflowVersion ===
      value.previousWorkflowVersion &&
    value.applicationExecution.resultingWorkflowVersion ===
      value.resultingWorkflowVersion &&
    value.applicationExecution.streamIdentityFingerprint ===
      value.appendReceipt.streamIdentity.streamIdentityFingerprint &&
    semanticallySameLifecycleExecution(
      value.currentWorkflowExecution.lifecycleExecution,
      value.currentLifecycleExecution,
    ) &&
    value.terminalCoordinationReached ===
      (value.currentWorkflowExecution.workflowStage === "completed")
  );
}

function hasExactCanonicalFingerprintBinding(
  execution: OrganizationVerificationApplicationExecution,
  fingerprints: readonly string[],
): boolean {
  const expected = [...new Set(fingerprints)].sort((left, right) =>
    left.localeCompare(right),
  );
  return (
    execution.lowerLayerFingerprints.length === expected.length &&
    execution.lowerLayerFingerprints.every(
      (fingerprint, index) => fingerprint === expected[index],
    )
  );
}

function hasExactEnumerableKeys(
  value: object,
  expectedKeys: readonly string[],
): boolean {
  const actual = Object.keys(value).sort((left, right) =>
    left.localeCompare(right),
  );
  const expected = [...expectedKeys].sort((left, right) =>
    left.localeCompare(right),
  );
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function persistedAuthorityFingerprint(
  step: OrganizationVerificationWorkflowStep,
  value: OrganizationVerificationPersistedWorkflowAuthorityResult,
): string | undefined {
  switch (step) {
    case "attempt_transition":
      return isOrganizationVerificationAttemptLifecycleExecution(value)
        ? value.attemptLifecycleExecutionFingerprint
        : undefined;
    case "bind_snapshot":
      return isOrganizationVerificationEvidenceSnapshot(value)
        ? String(value.snapshotFingerprint)
        : undefined;
    case "bind_projection":
      return isOrganizationVerificationEvaluationProjection(value)
        ? String(value.projectionFingerprint)
        : undefined;
    case "bind_evaluation_input":
      return isOrganizationVerificationPolicyEvaluationInput(value)
        ? String(value.inputFingerprint)
        : undefined;
    case "complete_policy":
      return isOrganizationVerificationPolicyEvaluationExecution(value)
        ? String(value.executionFingerprint)
        : undefined;
    case "complete_decision_trust_integration":
      return isOrganizationVerificationDecisionTrustIntegrationExecution(value)
        ? String(value.executionFingerprint)
        : undefined;
  }
}

function completedPersistedAuthorityFingerprint(
  execution: OrganizationVerificationWorkflowStepExecution,
): string {
  switch (execution.requestedStep) {
    case "attempt_transition":
      return execution.authorityResult.nextLifecycleExecution
        .attemptLifecycleExecutionFingerprint;
    case "bind_snapshot":
      return String(execution.authorityResult.snapshotFingerprint);
    case "bind_projection":
      return String(execution.authorityResult.projectionFingerprint);
    case "bind_evaluation_input":
      return String(execution.authorityResult.inputFingerprint);
    case "complete_policy":
    case "complete_decision_trust_integration":
      return String(execution.authorityResult.executionFingerprint);
  }
}

function runtimeAuthorityFingerprint(
  step: OrganizationVerificationWorkflowStep,
  value: OrganizationVerificationWorkflowAuthorityResult,
): string | undefined {
  switch (step) {
    case "attempt_transition":
      return isOrganizationVerificationAttemptLifecycleTransitionExecution(
        value,
      )
        ? value.attemptLifecycleTransitionExecutionFingerprint
        : undefined;
    case "bind_snapshot":
      return isOrganizationVerificationEvidenceSnapshot(value)
        ? String(value.snapshotFingerprint)
        : undefined;
    case "bind_projection":
      return isOrganizationVerificationEvaluationProjection(value)
        ? String(value.projectionFingerprint)
        : undefined;
    case "bind_evaluation_input":
      return isOrganizationVerificationPolicyEvaluationInput(value)
        ? String(value.inputFingerprint)
        : undefined;
    case "complete_policy":
      return isOrganizationVerificationPolicyEvaluationExecution(value)
        ? String(value.executionFingerprint)
        : undefined;
    case "complete_decision_trust_integration":
      return isOrganizationVerificationDecisionTrustIntegrationExecution(value)
        ? String(value.executionFingerprint)
        : undefined;
  }
}

function semanticallySameLifecycleExecution(
  left: OrganizationVerificationAttemptLifecycleExecution,
  right: OrganizationVerificationAttemptLifecycleExecution,
): boolean {
  return (
    left.lifecycleExecutionId === right.lifecycleExecutionId &&
    left.lifecycleExecutionVersion === right.lifecycleExecutionVersion &&
    left.organizationId === right.organizationId &&
    left.recordId === right.recordId &&
    left.revisionId === right.revisionId &&
    left.attemptId === right.attemptId &&
    left.attemptLifecycleExecutionFingerprint ===
      right.attemptLifecycleExecutionFingerprint
  );
}

function semanticallySameWorkflowExecution(
  left: OrganizationVerificationWorkflowExecution,
  right: OrganizationVerificationWorkflowExecution,
): boolean {
  return (
    left.workflowExecutionId === right.workflowExecutionId &&
    left.workflowExecutionVersion === right.workflowExecutionVersion &&
    left.workflowStage === right.workflowStage &&
    left.organizationId === right.organizationId &&
    left.recordId === right.recordId &&
    left.revisionId === right.revisionId &&
    left.attemptId === right.attemptId &&
    left.workflowExecutionFingerprint === right.workflowExecutionFingerprint &&
    semanticallySameLifecycleExecution(
      left.lifecycleExecution,
      right.lifecycleExecution,
    )
  );
}

export function createAdvanceCompletedResultInternal(
  value: AdvanceCompletedSuccess,
): AdvanceOrganizationVerificationWorkflowResult | undefined {
  const stepExecution = value.workflowStepExecution;
  const replay = value.replayExecution;
  const authorityFingerprint =
    isOrganizationVerificationWorkflowStepExecution(stepExecution)
      ? completedPersistedAuthorityFingerprint(stepExecution)
      : undefined;
  const authorityBindings = isOrganizationVerificationReplayExecution(replay)
    ? replay.authorityResultBindings.filter(
        (binding) =>
          binding.workflowStepId === value.workflowStepRecord.workflowStepId &&
          binding.workflowStep === value.executedWorkflowStep &&
          binding.resultingWorkflowVersion === value.resultingWorkflowVersion,
      )
    : [];
  const authorityBinding = authorityBindings[0];
  const appendedReferences = value.appendReceipt.appendedEvidenceReferences;
  if (
    !hasExactEnumerableKeys(value, [
      "applicationExecution",
      "previousPersistenceStreamVersion",
      "resultingPersistenceStreamVersion",
      "previousWorkflowVersion",
      "resultingWorkflowVersion",
      "executedWorkflowStep",
      "authorityResult",
      "workflowStepRecord",
      "workflowStepExecution",
      "replayExecution",
      "appendReceipt",
      "currentWorkflowExecution",
      "currentLifecycleExecution",
      "terminalCoordinationReached",
    ]) ||
    !validAdvanceBase("advance_completed", value) ||
    !isOrganizationVerificationWorkflowStepExecution(stepExecution) ||
    !isOrganizationVerificationReplayExecution(replay) ||
    authorityFingerprint === undefined ||
    authorityBindings.length !== 1 ||
    authorityBinding === undefined ||
    value.resultingWorkflowVersion !==
      value.currentWorkflowExecution.workflowExecutionVersion ||
    stepExecution.requestedStep !== value.executedWorkflowStep ||
    runtimeAuthorityFingerprint(
      value.executedWorkflowStep,
      stepExecution.authorityResult,
    ) !==
      runtimeAuthorityFingerprint(
        value.executedWorkflowStep,
        value.authorityResult,
      ) ||
    stepExecution.workflowStepRecord.workflowStepId !==
      value.workflowStepRecord.workflowStepId ||
    stepExecution.workflowStepRecord.workflowStepBindingFingerprint !==
      value.workflowStepRecord.workflowStepBindingFingerprint ||
    !semanticallySameWorkflowExecution(
      stepExecution.nextWorkflowExecution,
      replay.reconstructedWorkflowExecution,
    ) ||
    !semanticallySameWorkflowExecution(
      replay.reconstructedWorkflowExecution,
      value.currentWorkflowExecution,
    ) ||
    !semanticallySameLifecycleExecution(
      replay.reconstructedAttemptLifecycleExecution,
      value.currentLifecycleExecution,
    ) ||
    replay.streamIdentity.streamIdentityFingerprint !==
      value.appendReceipt.streamIdentity.streamIdentityFingerprint ||
    replay.persistenceStreamVersion !==
      value.resultingPersistenceStreamVersion ||
    replay.sourceEvidenceStreamFingerprint.trim().length === 0 ||
    authorityBinding.authorityResultFingerprint !== authorityFingerprint ||
    authorityBinding.workflowStepRecordId !==
      value.workflowStepRecord.workflowStepId ||
    authorityBinding.workflowStepRecordFingerprint !==
      value.workflowStepRecord.workflowStepBindingFingerprint ||
    replay.workflowStepRecordBindings.filter(
      (record) =>
        record.workflowStepId === value.workflowStepRecord.workflowStepId &&
        record.workflowStepBindingFingerprint ===
          value.workflowStepRecord.workflowStepBindingFingerprint,
    ).length !== 1 ||
    appendedReferences.length !== 2 ||
    appendedReferences[0]?.streamPosition !==
      authorityBinding.authorityResultPersistencePosition ||
    appendedReferences[1]?.streamPosition !==
      authorityBinding.workflowStepRecordPersistencePosition ||
    value.appendReceipt.outcome !== "appended" ||
    value.appendReceipt.idempotentReplay !== false ||
    !hasExactCanonicalFingerprintBinding(value.applicationExecution, [
      stepExecution.workflowStepExecutionFingerprint,
      replay.replayRequestFingerprint,
      replay.replayExecutionId,
      replay.replayFingerprint,
      replay.sourceEvidenceStreamFingerprint,
      authorityFingerprint,
      value.workflowStepRecord.workflowStepBindingFingerprint,
      value.appendReceipt.appendReceiptFingerprint,
      value.currentWorkflowExecution.workflowExecutionFingerprint,
      value.currentLifecycleExecution.attemptLifecycleExecutionFingerprint,
    ])
  ) {
    return undefined;
  }
  return sealApplicationResultInternal({
    outcome: "advance_completed" as const,
    ...value,
  });
}

export function createAdvanceIdempotentResultInternal(
  value: AdvanceIdempotentSuccess,
): AdvanceOrganizationVerificationWorkflowResult | undefined {
  const replay = value.replayExecution;
  const authorityFingerprint = persistedAuthorityFingerprint(
    value.executedWorkflowStep,
    value.persistedAuthorityResult,
  );
  const authorityBindings = isOrganizationVerificationReplayExecution(replay)
    ? replay.authorityResultBindings.filter(
        (binding) =>
          binding.workflowStepId === value.workflowStepRecord.workflowStepId &&
          binding.workflowStep === value.executedWorkflowStep &&
          binding.resultingWorkflowVersion === value.resultingWorkflowVersion,
      )
    : [];
  const authorityBinding = authorityBindings[0];
  const appendedReferences = value.appendReceipt.appendedEvidenceReferences;
  if (
    !hasExactEnumerableKeys(value, [
      "applicationExecution",
      "previousPersistenceStreamVersion",
      "resultingPersistenceStreamVersion",
      "previousWorkflowVersion",
      "resultingWorkflowVersion",
      "executedWorkflowStep",
      "persistedAuthorityResult",
      "workflowStepRecord",
      "appendReceipt",
      "replayExecution",
      "currentWorkflowExecution",
      "currentLifecycleExecution",
      "terminalCoordinationReached",
    ]) ||
    !validAdvanceBase("advance_idempotent", value) ||
    authorityFingerprint === undefined ||
    !isOrganizationVerificationReplayExecution(replay) ||
    authorityBindings.length !== 1 ||
    authorityBinding === undefined ||
    authorityBinding.authorityResultFingerprint !== authorityFingerprint ||
    authorityBinding.workflowStepRecordId !==
      value.workflowStepRecord.workflowStepId ||
    authorityBinding.workflowStepRecordFingerprint !==
      value.workflowStepRecord.workflowStepBindingFingerprint ||
    replay.workflowStepRecordBindings.filter(
      (record) => record === value.workflowStepRecord,
    ).length !== 1 ||
    value.appendReceipt.outcome !== "duplicate_append_idempotent" ||
    value.appendReceipt.idempotentReplay !== true ||
    appendedReferences.length !== 2 ||
    appendedReferences[0]?.streamPosition !==
      authorityBinding.authorityResultPersistencePosition ||
    appendedReferences[1]?.streamPosition !==
      authorityBinding.workflowStepRecordPersistencePosition ||
    replay.streamIdentity.streamIdentityFingerprint !==
      value.appendReceipt.streamIdentity.streamIdentityFingerprint ||
    replay.persistenceStreamVersion <
      value.resultingPersistenceStreamVersion ||
    replay.reconstructedWorkflowExecution !==
      value.currentWorkflowExecution ||
    replay.reconstructedAttemptLifecycleExecution !==
      value.currentLifecycleExecution ||
    value.currentWorkflowExecution.workflowExecutionVersion <
      value.resultingWorkflowVersion ||
    !hasExactCanonicalFingerprintBinding(value.applicationExecution, [
      authorityFingerprint,
      value.workflowStepRecord.workflowStepBindingFingerprint,
      value.appendReceipt.appendReceiptFingerprint,
      replay.replayRequestFingerprint,
      replay.replayFingerprint,
      replay.sourceEvidenceStreamFingerprint,
      value.currentWorkflowExecution.workflowExecutionFingerprint,
      value.currentLifecycleExecution.attemptLifecycleExecutionFingerprint,
    ])
  ) {
    return undefined;
  }
  return sealApplicationResultInternal({
    outcome: "advance_idempotent" as const,
    ...value,
  });
}

export function createApplicationRejectedResultInternal(
  outcome: "start_rejected" | "advance_rejected" | "state_rejected" | "history_rejected",
  applicationExecution: OrganizationVerificationApplicationExecution,
  failure: OrganizationVerificationApplicationFailure,
): OrganizationVerificationApplicationServiceResult | undefined {
  if (!authenticExecution(applicationExecution, outcome)) return undefined;
  return sealApplicationResultInternal({
    outcome,
    applicationExecution,
    failure,
  });
}

export function createApplicationNotFoundResultInternal(
  outcome: "state_not_found" | "history_not_found",
  applicationExecution: OrganizationVerificationApplicationExecution,
  streamIdentity: OrganizationVerificationWorkflowStreamIdentity,
): LoadOrganizationVerificationStateResult | ReplayOrganizationVerificationHistoryResult | undefined {
  if (
    !authenticExecution(applicationExecution, outcome) ||
    !isOrganizationVerificationWorkflowStreamIdentity(streamIdentity)
  ) {
    return undefined;
  }
  return sealApplicationResultInternal({
    outcome,
    applicationExecution,
    streamIdentity,
  });
}

export function createLoadOrganizationVerificationStateFoundInternal(
  value: Omit<
    Extract<LoadOrganizationVerificationStateResult, { outcome: "state_found" }>,
    "outcome"
  >,
): LoadOrganizationVerificationStateResult | undefined {
  const replay = value.replayExecution;
  if (
    !authenticExecution(value.applicationExecution, "state_found") ||
    !isOrganizationVerificationWorkflowStreamIdentity(value.streamIdentity) ||
    !isOrganizationVerificationReplayExecution(replay) ||
    replay.streamIdentity.streamIdentityFingerprint !==
      value.streamIdentity.streamIdentityFingerprint ||
    replay.persistenceStreamVersion !== value.persistenceStreamVersion ||
    replay.sourceEvidenceStreamFingerprint !==
      value.evidenceStreamFingerprint ||
    replay.reconstructedWorkflowExecution !==
      value.currentWorkflowExecution ||
    replay.reconstructedAttemptLifecycleExecution !==
      value.currentLifecycleExecution ||
    replay.diagnostics.terminalCoordinationReached !==
      value.terminalCoordinationReached ||
    value.diagnostics.fullStreamConsumed !== true ||
    value.diagnostics.totalEvidenceEntriesConsumed !==
      replay.diagnostics.totalEvidenceEntriesConsumed ||
    value.diagnostics.totalWorkflowStepsReconstructed !==
      replay.diagnostics.totalWorkflowStepsReconstructed
  ) {
    return undefined;
  }
  return sealApplicationResultInternal({
    outcome: "state_found" as const,
    ...value,
    diagnostics: Object.freeze({ ...value.diagnostics }),
  });
}

export function createReplayOrganizationVerificationHistorySuccessInternal(
  value: Omit<
    Extract<
      ReplayOrganizationVerificationHistoryResult,
      { outcome: "history_replayed" }
    >,
    "outcome"
  >,
): ReplayOrganizationVerificationHistoryResult | undefined {
  const replay = value.replayExecution;
  if (
    !authenticExecution(value.applicationExecution, "history_replayed") ||
    !isOrganizationVerificationWorkflowStreamIdentity(value.streamIdentity) ||
    !isOrganizationVerificationReplayExecution(replay) ||
    replay.streamIdentity.streamIdentityFingerprint !==
      value.streamIdentity.streamIdentityFingerprint ||
    replay.persistenceStreamVersion !== value.persistenceStreamVersion ||
    replay.sourceEvidenceStreamFingerprint !==
      value.evidenceStreamFingerprint ||
    replay.authorityResultBindings !== value.authorityResultBindings ||
    replay.workflowStepRecordBindings !== value.workflowStepRecordBindings ||
    replay.diagnostics !== value.diagnostics ||
    value.fullStreamConsumed !== true
  ) {
    return undefined;
  }
  return sealApplicationResultInternal({
    outcome: "history_replayed" as const,
    ...value,
  });
}

export function isOrganizationVerificationApplicationServiceResult(
  value: unknown,
): value is OrganizationVerificationApplicationServiceResult {
  return isApplicationResultAuthenticInternal(value);
}
