import assert from "node:assert/strict";
import test from "node:test";
import { createInMemoryOrganizationVerificationEvidenceRepository } from "../../infrastructure/persistence/in-memory/index.js";
import { buildRuntimeFixture } from "../workflow-runtime/workflowRuntime.test.js";
import * as persistence from "../persistence-contract/index.js";
import * as workflow from "../workflow-contract/index.js";
import * as replay from "./index.js";

type Result<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; code: string }>;

function must<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(result.code);
  return result.value;
}

function buildReplayFixture() {
  const runtime = buildRuntimeFixture();
  const genesis = runtime.chain.workflowExecution;
  const streamIdentity = must(
    persistence.createOrganizationVerificationWorkflowStreamIdentity({
      workflowExecutionId: genesis.workflowExecutionId,
      organizationId: genesis.organizationId,
      recordId: genesis.recordId,
      revisionId: genesis.revisionId,
      attemptId: genesis.attemptId,
    }),
  );
  const durableEvidence: readonly persistence.OrganizationVerificationDurableEvidence[] =
    [
      { evidenceKind: "workflow_genesis", artifact: genesis },
      {
        evidenceKind: "attempt_lifecycle_execution",
        artifact: runtime.queued.authorityResult.nextLifecycleExecution,
      },
      {
        evidenceKind: "workflow_step_record",
        artifact: runtime.queued.workflowStepRecord,
      },
      {
        evidenceKind: "attempt_lifecycle_execution",
        artifact: runtime.running.authorityResult.nextLifecycleExecution,
      },
      {
        evidenceKind: "workflow_step_record",
        artifact: runtime.running.workflowStepRecord,
      },
      {
        evidenceKind: "attempt_lifecycle_execution",
        artifact: runtime.requeued.authorityResult.nextLifecycleExecution,
      },
      {
        evidenceKind: "workflow_step_record",
        artifact: runtime.requeued.workflowStepRecord,
      },
      {
        evidenceKind: "attempt_lifecycle_execution",
        artifact: runtime.rerunning.authorityResult.nextLifecycleExecution,
      },
      {
        evidenceKind: "workflow_step_record",
        artifact: runtime.rerunning.workflowStepRecord,
      },
      {
        evidenceKind: "attempt_lifecycle_execution",
        artifact: runtime.completed.authorityResult.nextLifecycleExecution,
      },
      {
        evidenceKind: "workflow_step_record",
        artifact: runtime.completed.workflowStepRecord,
      },
      {
        evidenceKind: "evidence_snapshot",
        artifact: runtime.snapshotExecution.authorityResult,
      },
      {
        evidenceKind: "workflow_step_record",
        artifact: runtime.snapshotExecution.workflowStepRecord,
      },
      {
        evidenceKind: "evaluation_projection",
        artifact: runtime.projectionExecution.authorityResult,
      },
      {
        evidenceKind: "workflow_step_record",
        artifact: runtime.projectionExecution.workflowStepRecord,
      },
      {
        evidenceKind: "policy_evaluation_input",
        artifact: runtime.evaluationInputExecution.authorityResult,
      },
      {
        evidenceKind: "workflow_step_record",
        artifact: runtime.evaluationInputExecution.workflowStepRecord,
      },
      {
        evidenceKind: "policy_runtime_execution",
        artifact: runtime.policyExecution.authorityResult,
      },
      {
        evidenceKind: "workflow_step_record",
        artifact: runtime.policyExecution.workflowStepRecord,
      },
      {
        evidenceKind: "decision_trust_integration_execution",
        artifact: runtime.integrationExecution.authorityResult,
      },
      {
        evidenceKind: "workflow_step_record",
        artifact: runtime.integrationExecution.workflowStepRecord,
      },
    ];
  const entries: persistence.OrganizationVerificationStoredEvidence[] = [];
  for (const [index, evidence] of durableEvidence.entries()) {
    entries.push(
      must(
        persistence.createOrganizationVerificationStoredEvidence({
          ...evidence,
          evidenceEntryId: `replay-evidence-${index + 1}`,
          streamIdentity,
          streamPosition: index + 1,
          ...(index === 0
            ? {}
            : {
                predecessorEvidenceEntryId:
                  entries[index - 1]?.evidenceEntryId,
              }),
          appendedAt: "2026-09-01T00:30:00.000Z",
          provenanceReferences: ["replay-persistence-provenance"],
          integrityReferences: ["replay-persistence-integrity"],
        }),
      ),
    );
  }
  const stream = must(
    persistence.createOrganizationVerificationEvidenceStream({
      streamIdentity,
      entries,
    }),
  );
  return { runtime, streamIdentity, durableEvidence, entries, stream };
}

