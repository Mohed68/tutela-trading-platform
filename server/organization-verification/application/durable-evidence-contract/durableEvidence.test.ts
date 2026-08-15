import assert from "node:assert/strict";
import test from "node:test";
import { buildRuntimeFixture } from "../workflow-runtime/workflowRuntime.test.js";
import { replayOrganizationVerificationWorkflow, createOrganizationVerificationReplayRequest } from "../replay-runtime/index.js";
import * as persistence from "../persistence-contract/index.js";
import * as durable from "./index.js";
import { isOrganizationVerificationAttemptLifecycleExecution } from "../attempt-lifecycle-contract/index.js";
import { isOrganizationVerificationWorkflowExecution, isOrganizationVerificationWorkflowStepRecord } from "../workflow-contract/index.js";
import { isOrganizationVerificationDecisionTrustIntegrationExecution } from "../../domain/decision-trust-integration/index.js";
import { isDurablePlainObject } from "../../domain/durableRehydrationValidation.js";

type Result<T> = Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; code: string }>;
function must<T>(result: Result<T>): T {
  assert.equal(result.ok, true, result.ok ? undefined : result.code);
  if (!result.ok) throw new Error(result.code);
  return result.value;
}

function fixture() {
  const runtime = buildRuntimeFixture();
  const genesis = runtime.chain.workflowExecution;
  const streamIdentity = must(persistence.createOrganizationVerificationWorkflowStreamIdentity({
    workflowExecutionId: genesis.workflowExecutionId,
    organizationId: genesis.organizationId,
    recordId: genesis.recordId,
    revisionId: genesis.revisionId,
    attemptId: genesis.attemptId,
  }));
  const evidence: readonly persistence.OrganizationVerificationDurableEvidence[] = [
    { evidenceKind: "workflow_genesis", artifact: genesis },
    { evidenceKind: "attempt_lifecycle_execution", artifact: runtime.queued.authorityResult.nextLifecycleExecution },
    { evidenceKind: "workflow_step_record", artifact: runtime.queued.workflowStepRecord },
    { evidenceKind: "attempt_lifecycle_execution", artifact: runtime.running.authorityResult.nextLifecycleExecution },
    { evidenceKind: "workflow_step_record", artifact: runtime.running.workflowStepRecord },
    { evidenceKind: "attempt_lifecycle_execution", artifact: runtime.requeued.authorityResult.nextLifecycleExecution },
    { evidenceKind: "workflow_step_record", artifact: runtime.requeued.workflowStepRecord },
    { evidenceKind: "attempt_lifecycle_execution", artifact: runtime.rerunning.authorityResult.nextLifecycleExecution },
    { evidenceKind: "workflow_step_record", artifact: runtime.rerunning.workflowStepRecord },
    { evidenceKind: "attempt_lifecycle_execution", artifact: runtime.completed.authorityResult.nextLifecycleExecution },
    { evidenceKind: "workflow_step_record", artifact: runtime.completed.workflowStepRecord },
    { evidenceKind: "evidence_snapshot", artifact: runtime.snapshotExecution.authorityResult },
    { evidenceKind: "workflow_step_record", artifact: runtime.snapshotExecution.workflowStepRecord },
    { evidenceKind: "evaluation_projection", artifact: runtime.projectionExecution.authorityResult },
    { evidenceKind: "workflow_step_record", artifact: runtime.projectionExecution.workflowStepRecord },
    { evidenceKind: "policy_evaluation_input", artifact: runtime.evaluationInputExecution.authorityResult },
    { evidenceKind: "workflow_step_record", artifact: runtime.evaluationInputExecution.workflowStepRecord },
    { evidenceKind: "policy_runtime_execution", artifact: runtime.policyExecution.authorityResult },
    { evidenceKind: "workflow_step_record", artifact: runtime.policyExecution.workflowStepRecord },
    { evidenceKind: "decision_trust_integration_execution", artifact: runtime.integrationExecution.authorityResult },
    { evidenceKind: "workflow_step_record", artifact: runtime.integrationExecution.workflowStepRecord },
  ];
  const entries: persistence.OrganizationVerificationStoredEvidence[] = [];
  for (const [index, item] of evidence.entries()) {
    entries.push(must(persistence.createOrganizationVerificationStoredEvidence({
      ...item,
      evidenceEntryId: `durable-evidence-${index + 1}`,
      streamIdentity,
      streamPosition: index + 1,
      ...(index === 0 ? {} : { predecessorEvidenceEntryId: entries[index - 1]!.evidenceEntryId }),
      appendedAt: "2026-09-01T00:30:00.000Z",
      provenanceReferences: ["durable-evidence-provenance"],
      integrityReferences: ["durable-evidence-integrity"],
    })));
  }
  return { runtime, streamIdentity, entries };
}

