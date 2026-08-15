import assert from "node:assert/strict";
import test from "node:test";
import {
  createAdvanceOrganizationVerificationWorkflowRequest,
  createLoadOrganizationVerificationStateRequest,
  createReplayOrganizationVerificationHistoryRequest,
  createStartOrganizationVerificationRequest,
  isOrganizationVerificationApplicationServiceResult,
  type AdvanceOrganizationVerificationWorkflowRequest,
  type OrganizationVerificationApplicationServiceDependencies,
  type OrganizationVerificationApplicationServicePort,
  type StartOrganizationVerificationRequest,
} from "../application-service-contract/index.js";
import {
  createOrganizationVerificationWorkflowStreamIdentity,
  organizationVerificationEvidenceStreamNotFound,
} from "../persistence-contract/index.js";
import {
  createOrganizationVerificationReplayRequest,
  replayOrganizationVerificationWorkflow,
} from "../replay-runtime/index.js";
import {
  executeOrganizationVerificationWorkflowStep,
} from "../workflow-runtime/index.js";
import { buildRuntimeFixture } from "../workflow-runtime/workflowRuntime.test.js";
import { createInMemoryOrganizationVerificationEvidenceRepository } from "../../infrastructure/persistence/in-memory/index.js";
import { createOrganizationVerificationApplicationService } from "./index.js";

function must<T>(result: Readonly<{ ok: true; value: T }> | Readonly<{ ok: false }>): T {
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("expected success");
  return result.value;
}

