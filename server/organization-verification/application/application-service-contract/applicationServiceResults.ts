import {
  isOrganizationVerificationAttemptLifecycleExecution,
  type OrganizationVerificationAttemptLifecycleExecution,
} from "../attempt-lifecycle-contract/index.js";
import {
  isOrganizationVerificationEvidenceAppendReceipt,
  isOrganizationVerificationWorkflowStreamIdentity,
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
  readonly currentWorkflowExecution: OrganizationVerificationWorkflowExecution;
}

export type StartOrganizationVerificationResult =
  | Readonly<StartSuccess & { outcome: "start_completed" }>
  | Readonly<StartSuccess & { outcome: "start_idempotent" }>
  | Readonly<{
      outcome: "start_rejected";
      applicationExecution: OrganizationVerificationApplicationExecution;
      failure: OrganizationVerificationApplicationFailure;
    }>;

interface AdvanceSuccess {
  readonly applicationExecution: OrganizationVerificationApplicationExecution;
  readonly previousPersistenceStreamVersion: number;
  readonly resultingPersistenceStreamVersion: number;
  readonly previousWorkflowVersion: number;
  readonly resultingWorkflowVersion: number;
  readonly executedWorkflowStep: OrganizationVerificationWorkflowStep;
  readonly authorityResult: OrganizationVerificationWorkflowAuthorityResult;
  readonly workflowStepRecord: OrganizationVerificationWorkflowStepRecord;
  readonly workflowStepExecution: OrganizationVerificationWorkflowStepExecution;
  readonly appendReceipt: OrganizationVerificationEvidenceAppendReceipt;
  readonly currentWorkflowExecution: OrganizationVerificationWorkflowExecution;
  readonly currentLifecycleExecution: OrganizationVerificationAttemptLifecycleExecution;
  readonly terminalCoordinationReached: boolean;
}

export type AdvanceOrganizationVerificationWorkflowResult =
  | Readonly<AdvanceSuccess & { outcome: "advance_completed" }>
  | Readonly<AdvanceSuccess & { outcome: "advance_idempotent" }>
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
  if (
    !authenticExecution(value.applicationExecution, outcome) ||
    !isOrganizationVerificationWorkflowExecution(
      value.committedWorkflowGenesis,
    ) ||
    value.committedWorkflowGenesis.workflowExecutionVersion !== 1 ||
    value.currentWorkflowExecution !== value.committedWorkflowGenesis ||
    !isOrganizationVerificationEvidenceAppendReceipt(value.appendReceipt) ||
    value.appendReceipt.resultingStreamVersion !==
      value.resultingPersistenceStreamVersion ||
    value.appendReceipt.outcome !==
      (outcome === "start_completed"
        ? "appended"
        : "duplicate_append_idempotent")
  ) {
    return undefined;
  }
  return sealApplicationResultInternal({ outcome, ...value });
}

export function createAdvanceOrganizationVerificationSuccessInternal(
  outcome: "advance_completed" | "advance_idempotent",
  value: AdvanceSuccess,
): AdvanceOrganizationVerificationWorkflowResult | undefined {
  const stepExecution = value.workflowStepExecution;
  if (
    !authenticExecution(value.applicationExecution, outcome) ||
    !isOrganizationVerificationWorkflowStepExecution(stepExecution) ||
    !isOrganizationVerificationWorkflowStepRecord(value.workflowStepRecord) ||
    !isOrganizationVerificationWorkflowExecution(
      value.currentWorkflowExecution,
    ) ||
    !isOrganizationVerificationAttemptLifecycleExecution(
      value.currentLifecycleExecution,
    ) ||
    !isOrganizationVerificationEvidenceAppendReceipt(value.appendReceipt) ||
    value.previousWorkflowVersion + 1 !== value.resultingWorkflowVersion ||
    value.resultingWorkflowVersion !==
      value.currentWorkflowExecution.workflowExecutionVersion ||
    value.previousPersistenceStreamVersion + 2 !==
      value.resultingPersistenceStreamVersion ||
    value.appendReceipt.previousStreamVersion !==
      value.previousPersistenceStreamVersion ||
    value.appendReceipt.resultingStreamVersion !==
      value.resultingPersistenceStreamVersion ||
    stepExecution.requestedStep !== value.executedWorkflowStep ||
    stepExecution.authorityResult !== value.authorityResult ||
    stepExecution.workflowStepRecord !== value.workflowStepRecord ||
    stepExecution.nextWorkflowExecution !== value.currentWorkflowExecution ||
    value.currentWorkflowExecution.lifecycleExecution !==
      value.currentLifecycleExecution ||
    value.terminalCoordinationReached !==
      (value.currentWorkflowExecution.workflowStage === "completed") ||
    value.appendReceipt.outcome !==
      (outcome === "advance_completed"
        ? "appended"
        : "duplicate_append_idempotent")
  ) {
    return undefined;
  }
  return sealApplicationResultInternal({ outcome, ...value });
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