function roundTrip(entry: persistence.OrganizationVerificationStoredEvidence) {
  const created = durable.createOrganizationVerificationDurableEvidenceEnvelope(entry);
  if (!created.ok) throw new Error(`${entry.evidenceKind}:create:${created.code}`);
  const envelope = created.value;
  const serializedResult = durable.serializeOrganizationVerificationDurableEvidence(envelope);
  if (!serializedResult.ok) throw new Error(`${entry.evidenceKind}:serialize:${serializedResult.code}`);
  const serialized = serializedResult.value;
  const parsedResult = durable.parseOrganizationVerificationDurableEvidence(serialized);
  if (!parsedResult.ok) throw new Error(`${entry.evidenceKind}:parse:${parsedResult.code}`);
  const parsed = parsedResult.value;
  const rehydratedResult = durable.rehydrateOrganizationVerificationDurableEvidence(parsed);
  if (!rehydratedResult.ok) throw new Error(`${entry.evidenceKind}:rehydrate:${rehydratedResult.code}`);
  return { envelope, serialized, parsed, rehydrated: rehydratedResult.value };
}

test("all durable evidence kinds round-trip deterministically into newly authentic evidence", () => {
  const source = fixture();
  for (const entry of source.entries) {
    const first = roundTrip(entry);
    const second = roundTrip(entry);
    assert.equal(first.serialized, second.serialized);
    assert.equal(first.envelope.payloadFingerprint, second.envelope.payloadFingerprint);
    assert.notEqual(first.rehydrated, entry);
    assert.notEqual(first.rehydrated.artifact, entry.artifact);
    assert.equal(first.rehydrated.storedEvidenceFingerprint, entry.storedEvidenceFingerprint);
    assert.equal(persistence.isOrganizationVerificationStoredEvidence(first.rehydrated), true);
  }
});

test("canonical serialization is independent of top-level and nested property insertion order", () => {
  const source = fixture();
  const envelope = must(durable.createOrganizationVerificationDurableEvidenceEnvelope(source.entries[19]!));
  function reverseInsertionOrder(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(reverseInsertionOrder);
    if (!isDurablePlainObject(value)) return value;
    return Object.fromEntries(
      Object.keys(value).reverse().map((key) => [key, reverseInsertionOrder(value[key])]),
    );
  }
  const reorderedPayload = reverseInsertionOrder(envelope.payload);
  assert.equal(isDurablePlainObject(reorderedPayload), true);
  if (!isDurablePlainObject(reorderedPayload)) return;
  const reorderedEnvelope = Object.freeze({
    payloadFingerprint: envelope.payloadFingerprint,
    payload: reorderedPayload,
    evidenceKind: envelope.evidenceKind,
    contractVersion: envelope.contractVersion,
  });
  assert.equal(
    must(durable.serializeOrganizationVerificationDurableEvidence(reorderedEnvelope)),
    must(durable.serializeOrganizationVerificationDurableEvidence(envelope)),
  );
});

test("rehydrated nested lifecycle, workflow, and decision-trust evidence pass existing guards", () => {
  const source = fixture();
  const genesis = roundTrip(source.entries[0]!).rehydrated;
  const lifecycle = roundTrip(source.entries[1]!).rehydrated;
  const step = roundTrip(source.entries[2]!).rehydrated;
  const integration = roundTrip(source.entries[19]!).rehydrated;
  assert.equal(genesis.evidenceKind, "workflow_genesis");
  assert.equal(isOrganizationVerificationWorkflowExecution(genesis.artifact), true);
  assert.equal(lifecycle.evidenceKind, "attempt_lifecycle_execution");
  assert.equal(isOrganizationVerificationAttemptLifecycleExecution(lifecycle.artifact), true);
  assert.equal(step.evidenceKind, "workflow_step_record");
  assert.equal(isOrganizationVerificationWorkflowStepRecord(step.artifact), true);
  assert.equal(integration.evidenceKind, "decision_trust_integration_execution");
  assert.equal(isOrganizationVerificationDecisionTrustIntegrationExecution(integration.artifact), true);
});

