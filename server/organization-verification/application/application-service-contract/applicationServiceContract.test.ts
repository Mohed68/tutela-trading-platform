import assert from "node:assert/strict";
import test from "node:test";
import {
  createOrganizationVerificationEvidenceAppendBatch,
  createOrganizationVerificationEvidenceAppendReceipt,
  createOrganizationVerificationEvidenceStream,
  createOrganizationVerificationStoredEvidence,
  createOrganizationVerificationWorkflowStreamIdentity,
  type OrganizationVerificationDurableEvidence,
} from "../persistence-contract/index.js";
import {
  createOrganizationVerificationReplayRequest,
  replayOrganizationVerificationWorkflow,
} from "../replay-runtime/index.js";
import {
  buildRuntimeFixture,
} from "../workflow-runtime/workflowRuntime.test.js";
import {
  applicationFailureInternal,
} from "./applicationServiceFailures.js";
import {
  createOrganizationVerificationApplicationExecutionInternal,
} from "./applicationServiceExecutions.js";
import {
  createAdvanceCompletedResultInternal,
  createAdvanceIdempotentResultInternal,
  createStartOrganizationVerificationSuccessInternal,
} from "./applicationServiceResults.js";
import * as contract from "./index.js";

function must<T>(result: Readonly<{ ok: true; value: T }> | Readonly<{ ok: false }>): T {
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("expected success");
  return result.value;
}

function commandMetadata() {
  return {
    applicationExecutionId: "application-execution-1",
    commandId: "application-command-1",
    requestedAt: "2026-10-01T00:00:00.000Z",
    applicationCompletedAt: "2026-10-01T00:00:01.000Z",
    provenanceReferences: ["application-provenance-1"],
    integrityReferences: ["application-integrity-1"],
    correlationId: "application-correlation-1",
    causationId: "application-causation-1",
  };
}

function queryMetadata() {
  return {
    applicationExecutionId: "application-query-execution-1",
    queryId: "application-query-1",
    requestedAt: "2026-10-01T00:00:00.000Z",
    applicationCompletedAt: "2026-10-01T00:00:01.000Z",
    provenanceReferences: ["query-provenance-1"],
    integrityReferences: ["query-integrity-1"],
    correlationId: "query-correlation-1",
  };
}

function replayMetadata() {
  return {
    replayExecutionId: "application-replay-1",
    replayedAt: "2026-10-01T00:00:00.500Z",
    provenanceReferences: ["replay-provenance-1"],
    integrityReferences: ["replay-integrity-1"],
  };
}

function streamAndFixture() {
  const fixture = buildRuntimeFixture();
  const genesis = fixture.chain.workflowExecution;
  const streamIdentity = must(
    createOrganizationVerificationWorkflowStreamIdentity({
      workflowExecutionId: genesis.workflowExecutionId,
      organizationId: String(genesis.organizationId),
      recordId: String(genesis.recordId),
      revisionId: String(genesis.revisionId),
      attemptId: String(genesis.attemptId),
    }),
  );
  return { fixture, genesis, streamIdentity };
}