export function buildRequests() {
  const fixture = buildRuntimeFixture();
  const initial = fixture.chain.workflowExecution;
  const streamIdentity = must(
    createOrganizationVerificationWorkflowStreamIdentity({
      organizationId: initial.organizationId,
      recordId: initial.recordId,
      revisionId: initial.revisionId,
      attemptId: initial.attemptId,
      workflowExecutionId: initial.workflowExecutionId,
    }),
  );
  const start = must(
    createStartOrganizationVerificationRequest({
      metadata: {
        applicationExecutionId: "application-service-start-execution-1",
        commandId: "application-service-start-command-1",
        requestedAt: "2026-09-01T00:01:50.000Z",
        applicationCompletedAt: "2026-09-01T00:02:03.000Z",
        provenanceReferences: ["application-service-start-provenance"],
        integrityReferences: ["application-service-start-integrity"],
        correlationId: "application-service-start-correlation",
        causationId: "application-service-start-causation",
      },
      streamIdentity,
      expectedPersistenceStreamVersion: 0,
      initialWorkflowExecutionVersion: 1,
      initialLifecycleExecution: initial.lifecycleExecution,
      workflowCreatedAt: initial.createdAt,
      workflowProvenanceReferences: initial.provenanceReferences,
      workflowIntegrityReferences: initial.integrityReferences,
      persistence: {
        appendId: "application-service-start-append-1",
        genesisEvidenceEntryId: "application-service-genesis-evidence-1",
        appendedAt: "2026-09-01T00:02:01.000Z",
        provenanceReferences: ["application-service-start-append-provenance"],
        integrityReferences: ["application-service-start-append-integrity"],
      },
      authoritativeReplay: {
        replayRequestId: "application-service-start-replay-request-1",
        replayExecutionId: "application-service-start-replay-execution-1",
        replayedAt: "2026-09-01T00:02:02.000Z",
        provenanceReferences: ["application-service-start-replay-provenance"],
        integrityReferences: ["application-service-start-replay-integrity"],
      },
    }),
  );
  const lifecycle = initial.lifecycleExecution;
  const advance = must(
    createAdvanceOrganizationVerificationWorkflowRequest({
      metadata: {
        applicationExecutionId: "application-service-advance-execution-1",
        commandId: "application-service-advance-command-1",
        requestedAt: "2026-09-01T00:02:04.000Z",
        applicationCompletedAt: "2026-09-01T00:02:13.000Z",
        provenanceReferences: ["application-service-advance-provenance"],
        integrityReferences: ["application-service-advance-integrity"],
        correlationId: "application-service-advance-correlation",
        causationId: "application-service-advance-causation",
      },
      streamIdentity,
      expectedPersistenceStreamVersion: 1,
      expectedWorkflowExecutionId: initial.workflowExecutionId,
      expectedWorkflowVersion: 1,
      workflowStepId: "application-service-workflow-step-queued-1",
      occurredAt: "2026-09-01T00:02:10.000Z",
      provenanceReferences: ["application-service-step-provenance"],
      integrityReferences: ["application-service-step-integrity"],
      correlationId: "application-service-step-correlation",
      causationId: "application-service-step-causation",
      reasonReference: "application-service-step-reason",
      persistence: {
        appendId: "application-service-advance-append-1",
        authorityEvidenceEntryId: "application-service-authority-evidence-1",
        workflowStepRecordEvidenceEntryId: "application-service-step-evidence-1",
        appendedAt: "2026-09-01T00:02:11.000Z",
        provenanceReferences: ["application-service-advance-append-provenance"],
        integrityReferences: ["application-service-advance-append-integrity"],
      },
      preExecutionReplay: {
        replayRequestId: "application-service-pre-replay-request-1",
        replayExecutionId: "application-service-pre-replay-execution-1",
        replayedAt: "2026-09-01T00:02:05.000Z",
        provenanceReferences: ["application-service-pre-replay-provenance"],
        integrityReferences: ["application-service-pre-replay-integrity"],
      },
      authoritativeReplay: {
        replayRequestId: "application-service-post-replay-request-1",
        replayExecutionId: "application-service-post-replay-execution-1",
        replayedAt: "2026-09-01T00:02:12.000Z",
        provenanceReferences: ["application-service-post-replay-provenance"],
        integrityReferences: ["application-service-post-replay-integrity"],
      },
      step: {
        requestedStep: "attempt_transition",
        expectedWorkflowStage: "attempt_in_progress",
        authorityInput: {
          lifecycleExecutionId: lifecycle.lifecycleExecutionId,
          expectedPredecessorLifecycleExecutionVersion:
            lifecycle.lifecycleExecutionVersion,
          nextLifecycleExecutionVersion: lifecycle.lifecycleExecutionVersion + 1,
          transitionId: "application-service-transition-queued-1",
          requestedTransition: "queued",
          expectedPredecessorAttemptState: lifecycle.attempt.processState,
          expectedResultingAttemptState: "queued",
          recordId: lifecycle.recordId,
          revisionId: lifecycle.revisionId,
          attemptId: lifecycle.attemptId,
          attemptSequence: lifecycle.attemptSequence,
          occurredAt: "2026-09-01T00:02:10.000Z",
          provenanceReferences: ["application-service-transition-provenance"],
          integrityReferences: ["application-service-transition-integrity"],
        },
      },
    }),
  );
  return { fixture, streamIdentity, start, advance };
}

interface Counters {
  appends: number;
  loads: number;
  replays: number;
  runtimes: number;
  authorities: number;
}

function harness(): Readonly<{
  service: OrganizationVerificationApplicationServicePort;
  dependencies: OrganizationVerificationApplicationServiceDependencies;
  counters: Counters;
}> {
  const repository = createInMemoryOrganizationVerificationEvidenceRepository();
  const counters: Counters = {
    appends: 0,
    loads: 0,
    replays: 0,
    runtimes: 0,
    authorities: 0,
  };
  const dependencies: OrganizationVerificationApplicationServiceDependencies = {
    evidenceRepository: {
      async appendOrganizationVerificationEvidence(request) {
        counters.appends += 1;
        return repository.appendOrganizationVerificationEvidence(request);
      },
      async loadOrganizationVerificationEvidenceStream(request) {
        counters.loads += 1;
        return repository.loadOrganizationVerificationEvidenceStream(request);
      },
    },
    replayRuntime: {
      replayHistory(request) {
        counters.replays += 1;
        return replayOrganizationVerificationWorkflow(request);
      },
    },
    workflowRuntime: {
      executeOneWorkflowStep(request) {
        counters.runtimes += 1;
        counters.authorities += 1;
        return executeOrganizationVerificationWorkflowStep(request);
      },
    },
  };
  return Object.freeze({
    service: createOrganizationVerificationApplicationService(dependencies),
    dependencies,
    counters,
  });
}