function streamPrefix(
  fixture: ReturnType<typeof buildReplayFixture>,
  entryCount: number,
): persistence.OrganizationVerificationEvidenceStream {
  return must(
    persistence.createOrganizationVerificationEvidenceStream({
      streamIdentity: fixture.streamIdentity,
      entries: fixture.entries.slice(0, entryCount),
    }),
  );
}

function replayRequest(
  stream: persistence.OrganizationVerificationEvidenceStream,
  replayExecutionId = "replay-execution-1",
): replay.OrganizationVerificationReplayRequest {
  return must(
    replay.createOrganizationVerificationReplayRequest({
      replayRequestId: `${replayExecutionId}-request`,
      replayExecutionId,
      sourceEvidenceStream: stream,
      replayedAt: "2026-09-01T00:40:00.000Z",
      provenanceReferences: ["replay-provenance"],
      integrityReferences: ["replay-integrity"],
    }),
  );
}

function completed(
  result: replay.OrganizationVerificationReplayResult,
): replay.OrganizationVerificationReplayExecution {
  assert.equal(result.outcome, "replay_completed");
  if (result.outcome !== "replay_completed") {
    throw new Error(result.failure.code);
  }
  return result.execution;
}

function appendBatch(
  fixture: ReturnType<typeof buildReplayFixture>,
  startIndex: number,
): persistence.OrganizationVerificationEvidenceAppendBatch {
  if (startIndex === 0) {
    return must(
      persistence.createOrganizationVerificationEvidenceAppendBatch({
        appendId: "replay-integration-genesis",
        streamIdentity: fixture.streamIdentity,
        expectedStreamVersion: 0,
        entries: [fixture.entries[0]!],
        appendedAt: "2026-09-01T00:31:00.000Z",
        provenanceReferences: ["replay-integration-provenance"],
        integrityReferences: ["replay-integration-integrity"],
      }),
    );
  }
  return must(
    persistence.createOrganizationVerificationEvidenceAppendBatch({
      appendId: `replay-integration-pair-${startIndex}`,
      streamIdentity: fixture.streamIdentity,
      expectedStreamVersion: startIndex,
      expectedHeadEvidenceEntryId:
        fixture.entries[startIndex - 1]!.evidenceEntryId,
      entries: [
        fixture.entries[startIndex]!,
        fixture.entries[startIndex + 1]!,
      ],
      appendedAt: "2026-09-01T00:31:00.000Z",
      provenanceReferences: ["replay-integration-provenance"],
      integrityReferences: ["replay-integration-integrity"],
    }),
  );
}