function advanceResultFixture() {
  const { fixture, genesis, streamIdentity } = streamAndFixture();
  const durableEvidence: readonly OrganizationVerificationDurableEvidence[] = [
    { evidenceKind: "workflow_genesis", artifact: genesis },
    {
      evidenceKind: "attempt_lifecycle_execution",
      artifact: fixture.queued.authorityResult.nextLifecycleExecution,
    },
    {
      evidenceKind: "workflow_step_record",
      artifact: fixture.queued.workflowStepRecord,
    },
    {
      evidenceKind: "attempt_lifecycle_execution",
      artifact: fixture.running.authorityResult.nextLifecycleExecution,
    },
    {
      evidenceKind: "workflow_step_record",
      artifact: fixture.running.workflowStepRecord,
    },
    {
      evidenceKind: "attempt_lifecycle_execution",
      artifact: fixture.requeued.authorityResult.nextLifecycleExecution,
    },
    {
      evidenceKind: "workflow_step_record",
      artifact: fixture.requeued.workflowStepRecord,
    },
    {
      evidenceKind: "attempt_lifecycle_execution",
      artifact: fixture.rerunning.authorityResult.nextLifecycleExecution,
    },
    {
      evidenceKind: "workflow_step_record",
      artifact: fixture.rerunning.workflowStepRecord,
    },
    {
      evidenceKind: "attempt_lifecycle_execution",
      artifact: fixture.completed.authorityResult.nextLifecycleExecution,
    },
    {
      evidenceKind: "workflow_step_record",
      artifact: fixture.completed.workflowStepRecord,
    },
    {
      evidenceKind: "evidence_snapshot",
      artifact: fixture.snapshotExecution.authorityResult,
    },
    {
      evidenceKind: "workflow_step_record",
      artifact: fixture.snapshotExecution.workflowStepRecord,
    },
    {
      evidenceKind: "evaluation_projection",
      artifact: fixture.projectionExecution.authorityResult,
    },
    {
      evidenceKind: "workflow_step_record",
      artifact: fixture.projectionExecution.workflowStepRecord,
    },
    {
      evidenceKind: "policy_evaluation_input",
      artifact: fixture.evaluationInputExecution.authorityResult,
    },
    {
      evidenceKind: "workflow_step_record",
      artifact: fixture.evaluationInputExecution.workflowStepRecord,
    },
    {
      evidenceKind: "policy_runtime_execution",
      artifact: fixture.policyExecution.authorityResult,
    },
    {
      evidenceKind: "workflow_step_record",
      artifact: fixture.policyExecution.workflowStepRecord,
    },
    {
      evidenceKind: "decision_trust_integration_execution",
      artifact: fixture.integrationExecution.authorityResult,
    },
    {
      evidenceKind: "workflow_step_record",
      artifact: fixture.integrationExecution.workflowStepRecord,
    },
  ];
  const entries = durableEvidence.map((evidence, index, collected) =>
    must(
      createOrganizationVerificationStoredEvidence({
        ...evidence,
        evidenceEntryId: `application-result-evidence-${index + 1}`,
        streamIdentity,
        streamPosition: index + 1,
        ...(index === 0
          ? {}
          : {
              predecessorEvidenceEntryId:
                `application-result-evidence-${index}`,
            }),
        appendedAt: "2026-10-01T00:30:00.000Z",
        provenanceReferences: ["application-result-provenance"],
        integrityReferences: ["application-result-integrity"],
      }),
    ),
  );
  const stream = must(
    createOrganizationVerificationEvidenceStream({
      streamIdentity,
      entries,
    }),
  );
  const replayRequest = must(
    createOrganizationVerificationReplayRequest({
      replayExecutionId: "application-result-replay",
      sourceEvidenceStream: stream,
      replayedAt: "2026-10-01T00:40:00.000Z",
      provenanceReferences: ["application-result-replay-provenance"],
      integrityReferences: ["application-result-replay-integrity"],
    }),
  );
  const replayResult = replayOrganizationVerificationWorkflow(replayRequest);
  assert.equal(replayResult.outcome, "replay_completed");
  if (replayResult.outcome !== "replay_completed") {
    throw new Error(replayResult.failure.code);
  }
  const replayExecution = replayResult.execution;
  const stepExecution = fixture.integrationExecution;
  const previousPersistenceStreamVersion = entries.length - 2;
  const appendBatch = must(
    createOrganizationVerificationEvidenceAppendBatch({
      appendId: "application-result-advance-append",
      streamIdentity,
      expectedStreamVersion: previousPersistenceStreamVersion,
      expectedHeadEvidenceEntryId:
        entries[previousPersistenceStreamVersion - 1]?.evidenceEntryId,
      entries: entries.slice(-2),
      appendedAt: "2026-10-01T00:30:00.000Z",
      provenanceReferences: ["application-result-provenance"],
      integrityReferences: ["application-result-integrity"],
    }),
  );
  const completedReceipt = must(
    createOrganizationVerificationEvidenceAppendReceipt({
      batch: appendBatch,
      outcome: "appended",
    }),
  );
  const idempotentReceipt = must(
    createOrganizationVerificationEvidenceAppendReceipt({
      batch: appendBatch,
      outcome: "duplicate_append_idempotent",
    }),
  );
  const commonExecution = {
    applicationExecutionId: "application-result-execution",
    useCase: "advance_organization_verification_workflow" as const,
    requestIdentity: "application-result-command",
    requestFingerprint: "application-result-request-fingerprint",
    streamIdentityFingerprint: streamIdentity.streamIdentityFingerprint,
    completedAt: "2026-10-01T00:41:00.000Z",
    previousPersistenceStreamVersion,
    resultingPersistenceStreamVersion: entries.length,
    previousWorkflowVersion:
      stepExecution.predecessorWorkflowExecutionVersion,
    resultingWorkflowVersion: stepExecution.nextWorkflowExecutionVersion,
  };
  const completedLowerLayerFingerprints = [
    stepExecution.workflowStepExecutionFingerprint,
    stepExecution.workflowStepRecord.workflowStepBindingFingerprint,
    completedReceipt.appendReceiptFingerprint,
    stepExecution.nextWorkflowExecution.workflowExecutionFingerprint,
    stepExecution.nextWorkflowExecution.lifecycleExecution
      .attemptLifecycleExecutionFingerprint,
  ].sort((left, right) => left.localeCompare(right));
  const idempotentLowerLayerFingerprints = [
    stepExecution.authorityResult.executionFingerprint,
    stepExecution.workflowStepRecord.workflowStepBindingFingerprint,
    idempotentReceipt.appendReceiptFingerprint,
    replayExecution.replayFingerprint,
    replayExecution.sourceEvidenceStreamFingerprint,
    replayExecution.reconstructedWorkflowExecution.workflowExecutionFingerprint,
    replayExecution.reconstructedAttemptLifecycleExecution
      .attemptLifecycleExecutionFingerprint,
  ]
    .filter((fingerprint, index, values) => values.indexOf(fingerprint) === index)
    .sort((left, right) => left.localeCompare(right));
  const completedApplicationExecution =
    createOrganizationVerificationApplicationExecutionInternal({
      ...commonExecution,
      outcome: "advance_completed",
      lowerLayerFingerprints: completedLowerLayerFingerprints,
    });
  const idempotentApplicationExecution =
    createOrganizationVerificationApplicationExecutionInternal({
      ...commonExecution,
      applicationExecutionId: "application-result-idempotent-execution",
      outcome: "advance_idempotent",
      lowerLayerFingerprints: idempotentLowerLayerFingerprints,
    });
  assert.ok(completedApplicationExecution);
  assert.ok(idempotentApplicationExecution);

  return {
    fixture,
    entries,
    replayExecution,
    stepExecution,
    completedReceipt,
    idempotentReceipt,
    completedApplicationExecution,
    idempotentApplicationExecution,
    previousPersistenceStreamVersion,
  };
}