function reset(counters: Counters): void {
  counters.appends = 0;
  counters.loads = 0;
  counters.replays = 0;
  counters.runtimes = 0;
  counters.authorities = 0;
}

test("factory exposes exactly four frozen operations with no singleton state", () => {
  const first = harness().service;
  const second = harness().service;
  assert.notEqual(first, second);
  assert.equal(Object.isFrozen(first), true);
  assert.deepEqual(Object.keys(first).sort(), [
    "advanceOrganizationVerificationWorkflow",
    "loadOrganizationVerificationState",
    "replayOrganizationVerificationHistory",
    "startOrganizationVerification",
  ]);
});

test("Start appends genesis once, reloads, and returns Replay-authoritative state", async () => {
  const requests = buildRequests();
  const runtime = harness();
  const result = await runtime.service.startOrganizationVerification(requests.start);
  assert.equal(result.outcome, "start_completed");
  assert.equal(isOrganizationVerificationApplicationServiceResult(result), true);
  if (result.outcome !== "start_completed") return;
  assert.equal(runtime.counters.appends, 1);
  assert.equal(runtime.counters.loads, 1);
  assert.equal(runtime.counters.replays, 1);
  assert.equal(runtime.counters.runtimes, 0);
  assert.equal(runtime.counters.authorities, 0);
  assert.equal(
    result.currentWorkflowExecution,
    result.replayExecution.reconstructedWorkflowExecution,
  );
  assert.equal(
    result.currentWorkflowExecution.workflowExecutionFingerprint,
    result.committedWorkflowGenesis.workflowExecutionFingerprint,
  );
});

test("exact duplicate Start is proven by Persistence and remains Replay-authoritative", async () => {
  const requests = buildRequests();
  const runtime = harness();
  assert.equal(
    (await runtime.service.startOrganizationVerification(requests.start)).outcome,
    "start_completed",
  );
  reset(runtime.counters);
  const duplicate = await runtime.service.startOrganizationVerification(requests.start);
  assert.equal(duplicate.outcome, "start_idempotent");
  assert.deepEqual(runtime.counters, {
    appends: 1,
    loads: 1,
    replays: 1,
    runtimes: 0,
    authorities: 0,
  });
});

test("Start maps persistence conflicts and Replay failures without extra writes", async () => {
  const requests = buildRequests();
  const runtime = harness();
  await runtime.service.startOrganizationVerification(requests.start);
  const competing = must(
    createStartOrganizationVerificationRequest({
      ...requests.start,
      metadata: {
        ...requests.start.metadata,
        applicationExecutionId: "application-service-competing-start-execution",
        commandId: "application-service-competing-start-command",
      },
      persistence: {
        ...requests.start.persistence,
        appendId: "application-service-competing-start-append",
        genesisEvidenceEntryId: "application-service-competing-genesis",
      },
      authoritativeReplay: {
        ...requests.start.authoritativeReplay,
        replayRequestId: "application-service-competing-start-replay-request",
        replayExecutionId: "application-service-competing-start-replay-execution",
      },
    }),
  );
  reset(runtime.counters);
  const conflict = await runtime.service.startOrganizationVerification(competing);
  assert.equal(conflict.outcome, "start_rejected");
  if (conflict.outcome === "start_rejected") {
    assert.equal(conflict.failure.code, "start_persistence_conflict");
  }
  assert.deepEqual(runtime.counters, {
    appends: 1,
    loads: 0,
    replays: 0,
    runtimes: 0,
    authorities: 0,
  });

  const failedRepository = createInMemoryOrganizationVerificationEvidenceRepository();
  const persistenceRejected = createOrganizationVerificationApplicationService({
    evidenceRepository: {
      loadOrganizationVerificationEvidenceStream: (request) =>
        failedRepository.loadOrganizationVerificationEvidenceStream(request),
      async appendOrganizationVerificationEvidence() {
        return Object.freeze({
          ok: false as const,
          code: "expected_stream_version_conflict" as const,
        });
      },
    },
    replayRuntime: { replayHistory: replayOrganizationVerificationWorkflow },
    workflowRuntime: { executeOneWorkflowStep: executeOrganizationVerificationWorkflowStep },
  });
  const persistenceFailure = await persistenceRejected.startOrganizationVerification(
    requests.start,
  );
  assert.equal(persistenceFailure.outcome, "start_rejected");

  const replayRepository = createInMemoryOrganizationVerificationEvidenceRepository();
  const replayRejected = createOrganizationVerificationApplicationService({
    evidenceRepository: replayRepository,
    replayRuntime: {
      replayHistory(request) {
        return replayOrganizationVerificationWorkflow({ ...request });
      },
    },
    workflowRuntime: { executeOneWorkflowStep: executeOrganizationVerificationWorkflowStep },
  });
  const replayFailure = await replayRejected.startOrganizationVerification(requests.start);
  assert.equal(replayFailure.outcome, "start_rejected");
  if (replayFailure.outcome === "start_rejected") {
    assert.equal(replayFailure.failure.code, "current_state_integrity_failure");
  }
});

