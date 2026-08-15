import {
  createOrganizationVerificationEvidenceAppendBatch,
  createOrganizationVerificationEvidenceAppendReceipt,
  createOrganizationVerificationStoredEvidence,
  type OrganizationVerificationDurableEvidence,
  type OrganizationVerificationEvidenceAppendReceipt,
  type OrganizationVerificationEvidenceAppendBatch,
  type OrganizationVerificationEvidenceStream,
  type OrganizationVerificationPersistenceFailureCode,
  type OrganizationVerificationStoredEvidence,
} from "../persistence-contract/index.js";
import {
  createOrganizationVerificationReplayRequest,
  isOrganizationVerificationReplayResult,
  type OrganizationVerificationReplayExecution,
} from "../replay-runtime/index.js";
import {
  createOrganizationVerificationWorkflowExecution,
  type OrganizationVerificationWorkflowExecution,
} from "../workflow-contract/index.js";
import type {
  ExecuteOrganizationVerificationWorkflowStepInput,
  OrganizationVerificationWorkflowStepExecution,
} from "../workflow-runtime/index.js";
import {
  ORGANIZATION_VERIFICATION_PERSISTENCE_FAILURE_MAPPING,
  ORGANIZATION_VERIFICATION_REPLAY_FAILURE_MAPPING,
  ORGANIZATION_VERIFICATION_WORKFLOW_FAILURE_STAGE_MAPPING,
  applicationFailureInternal,
  type OrganizationVerificationApplicationFailure,
} from "../application-service-contract/applicationServiceFailures.js";
import {
  createOrganizationVerificationApplicationExecutionInternal,
  type OrganizationVerificationApplicationExecution,
  type OrganizationVerificationApplicationOutcome,
} from "../application-service-contract/applicationServiceExecutions.js";
import { fingerprintApplicationServiceContract } from "../application-service-contract/applicationServiceFingerprint.js";
import type {
  OrganizationVerificationApplicationReplayMetadata,
} from "../application-service-contract/applicationServiceMetadata.js";
import type {
  OrganizationVerificationApplicationServiceDependencies,
  OrganizationVerificationApplicationServicePort,
} from "../application-service-contract/applicationServicePorts.js";
import {
  isAdvanceOrganizationVerificationWorkflowRequest,
  isLoadOrganizationVerificationStateRequest,
  isReplayOrganizationVerificationHistoryRequest,
  isStartOrganizationVerificationRequest,
  type AdvanceOrganizationVerificationWorkflowRequest,
  type LoadOrganizationVerificationStateRequest,
  type ReplayOrganizationVerificationHistoryRequest,
  type StartOrganizationVerificationRequest,
} from "../application-service-contract/applicationServiceRequests.js";
import {
  createAdvanceCompletedResultInternal,
  createAdvanceIdempotentResultInternal,
  createApplicationNotFoundResultInternal,
  createApplicationRejectedResultInternal,
  createLoadOrganizationVerificationStateFoundInternal,
  createReplayOrganizationVerificationHistorySuccessInternal,
  createStartOrganizationVerificationSuccessInternal,
  type AdvanceOrganizationVerificationWorkflowResult,
  type LoadOrganizationVerificationStateResult,
  type ReplayOrganizationVerificationHistoryResult,
  type StartOrganizationVerificationResult,
} from "../application-service-contract/applicationServiceResults.js";

type ApplicationRequest =
  | StartOrganizationVerificationRequest
  | AdvanceOrganizationVerificationWorkflowRequest
  | LoadOrganizationVerificationStateRequest
  | ReplayOrganizationVerificationHistoryRequest;

type ExecutionVersions = Readonly<{
  previousPersistenceStreamVersion?: number;
  resultingPersistenceStreamVersion?: number;
  previousWorkflowVersion?: number;
  resultingWorkflowVersion?: number;
}>;

type ReplayAttempt =
  | Readonly<{ ok: true; execution: OrganizationVerificationReplayExecution }>
  | Readonly<{ ok: false; failure: OrganizationVerificationApplicationFailure }>;

function requestIdentity(request: ApplicationRequest): string {
  return "commandId" in request.metadata
    ? request.metadata.commandId
    : request.metadata.queryId;
}

function applicationExecution(
  request: ApplicationRequest,
  outcome: OrganizationVerificationApplicationOutcome,
  lowerLayerFingerprints: readonly string[],
  versions: ExecutionVersions = {},
): OrganizationVerificationApplicationExecution {
  const execution = createOrganizationVerificationApplicationExecutionInternal({
    applicationExecutionId: request.metadata.applicationExecutionId,
    useCase: request.useCase,
    requestIdentity: requestIdentity(request),
    requestFingerprint: request.requestFingerprint,
    outcome,
    streamIdentityFingerprint: request.streamIdentity.streamIdentityFingerprint,
    completedAt: request.metadata.applicationCompletedAt,
    ...versions,
    lowerLayerFingerprints: [...new Set(lowerLayerFingerprints)].sort((left, right) =>
      left.localeCompare(right),
    ),
  });
  if (execution === undefined) {
    throw new Error("organization verification application execution invariant failed");
  }
  return execution;
}

function failureFingerprint(
  request: ApplicationRequest,
  failure: OrganizationVerificationApplicationFailure,
): string {
  return fingerprintApplicationServiceContract("application_failure_evidence", {
    requestFingerprint: request.requestFingerprint,
    failure,
  });
}