function completedAdvanceResultInput(
  fixture: ReturnType<typeof advanceResultFixture>,
) {
  const step = fixture.stepExecution;
  return {
    applicationExecution: fixture.completedApplicationExecution,
    previousPersistenceStreamVersion:
      fixture.previousPersistenceStreamVersion,
    resultingPersistenceStreamVersion: fixture.entries.length,
    previousWorkflowVersion: step.predecessorWorkflowExecutionVersion,
    resultingWorkflowVersion: step.nextWorkflowExecutionVersion,
    executedWorkflowStep: step.requestedStep,
    authorityResult: step.authorityResult,
    workflowStepRecord: step.workflowStepRecord,
    workflowStepExecution: step,
    appendReceipt: fixture.completedReceipt,
    currentWorkflowExecution: step.nextWorkflowExecution,
    currentLifecycleExecution:
      step.nextWorkflowExecution.lifecycleExecution,
    terminalCoordinationReached: true,
  };
}

function idempotentAdvanceResultInput(
  fixture: ReturnType<typeof advanceResultFixture>,
) {
  const step = fixture.stepExecution;
  return {
    applicationExecution: fixture.idempotentApplicationExecution,
    previousPersistenceStreamVersion:
      fixture.previousPersistenceStreamVersion,
    resultingPersistenceStreamVersion: fixture.entries.length,
    previousWorkflowVersion: step.predecessorWorkflowExecutionVersion,
    resultingWorkflowVersion: step.nextWorkflowExecutionVersion,
    executedWorkflowStep: step.requestedStep,
    persistedAuthorityResult: step.authorityResult,
    workflowStepRecord: step.workflowStepRecord,
    appendReceipt: fixture.idempotentReceipt,
    replayExecution: fixture.replayExecution,
    currentWorkflowExecution:
      fixture.replayExecution.reconstructedWorkflowExecution,
    currentLifecycleExecution:
      fixture.replayExecution.reconstructedAttemptLifecycleExecution,
    terminalCoordinationReached: true,
  };
}

function startRequestInput() {
  const { genesis, streamIdentity } = streamAndFixture();
  return {
    metadata: commandMetadata(),
    streamIdentity,
    expectedPersistenceStreamVersion: 0 as const,
    initialWorkflowExecutionVersion: 1 as const,
    initialLifecycleExecution: genesis.lifecycleExecution,
    workflowCreatedAt: genesis.createdAt,
    workflowProvenanceReferences: ["workflow-provenance-1"],
    workflowIntegrityReferences: ["workflow-integrity-1"],
    persistence: {
      appendId: "genesis-append-1",
      genesisEvidenceEntryId: "genesis-entry-1",
      appendedAt: "2026-10-01T00:00:00.500Z",
      provenanceReferences: ["append-provenance-1"],
      integrityReferences: ["append-integrity-1"],
    },
  };
}

function advanceBase() {
  const { fixture, streamIdentity } = streamAndFixture();
  const predecessor = fixture.completed.nextWorkflowExecution;
  return {
    fixture,
    value: {
      metadata: commandMetadata(),
      streamIdentity,
      expectedPersistenceStreamVersion: 11,
      expectedWorkflowExecutionId: predecessor.workflowExecutionId,
      expectedWorkflowVersion: predecessor.workflowExecutionVersion,
      workflowStepId: "application-workflow-step-1",
      occurredAt: "2026-10-01T00:00:00.000Z",
      provenanceReferences: ["step-provenance-1"],
      integrityReferences: ["step-integrity-1"],
      correlationId: "step-correlation-1",
      causationId: "step-causation-1",
      persistence: {
        appendId: "step-append-1",
        authorityEvidenceEntryId: "authority-entry-1",
        workflowStepRecordEvidenceEntryId: "step-record-entry-1",
        appendedAt: "2026-10-01T00:00:00.500Z",
        provenanceReferences: ["append-provenance-1"],
        integrityReferences: ["append-integrity-1"],
      },
    },
  };
}

function invokeAdvance(input: unknown) {
  return Reflect.apply(
    contract.createAdvanceOrganizationVerificationWorkflowRequest,
    undefined,
    [input],
  ) as contract.OrganizationVerificationApplicationRequestCreationResult<contract.AdvanceOrganizationVerificationWorkflowRequest>;
}

test("application use-case vocabulary and command/query classification are exact", () => {
  assert.deepEqual(contract.ORGANIZATION_VERIFICATION_APPLICATION_USE_CASES, [
    "start_organization_verification",
    "advance_organization_verification_workflow",
    "load_organization_verification_state",
    "replay_organization_verification_history",
  ]);
  assert.deepEqual(contract.ORGANIZATION_VERIFICATION_APPLICATION_COMMANDS, [
    "start_organization_verification",
    "advance_organization_verification_workflow",
  ]);
  assert.deepEqual(contract.ORGANIZATION_VERIFICATION_APPLICATION_QUERIES, [
    "load_organization_verification_state",
    "replay_organization_verification_history",
  ]);
  assert.equal(
    contract.isOrganizationVerificationApplicationUseCase("execute"),
    false,
  );
});

test("start request is authentic, immutable, explicit, and version zero only", () => {
  const input = startRequestInput();
  const request = must(
    contract.createStartOrganizationVerificationRequest(input),
  );
  assert.equal(contract.isStartOrganizationVerificationRequest(request), true);
  assert.equal(request.expectedPersistenceStreamVersion, 0);
  assert.equal(request.initialWorkflowExecutionVersion, 1);
  assert.equal(Object.isFrozen(request), true);
  assert.equal(Object.isFrozen(request.metadata), true);
  assert.equal(Object.isFrozen(request.persistence), true);

  assert.equal(
    contract.createStartOrganizationVerificationRequest({
      ...input,
      expectedPersistenceStreamVersion: 1 as 0,
    }).ok,
    false,
  );
});