test("fresh Advance performs two loads, two Replays, one Runtime, one Authority, and one append", async () => {
  const requests = buildRequests();
  const runtime = harness();
  await runtime.service.startOrganizationVerification(requests.start);
  reset(runtime.counters);
  const result = await runtime.service.advanceOrganizationVerificationWorkflow(
    requests.advance,
  );
  assert.equal(result.outcome, "advance_completed");
  assert.equal(isOrganizationVerificationApplicationServiceResult(result), true);
  assert.deepEqual(runtime.counters, {
    appends: 1,
    loads: 2,
    replays: 2,
    runtimes: 1,
    authorities: 1,
  });
  if (result.outcome !== "advance_completed") return;
  assert.equal(
    result.currentWorkflowExecution,
    result.replayExecution.reconstructedWorkflowExecution,
  );
  assert.notEqual(
    result.workflowStepExecution.nextWorkflowExecution,
    result.currentWorkflowExecution,
  );
});

test("duplicate Advance performs no Runtime or Authority and reuses durable evidence", async () => {
  const requests = buildRequests();
  const runtime = harness();
  await runtime.service.startOrganizationVerification(requests.start);
  const fresh = await runtime.service.advanceOrganizationVerificationWorkflow(
    requests.advance,
  );
  assert.equal(fresh.outcome, "advance_completed");
  reset(runtime.counters);
  const duplicate = await runtime.service.advanceOrganizationVerificationWorkflow(
    requests.advance,
  );
  assert.equal(duplicate.outcome, "advance_idempotent");
  assert.deepEqual(runtime.counters, {
    appends: 1,
    loads: 2,
    replays: 2,
    runtimes: 0,
    authorities: 0,
  });
  if (fresh.outcome !== "advance_completed" || duplicate.outcome !== "advance_idempotent") return;
  assert.equal("workflowStepExecution" in duplicate, false);
  assert.equal(duplicate.workflowStepRecord, fresh.workflowStepRecord);
  assert.equal(
    duplicate.persistedAuthorityResult,
    fresh.workflowStepExecution.requestedStep === "attempt_transition"
      ? fresh.workflowStepExecution.authorityResult.nextLifecycleExecution
      : fresh.authorityResult,
  );
});

test("changed metadata under a committed Workflow Step ID is an idempotency conflict", async () => {
  const requests = buildRequests();
  const runtime = harness();
  await runtime.service.startOrganizationVerification(requests.start);
  await runtime.service.advanceOrganizationVerificationWorkflow(requests.advance);
  const conflicting = must(
    createAdvanceOrganizationVerificationWorkflowRequest({
      ...requests.advance,
      metadata: {
        ...requests.advance.metadata,
        applicationExecutionId: "application-service-conflict-execution",
        commandId: "application-service-conflict-command",
      },
      correlationId: "application-service-conflicting-step-correlation",
      persistence: {
        ...requests.advance.persistence,
        appendId: "application-service-conflicting-append",
      },
      preExecutionReplay: {
        ...requests.advance.preExecutionReplay,
        replayRequestId: "application-service-conflict-pre-request",
        replayExecutionId: "application-service-conflict-pre-execution",
      },
      authoritativeReplay: {
        ...requests.advance.authoritativeReplay,
        replayRequestId: "application-service-conflict-post-request",
        replayExecutionId: "application-service-conflict-post-execution",
      },
    }),
  );
  reset(runtime.counters);
  const result = await runtime.service.advanceOrganizationVerificationWorkflow(conflicting);
  assert.equal(result.outcome, "advance_rejected");
  if (result.outcome === "advance_rejected") {
    assert.equal(result.failure.code, "application_idempotency_conflict");
  }
  assert.deepEqual(runtime.counters, {
    appends: 0,
    loads: 1,
    replays: 1,
    runtimes: 0,
    authorities: 0,
  });
});