function persistenceFailure(
  code: OrganizationVerificationPersistenceFailureCode,
): OrganizationVerificationApplicationFailure {
  return applicationFailureInternal(
    ORGANIZATION_VERIFICATION_PERSISTENCE_FAILURE_MAPPING[code],
    { lowerLayerCode: code },
  );
}

function startPersistenceFailure(
  code: OrganizationVerificationPersistenceFailureCode,
): OrganizationVerificationApplicationFailure {
  if (
    code === "expected_stream_version_conflict" ||
    code === "evidence_identity_conflict" ||
    code === "evidence_fingerprint_conflict"
  ) {
    return applicationFailureInternal("start_persistence_conflict", {
      lowerLayerCode: code,
    });
  }
  return persistenceFailure(code);
}

function interpretedAppendReceipt(
  outcome: "appended" | "duplicate_append_idempotent",
  batch: OrganizationVerificationEvidenceAppendBatch,
  persistenceReceipt: OrganizationVerificationEvidenceAppendReceipt,
): OrganizationVerificationEvidenceAppendReceipt | undefined {
  if (outcome === "appended") return persistenceReceipt;
  const receipt = createOrganizationVerificationEvidenceAppendReceipt({
    batch,
    outcome: "duplicate_append_idempotent",
  });
  return receipt.ok ? receipt.value : undefined;
}

function rejectedExecution(
  request: ApplicationRequest,
  outcome: "start_rejected" | "advance_rejected" | "state_rejected" | "history_rejected",
  failure: OrganizationVerificationApplicationFailure,
  extraFingerprints: readonly string[] = [],
  versions: ExecutionVersions = {},
): OrganizationVerificationApplicationExecution {
  return applicationExecution(
    request,
    outcome,
    [failureFingerprint(request, failure), ...extraFingerprints],
    versions,
  );
}

function rejectStart(
  request: StartOrganizationVerificationRequest,
  failure: OrganizationVerificationApplicationFailure,
  extraFingerprints: readonly string[] = [],
  versions: ExecutionVersions = {},
): StartOrganizationVerificationResult {
  const result = createApplicationRejectedResultInternal(
    "start_rejected",
    rejectedExecution(request, "start_rejected", failure, extraFingerprints, versions),
    failure,
  );
  if (result?.outcome !== "start_rejected") {
    throw new Error("organization verification start rejection invariant failed");
  }
  return result;
}

function rejectAdvance(
  request: AdvanceOrganizationVerificationWorkflowRequest,
  failure: OrganizationVerificationApplicationFailure,
  extraFingerprints: readonly string[] = [],
  versions: ExecutionVersions = {},
): AdvanceOrganizationVerificationWorkflowResult {
  const result = createApplicationRejectedResultInternal(
    "advance_rejected",
    rejectedExecution(request, "advance_rejected", failure, extraFingerprints, versions),
    failure,
  );
  if (result?.outcome !== "advance_rejected") {
    throw new Error("organization verification advance rejection invariant failed");
  }
  return result;
}

function rejectState(
  request: LoadOrganizationVerificationStateRequest,
  failure: OrganizationVerificationApplicationFailure,
  extraFingerprints: readonly string[] = [],
): LoadOrganizationVerificationStateResult {
  const result = createApplicationRejectedResultInternal(
    "state_rejected",
    rejectedExecution(request, "state_rejected", failure, extraFingerprints),
    failure,
  );
  if (result?.outcome !== "state_rejected") {
    throw new Error("organization verification state rejection invariant failed");
  }
  return result;
}

function rejectHistory(
  request: ReplayOrganizationVerificationHistoryRequest,
  failure: OrganizationVerificationApplicationFailure,
  extraFingerprints: readonly string[] = [],
): ReplayOrganizationVerificationHistoryResult {
  const result = createApplicationRejectedResultInternal(
    "history_rejected",
    rejectedExecution(request, "history_rejected", failure, extraFingerprints),
    failure,
  );
  if (result?.outcome !== "history_rejected") {
    throw new Error("organization verification history rejection invariant failed");
  }
  return result;
}

function replayFailure(
  code: keyof typeof ORGANIZATION_VERIFICATION_REPLAY_FAILURE_MAPPING,
): OrganizationVerificationApplicationFailure {
  return applicationFailureInternal(
    ORGANIZATION_VERIFICATION_REPLAY_FAILURE_MAPPING[code],
    { lowerLayerCode: code },
  );
}

function executeReplay(
  dependencies: OrganizationVerificationApplicationServiceDependencies,
  stream: OrganizationVerificationEvidenceStream,
  metadata: OrganizationVerificationApplicationReplayMetadata,
): ReplayAttempt {
  const replayRequest = createOrganizationVerificationReplayRequest({
    replayRequestId: metadata.replayRequestId,
    replayExecutionId: metadata.replayExecutionId,
    sourceEvidenceStream: stream,
    replayedAt: metadata.replayedAt,
    provenanceReferences: metadata.provenanceReferences,
    integrityReferences: metadata.integrityReferences,
  });
  if (!replayRequest.ok) {
    return Object.freeze({
      ok: false,
      failure: replayFailure(replayRequest.code),
    });
  }
  let result;
  try {
    result = dependencies.replayRuntime.replayHistory(replayRequest.value);
  } catch {
    return Object.freeze({
      ok: false,
      failure: applicationFailureInternal("current_state_reconstruction_failure"),
    });
  }
  if (!isOrganizationVerificationReplayResult(result)) {
    return Object.freeze({
      ok: false,
      failure: applicationFailureInternal("current_state_integrity_failure"),
    });
  }
  if (result.outcome === "replay_rejected") {
    return Object.freeze({
      ok: false,
      failure: replayFailure(result.failure.code),
    });
  }
  if (
    result.execution.replayRequestId !== replayRequest.value.replayRequestId ||
    result.execution.replayRequestFingerprint !==
      replayRequest.value.replayRequestFingerprint ||
    result.execution.replayExecutionId !== replayRequest.value.replayExecutionId ||
    result.execution.replayedAt !== replayRequest.value.replayedAt
  ) {
    return Object.freeze({
      ok: false,
      failure: applicationFailureInternal("current_state_integrity_failure"),
    });
  }
  return Object.freeze({ ok: true, execution: result.execution });
}