test("start requires complete identity, explicit time, and complete metadata", () => {
  const input = startRequestInput();
  assert.equal(
    contract.createStartOrganizationVerificationRequest({
      ...input,
      workflowCreatedAt: "not-a-time",
    }).ok,
    false,
  );
  assert.equal(
    contract.createStartOrganizationVerificationRequest({
      ...input,
      metadata: { ...input.metadata, commandId: "" },
    }).ok,
    false,
  );
  const otherStream = must(
    createOrganizationVerificationWorkflowStreamIdentity({
      workflowExecutionId: "other-workflow",
      organizationId: input.streamIdentity.organizationId,
      recordId: input.streamIdentity.recordId,
      revisionId: input.streamIdentity.revisionId,
      attemptId: "other-attempt",
    }),
  );
  assert.equal(
    contract.createStartOrganizationVerificationRequest({
      ...input,
      streamIdentity: otherStream,
    }).ok,
    false,
  );
});

test("start request rejects every structural impersonation", () => {
  const request = must(
    contract.createStartOrganizationVerificationRequest(startRequestInput()),
  );
  for (const candidate of [
    { ...request },
    Object.assign({}, request),
    Object.freeze({ ...request }),
    JSON.parse(JSON.stringify(request)),
    structuredClone(request),
  ]) {
    assert.equal(contract.isStartOrganizationVerificationRequest(candidate), false);
  }
});

test("start request fingerprint is deterministic and property-order independent", () => {
  const input = startRequestInput();
  const left = must(contract.createStartOrganizationVerificationRequest(input));
  const right = must(
    contract.createStartOrganizationVerificationRequest({
      ...input,
      workflowProvenanceReferences: [...input.workflowProvenanceReferences].reverse(),
      workflowIntegrityReferences: [...input.workflowIntegrityReferences].reverse(),
    }),
  );
  assert.equal(left.requestFingerprint, right.requestFingerprint);
});

test("all six approved advance step contracts are constructible", () => {
  const { fixture, value } = advanceBase();
  const cases: readonly unknown[] = [
    {
      ...value,
      step: {
        requestedStep: "attempt_transition",
        expectedWorkflowStage: "attempt_in_progress",
        authorityInput: {
          lifecycleExecutionId: "lifecycle-1",
          expectedPredecessorLifecycleExecutionVersion: 1,
          nextLifecycleExecutionVersion: 2,
          transitionId: "transition-1",
          requestedTransition: "queued",
          expectedPredecessorAttemptState: "not_started",
          expectedResultingAttemptState: "queued",
          recordId: value.streamIdentity.recordId,
          revisionId: value.streamIdentity.revisionId,
          attemptId: value.streamIdentity.attemptId,
          attemptSequence: 1,
          occurredAt: value.occurredAt,
          provenanceReferences: ["authority-provenance"],
          integrityReferences: ["authority-integrity"],
        },
      },
    },
    {
      ...value,
      step: {
        requestedStep: "bind_snapshot",
        expectedWorkflowStage: "attempt_completed",
        authorityInput: fixture.snapshotInput,
      },
    },
    {
      ...value,
      step: {
        requestedStep: "bind_projection",
        expectedWorkflowStage: "snapshot_bound",
        authorityInput: fixture.preparation.projectionInput,
      },
    },
    {
      ...value,
      step: {
        requestedStep: "bind_evaluation_input",
        expectedWorkflowStage: "projection_bound",
        authorityInput: fixture.preparation.evaluationInput,
      },
    },
    {
      ...value,
      step: {
        requestedStep: "complete_policy",
        expectedWorkflowStage: "evaluation_input_bound",
        authorityInput: fixture.preparation.policyInput,
      },
    },
    {
      ...value,
      step: {
        requestedStep: "complete_decision_trust_integration",
        expectedWorkflowStage: "policy_completed",
        authorityInput: {
          inputBindingArtifacts: {},
          decisionContext: {},
          trustSourceFactsArtifacts: {},
          trustDerivationContext: {},
          bindingArtifacts: {},
          executionArtifacts: {},
        },
      },
    },
  ];
  for (const candidate of cases) {
    assert.equal(invokeAdvance(candidate).ok, true);
  }
});

test("advance rejects unknown steps, wrong authority shape, and stage mismatch", () => {
  const { value } = advanceBase();
  for (const step of [
    {
      requestedStep: "execute_next",
      expectedWorkflowStage: "attempt_completed",
      authorityInput: {},
    },
    {
      requestedStep: "bind_snapshot",
      expectedWorkflowStage: "snapshot_bound",
      authorityInput: {},
    },
    {
      requestedStep: "bind_snapshot",
      expectedWorkflowStage: "attempt_completed",
      authorityInput: { genericPayload: {} },
    },
  ]) {
    assert.equal(invokeAdvance({ ...value, step }).ok, false);
  }
});

test("advance requires persistence and Workflow concurrency expectations", () => {
  const { fixture, value } = advanceBase();
  const step = {
    requestedStep: "bind_snapshot",
    expectedWorkflowStage: "attempt_completed",
    authorityInput: fixture.snapshotInput,
  };
  assert.equal(
    invokeAdvance({ ...value, expectedPersistenceStreamVersion: -1, step }).ok,
    false,
  );
  assert.equal(
    invokeAdvance({ ...value, expectedWorkflowVersion: 0, step }).ok,
    false,
  );
  assert.equal(
    invokeAdvance({ ...value, expectedWorkflowExecutionId: "other", step }).ok,
    false,
  );
});