test("payload, fingerprint, discriminator, identity, and authority-binding corruption fail closed", () => {
  const source = fixture();
  const original = roundTrip(source.entries[19]!);
  const parsed: unknown = JSON.parse(original.serialized);
  assert.equal(isDurablePlainObject(parsed), true);
  if (!isDurablePlainObject(parsed) || !isDurablePlainObject(parsed.payload)) return;
  for (const changed of [
    { ...parsed, evidenceKind: "unsupported" },
    { ...parsed, payloadFingerprint: "sha256:changed" },
    { ...parsed, extra: "forbidden" },
    { ...parsed, payload: { ...parsed.payload, evidenceEntryId: "changed-entry" } },
  ]) {
    assert.equal(durable.parseOrganizationVerificationDurableEvidence(JSON.stringify(changed)).ok, false);
  }
  const changedBinding: unknown = JSON.parse(original.serialized);
  assert.equal(isDurablePlainObject(changedBinding), true);
  if (!isDurablePlainObject(changedBinding) || !isDurablePlainObject(changedBinding.payload)) return;
  const artifact = changedBinding.payload.artifact;
  if (!isDurablePlainObject(artifact) || !isDurablePlainObject(artifact.binding)) return;
  Reflect.set(artifact.binding, "decisionBindingFingerprint", "sha256:changed-binding");
  assert.equal(durable.parseOrganizationVerificationDurableEvidence(JSON.stringify(changedBinding)).ok, false);
});

test("plain structural clones cannot impersonate runtime evidence", () => {
  const source = fixture();
  for (const entry of source.entries) {
    assert.equal(persistence.isOrganizationVerificationStoredEvidence(JSON.parse(JSON.stringify(entry))), false);
  }
});

test("durable representation excludes runtime-only WorkflowStepExecution and executable values", () => {
  const source = fixture();
  function forbiddenKey(value: unknown): boolean {
    if (Array.isArray(value)) return value.some(forbiddenKey);
    if (typeof value !== "object" || value === null) return false;
    return Object.keys(value).some((key) => key === "workflowStepExecution" || key === "nextWorkflowExecution" || forbiddenKey(Object.getOwnPropertyDescriptor(value, key)?.value));
  }
  for (const entry of source.entries) {
    const serialized = roundTrip(entry).serialized;
    assert.equal(forbiddenKey(JSON.parse(serialized)), false);
  }
});

test("JSON process-boundary round-trip rehydrates a complete stream consumable by Replay", () => {
  const source = fixture();
  const session = durable.createOrganizationVerificationDurableEvidenceRehydrationSession();
  const rehydratedEntries = source.entries.map((entry) => {
    const envelope = must(durable.createOrganizationVerificationDurableEvidenceEnvelope(entry));
    const serialized = must(durable.serializeOrganizationVerificationDurableEvidence(envelope));
    const parsed = must(durable.parseOrganizationVerificationDurableEvidence(serialized));
    return must(session.rehydrate(parsed));
  });
  const stream = must(persistence.createOrganizationVerificationEvidenceStream({
    streamIdentity: rehydratedEntries[0]!.streamIdentity,
    entries: rehydratedEntries,
  }));
  const request = must(createOrganizationVerificationReplayRequest({
    replayRequestId: "durable-replay-request",
    replayExecutionId: "durable-replay-execution",
    sourceEvidenceStream: stream,
    replayedAt: "2026-09-01T00:40:00.000Z",
    provenanceReferences: ["durable-replay-provenance"],
    integrityReferences: ["durable-replay-integrity"],
  }));
  const replay = replayOrganizationVerificationWorkflow(request);
  assert.equal(replay.outcome, "replay_completed", replay.outcome === "replay_rejected" ? `${replay.failure.code}:${JSON.stringify(replay.failure.diagnostic)}` : undefined);
  if (replay.outcome !== "replay_completed") return;
  assert.equal(replay.execution.reconstructedWorkflowExecution.workflowStage, source.runtime.integrationExecution.nextWorkflowExecution.workflowStage);
  assert.equal(replay.execution.reconstructedWorkflowExecution.workflowExecutionVersion, source.runtime.integrationExecution.nextWorkflowExecution.workflowExecutionVersion);
  assert.equal(replay.execution.reconstructedAttemptLifecycleExecution.attemptLifecycleExecutionFingerprint, source.runtime.integrationExecution.nextWorkflowExecution.lifecycleExecution.attemptLifecycleExecutionFingerprint);
  assert.equal(replay.execution.diagnostics.totalEvidenceEntriesConsumed, source.entries.length);
});

test("durable evidence public export surface is exact and exposes no owner internals", () => {
  assert.deepEqual(Object.keys(durable).sort(), [
    "ORGANIZATION_VERIFICATION_DURABLE_EVIDENCE_CONTRACT_VERSION",
    "createOrganizationVerificationDurableEvidenceEnvelope",
    "createOrganizationVerificationDurableEvidenceRehydrationSession",
    "parseOrganizationVerificationDurableEvidence",
    "rehydrateOrganizationVerificationDurableEvidence",
    "serializeOrganizationVerificationDurableEvidence",
  ]);
});