test("accepts only an authentic integrity-verified evidence stream", () => {
  const fixture = buildReplayFixture();
  const request = replay.createOrganizationVerificationReplayRequest({
    replayRequestId: "replay-authentic-request",
    replayExecutionId: "replay-authentic-input",
    sourceEvidenceStream: fixture.stream,
    replayedAt: "2026-09-01T00:40:00.000Z",
    provenanceReferences: ["replay-provenance"],
    integrityReferences: ["replay-integrity"],
  });
  assert.equal(request.ok, true);
  if (!request.ok) return;
  assert.equal(replay.isOrganizationVerificationReplayRequest(request.value), true);
  assert.equal(request.value.replayRequestId, "replay-authentic-request");
  assert.match(request.value.replayRequestFingerprint, /^sha256:/);

  const notFound =
    must(
      persistence.organizationVerificationEvidenceStreamNotFound(
        fixture.streamIdentity,
      ),
    );
  assert.deepEqual(
    replay.createOrganizationVerificationReplayRequest({
      replayRequestId: "replay-not-found-request",
      replayExecutionId: "replay-not-found",
      sourceEvidenceStream: notFound,
      replayedAt: "2026-09-01T00:40:00.000Z",
      provenanceReferences: ["replay-provenance"],
      integrityReferences: ["replay-integrity"],
    }),
    {
      ok: false,
      code: "replay_stream_not_found_input",
      diagnostic: {},
    },
  );

  for (const fake of [
    { status: "found", stream: fixture.stream },
    { ...fixture.stream },
    Object.assign({}, fixture.stream),
    Object.freeze({ ...fixture.stream }),
    JSON.parse(JSON.stringify(fixture.stream)),
    structuredClone(fixture.stream),
  ]) {
    const rejected = replay.createOrganizationVerificationReplayRequest({
      replayRequestId: "replay-fake-source-request",
      replayExecutionId: "replay-fake-source",
      sourceEvidenceStream: fake,
      replayedAt: "2026-09-01T00:40:00.000Z",
      provenanceReferences: ["replay-provenance"],
      integrityReferences: ["replay-integrity"],
    });
    assert.equal(rejected.ok, false);
    if (rejected.ok) continue;
    assert.equal(rejected.code, "replay_unauthentic_stream");
  }
});

test("Replay Request identity is explicit, distinct, immutable, and fingerprint-bound", () => {
  const fixture = buildReplayFixture();
  const input = {
    replayRequestId: "replay-request-identity",
    replayExecutionId: "replay-execution-identity",
    sourceEvidenceStream: fixture.stream,
    replayedAt: "2026-09-01T00:40:00.000Z",
    provenanceReferences: ["replay-provenance"],
    integrityReferences: ["replay-integrity"],
  };
  const left = must(replay.createOrganizationVerificationReplayRequest(input));
  const right = must(
    replay.createOrganizationVerificationReplayRequest({
      ...input,
      provenanceReferences: [...input.provenanceReferences].reverse(),
      integrityReferences: [...input.integrityReferences].reverse(),
    }),
  );
  assert.equal(left.replayRequestFingerprint, right.replayRequestFingerprint);
  assert.equal(Object.isFrozen(left), true);
  assert.equal(
    replay.createOrganizationVerificationReplayRequest({
      ...input,
      replayRequestId: input.replayExecutionId,
    }).ok,
    false,
  );
  const changed = must(
    replay.createOrganizationVerificationReplayRequest({
      ...input,
      replayRequestId: "replay-request-identity-2",
    }),
  );
  assert.notEqual(left.replayRequestFingerprint, changed.replayRequestFingerprint);
});

test("replays a valid genesis-only stream without implying completion", () => {
  const fixture = buildReplayFixture();
  const genesisStream = streamPrefix(fixture, 1);
  const execution = completed(
    replay.replayOrganizationVerificationWorkflow(
      replayRequest(genesisStream, "replay-genesis"),
    ),
  );
  assert.equal(
    execution.reconstructedWorkflowExecution,
    fixture.runtime.chain.workflowExecution,
  );
  assert.equal(execution.reconstructedWorkflowExecution.workflowExecutionVersion, 1);
  assert.equal(execution.reconstructedWorkflowExecution.workflowStage, "attempt_in_progress");
  assert.equal(execution.authorityResultBindings.length, 0);
  assert.equal(execution.workflowStepRecordBindings.length, 0);
  assert.equal(execution.diagnostics.terminalCoordinationReached, false);
  assert.equal(execution.completionStatus, "stream_consumed");
  assert.equal(execution.replayRequestId, "replay-genesis-request");
  assert.equal(execution.replayExecutionId, "replay-genesis");
  assert.match(execution.replayRequestFingerprint, /^sha256:/);
});