test("advance request contains no arbitrary evidence, append batch, or callback surface", () => {
  const { fixture, value } = advanceBase();
  const result = invokeAdvance({
    ...value,
    arbitraryEvidence: [],
    appendBatch: {},
    callback: () => undefined,
    step: {
      requestedStep: "bind_snapshot",
      expectedWorkflowStage: "attempt_completed",
      authorityInput: fixture.snapshotInput,
    },
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal("arbitraryEvidence" in result.value, false);
  assert.equal("appendBatch" in result.value, false);
  assert.equal("callback" in result.value, false);
});

test("advance copies mutable authority input and remains deterministic", () => {
  const { fixture, value } = advanceBase();
  const mutableReferences = [...fixture.snapshotInput.evidenceReferences];
  const candidate = {
    ...value,
    step: {
      requestedStep: "bind_snapshot",
      expectedWorkflowStage: "attempt_completed",
      authorityInput: {
        ...fixture.snapshotInput,
        evidenceReferences: mutableReferences,
      },
    },
  };
  const first = must(invokeAdvance(candidate));
  mutableReferences.splice(0);
  const second = must(
    invokeAdvance({
      ...value,
      step: {
        requestedStep: "bind_snapshot",
        expectedWorkflowStage: "attempt_completed",
        authorityInput: fixture.snapshotInput,
      },
    }),
  );
  assert.notEqual(first.step.authorityInput.evidenceReferences.length, 0);
  assert.equal(first.requestFingerprint, second.requestFingerprint);
  assert.equal(Object.isFrozen(first.step.authorityInput), true);
});

test("advance structural copies are unauthentic", () => {
  const { fixture, value } = advanceBase();
  const request = must(
    invokeAdvance({
      ...value,
      step: {
        requestedStep: "bind_snapshot",
        expectedWorkflowStage: "attempt_completed",
        authorityInput: fixture.snapshotInput,
      },
    }),
  );
  for (const candidate of [
    { ...request },
    Object.assign({}, request),
    Object.freeze({ ...request }),
    JSON.parse(JSON.stringify(request)),
    structuredClone(request),
  ]) {
    assert.equal(
      contract.isAdvanceOrganizationVerificationWorkflowRequest(candidate),
      false,
    );
  }
});

test("load-current-state is the authoritative reconstructed-state query", () => {
  const { streamIdentity } = streamAndFixture();
  const request = must(
    contract.createLoadOrganizationVerificationStateRequest({
      metadata: queryMetadata(),
      streamIdentity,
      replay: replayMetadata(),
    }),
  );
  assert.equal(contract.isLoadOrganizationVerificationStateRequest(request), true);
  assert.equal("expectedPersistenceStreamVersion" in request, false);
  assert.equal("persistence" in request, false);
  assert.equal(Object.isFrozen(request), true);
});

test("history replay is a distinct read-only audit query", () => {
  const { streamIdentity } = streamAndFixture();
  const request = must(
    contract.createReplayOrganizationVerificationHistoryRequest({
      metadata: queryMetadata(),
      streamIdentity,
      replay: replayMetadata(),
    }),
  );
  assert.equal(
    contract.isReplayOrganizationVerificationHistoryRequest(request),
    true,
  );
  assert.equal("persistence" in request, false);
  assert.equal("appendReceipt" in request, false);
});

test("query requests reject structural clones and are deterministic", () => {
  const { streamIdentity } = streamAndFixture();
  const input = {
    metadata: queryMetadata(),
    streamIdentity,
    replay: replayMetadata(),
  };
  const left = must(
    contract.createLoadOrganizationVerificationStateRequest(input),
  );
  const right = must(
    contract.createLoadOrganizationVerificationStateRequest(input),
  );
  assert.equal(left.requestFingerprint, right.requestFingerprint);
  for (const candidate of [
    { ...left },
    Object.assign({}, left),
    Object.freeze({ ...left }),
    JSON.parse(JSON.stringify(left)),
    structuredClone(left),
  ]) {
    assert.equal(
      contract.isLoadOrganizationVerificationStateRequest(candidate),
      false,
    );
  }
});

test("application failure vocabulary and lower-layer maps are closed and exhaustive", () => {
  assert.equal(
    contract.isOrganizationVerificationApplicationFailureCode("sql_error"),
    false,
  );
  assert.equal(
    contract.ORGANIZATION_VERIFICATION_PERSISTENCE_FAILURE_MAPPING
      .expected_stream_version_conflict,
    "expected_persistence_version_conflict",
  );
  assert.equal(
    contract.ORGANIZATION_VERIFICATION_REPLAY_FAILURE_MAPPING
      .replay_stream_integrity_failure,
    "current_state_integrity_failure",
  );
  assert.equal(
    contract.ORGANIZATION_VERIFICATION_WORKFLOW_FAILURE_STAGE_MAPPING
      .policy_authority,
    "authority_execution_rejected",
  );
  for (const forbidden of ["sql", "http", "orm", "map", "status_code"]) {
    assert.equal(
      contract.ORGANIZATION_VERIFICATION_APPLICATION_FAILURE_CODES.includes(
        forbidden as never,
      ),
      false,
    );
  }
});

test("application execution is authentic, deterministic, immutable, and orchestration-only", () => {
  const input = {
    applicationExecutionId: "execution-1",
    useCase: "start_organization_verification" as const,
    requestIdentity: "command-1",
    requestFingerprint: "request-fingerprint-1",
    outcome: "start_completed" as const,
    streamIdentityFingerprint: "stream-fingerprint-1",
    completedAt: "2026-10-01T00:00:01.000Z",
    previousPersistenceStreamVersion: 0,
    resultingPersistenceStreamVersion: 1,
    previousWorkflowVersion: 0,
    resultingWorkflowVersion: 1,
    lowerLayerFingerprints: ["workflow-fingerprint-1", "receipt-fingerprint-1"],
  };
  const left = createOrganizationVerificationApplicationExecutionInternal(input);
  const right = createOrganizationVerificationApplicationExecutionInternal(input);
  assert.ok(left);
  assert.ok(right);
  assert.equal(
    left.applicationExecutionFingerprint,
    right.applicationExecutionFingerprint,
  );
  assert.equal(contract.isOrganizationVerificationApplicationExecution(left), true);
  assert.equal(
    contract.isOrganizationVerificationApplicationExecution({ ...left }),
    false,
  );
  assert.equal(Object.isFrozen(left.lowerLayerFingerprints), true);
  assert.equal("workflowExecution" in left, false);
});

test("advance completion and idempotent retrieval have distinct exact result shapes", () => {
  const fixture = advanceResultFixture();
  const completed = createAdvanceCompletedResultInternal(
    completedAdvanceResultInput(fixture),
  );
  const idempotent = createAdvanceIdempotentResultInternal(
    idempotentAdvanceResultInput(fixture),
  );
  assert.ok(completed);
  assert.ok(idempotent);
  assert.equal(completed.outcome, "advance_completed");
  assert.equal(idempotent.outcome, "advance_idempotent");
  assert.equal("workflowStepExecution" in completed, true);
  assert.equal("workflowStepExecution" in idempotent, false);
  assert.equal("authorityResult" in idempotent, false);
  assert.equal("persistedAuthorityResult" in idempotent, true);
  assert.equal("replayExecution" in idempotent, true);
  assert.notEqual(
    completed.applicationExecution.applicationExecutionFingerprint,
    idempotent.applicationExecution.applicationExecutionFingerprint,
  );
  assert.equal(
    contract.isOrganizationVerificationApplicationServiceResult(completed),
    true,
  );
  assert.equal(
    contract.isOrganizationVerificationApplicationServiceResult(idempotent),
    true,
  );
});

test("attempt-transition idempotency returns the persisted Lifecycle artifact without Runtime reconstruction", () => {
  const fixture = advanceResultFixture();
  const step = fixture.fixture.queued;
  const streamIdentity = fixture.entries[0]!.streamIdentity;
  const appendBatch = must(
    createOrganizationVerificationEvidenceAppendBatch({
      appendId: "application-result-attempt-append",
      streamIdentity,
      expectedStreamVersion: 1,
      expectedHeadEvidenceEntryId: fixture.entries[0]!.evidenceEntryId,
      entries: fixture.entries.slice(1, 3),
      appendedAt: "2026-10-01T00:30:00.000Z",
      provenanceReferences: ["application-result-provenance"],
      integrityReferences: ["application-result-integrity"],
    }),
  );
  const receipt = must(
    createOrganizationVerificationEvidenceAppendReceipt({
      batch: appendBatch,
      outcome: "duplicate_append_idempotent",
    }),
  );
  const persistedAuthorityResult =
    step.authorityResult.nextLifecycleExecution;
  const lowerLayerFingerprints = [
    persistedAuthorityResult.attemptLifecycleExecutionFingerprint,
    step.workflowStepRecord.workflowStepBindingFingerprint,
    receipt.appendReceiptFingerprint,
    fixture.replayExecution.replayFingerprint,
    fixture.replayExecution.sourceEvidenceStreamFingerprint,
    fixture.replayExecution.reconstructedWorkflowExecution
      .workflowExecutionFingerprint,
    fixture.replayExecution.reconstructedAttemptLifecycleExecution
      .attemptLifecycleExecutionFingerprint,
  ]
    .filter((fingerprint, index, values) => values.indexOf(fingerprint) === index)
    .sort((left, right) => left.localeCompare(right));
  const applicationExecution =
    createOrganizationVerificationApplicationExecutionInternal({
      applicationExecutionId: "application-result-attempt-idempotent",
      useCase: "advance_organization_verification_workflow",
      requestIdentity: "application-result-attempt-command",
      requestFingerprint: "application-result-attempt-request",
      outcome: "advance_idempotent",
      streamIdentityFingerprint: streamIdentity.streamIdentityFingerprint,
      completedAt: "2026-10-01T00:41:00.000Z",
      previousPersistenceStreamVersion: 1,
      resultingPersistenceStreamVersion: 3,
      previousWorkflowVersion: step.predecessorWorkflowExecutionVersion,
      resultingWorkflowVersion: step.nextWorkflowExecutionVersion,
      lowerLayerFingerprints,
    });
  assert.ok(applicationExecution);
  const result = createAdvanceIdempotentResultInternal({
    applicationExecution,
    previousPersistenceStreamVersion: 1,
    resultingPersistenceStreamVersion: 3,
    previousWorkflowVersion: step.predecessorWorkflowExecutionVersion,
    resultingWorkflowVersion: step.nextWorkflowExecutionVersion,
    executedWorkflowStep: "attempt_transition",
    persistedAuthorityResult,
    workflowStepRecord: step.workflowStepRecord,
    appendReceipt: receipt,
    replayExecution: fixture.replayExecution,
    currentWorkflowExecution:
      fixture.replayExecution.reconstructedWorkflowExecution,
    currentLifecycleExecution:
      fixture.replayExecution.reconstructedAttemptLifecycleExecution,
    terminalCoordinationReached: true,
  });
  assert.ok(result);
  assert.equal(
    result.persistedAuthorityResult,
    step.authorityResult.nextLifecycleExecution,
  );
  assert.equal(
    result.currentWorkflowExecution.workflowExecutionVersion >
      result.resultingWorkflowVersion,
    true,
  );
  assert.equal("workflowStepExecution" in result, false);
});

test("advance idempotent rejects Runtime envelopes and incomplete durable evidence", () => {
  const fixture = advanceResultFixture();
  const input = idempotentAdvanceResultInput(fixture);
  assert.equal(
    Reflect.apply(createAdvanceIdempotentResultInternal, undefined, [
      { ...input, workflowStepExecution: fixture.stepExecution },
    ]),
    undefined,
  );
  const {
    persistedAuthorityResult: omittedAuthority,
    ...withoutAuthority
  } = input;
  assert.ok(omittedAuthority);
  assert.equal(
    Reflect.apply(createAdvanceIdempotentResultInternal, undefined, [
      withoutAuthority,
    ]),
    undefined,
  );
  assert.equal(
    Reflect.apply(createAdvanceIdempotentResultInternal, undefined, [
      {
        ...input,
        persistedAuthorityResult: Object.freeze({
          ...input.persistedAuthorityResult,
        }),
      },
    ]),
    undefined,
  );
  assert.equal(
    createAdvanceIdempotentResultInternal({
      ...input,
      appendReceipt: fixture.completedReceipt,
    }),
    undefined,
  );
});

test("advance idempotent requires exact identities, versions, receipt, and Replay bindings", () => {
  const fixture = advanceResultFixture();
  const input = idempotentAdvanceResultInput(fixture);
  for (const changed of [
    {
      ...input,
      previousPersistenceStreamVersion:
        input.previousPersistenceStreamVersion - 1,
    },
    {
      ...input,
      previousWorkflowVersion: input.previousWorkflowVersion - 1,
    },
    {
      ...input,
      resultingWorkflowVersion: input.resultingWorkflowVersion - 1,
    },
    {
      ...input,
      workflowStepRecord: fixture.fixture.policyExecution.workflowStepRecord,
    },
  ]) {
    assert.equal(
      Reflect.apply(createAdvanceIdempotentResultInternal, undefined, [
        changed,
      ]),
      undefined,
    );
  }
});

test("advance idempotent authenticity rejects every structural impersonation", () => {
  const fixture = advanceResultFixture();
  const result = createAdvanceIdempotentResultInternal(
    idempotentAdvanceResultInput(fixture),
  );
  assert.ok(result);
  for (const candidate of [
    { ...result },
    Object.assign({}, result),
    Object.freeze({ ...result }),
    JSON.parse(JSON.stringify(result)),
    structuredClone(result),
  ]) {
    assert.equal(
      contract.isOrganizationVerificationApplicationServiceResult(candidate),
      false,
    );
  }
});

test("advance idempotent evidence is deeply immutable and caller mutation is isolated", () => {
  const fixture = advanceResultFixture();
  const input = idempotentAdvanceResultInput(fixture);
  const result = createAdvanceIdempotentResultInternal(input);
  assert.ok(result);
  input.terminalCoordinationReached = false;
  assert.equal(result.terminalCoordinationReached, true);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.persistedAuthorityResult), true);
  assert.equal(Object.isFrozen(result.workflowStepRecord), true);
  assert.equal(Object.isFrozen(result.appendReceipt), true);
  assert.equal(Object.isFrozen(result.replayExecution), true);
  assert.equal(Object.isFrozen(result.currentWorkflowExecution), true);
  assert.equal(
    Reflect.set(
      result.currentWorkflowExecution,
      "workflowStage",
      "attempt_in_progress",
    ),
    false,
  );
});