function workflowRuntimeInput(
  request: AdvanceOrganizationVerificationWorkflowRequest,
  workflowExecution: OrganizationVerificationWorkflowExecution,
): ExecuteOrganizationVerificationWorkflowStepInput {
  const common = {
    workflowExecution,
    workflowStepId: request.workflowStepId,
    occurredAt: request.occurredAt,
    provenanceReferences: request.provenanceReferences,
    integrityReferences: request.integrityReferences,
    correlationId: request.correlationId,
    causationId: request.causationId,
    ...(request.reasonReference === undefined
      ? {}
      : { reasonReference: request.reasonReference }),
  };
  switch (request.step.requestedStep) {
    case "attempt_transition":
      return Object.freeze({
        ...common,
        requestedStep: request.step.requestedStep,
        attemptTransitionInput: request.step.authorityInput,
      });
    case "bind_snapshot":
      return Object.freeze({
        ...common,
        requestedStep: request.step.requestedStep,
        snapshotInput: request.step.authorityInput,
      });
    case "bind_projection":
      return Object.freeze({
        ...common,
        requestedStep: request.step.requestedStep,
        projectionInput: request.step.authorityInput,
      });
    case "bind_evaluation_input":
      return Object.freeze({
        ...common,
        requestedStep: request.step.requestedStep,
        evaluationInput: request.step.authorityInput,
      });
    case "complete_policy":
      return Object.freeze({
        ...common,
        requestedStep: request.step.requestedStep,
        policyInput: request.step.authorityInput,
      });
    case "complete_decision_trust_integration":
      return Object.freeze({
        ...common,
        requestedStep: request.step.requestedStep,
        decisionTrustIntegrationInput: request.step.authorityInput,
      });
  }
}

function durableAuthorityEvidence(
  execution: OrganizationVerificationWorkflowStepExecution,
): OrganizationVerificationDurableEvidence {
  switch (execution.requestedStep) {
    case "attempt_transition":
      return Object.freeze({
        evidenceKind: "attempt_lifecycle_execution" as const,
        artifact: execution.authorityResult.nextLifecycleExecution,
      });
    case "bind_snapshot":
      return Object.freeze({
        evidenceKind: "evidence_snapshot" as const,
        artifact: execution.authorityResult,
      });
    case "bind_projection":
      return Object.freeze({
        evidenceKind: "evaluation_projection" as const,
        artifact: execution.authorityResult,
      });
    case "bind_evaluation_input":
      return Object.freeze({
        evidenceKind: "policy_evaluation_input" as const,
        artifact: execution.authorityResult,
      });
    case "complete_policy":
      return Object.freeze({
        evidenceKind: "policy_runtime_execution" as const,
        artifact: execution.authorityResult,
      });
    case "complete_decision_trust_integration":
      return Object.freeze({
        evidenceKind: "decision_trust_integration_execution" as const,
        artifact: execution.authorityResult,
      });
  }
}

function persistedAuthorityFingerprint(
  evidence: Exclude<
    OrganizationVerificationStoredEvidence,
    Readonly<{ evidenceKind: "workflow_genesis" | "workflow_step_record" }>
  >,
): string {
  return evidence.artifactFingerprint;
}

function duplicatePair(
  stream: OrganizationVerificationEvidenceStream,
  request: AdvanceOrganizationVerificationWorkflowRequest,
):
  | Readonly<{
      status: "exact";
      authority: Exclude<
        OrganizationVerificationStoredEvidence,
        Readonly<{ evidenceKind: "workflow_genesis" | "workflow_step_record" }>
      >;
      step: Extract<OrganizationVerificationStoredEvidence, Readonly<{ evidenceKind: "workflow_step_record" }>>;
    }>
  | Readonly<{ status: "conflict" }>
  | undefined {
  for (let index = 1; index < stream.entries.length; index += 2) {
    const authority = stream.entries[index];
    const step = stream.entries[index + 1];
    if (
      authority === undefined ||
      authority.evidenceKind === "workflow_genesis" ||
      authority.evidenceKind === "workflow_step_record" ||
      step?.evidenceKind !== "workflow_step_record" ||
      step.artifact.workflowStepId !== request.workflowStepId
    ) {
      continue;
    }
    if (
      step.artifact.requestedStep !== request.step.requestedStep ||
      step.artifact.predecessorStage !== request.step.expectedWorkflowStage ||
      step.artifact.predecessorWorkflowExecutionVersion !==
        request.expectedWorkflowVersion ||
      step.artifact.nextWorkflowExecutionVersion !==
        request.expectedWorkflowVersion + 1 ||
      step.artifact.workflowExecutionId !== request.expectedWorkflowExecutionId ||
      step.artifact.occurredAt !== request.occurredAt ||
      step.artifact.correlationId !== request.correlationId ||
      step.artifact.causationId !== request.causationId ||
      step.artifact.reasonReference !== request.reasonReference ||
      step.artifact.provenanceReferences.length !== request.provenanceReferences.length ||
      step.artifact.provenanceReferences.some(
        (reference, referenceIndex) =>
          reference !== request.provenanceReferences[referenceIndex],
      ) ||
      step.artifact.integrityReferences.length !== request.integrityReferences.length ||
      step.artifact.integrityReferences.some(
        (reference, referenceIndex) =>
          reference !== request.integrityReferences[referenceIndex],
      )
    ) {
      return Object.freeze({ status: "conflict" as const });
    }
    return Object.freeze({ status: "exact" as const, authority, step });
  }
  return undefined;
}