test("state and history queries load and Replay without writes, Runtime, or Authority", async () => {
  const requests = buildRequests();
  const runtime = harness();
  await runtime.service.startOrganizationVerification(requests.start);
  const stateRequest = must(
    createLoadOrganizationVerificationStateRequest({
      metadata: {
        applicationExecutionId: "application-service-state-execution-1",
        queryId: "application-service-state-query-1",
        requestedAt: "2026-09-01T00:02:14.000Z",
        applicationCompletedAt: "2026-09-01T00:02:16.000Z",
        provenanceReferences: ["application-service-state-provenance"],
        integrityReferences: ["application-service-state-integrity"],
        correlationId: "application-service-state-correlation",
      },
      streamIdentity: requests.streamIdentity,
      replay: {
        replayRequestId: "application-service-state-replay-request-1",
        replayExecutionId: "application-service-state-replay-execution-1",
        replayedAt: "2026-09-01T00:02:15.000Z",
        provenanceReferences: ["application-service-state-replay-provenance"],
        integrityReferences: ["application-service-state-replay-integrity"],
      },
    }),
  );
  const historyRequest = must(
    createReplayOrganizationVerificationHistoryRequest({
      metadata: {
        applicationExecutionId: "application-service-history-execution-1",
        queryId: "application-service-history-query-1",
        requestedAt: "2026-09-01T00:02:17.000Z",
        applicationCompletedAt: "2026-09-01T00:02:19.000Z",
        provenanceReferences: ["application-service-history-provenance"],
        integrityReferences: ["application-service-history-integrity"],
        correlationId: "application-service-history-correlation",
      },
      streamIdentity: requests.streamIdentity,
      replay: {
        replayRequestId: "application-service-history-replay-request-1",
        replayExecutionId: "application-service-history-replay-execution-1",
        replayedAt: "2026-09-01T00:02:18.000Z",
        provenanceReferences: ["application-service-history-replay-provenance"],
        integrityReferences: ["application-service-history-replay-integrity"],
      },
    }),
  );
  reset(runtime.counters);
  const state = await runtime.service.loadOrganizationVerificationState(stateRequest);
  const history = await runtime.service.replayOrganizationVerificationHistory(historyRequest);
  assert.equal(state.outcome, "state_found");
  assert.equal(history.outcome, "history_replayed");
  assert.deepEqual(runtime.counters, {
    appends: 0,
    loads: 2,
    replays: 2,
    runtimes: 0,
    authorities: 0,
  });
  if (state.outcome === "state_found") {
    assert.equal(
      state.currentWorkflowExecution,
      state.replayExecution.reconstructedWorkflowExecution,
    );
  }
});

test("unauthentic requests and impossible chronology fail closed before side effects", async () => {
  const requests = buildRequests();
  const runtime = harness();
  const rejected = await runtime.service.startOrganizationVerification({
    ...requests.start,
  });
  assert.equal(rejected.outcome, "start_rejected");
  if (rejected.outcome === "start_rejected") {
    assert.equal(rejected.failure.code, "unauthentic_application_request");
  }
  assert.deepEqual(runtime.counters, {
    appends: 0,
    loads: 0,
    replays: 0,
    runtimes: 0,
    authorities: 0,
  });
  const chronology = createStartOrganizationVerificationRequest({
    ...requests.start,
    metadata: {
      ...requests.start.metadata,
      applicationCompletedAt: "2026-09-01T00:02:00.500Z",
    },
  });
  assert.equal(chronology.ok, false);
  const advanceChronology = createAdvanceOrganizationVerificationWorkflowRequest({
    ...requests.advance,
    persistence: {
      ...requests.advance.persistence,
      appendedAt: "2026-09-01T00:02:09.000Z",
    },
  });
  assert.equal(advanceChronology.ok, false);
});