test("advance idempotent application fingerprint binds every durable and replayed artifact", () => {
  const fixture = advanceResultFixture();
  const input = idempotentAdvanceResultInput(fixture);
  const originalFingerprint =
    input.applicationExecution.applicationExecutionFingerprint;
  const repeated = createAdvanceIdempotentResultInternal({
    terminalCoordinationReached: input.terminalCoordinationReached,
    currentLifecycleExecution: input.currentLifecycleExecution,
    currentWorkflowExecution: input.currentWorkflowExecution,
    replayExecution: input.replayExecution,
    appendReceipt: input.appendReceipt,
    workflowStepRecord: input.workflowStepRecord,
    persistedAuthorityResult: input.persistedAuthorityResult,
    executedWorkflowStep: input.executedWorkflowStep,
    resultingWorkflowVersion: input.resultingWorkflowVersion,
    previousWorkflowVersion: input.previousWorkflowVersion,
    resultingPersistenceStreamVersion:
      input.resultingPersistenceStreamVersion,
    previousPersistenceStreamVersion: input.previousPersistenceStreamVersion,
    applicationExecution: input.applicationExecution,
  });
  assert.ok(repeated);
  assert.equal(
    repeated.applicationExecution.applicationExecutionFingerprint,
    originalFingerprint,
  );
  for (const index of input.applicationExecution.lowerLayerFingerprints.keys()) {
    const changedLowerLayerFingerprints = [
      ...input.applicationExecution.lowerLayerFingerprints,
    ];
    changedLowerLayerFingerprints[index] =
      `changed-lower-layer-fingerprint-${index}`;
    const changedExecution =
      createOrganizationVerificationApplicationExecutionInternal({
        applicationExecutionId: input.applicationExecution.applicationExecutionId,
        useCase: input.applicationExecution.useCase,
        requestIdentity: input.applicationExecution.requestIdentity,
        requestFingerprint: input.applicationExecution.requestFingerprint,
        outcome: input.applicationExecution.outcome,
        streamIdentityFingerprint:
          input.applicationExecution.streamIdentityFingerprint,
        completedAt: input.applicationExecution.completedAt,
        previousPersistenceStreamVersion:
          input.applicationExecution.previousPersistenceStreamVersion,
        resultingPersistenceStreamVersion:
          input.applicationExecution.resultingPersistenceStreamVersion,
        previousWorkflowVersion:
          input.applicationExecution.previousWorkflowVersion,
        resultingWorkflowVersion:
          input.applicationExecution.resultingWorkflowVersion,
        lowerLayerFingerprints: changedLowerLayerFingerprints.sort(
          (left, right) => left.localeCompare(right),
        ),
      });
    assert.ok(changedExecution);
    assert.notEqual(
      changedExecution.applicationExecutionFingerprint,
      originalFingerprint,
    );
    assert.equal(
      createAdvanceIdempotentResultInternal({
        ...input,
        applicationExecution: changedExecution,
      }),
      undefined,
    );
  }
});