test("reconstructs valid partial Workflow histories exactly", () => {
  const fixture = buildReplayFixture();
  const oneStep = completed(
    replay.replayOrganizationVerificationWorkflow(
      replayRequest(streamPrefix(fixture, 3), "replay-one-step"),
    ),
  );
  assert.equal(oneStep.reconstructedWorkflowExecution.workflowExecutionVersion, 2);
  assert.equal(oneStep.reconstructedWorkflowExecution.workflowStage, "attempt_in_progress");
  assert.equal(oneStep.authorityResultBindings.length, 1);

  const lifecycleCompleted = completed(
    replay.replayOrganizationVerificationWorkflow(
      replayRequest(streamPrefix(fixture, 11), "replay-lifecycle-complete"),
    ),
  );
  assert.equal(
    lifecycleCompleted.reconstructedWorkflowExecution.workflowExecutionVersion,
    6,
  );
  assert.equal(
    lifecycleCompleted.reconstructedWorkflowExecution.workflowStage,
    "attempt_completed",
  );
  assert.equal(lifecycleCompleted.authorityResultBindings.length, 5);
  assert.equal(
    lifecycleCompleted.diagnostics.terminalCoordinationReached,
    false,
  );
});

test("reconstructs the complete terminal coordination Workflow", () => {
  const fixture = buildReplayFixture();
  const execution = completed(
    replay.replayOrganizationVerificationWorkflow(
      replayRequest(fixture.stream, "replay-complete"),
    ),
  );
  const expected =
    fixture.runtime.integrationExecution.nextWorkflowExecution;
  assert.equal(
    execution.reconstructedWorkflowExecution.workflowExecutionFingerprint,
    expected.workflowExecutionFingerprint,
  );
  assert.equal(execution.reconstructedWorkflowExecution.workflowStage, "completed");
  assert.equal(execution.reconstructedWorkflowExecution.workflowExecutionVersion, 11);
  assert.equal(execution.diagnostics.totalWorkflowStepsReconstructed, 10);
  assert.equal(execution.diagnostics.terminalCoordinationReached, true);
  assert.equal("approved" in execution, false);
  assert.equal("verified" in execution, false);
  assert.equal("eligible" in execution, false);
});

test("preserves the exact stage-to-evidence mapping and ordered bindings", () => {
  const fixture = buildReplayFixture();
  const execution = completed(
    replay.replayOrganizationVerificationWorkflow(
      replayRequest(fixture.stream, "replay-bindings"),
    ),
  );
  assert.deepEqual(
    execution.authorityResultBindings.map(
      (binding) => binding.authorityResultEvidenceKind,
    ),
    [
      "attempt_lifecycle_execution",
      "attempt_lifecycle_execution",
      "attempt_lifecycle_execution",
      "attempt_lifecycle_execution",
      "attempt_lifecycle_execution",
      "evidence_snapshot",
      "evaluation_projection",
      "policy_evaluation_input",
      "policy_runtime_execution",
      "decision_trust_integration_execution",
    ],
  );
  assert.deepEqual(
    execution.authorityResultBindings.map(
      (binding) => binding.workflowStep,
    ),
    [
      "attempt_transition",
      "attempt_transition",
      "attempt_transition",
      "attempt_transition",
      "attempt_transition",
      "bind_snapshot",
      "bind_projection",
      "bind_evaluation_input",
      "complete_policy",
      "complete_decision_trust_integration",
    ],
  );
  for (const [index, binding] of execution.authorityResultBindings.entries()) {
    const authority = fixture.entries[index * 2 + 1]!;
    const step = fixture.entries[index * 2 + 2]!;
    assert.equal(binding.authorityResultSemanticId, authority.semanticArtifactIdentity);
    assert.equal(binding.authorityResultFingerprint, authority.artifactFingerprint);
    assert.equal(binding.authorityResultPersistencePosition, authority.streamPosition);
    assert.equal(binding.workflowStepRecordPersistencePosition, step.streamPosition);
    assert.equal(
      binding.workflowStepRecordFingerprint,
      step.artifactFingerprint,
    );
    assert.equal(binding.resultingWorkflowVersion, index + 2);
    assert.equal(replay.isOrganizationVerificationReplayEvidenceBinding(binding), true);
  }
});

test("reconstructs lifecycle successors structurally without transition authority", () => {
  const fixture = buildReplayFixture();
  const execution = completed(
    replay.replayOrganizationVerificationWorkflow(
      replayRequest(streamPrefix(fixture, 11), "replay-lifecycle"),
    ),
  );
  const expected =
    fixture.runtime.completed.authorityResult.nextLifecycleExecution;
  assert.equal(
    execution.reconstructedAttemptLifecycleExecution
      .attemptLifecycleExecutionFingerprint,
    expected.attemptLifecycleExecutionFingerprint,
  );
  assert.equal(
    execution.reconstructedAttemptLifecycleExecution.lifecycleExecutionVersion,
    6,
  );
  assert.equal(
    execution.reconstructedAttemptLifecycleExecution.transitionRecords.length,
    5,
  );
  assert.equal(
    execution.diagnostics.finalLifecycleExecutionVersion,
    6,
  );
});