test("stale versions reject after pre-Replay and before Runtime, Authority, or append", async () => {
  const requests = buildRequests();
  const runtime = harness();
  await runtime.service.startOrganizationVerification(requests.start);
  const stale = must(
    createAdvanceOrganizationVerificationWorkflowRequest({
      ...requests.advance,
      expectedPersistenceStreamVersion: 3,
      persistence: {
        ...requests.advance.persistence,
        appendId: "application-service-stale-append-1",
        authorityEvidenceEntryId: "application-service-stale-authority-1",
        workflowStepRecordEvidenceEntryId: "application-service-stale-step-1",
      },
      metadata: {
        ...requests.advance.metadata,
        applicationExecutionId: "application-service-stale-execution-1",
        commandId: "application-service-stale-command-1",
      },
      preExecutionReplay: {
        ...requests.advance.preExecutionReplay,
        replayRequestId: "application-service-stale-pre-request-1",
        replayExecutionId: "application-service-stale-pre-execution-1",
      },
      authoritativeReplay: {
        ...requests.advance.authoritativeReplay,
        replayRequestId: "application-service-stale-post-request-1",
        replayExecutionId: "application-service-stale-post-execution-1",
      },
    }),
  );
  reset(runtime.counters);
  const result = await runtime.service.advanceOrganizationVerificationWorkflow(stale);
  assert.equal(result.outcome, "advance_rejected");
  if (result.outcome === "advance_rejected") {
    assert.equal(result.failure.code, "expected_persistence_version_conflict");
  }
  assert.deepEqual(runtime.counters, {
    appends: 0,
    loads: 1,
    replays: 1,
    runtimes: 0,
    authorities: 0,
  });
});

test("pre-Replay and Runtime failures map to closed failures without writes", async () => {
  const requests = buildRequests();
  const repository = createInMemoryOrganizationVerificationEvidenceRepository();
  const starter = createOrganizationVerificationApplicationService({
    evidenceRepository: repository,
    replayRuntime: { replayHistory: replayOrganizationVerificationWorkflow },
    workflowRuntime: { executeOneWorkflowStep: executeOrganizationVerificationWorkflowStep },
  });
  await starter.startOrganizationVerification(requests.start);
  let runtimeCalls = 0;
  const replayRejected = createOrganizationVerificationApplicationService({
    evidenceRepository: repository,
    replayRuntime: {
      replayHistory(request) {
        return replayOrganizationVerificationWorkflow({ ...request });
      },
    },
    workflowRuntime: {
      executeOneWorkflowStep(request) {
        runtimeCalls += 1;
        return executeOrganizationVerificationWorkflowStep(request);
      },
    },
  });
  const preFailure = await replayRejected.advanceOrganizationVerificationWorkflow(
    requests.advance,
  );
  assert.equal(preFailure.outcome, "advance_rejected");
  assert.equal(runtimeCalls, 0);

  const runtimeRejected = createOrganizationVerificationApplicationService({
    evidenceRepository: repository,
    replayRuntime: { replayHistory: replayOrganizationVerificationWorkflow },
    workflowRuntime: {
      executeOneWorkflowStep() {
        runtimeCalls += 1;
        return Object.freeze({
          ok: false as const,
          stage: "workflow_runtime" as const,
          code: "invalid_runtime_artifacts" as const,
        });
      },
    },
  });
  const runtimeFailure = await runtimeRejected.advanceOrganizationVerificationWorkflow(
    requests.advance,
  );
  assert.equal(runtimeFailure.outcome, "advance_rejected");
  if (runtimeFailure.outcome === "advance_rejected") {
    assert.equal(runtimeFailure.failure.code, "workflow_step_execution_rejected");
  }
  assert.equal(runtimeCalls, 1);
});