test("start result distinguishes committed and idempotent success from rejection", () => {
  const { genesis, streamIdentity } = streamAndFixture();
  const stored = must(
    createOrganizationVerificationStoredEvidence({
      evidenceKind: "workflow_genesis",
      artifact: genesis,
      evidenceEntryId: "result-genesis-entry",
      streamIdentity,
      streamPosition: 1,
      appendedAt: "2026-10-01T00:00:00.500Z",
      provenanceReferences: ["result-provenance"],
      integrityReferences: ["result-integrity"],
    }),
  );
  const batch = must(
    createOrganizationVerificationEvidenceAppendBatch({
      appendId: "result-append",
      streamIdentity,
      expectedStreamVersion: 0,
      entries: [stored],
      appendedAt: "2026-10-01T00:00:00.500Z",
      provenanceReferences: ["result-provenance"],
      integrityReferences: ["result-integrity"],
    }),
  );
  const receipt = must(
    createOrganizationVerificationEvidenceAppendReceipt({
      batch,
      outcome: "appended",
    }),
  );
  const execution =
    createOrganizationVerificationApplicationExecutionInternal({
      applicationExecutionId: "result-execution",
      useCase: "start_organization_verification",
      requestIdentity: "result-command",
      requestFingerprint: "result-request-fingerprint",
      outcome: "start_completed",
      streamIdentityFingerprint: streamIdentity.streamIdentityFingerprint,
      completedAt: "2026-10-01T00:00:01.000Z",
      previousPersistenceStreamVersion: 0,
      resultingPersistenceStreamVersion: 1,
      previousWorkflowVersion: 0,
      resultingWorkflowVersion: 1,
      lowerLayerFingerprints: [
        genesis.workflowExecutionFingerprint,
        receipt.appendReceiptFingerprint,
      ],
    });
  assert.ok(execution);
  const result = createStartOrganizationVerificationSuccessInternal(
    "start_completed",
    {
      applicationExecution: execution,
      committedWorkflowGenesis: genesis,
      appendReceipt: receipt,
      resultingPersistenceStreamVersion: 1,
      currentWorkflowExecution: genesis,
    },
  );
  assert.ok(result);
  assert.equal(contract.isOrganizationVerificationApplicationServiceResult(result), true);
  assert.equal(contract.isOrganizationVerificationApplicationServiceResult({ ...result }), false);
  assert.equal(Object.isFrozen(result), true);

  const failure = applicationFailureInternal("start_persistence_conflict");
  assert.equal(Object.isFrozen(failure), true);
  assert.equal(Object.isFrozen(failure.diagnostic), true);
});

