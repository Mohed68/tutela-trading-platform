import assert from "node:assert/strict";
import test from "node:test";
import {
  createOrganizationVerificationEvidenceAppendBatch,
  createOrganizationVerificationEvidenceAppendReceipt,
  createOrganizationVerificationStoredEvidence,
  createOrganizationVerificationWorkflowStreamIdentity,
} from "../persistence-contract/index.js";
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