test("append, reload, authoritative Replay, and semantic-alignment failures fail closed", async () => {
  const requests = buildRequests();

  async function startedRepository() {
    const repository = createInMemoryOrganizationVerificationEvidenceRepository();
    const service = createOrganizationVerificationApplicationService({
      evidenceRepository: repository,
      replayRuntime: { replayHistory: replayOrganizationVerificationWorkflow },
      workflowRuntime: { executeOneWorkflowStep: executeOrganizationVerificationWorkflowStep },
    });
    await service.startOrganizationVerification(requests.start);
    return repository;
  }

  const appendRepository = await startedRepository();
  const appendFailure = createOrganizationVerificationApplicationService({
    evidenceRepository: {
      loadOrganizationVerificationEvidenceStream: (request) =>
        appendRepository.loadOrganizationVerificationEvidenceStream(request),
      async appendOrganizationVerificationEvidence() {
        return Object.freeze({
          ok: false as const,
          code: "expected_stream_version_conflict" as const,
        });
      },
    },
    replayRuntime: { replayHistory: replayOrganizationVerificationWorkflow },
    workflowRuntime: { executeOneWorkflowStep: executeOrganizationVerificationWorkflowStep },
  });
  const appendRejected = await appendFailure.advanceOrganizationVerificationWorkflow(
    requests.advance,
  );
  assert.equal(appendRejected.outcome, "advance_rejected");
  if (appendRejected.outcome === "advance_rejected") {
    assert.equal(appendRejected.failure.code, "expected_persistence_version_conflict");
  }

  const reloadRepository = await startedRepository();
  let returnNotFound = false;
  const reloadFailure = createOrganizationVerificationApplicationService({
    evidenceRepository: {
      async loadOrganizationVerificationEvidenceStream(request) {
        if (returnNotFound) {
          return must(organizationVerificationEvidenceStreamNotFound(request.streamIdentity));
        }
        return reloadRepository.loadOrganizationVerificationEvidenceStream(request);
      },
      async appendOrganizationVerificationEvidence(request) {
        const result = await reloadRepository.appendOrganizationVerificationEvidence(request);
        returnNotFound = result.ok;
        return result;
      },
    },
    replayRuntime: { replayHistory: replayOrganizationVerificationWorkflow },
    workflowRuntime: { executeOneWorkflowStep: executeOrganizationVerificationWorkflowStep },
  });
  const reloadRejected = await reloadFailure.advanceOrganizationVerificationWorkflow(
    requests.advance,
  );
  assert.equal(reloadRejected.outcome, "advance_rejected");
  if (reloadRejected.outcome === "advance_rejected") {
    assert.equal(reloadRejected.failure.code, "current_state_reconstruction_failure");
  }

  const replayRepository = await startedRepository();
  let replayCalls = 0;
  const authoritativeReplayFailure = createOrganizationVerificationApplicationService({
    evidenceRepository: replayRepository,
    replayRuntime: {
      replayHistory(request) {
        replayCalls += 1;
        return replayCalls === 1
          ? replayOrganizationVerificationWorkflow(request)
          : replayOrganizationVerificationWorkflow({ ...request });
      },
    },
    workflowRuntime: { executeOneWorkflowStep: executeOrganizationVerificationWorkflowStep },
  });
  const replayRejected = await authoritativeReplayFailure.advanceOrganizationVerificationWorkflow(
    requests.advance,
  );
  assert.equal(replayRejected.outcome, "advance_rejected");

  const semanticRepository = await startedRepository();
  let firstLoadedStream:
    | Awaited<ReturnType<typeof semanticRepository.loadOrganizationVerificationEvidenceStream>>
    | undefined;
  let loadCount = 0;
  const semanticFailure = createOrganizationVerificationApplicationService({
    evidenceRepository: {
      async loadOrganizationVerificationEvidenceStream(request) {
        loadCount += 1;
        const loaded = await semanticRepository.loadOrganizationVerificationEvidenceStream(request);
        if (loadCount === 1) firstLoadedStream = loaded;
        return loadCount === 2 && firstLoadedStream !== undefined
          ? firstLoadedStream
          : loaded;
      },
      appendOrganizationVerificationEvidence: (request) =>
        semanticRepository.appendOrganizationVerificationEvidence(request),
    },
    replayRuntime: { replayHistory: replayOrganizationVerificationWorkflow },
    workflowRuntime: { executeOneWorkflowStep: executeOrganizationVerificationWorkflowStep },
  });
  const semanticRejected = await semanticFailure.advanceOrganizationVerificationWorkflow(
    requests.advance,
  );
  assert.equal(semanticRejected.outcome, "advance_rejected");
  if (semanticRejected.outcome === "advance_rejected") {
    assert.equal(semanticRejected.failure.code, "current_state_integrity_failure");
  }
});