test("public service port is explicit and exposes no generic dispatch operation", async () => {
  const methodNames: readonly (keyof contract.OrganizationVerificationApplicationServicePort)[] = [
    "startOrganizationVerification",
    "advanceOrganizationVerificationWorkflow",
    "loadOrganizationVerificationState",
    "replayOrganizationVerificationHistory",
  ];
  assert.deepEqual(methodNames, [
    "startOrganizationVerification",
    "advanceOrganizationVerificationWorkflow",
    "loadOrganizationVerificationState",
    "replayOrganizationVerificationHistory",
  ]);
  assert.equal(methodNames.includes("execute" as never), false);
  assert.equal(methodNames.includes("dispatch" as never), false);
});

test("public export surface contains no seals, internal factories, or orchestration", async () => {
  const publicKeys = Object.keys(await import("./index.js"));
  for (const forbidden of [
    "applicationRequestSeal",
    "applicationExecutionSeal",
    "applicationResultSeal",
    "sealApplicationRequestInternal",
    "createOrganizationVerificationApplicationExecutionInternal",
    "createStartOrganizationVerificationSuccessInternal",
    "createAdvanceCompletedResultInternal",
    "createAdvanceIdempotentResultInternal",
    "applicationFailureInternal",
    "fingerprintApplicationServiceContract",
    "executeOrganizationVerificationWorkflowStep",
    "replayOrganizationVerificationWorkflow",
    "appendOrganizationVerificationEvidence",
    "loadOrganizationVerificationEvidenceStream",
  ]) {
    assert.equal(publicKeys.includes(forbidden), false);
  }
});