test("rejects an authentic stream with semantically impossible stage progression", () => {
  const fixture = buildReplayFixture();
  const snapshot = fixture.runtime.snapshotExecution.authorityResult;
  const completedLifecycle =
    fixture.runtime.completed.authorityResult.nextLifecycleExecution;
  const mismatchedStep = must(
    workflow.createOrganizationVerificationWorkflowStepRecord({
      workflowStepId: "replay-stage-mismatch-step",
      workflowExecutionId: fixture.streamIdentity.workflowExecutionId,
      predecessorWorkflowExecutionVersion: 1,
      nextWorkflowExecutionVersion: 2,
      predecessorStage: "attempt_completed",
      resultingStage: "snapshot_bound",
      organizationId: fixture.streamIdentity.organizationId,
      recordId: fixture.streamIdentity.recordId,
      revisionId: fixture.streamIdentity.revisionId,
      attemptId: fixture.streamIdentity.attemptId,
      occurredAt: snapshot.createdAt,
      provenanceReferences: ["replay-stage-provenance"],
      integrityReferences: ["replay-stage-integrity"],
      artifacts: {
        requestedStep: "bind_snapshot",
        lifecycleExecution: completedLifecycle,
        snapshot,
      },
    }),
  );
  const authorityEvidence = must(
    persistence.createOrganizationVerificationStoredEvidence({
      evidenceKind: "evidence_snapshot",
      artifact: snapshot,
      evidenceEntryId: "replay-stage-authority",
      streamIdentity: fixture.streamIdentity,
      streamPosition: 2,
      predecessorEvidenceEntryId: fixture.entries[0]!.evidenceEntryId,
      appendedAt: "2026-09-01T00:30:00.000Z",
      provenanceReferences: ["replay-stage-provenance"],
      integrityReferences: ["replay-stage-integrity"],
    }),
  );
  const stepEvidence = must(
    persistence.createOrganizationVerificationStoredEvidence({
      evidenceKind: "workflow_step_record",
      artifact: mismatchedStep,
      evidenceEntryId: "replay-stage-step-record",
      streamIdentity: fixture.streamIdentity,
      streamPosition: 3,
      predecessorEvidenceEntryId: authorityEvidence.evidenceEntryId,
      appendedAt: "2026-09-01T00:30:00.000Z",
      provenanceReferences: ["replay-stage-provenance"],
      integrityReferences: ["replay-stage-integrity"],
    }),
  );
  const stream = must(
    persistence.createOrganizationVerificationEvidenceStream({
      streamIdentity: fixture.streamIdentity,
      entries: [fixture.entries[0]!, authorityEvidence, stepEvidence],
    }),
  );
  const result = replay.replayOrganizationVerificationWorkflow(
    replayRequest(stream, "replay-stage-mismatch"),
  );
  assert.equal(result.outcome, "replay_rejected");
  if (result.outcome !== "replay_rejected") return;
  assert.equal(result.failure.code, "replay_stage_mismatch");
  assert.deepEqual(result.failure.diagnostic, {
    persistencePosition: 3,
    expectedWorkflowStage: "attempt_in_progress",
    actualWorkflowStage: "attempt_completed",
  });
  assert.equal(replay.isOrganizationVerificationReplayResult(result), true);
});

test("persistence integrity prevents incomplete, reordered, and duplicate genesis input", () => {
  const fixture = buildReplayFixture();
  const incomplete =
    persistence.createOrganizationVerificationEvidenceStream({
      streamIdentity: fixture.streamIdentity,
      entries: fixture.entries.slice(0, 2),
    });
  assert.equal(incomplete.ok, false);
  const reordered =
    persistence.createOrganizationVerificationEvidenceStream({
      streamIdentity: fixture.streamIdentity,
      entries: [
        fixture.entries[0]!,
        fixture.entries[2]!,
        fixture.entries[1]!,
      ],
    });
  assert.equal(reordered.ok, false);
  const duplicateGenesis =
    persistence.createOrganizationVerificationEvidenceStream({
      streamIdentity: fixture.streamIdentity,
      entries: [fixture.entries[0]!, fixture.entries[0]!],
    });
  assert.equal(duplicateGenesis.ok, false);
});