function lowerFingerprintsForAdvance(
  stepExecution: OrganizationVerificationWorkflowStepExecution,
  receipt: OrganizationVerificationEvidenceAppendReceipt,
  replay: OrganizationVerificationReplayExecution,
  authorityFingerprint: string,
): readonly string[] {
  return [
    stepExecution.workflowStepExecutionFingerprint,
    replay.replayRequestFingerprint,
    replay.replayExecutionId,
    replay.replayFingerprint,
    replay.sourceEvidenceStreamFingerprint,
    authorityFingerprint,
    stepExecution.workflowStepRecord.workflowStepBindingFingerprint,
    receipt.appendReceiptFingerprint,
    replay.reconstructedWorkflowExecution.workflowExecutionFingerprint,
    replay.reconstructedAttemptLifecycleExecution
      .attemptLifecycleExecutionFingerprint,
  ];
}

export function createOrganizationVerificationApplicationService(
  dependencies: OrganizationVerificationApplicationServiceDependencies,
): OrganizationVerificationApplicationServicePort {
  async function startOrganizationVerification(
    request: StartOrganizationVerificationRequest,
  ): Promise<StartOrganizationVerificationResult> {
    if (!isStartOrganizationVerificationRequest(request)) {
      return rejectStart(
        request,
        applicationFailureInternal("unauthentic_application_request"),
      );
    }
    const lifecycle = request.initialLifecycleExecution;
    const genesisResult = createOrganizationVerificationWorkflowExecution({
      workflowExecutionId: request.streamIdentity.workflowExecutionId,
      workflowExecutionVersion: request.initialWorkflowExecutionVersion,
      organizationId: lifecycle.organizationId,
      recordId: lifecycle.recordId,
      revisionId: lifecycle.revisionId,
      attemptId: lifecycle.attemptId,
      workflowStage:
        lifecycle.attempt.processState === "completed"
          ? "attempt_completed"
          : "attempt_in_progress",
      lifecycleExecution: lifecycle,
      stepRecords: [],
      createdAt: request.workflowCreatedAt,
      provenanceReferences: request.workflowProvenanceReferences,
      integrityReferences: request.workflowIntegrityReferences,
    });
    if (!genesisResult.ok) {
      return rejectStart(
        request,
        applicationFailureInternal("invalid_workflow_genesis", {
          lowerLayerCode: genesisResult.code,
        }),
      );
    }
    const genesis = genesisResult.value;
    const storedGenesis = createOrganizationVerificationStoredEvidence({
      evidenceKind: "workflow_genesis",
      artifact: genesis,
      evidenceEntryId: request.persistence.genesisEvidenceEntryId!,
      streamIdentity: request.streamIdentity,
      streamPosition: 1,
      appendedAt: request.persistence.appendedAt,
      provenanceReferences: request.persistence.provenanceReferences,
      integrityReferences: request.persistence.integrityReferences,
    });
    if (!storedGenesis.ok) {
      return rejectStart(request, startPersistenceFailure(storedGenesis.code));
    }
    const batch = createOrganizationVerificationEvidenceAppendBatch({
      appendId: request.persistence.appendId,
      streamIdentity: request.streamIdentity,
      expectedStreamVersion: 0,
      entries: [storedGenesis.value],
      appendedAt: request.persistence.appendedAt,
      provenanceReferences: request.persistence.provenanceReferences,
      integrityReferences: request.persistence.integrityReferences,
    });
    if (!batch.ok) {
      return rejectStart(request, startPersistenceFailure(batch.code));
    }
    let append;
    try {
      append = await dependencies.evidenceRepository.appendOrganizationVerificationEvidence({
        streamIdentity: request.streamIdentity,
        expectedStreamVersion: 0,
        batch: batch.value,
      });
    } catch {
      return rejectStart(
        request,
        applicationFailureInternal("persistence_append_rejected"),
        [batch.value.appendBatchFingerprint],
      );
    }
    if (!append.ok) {
      return rejectStart(
        request,
        startPersistenceFailure(append.code),
        [batch.value.appendBatchFingerprint],
      );
    }
    const appendReceipt = interpretedAppendReceipt(
      append.outcome,
      batch.value,
      append.receipt,
    );
    if (appendReceipt === undefined) {
      return rejectStart(
        request,
        applicationFailureInternal("application_integrity_failure"),
        [batch.value.appendBatchFingerprint],
      );
    }
    let loaded;
    try {
      loaded = await dependencies.evidenceRepository.loadOrganizationVerificationEvidenceStream({
        streamIdentity: request.streamIdentity,
      });
    } catch {
      return rejectStart(
        request,
        applicationFailureInternal("current_state_integrity_failure"),
        [appendReceipt.appendReceiptFingerprint],
      );
    }
    if (loaded.status !== "found") {
      return rejectStart(
        request,
        applicationFailureInternal("current_state_reconstruction_failure"),
        [appendReceipt.appendReceiptFingerprint],
      );
    }
    const replay = executeReplay(
      dependencies,
      loaded.stream,
      request.authoritativeReplay,
    );
    if (!replay.ok) {
      return rejectStart(
        request,
        replay.failure,
        [appendReceipt.appendReceiptFingerprint, loaded.stream.evidenceStreamFingerprint],
      );
    }
    const execution = applicationExecution(
      request,
      append.outcome === "appended" ? "start_completed" : "start_idempotent",
      [
        genesis.workflowExecutionFingerprint,
        appendReceipt.appendReceiptFingerprint,
        replay.execution.replayRequestFingerprint,
        replay.execution.replayExecutionId,
        replay.execution.replayFingerprint,
        replay.execution.sourceEvidenceStreamFingerprint,
        replay.execution.reconstructedWorkflowExecution.workflowExecutionFingerprint,
        replay.execution.reconstructedAttemptLifecycleExecution
          .attemptLifecycleExecutionFingerprint,
      ],
      {
        previousPersistenceStreamVersion: 0,
        resultingPersistenceStreamVersion: appendReceipt.resultingStreamVersion,
        previousWorkflowVersion: 0,
        resultingWorkflowVersion: 1,
      },
    );
    const result = createStartOrganizationVerificationSuccessInternal(
      append.outcome === "appended" ? "start_completed" : "start_idempotent",
      {
        applicationExecution: execution,
        committedWorkflowGenesis: genesis,
        appendReceipt,
        resultingPersistenceStreamVersion: appendReceipt.resultingStreamVersion,
        replayExecution: replay.execution,
        currentWorkflowExecution: replay.execution.reconstructedWorkflowExecution,
        currentLifecycleExecution:
          replay.execution.reconstructedAttemptLifecycleExecution,
      },
    );
    return result ??
      rejectStart(
        request,
        applicationFailureInternal("current_state_integrity_failure"),
        [execution.applicationExecutionFingerprint],
      );
  }

  async function advanceOrganizationVerificationWorkflow(
    request: AdvanceOrganizationVerificationWorkflowRequest,
  ): Promise<AdvanceOrganizationVerificationWorkflowResult> {
    if (!isAdvanceOrganizationVerificationWorkflowRequest(request)) {
      return rejectAdvance(
        request,
        applicationFailureInternal("unauthentic_application_request"),
      );
    }
    let loaded;
    try {
      loaded = await dependencies.evidenceRepository.loadOrganizationVerificationEvidenceStream({
        streamIdentity: request.streamIdentity,
      });
    } catch {
      return rejectAdvance(
        request,
        applicationFailureInternal("current_state_integrity_failure"),
      );
    }
    if (loaded.status !== "found") {
      return rejectAdvance(
        request,
        applicationFailureInternal("verification_stream_not_found"),
      );
    }
    const preReplay = executeReplay(
      dependencies,
      loaded.stream,
      request.preExecutionReplay,
    );
    if (!preReplay.ok) {
      return rejectAdvance(request, preReplay.failure, [loaded.stream.evidenceStreamFingerprint]);
    }

    const duplicate = duplicatePair(loaded.stream, request);
    if (duplicate?.status === "conflict") {
      return rejectAdvance(
        request,
        applicationFailureInternal("application_idempotency_conflict", {
          safeIdentityReference: request.workflowStepId,
        }),
      );
    }
    if (duplicate?.status === "exact") {
      const duplicateBatch = createOrganizationVerificationEvidenceAppendBatch({
        appendId: request.persistence.appendId,
        streamIdentity: request.streamIdentity,
        expectedStreamVersion: request.expectedPersistenceStreamVersion,
        expectedHeadEvidenceEntryId: duplicate.authority.predecessorEvidenceEntryId,
        entries: [duplicate.authority, duplicate.step],
        appendedAt: request.persistence.appendedAt,
        provenanceReferences: request.persistence.provenanceReferences,
        integrityReferences: request.persistence.integrityReferences,
      });
      if (!duplicateBatch.ok) {
        return rejectAdvance(request, persistenceFailure(duplicateBatch.code));
      }
      let duplicateAppend;
      try {
        duplicateAppend = await dependencies.evidenceRepository.appendOrganizationVerificationEvidence({
          streamIdentity: request.streamIdentity,
          expectedStreamVersion: request.expectedPersistenceStreamVersion,
          batch: duplicateBatch.value,
        });
      } catch {
        return rejectAdvance(
          request,
          applicationFailureInternal("persistence_append_rejected"),
          [duplicateBatch.value.appendBatchFingerprint],
        );
      }
      if (!duplicateAppend.ok) {
        return rejectAdvance(request, persistenceFailure(duplicateAppend.code));
      }
      if (duplicateAppend.outcome !== "duplicate_append_idempotent") {
        return rejectAdvance(
          request,
          applicationFailureInternal("application_idempotency_conflict"),
          [duplicateAppend.receipt.appendReceiptFingerprint],
        );
      }
      const duplicateReceipt = interpretedAppendReceipt(
        duplicateAppend.outcome,
        duplicateBatch.value,
        duplicateAppend.receipt,
      );
      if (duplicateReceipt === undefined) {
        return rejectAdvance(
          request,
          applicationFailureInternal("application_integrity_failure"),
          [duplicateBatch.value.appendBatchFingerprint],
        );
      }
      let reloaded;
      try {
        reloaded = await dependencies.evidenceRepository.loadOrganizationVerificationEvidenceStream({
          streamIdentity: request.streamIdentity,
        });
      } catch {
        return rejectAdvance(
          request,
          applicationFailureInternal("current_state_integrity_failure"),
          [duplicateReceipt.appendReceiptFingerprint],
        );
      }
      if (reloaded.status !== "found") {
        return rejectAdvance(
          request,
          applicationFailureInternal("current_state_reconstruction_failure"),
          [duplicateReceipt.appendReceiptFingerprint],
        );
      }
      const authoritativeReplay = executeReplay(
        dependencies,
        reloaded.stream,
        request.authoritativeReplay,
      );
      if (!authoritativeReplay.ok) {
        return rejectAdvance(request, authoritativeReplay.failure);
      }
      const replay = authoritativeReplay.execution;
      const execution = applicationExecution(
        request,
        "advance_idempotent",
        [
          persistedAuthorityFingerprint(duplicate.authority),
          duplicate.step.artifact.workflowStepBindingFingerprint,
          duplicateReceipt.appendReceiptFingerprint,
          replay.replayRequestFingerprint,
          replay.replayFingerprint,
          replay.sourceEvidenceStreamFingerprint,
          replay.reconstructedWorkflowExecution.workflowExecutionFingerprint,
          replay.reconstructedAttemptLifecycleExecution
            .attemptLifecycleExecutionFingerprint,
        ],
        {
          previousPersistenceStreamVersion:
            duplicateReceipt.previousStreamVersion,
          resultingPersistenceStreamVersion:
            duplicateReceipt.resultingStreamVersion,
          previousWorkflowVersion:
            duplicate.step.artifact.predecessorWorkflowExecutionVersion,
          resultingWorkflowVersion:
            duplicate.step.artifact.nextWorkflowExecutionVersion,
        },
      );
      const result = createAdvanceIdempotentResultInternal({
        applicationExecution: execution,
        previousPersistenceStreamVersion:
          duplicateReceipt.previousStreamVersion,
        resultingPersistenceStreamVersion:
          duplicateReceipt.resultingStreamVersion,
        previousWorkflowVersion:
          duplicate.step.artifact.predecessorWorkflowExecutionVersion,
        resultingWorkflowVersion:
          duplicate.step.artifact.nextWorkflowExecutionVersion,
        executedWorkflowStep: duplicate.step.artifact.requestedStep,
        persistedAuthorityResult: duplicate.authority.artifact,
        workflowStepRecord: duplicate.step.artifact,
        appendReceipt: duplicateReceipt,
        replayExecution: replay,
        currentWorkflowExecution: replay.reconstructedWorkflowExecution,
        currentLifecycleExecution: replay.reconstructedAttemptLifecycleExecution,
        terminalCoordinationReached:
          replay.diagnostics.terminalCoordinationReached,
      });
      return result ??
        rejectAdvance(
          request,
          applicationFailureInternal("current_state_integrity_failure"),
          [execution.applicationExecutionFingerprint],
        );
    }

    const current = preReplay.execution.reconstructedWorkflowExecution;
    if (loaded.stream.streamVersion !== request.expectedPersistenceStreamVersion) {
      return rejectAdvance(
        request,
        applicationFailureInternal("expected_persistence_version_conflict", {
          expectedPersistenceStreamVersion: request.expectedPersistenceStreamVersion,
          actualPersistenceStreamVersion: loaded.stream.streamVersion,
        }),
      );
    }
    if (
      current.workflowExecutionId !== request.expectedWorkflowExecutionId ||
      current.workflowExecutionVersion !== request.expectedWorkflowVersion
    ) {
      return rejectAdvance(
        request,
        applicationFailureInternal("expected_workflow_version_conflict", {
          expectedWorkflowVersion: request.expectedWorkflowVersion,
          actualWorkflowVersion: current.workflowExecutionVersion,
        }),
      );
    }
    if (current.workflowStage === "completed") {
      return rejectAdvance(request, applicationFailureInternal("workflow_already_completed"));
    }
    if (current.workflowStage !== request.step.expectedWorkflowStage) {
      return rejectAdvance(
        request,
        applicationFailureInternal("expected_workflow_stage_conflict", {
          expectedWorkflowStage: request.step.expectedWorkflowStage,
          actualWorkflowStage: current.workflowStage,
        }),
      );
    }

    let runtimeResult;
    try {
      runtimeResult = dependencies.workflowRuntime.executeOneWorkflowStep(
        workflowRuntimeInput(request, current),
      );
    } catch {
      return rejectAdvance(
        request,
        applicationFailureInternal("workflow_step_execution_rejected"),
      );
    }
    if (!runtimeResult.ok) {
      return rejectAdvance(
        request,
        applicationFailureInternal(
          ORGANIZATION_VERIFICATION_WORKFLOW_FAILURE_STAGE_MAPPING[
            runtimeResult.stage
          ],
          {
            lowerLayerCode:
              "code" in runtimeResult
                ? runtimeResult.code
                : "cause" in runtimeResult && "code" in runtimeResult.cause
                  ? runtimeResult.cause.code
                  : runtimeResult.stage,
          },
        ),
      );
    }
    const stepExecution = runtimeResult.value;
    const authorityEvidence = durableAuthorityEvidence(stepExecution);
    const authorityStored = createOrganizationVerificationStoredEvidence({
      ...authorityEvidence,
      evidenceEntryId: request.persistence.authorityEvidenceEntryId!,
      streamIdentity: request.streamIdentity,
      streamPosition: loaded.stream.streamVersion + 1,
      predecessorEvidenceEntryId:
        loaded.stream.headEvidenceReference.evidenceEntryId,
      appendedAt: request.persistence.appendedAt,
      provenanceReferences: request.persistence.provenanceReferences,
      integrityReferences: request.persistence.integrityReferences,
    });
    if (!authorityStored.ok) {
      return rejectAdvance(request, persistenceFailure(authorityStored.code));
    }
    const stepStored = createOrganizationVerificationStoredEvidence({
      evidenceKind: "workflow_step_record",
      artifact: stepExecution.workflowStepRecord,
      evidenceEntryId: request.persistence.workflowStepRecordEvidenceEntryId!,
      streamIdentity: request.streamIdentity,
      streamPosition: loaded.stream.streamVersion + 2,
      predecessorEvidenceEntryId: authorityStored.value.evidenceEntryId,
      appendedAt: request.persistence.appendedAt,
      provenanceReferences: request.persistence.provenanceReferences,
      integrityReferences: request.persistence.integrityReferences,
    });
    if (!stepStored.ok) {
      return rejectAdvance(request, persistenceFailure(stepStored.code));
    }
    const appendBatch = createOrganizationVerificationEvidenceAppendBatch({
      appendId: request.persistence.appendId,
      streamIdentity: request.streamIdentity,
      expectedStreamVersion: loaded.stream.streamVersion,
      expectedHeadEvidenceEntryId:
        loaded.stream.headEvidenceReference.evidenceEntryId,
      entries: [authorityStored.value, stepStored.value],
      appendedAt: request.persistence.appendedAt,
      provenanceReferences: request.persistence.provenanceReferences,
      integrityReferences: request.persistence.integrityReferences,
    });
    if (!appendBatch.ok) {
      return rejectAdvance(request, persistenceFailure(appendBatch.code));
    }
    let append;
    try {
      append = await dependencies.evidenceRepository.appendOrganizationVerificationEvidence({
        streamIdentity: request.streamIdentity,
        expectedStreamVersion: loaded.stream.streamVersion,
        batch: appendBatch.value,
      });
    } catch {
      return rejectAdvance(
        request,
        applicationFailureInternal("persistence_append_rejected"),
        [appendBatch.value.appendBatchFingerprint],
      );
    }
    if (!append.ok) {
      return rejectAdvance(request, persistenceFailure(append.code));
    }
    if (append.outcome !== "appended") {
      return rejectAdvance(
        request,
        applicationFailureInternal("application_idempotency_conflict"),
        [append.receipt.appendReceiptFingerprint],
      );
    }
    let reloaded;
    try {
      reloaded = await dependencies.evidenceRepository.loadOrganizationVerificationEvidenceStream({
        streamIdentity: request.streamIdentity,
      });
    } catch {
      return rejectAdvance(
        request,
        applicationFailureInternal("current_state_integrity_failure"),
        [append.receipt.appendReceiptFingerprint],
      );
    }
    if (reloaded.status !== "found") {
      return rejectAdvance(
        request,
        applicationFailureInternal("current_state_reconstruction_failure"),
        [append.receipt.appendReceiptFingerprint],
      );
    }
    const authoritativeReplay = executeReplay(
      dependencies,
      reloaded.stream,
      request.authoritativeReplay,
    );
    if (!authoritativeReplay.ok) {
      return rejectAdvance(request, authoritativeReplay.failure);
    }
    const replay = authoritativeReplay.execution;
    const execution = applicationExecution(
      request,
      "advance_completed",
      lowerFingerprintsForAdvance(
        stepExecution,
        append.receipt,
        replay,
        authorityStored.value.artifactFingerprint,
      ),
      {
        previousPersistenceStreamVersion: loaded.stream.streamVersion,
        resultingPersistenceStreamVersion: append.receipt.resultingStreamVersion,
        previousWorkflowVersion: current.workflowExecutionVersion,
        resultingWorkflowVersion:
          stepExecution.nextWorkflowExecution.workflowExecutionVersion,
      },
    );
    const result = createAdvanceCompletedResultInternal({
      applicationExecution: execution,
      previousPersistenceStreamVersion: loaded.stream.streamVersion,
      resultingPersistenceStreamVersion: append.receipt.resultingStreamVersion,
      previousWorkflowVersion: current.workflowExecutionVersion,
      resultingWorkflowVersion:
        stepExecution.nextWorkflowExecution.workflowExecutionVersion,
      executedWorkflowStep: stepExecution.requestedStep,
      authorityResult: stepExecution.authorityResult,
      workflowStepRecord: stepExecution.workflowStepRecord,
      workflowStepExecution: stepExecution,
      replayExecution: replay,
      appendReceipt: append.receipt,
      currentWorkflowExecution: replay.reconstructedWorkflowExecution,
      currentLifecycleExecution: replay.reconstructedAttemptLifecycleExecution,
      terminalCoordinationReached:
        replay.diagnostics.terminalCoordinationReached,
    });
    return result ??
      rejectAdvance(
        request,
        applicationFailureInternal("current_state_integrity_failure"),
        [execution.applicationExecutionFingerprint],
      );
  }

  async function loadOrganizationVerificationState(
    request: LoadOrganizationVerificationStateRequest,
  ): Promise<LoadOrganizationVerificationStateResult> {
    if (!isLoadOrganizationVerificationStateRequest(request)) {
      return rejectState(request, applicationFailureInternal("unauthentic_application_request"));
    }
    let loaded;
    try {
      loaded = await dependencies.evidenceRepository.loadOrganizationVerificationEvidenceStream({
        streamIdentity: request.streamIdentity,
      });
    } catch {
      return rejectState(request, applicationFailureInternal("current_state_integrity_failure"));
    }
    if (loaded.status === "not_found") {
      const execution = applicationExecution(request, "state_not_found", [
        request.streamIdentity.streamIdentityFingerprint,
      ]);
      const result = createApplicationNotFoundResultInternal(
        "state_not_found",
        execution,
        request.streamIdentity,
      );
      if (result?.outcome !== "state_not_found") {
        return rejectState(request, applicationFailureInternal("application_integrity_failure"));
      }
      return result;
    }
    const replay = executeReplay(dependencies, loaded.stream, request.replay);
    if (!replay.ok) return rejectState(request, replay.failure);
    const execution = applicationExecution(request, "state_found", [
      replay.execution.replayRequestFingerprint,
      replay.execution.replayFingerprint,
      replay.execution.sourceEvidenceStreamFingerprint,
      replay.execution.reconstructedWorkflowExecution.workflowExecutionFingerprint,
      replay.execution.reconstructedAttemptLifecycleExecution
        .attemptLifecycleExecutionFingerprint,
    ]);
    const result = createLoadOrganizationVerificationStateFoundInternal({
      applicationExecution: execution,
      streamIdentity: request.streamIdentity,
      persistenceStreamVersion: loaded.stream.streamVersion,
      evidenceStreamFingerprint: loaded.stream.evidenceStreamFingerprint,
      replayExecution: replay.execution,
      currentWorkflowExecution: replay.execution.reconstructedWorkflowExecution,
      currentLifecycleExecution:
        replay.execution.reconstructedAttemptLifecycleExecution,
      terminalCoordinationReached:
        replay.execution.diagnostics.terminalCoordinationReached,
      diagnostics: {
        totalEvidenceEntriesConsumed:
          replay.execution.diagnostics.totalEvidenceEntriesConsumed,
        totalWorkflowStepsReconstructed:
          replay.execution.diagnostics.totalWorkflowStepsReconstructed,
        fullStreamConsumed: true,
      },
    });
    return result ??
      rejectState(request, applicationFailureInternal("current_state_integrity_failure"));
  }

  async function replayOrganizationVerificationHistory(
    request: ReplayOrganizationVerificationHistoryRequest,
  ): Promise<ReplayOrganizationVerificationHistoryResult> {
    if (!isReplayOrganizationVerificationHistoryRequest(request)) {
      return rejectHistory(request, applicationFailureInternal("unauthentic_application_request"));
    }
    let loaded;
    try {
      loaded = await dependencies.evidenceRepository.loadOrganizationVerificationEvidenceStream({
        streamIdentity: request.streamIdentity,
      });
    } catch {
      return rejectHistory(request, applicationFailureInternal("current_state_integrity_failure"));
    }
    if (loaded.status === "not_found") {
      const execution = applicationExecution(request, "history_not_found", [
        request.streamIdentity.streamIdentityFingerprint,
      ]);
      const result = createApplicationNotFoundResultInternal(
        "history_not_found",
        execution,
        request.streamIdentity,
      );
      if (result?.outcome !== "history_not_found") {
        return rejectHistory(request, applicationFailureInternal("application_integrity_failure"));
      }
      return result;
    }
    const replay = executeReplay(dependencies, loaded.stream, request.replay);
    if (!replay.ok) return rejectHistory(request, replay.failure);
    const execution = applicationExecution(request, "history_replayed", [
      replay.execution.replayRequestFingerprint,
      replay.execution.replayFingerprint,
      replay.execution.sourceEvidenceStreamFingerprint,
    ]);
    const result = createReplayOrganizationVerificationHistorySuccessInternal({
      applicationExecution: execution,
      streamIdentity: request.streamIdentity,
      persistenceStreamVersion: loaded.stream.streamVersion,
      evidenceStreamFingerprint: loaded.stream.evidenceStreamFingerprint,
      replayExecution: replay.execution,
      authorityResultBindings: replay.execution.authorityResultBindings,
      workflowStepRecordBindings: replay.execution.workflowStepRecordBindings,
      diagnostics: replay.execution.diagnostics,
      fullStreamConsumed: true,
    });
    return result ??
      rejectHistory(request, applicationFailureInternal("current_state_integrity_failure"));
  }

  return Object.freeze({
    startOrganizationVerification,
    advanceOrganizationVerificationWorkflow,
    loadOrganizationVerificationState,
    replayOrganizationVerificationHistory,
  });
}