test("Replay identity mismatch is rejected and queries never write when not found", async () => {
  const requests = buildRequests();
  const repository = createInMemoryOrganizationVerificationEvidenceRepository();
  const base = createOrganizationVerificationApplicationService({
    evidenceRepository: repository,
    replayRuntime: { replayHistory: replayOrganizationVerificationWorkflow },
    workflowRuntime: { executeOneWorkflowStep: executeOrganizationVerificationWorkflowStep },
  });
  await base.startOrganizationVerification(requests.start);
  const mismatch = createOrganizationVerificationApplicationService({
    evidenceRepository: repository,
    replayRuntime: {
      replayHistory(request) {
        const alternate = createOrganizationVerificationReplayRequest({
          replayRequestId: `${request.replayRequestId}-alternate`,
          replayExecutionId: `${request.replayExecutionId}-alternate`,
          sourceEvidenceStream: request.sourceEvidenceStream,
          replayedAt: request.replayedAt,
          provenanceReferences: request.provenanceReferences,
          integrityReferences: request.integrityReferences,
        });
        assert.equal(alternate.ok, true);
        if (!alternate.ok) return replayOrganizationVerificationWorkflow(request);
        return replayOrganizationVerificationWorkflow(alternate.value);
      },
    },
    workflowRuntime: { executeOneWorkflowStep: executeOrganizationVerificationWorkflowStep },
  });
  const rejected = await mismatch.advanceOrganizationVerificationWorkflow(requests.advance);
  assert.equal(rejected.outcome, "advance_rejected");
  if (rejected.outcome === "advance_rejected") {
    assert.equal(rejected.failure.code, "current_state_integrity_failure");
  }

  const empty = createInMemoryOrganizationVerificationEvidenceRepository();
  let writes = 0;
  const emptyService = createOrganizationVerificationApplicationService({
    evidenceRepository: {
      loadOrganizationVerificationEvidenceStream: (request) =>
        empty.loadOrganizationVerificationEvidenceStream(request),
      async appendOrganizationVerificationEvidence(request) {
        writes += 1;
        return empty.appendOrganizationVerificationEvidence(request);
      },
    },
    replayRuntime: { replayHistory: replayOrganizationVerificationWorkflow },
    workflowRuntime: { executeOneWorkflowStep: executeOrganizationVerificationWorkflowStep },
  });
  const stateRequest = must(
    createLoadOrganizationVerificationStateRequest({
      metadata: {
        applicationExecutionId: "application-service-empty-state-execution",
        queryId: "application-service-empty-state-query",
        requestedAt: "2026-09-01T00:02:14.000Z",
        applicationCompletedAt: "2026-09-01T00:02:16.000Z",
        provenanceReferences: ["application-service-empty-state-provenance"],
        integrityReferences: ["application-service-empty-state-integrity"],
        correlationId: "application-service-empty-state-correlation",
      },
      streamIdentity: requests.streamIdentity,
      replay: {
        replayRequestId: "application-service-empty-replay-request",
        replayExecutionId: "application-service-empty-replay-execution",
        replayedAt: "2026-09-01T00:02:15.000Z",
        provenanceReferences: ["application-service-empty-replay-provenance"],
        integrityReferences: ["application-service-empty-replay-integrity"],
      },
    }),
  );
  const notFound = await emptyService.loadOrganizationVerificationState(stateRequest);
  assert.equal(notFound.outcome, "state_not_found");
  assert.equal(writes, 0);
});