test("replay request, execution, result, and bindings reject impersonation", () => {
  const fixture = buildReplayFixture();
  const request = replayRequest(fixture.stream, "replay-authenticity");
  const result = replay.replayOrganizationVerificationWorkflow(request);
  const execution = completed(result);
  assert.equal(replay.isOrganizationVerificationReplayRequest(request), true);
  assert.equal(replay.isOrganizationVerificationReplayExecution(execution), true);
  assert.equal(replay.isOrganizationVerificationReplayResult(result), true);

  for (const fakeRequest of [
    { ...request },
    Object.assign({}, request),
    Object.freeze({ ...request }),
    JSON.parse(JSON.stringify(request)),
    structuredClone(request),
  ]) {
    assert.equal(replay.isOrganizationVerificationReplayRequest(fakeRequest), false);
    const rejected = replay.replayOrganizationVerificationWorkflow(
      fakeRequest as replay.OrganizationVerificationReplayRequest,
    );
    assert.equal(rejected.outcome, "replay_rejected");
    if (rejected.outcome === "replay_rejected") {
      assert.equal(rejected.failure.code, "replay_unauthentic_stream");
    }
  }
  for (const fake of [
    { ...execution },
    Object.assign({}, execution),
    Object.freeze({ ...execution }),
    JSON.parse(JSON.stringify(execution)),
    structuredClone(execution),
  ]) {
    assert.equal(replay.isOrganizationVerificationReplayExecution(fake), false);
  }
  for (const fake of [
    { ...result },
    Object.assign({}, result),
    Object.freeze({ ...result }),
    JSON.parse(JSON.stringify(result)),
    structuredClone(result),
  ]) {
    assert.equal(replay.isOrganizationVerificationReplayResult(fake), false);
  }
  const binding = execution.authorityResultBindings[0]!;
  assert.equal(replay.isOrganizationVerificationReplayEvidenceBinding({ ...binding }), false);
});

test("replay output is deeply immutable and cannot influence a later replay", () => {
  const fixture = buildReplayFixture();
  const request = replayRequest(fixture.stream, "replay-immutability");
  const first = completed(
    replay.replayOrganizationVerificationWorkflow(request),
  );
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.authorityResultBindings), true);
  assert.equal(Object.isFrozen(first.workflowStepRecordBindings), true);
  assert.equal(Object.isFrozen(first.diagnostics), true);
  assert.equal(Object.isFrozen(first.diagnostics.evidenceKindCounts), true);
  assert.equal(Object.isFrozen(first.replayedEvidenceRange), true);
  assert.equal(
    Reflect.set(first.authorityResultBindings, "0", Object.freeze({})),
    false,
  );
  assert.equal(
    Reflect.set(first.diagnostics, "finalWorkflowVersion", 999),
    false,
  );
  assert.equal(
    Reflect.set(
      first.reconstructedWorkflowExecution,
      "workflowStage",
      "attempt_in_progress",
    ),
    false,
  );
  const second = completed(
    replay.replayOrganizationVerificationWorkflow(request),
  );
  assert.equal(first.replayFingerprint, second.replayFingerprint);
  assert.equal(second.diagnostics.finalWorkflowVersion, 11);
});

test("replay is deterministic and property-order independent", () => {
  const fixture = buildReplayFixture();
  const firstRequest = replayRequest(fixture.stream, "replay-deterministic");
  const secondRequest = must(
    replay.createOrganizationVerificationReplayRequest({
      integrityReferences: ["replay-integrity"],
      provenanceReferences: ["replay-provenance"],
      replayedAt: "2026-09-01T00:40:00.000Z",
      sourceEvidenceStream: fixture.stream,
      replayRequestId: "replay-deterministic-request",
      replayExecutionId: "replay-deterministic",
    }),
  );
  const first = completed(
    replay.replayOrganizationVerificationWorkflow(firstRequest),
  );
  const second = completed(
    replay.replayOrganizationVerificationWorkflow(secondRequest),
  );
  assert.equal(first.replayFingerprint, second.replayFingerprint);
  assert.equal(
    first.reconstructedWorkflowExecution.workflowExecutionFingerprint,
    second.reconstructedWorkflowExecution.workflowExecutionFingerprint,
  );
  assert.deepEqual(first.authorityResultBindings, second.authorityResultBindings);
  assert.deepEqual(first.diagnostics, second.diagnostics);
});

test("integration composes runtime evidence, persistence, load, and replay without writes", async () => {
  const fixture = buildReplayFixture();
  const repository =
    createInMemoryOrganizationVerificationEvidenceRepository();
  for (let startIndex = 0; startIndex < fixture.entries.length; ) {
    const batch = appendBatch(fixture, startIndex);
    const appended =
      await repository.appendOrganizationVerificationEvidence({
        streamIdentity: fixture.streamIdentity,
        expectedStreamVersion: batch.expectedStreamVersion,
        batch,
      });
    assert.equal(appended.ok, true);
    startIndex += startIndex === 0 ? 1 : 2;
  }
  const before =
    await repository.loadOrganizationVerificationEvidenceStream({
      streamIdentity: fixture.streamIdentity,
    });
  assert.equal(before.status, "found");
  if (before.status !== "found") return;

  const execution = completed(
    replay.replayOrganizationVerificationWorkflow(
      replayRequest(before.stream, "replay-integration"),
    ),
  );
  assert.equal(execution.reconstructedWorkflowExecution.workflowStage, "completed");
  assert.equal(execution.persistenceStreamVersion, fixture.entries.length);

  const after =
    await repository.loadOrganizationVerificationEvidenceStream({
      streamIdentity: fixture.streamIdentity,
    });
  assert.equal(after.status, "found");
  if (after.status !== "found") return;
  assert.equal(after.stream.streamVersion, before.stream.streamVersion);
  assert.equal(
    after.stream.evidenceStreamFingerprint,
    before.stream.evidenceStreamFingerprint,
  );
  assert.deepEqual(
    after.stream.entries.map((entry) => entry.storedEvidenceFingerprint),
    before.stream.entries.map((entry) => entry.storedEvidenceFingerprint),
  );
});

test("diagnostics are complete, deterministic, and business-neutral", () => {
  const fixture = buildReplayFixture();
  const execution = completed(
    replay.replayOrganizationVerificationWorkflow(
      replayRequest(fixture.stream, "replay-diagnostics"),
    ),
  );
  assert.deepEqual(execution.diagnostics.evidenceKindCounts, {
    workflow_genesis: 1,
    attempt_lifecycle_execution: 5,
    evidence_snapshot: 1,
    evaluation_projection: 1,
    policy_evaluation_input: 1,
    policy_runtime_execution: 1,
    decision_trust_integration_execution: 1,
    workflow_step_record: 10,
  });
  assert.equal(execution.diagnostics.totalEvidenceEntriesConsumed, 21);
  assert.equal(execution.diagnostics.firstPersistencePosition, 1);
  assert.equal(execution.diagnostics.lastPersistencePosition, 21);
  assert.equal("duration" in execution.diagnostics, false);
  assert.equal("approval" in execution.diagnostics, false);
  assert.equal("trust" in execution.diagnostics, false);
  assert.equal("eligibility" in execution.diagnostics, false);
});

test("public replay surface exposes no seals, stampers, or fingerprint helpers", () => {
  assert.deepEqual(Object.keys(replay).sort(), [
    "createOrganizationVerificationReplayRequest",
    "isOrganizationVerificationReplayEvidenceBinding",
    "isOrganizationVerificationReplayExecution",
    "isOrganizationVerificationReplayRequest",
    "isOrganizationVerificationReplayResult",
    "replayOrganizationVerificationWorkflow",
  ]);
  assert.equal(
    Object.keys(replay).some((key) =>
      /seal|internal|fingerprintOrganization|stamp|repair|repository/i.test(
        key,
      ),
    ),
    false,
  );
});
