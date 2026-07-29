import assert from "node:assert/strict";
import test from "node:test";
import { buildRuntimeFixture } from "../workflow-runtime/workflowRuntime.test.js";
import * as workflow from "../workflow-contract/index.js";
import * as persistence from "./index.js";

type Result<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; code: string }>;

function must<T>(result: Result<T>): T {
  assert.equal(result.ok, true, result.ok ? undefined : result.code);
  if (!result.ok) throw new Error(result.code);
  return result.value;
}

function buildEvidenceChain() {
  const fixture = buildRuntimeFixture();
  const genesis = fixture.chain.workflowExecution;
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
  const entries: persistence.OrganizationVerificationStoredEvidence[] = [];
  for (const [index, evidence] of durableEvidence.entries()) {
    entries.push(
      must(
        persistence.createOrganizationVerificationStoredEvidence({
          ...evidence,
          evidenceEntryId: `persistence-entry-${index + 1}`,
          streamIdentity,
          streamPosition: index + 1,
          ...(index === 0
            ? {}
            : {
                predecessorEvidenceEntryId:
                  entries[index - 1]?.evidenceEntryId,
              }),
          appendedAt: "2026-09-01T00:30:00.000Z",
          provenanceReferences: ["persistence-provenance"],
          integrityReferences: ["persistence-integrity"],
        }),
      ),
    );
  }
  return { fixture, streamIdentity, durableEvidence, entries };
}

test("classifies every frozen evidence surface without competing authority", () => {
  const classifications =
    persistence.ORGANIZATION_VERIFICATION_ARTIFACT_PERSISTENCE_CLASSIFICATION;
  assert.equal(classifications.length, 15);
  assert.equal(
    classifications.filter((entry) => entry.persistenceMode === "genesis_only")
      .length,
    1,
  );
  assert.deepEqual(
    classifications
      .filter((entry) => entry.classification === "derived_runtime_envelope")
      .map((entry) => entry.artifact)
      .sort(),
    [
      "OrganizationVerificationAttemptLifecycleTransitionExecution",
      "OrganizationVerificationWorkflowStepExecution",
    ],
  );
  assert.equal(
    new Set(
      classifications
        .filter((entry) => entry.persistenceMode === "standalone")
        .map((entry) => entry.sourceOfTruth),
    ).size,
    classifications.filter((entry) => entry.persistenceMode === "standalone")
      .length,
  );
});

test("accepts exactly every approved durable evidence kind", () => {
  const chain = buildEvidenceChain();
  assert.deepEqual(
    [...new Set(chain.entries.map((entry) => entry.evidenceKind))].sort(),
    [...persistence.ORGANIZATION_VERIFICATION_DURABLE_EVIDENCE_KINDS].sort(),
  );
  assert.equal(chain.entries.every(Object.isFrozen), true);
  assert.equal(
    chain.entries.every((entry) =>
      persistence.isOrganizationVerificationStoredEvidence(entry),
    ),
    true,
  );
});

test("rejects unsupported kinds, fake artifacts, and stream mismatches", () => {
  const chain = buildEvidenceChain();
  const unsupported =
    persistence.createOrganizationVerificationStoredEvidence({
      evidenceKind: "unknown",
      artifact: chain.fixture.chain.workflowExecution,
      evidenceEntryId: "unsupported-entry",
      streamIdentity: chain.streamIdentity,
      streamPosition: 1,
      appendedAt: "2026-09-01T00:30:00.000Z",
      provenanceReferences: ["provenance"],
      integrityReferences: ["integrity"],
  } as never);
  assert.deepEqual(unsupported, {
    ok: false,
    code: "unsupported_evidence_kind",
  });

  const fake = persistence.createOrganizationVerificationStoredEvidence({
    evidenceKind: "workflow_genesis",
    artifact: Object.freeze({
      ...chain.fixture.chain.workflowExecution,
    }),
    evidenceEntryId: "fake-entry",
    streamIdentity: chain.streamIdentity,
    streamPosition: 1,
    appendedAt: "2026-09-01T00:30:00.000Z",
    provenanceReferences: ["provenance"],
    integrityReferences: ["integrity"],
  } as never);
  assert.deepEqual(fake, { ok: false, code: "unauthentic_evidence" });

  const otherStream = must(
    persistence.createOrganizationVerificationWorkflowStreamIdentity({
      ...chain.streamIdentity,
      organizationId: "other-organization",
    }),
  );
  const mismatch = persistence.createOrganizationVerificationStoredEvidence({
    evidenceKind: "evidence_snapshot",
    artifact: chain.fixture.snapshotExecution.authorityResult,
    evidenceEntryId: "mismatch-entry",
    streamIdentity: otherStream,
    streamPosition: 1,
    appendedAt: "2026-09-01T00:30:00.000Z",
    provenanceReferences: ["provenance"],
    integrityReferences: ["integrity"],
  });
  assert.deepEqual(mismatch, {
    ok: false,
    code: "stream_identity_mismatch",
  });
});

test("stored evidence is deterministic, deeply immutable, and uses explicit time", () => {
  const chain = buildEvidenceChain();
  const first = chain.entries[0]!;
  const replay = must(
    persistence.createOrganizationVerificationStoredEvidence({
      ...chain.durableEvidence[0]!,
      evidenceEntryId: first.evidenceEntryId,
      streamIdentity: chain.streamIdentity,
      streamPosition: 1,
      appendedAt: first.appendedAt,
      provenanceReferences: ["persistence-provenance"],
      integrityReferences: ["persistence-integrity"],
    }),
  );
  assert.equal(
    replay.storedEvidenceFingerprint,
    first.storedEvidenceFingerprint,
  );
  assert.equal(Object.isFrozen(first.provenanceReferences), true);
  assert.equal(Object.isFrozen(first.integrityReferences), true);
  assert.equal(
    persistence.isOrganizationVerificationStoredEvidence({ ...first }),
    false,
  );
  assert.deepEqual(
    persistence.createOrganizationVerificationStoredEvidence({
      ...chain.durableEvidence[0]!,
      evidenceEntryId: "missing-time-entry",
      streamIdentity: chain.streamIdentity,
      streamPosition: 1,
      appendedAt: "",
      provenanceReferences: ["provenance"],
      integrityReferences: ["integrity"],
    }),
    { ok: false, code: "malformed_append_metadata" },
  );
  const exactEnvelope = must(
    persistence.createOrganizationVerificationStoredEvidence({
      ...chain.durableEvidence[0]!,
      evidenceEntryId: "exact-envelope-entry",
      streamIdentity: chain.streamIdentity,
      streamPosition: 1,
      appendedAt: first.appendedAt,
      provenanceReferences: ["persistence-provenance"],
      integrityReferences: ["persistence-integrity"],
      unexpectedCallerProperty: "must-not-survive",
    } as never),
  );
  assert.equal("unexpectedCallerProperty" in exactEnvelope, false);
});

test("requires a non-empty, exact-position append batch for one stream", () => {
  const chain = buildEvidenceChain();
  const empty = persistence.createOrganizationVerificationEvidenceAppendBatch({
    appendId: "append-empty",
    streamIdentity: chain.streamIdentity,
    expectedStreamVersion: 0,
    entries: [],
    appendedAt: "2026-09-01T00:31:00.000Z",
    provenanceReferences: ["provenance"],
    integrityReferences: ["integrity"],
  });
  assert.deepEqual(empty, {
    ok: false,
    code: "malformed_append_metadata",
  });

  const genesis = must(
    persistence.createOrganizationVerificationEvidenceAppendBatch({
      appendId: "append-genesis",
      streamIdentity: chain.streamIdentity,
      expectedStreamVersion: 0,
      entries: [chain.entries[0]!],
      appendedAt: "2026-09-01T00:31:00.000Z",
      provenanceReferences: ["batch-provenance"],
      integrityReferences: ["batch-integrity"],
    }),
  );
  assert.equal(genesis.expectedStreamVersion, 0);
  assert.equal(genesis.entries.length, 1);

  const step = must(
    persistence.createOrganizationVerificationEvidenceAppendBatch({
      appendId: "append-step",
      streamIdentity: chain.streamIdentity,
      expectedStreamVersion: 1,
      expectedHeadEvidenceEntryId: chain.entries[0]!.evidenceEntryId,
      entries: chain.entries.slice(1, 3),
      appendedAt: "2026-09-01T00:31:00.000Z",
      provenanceReferences: ["batch-provenance"],
      integrityReferences: ["batch-integrity"],
    }),
  );
  assert.equal(step.entries.length, 2);
  assert.equal(Object.isFrozen(step.entries), true);
});

test("append batch rejects wrong stream, gaps, duplicates, and semantic conflicts", () => {
  const chain = buildEvidenceChain();
  const otherStream = must(
    persistence.createOrganizationVerificationWorkflowStreamIdentity({
      ...chain.streamIdentity,
      workflowExecutionId: "other-workflow-stream",
    }),
  );
  assert.deepEqual(
    persistence.createOrganizationVerificationEvidenceAppendBatch({
      appendId: "append-wrong-stream",
      streamIdentity: otherStream,
      expectedStreamVersion: 0,
      entries: [chain.entries[0]!],
      appendedAt: "2026-09-01T00:31:00.000Z",
      provenanceReferences: ["provenance"],
      integrityReferences: ["integrity"],
    }),
    { ok: false, code: "stream_identity_mismatch" },
  );
  const wrongPosition =
    persistence.createOrganizationVerificationEvidenceAppendBatch({
      appendId: "append-gap",
      streamIdentity: chain.streamIdentity,
      expectedStreamVersion: 3,
      expectedHeadEvidenceEntryId: chain.entries[2]!.evidenceEntryId,
      entries: chain.entries.slice(1, 3),
      appendedAt: "2026-09-01T00:31:00.000Z",
      provenanceReferences: ["provenance"],
      integrityReferences: ["integrity"],
    });
  assert.deepEqual(wrongPosition, {
    ok: false,
    code: "invalid_evidence_order",
  });

  const duplicateAuthority = must(
    persistence.createOrganizationVerificationStoredEvidence({
      evidenceKind: "attempt_lifecycle_execution",
      artifact: chain.fixture.queued.authorityResult.nextLifecycleExecution,
      evidenceEntryId: "duplicate-semantic",
      streamIdentity: chain.streamIdentity,
      streamPosition: 4,
      predecessorEvidenceEntryId: chain.entries[2]!.evidenceEntryId,
      appendedAt: "2026-09-01T00:30:00.000Z",
      provenanceReferences: ["provenance"],
      integrityReferences: ["integrity"],
    }),
  );
  const duplicateStep = must(
    persistence.createOrganizationVerificationStoredEvidence({
      evidenceKind: "workflow_step_record",
      artifact: chain.fixture.queued.workflowStepRecord,
      evidenceEntryId: "duplicate-step-semantic",
      streamIdentity: chain.streamIdentity,
      streamPosition: 5,
      predecessorEvidenceEntryId: duplicateAuthority.evidenceEntryId,
      appendedAt: "2026-09-01T00:30:00.000Z",
      provenanceReferences: ["provenance"],
      integrityReferences: ["integrity"],
    }),
  );
  const semanticConflict =
    persistence.createOrganizationVerificationEvidenceAppendBatch({
      appendId: "append-semantic-conflict",
      streamIdentity: chain.streamIdentity,
      expectedStreamVersion: 1,
      expectedHeadEvidenceEntryId: chain.entries[0]!.evidenceEntryId,
      entries: [
        chain.entries[1]!,
        chain.entries[2]!,
        duplicateAuthority,
        duplicateStep,
      ],
      appendedAt: "2026-09-01T00:31:00.000Z",
      provenanceReferences: ["provenance"],
      integrityReferences: ["integrity"],
    });
  assert.deepEqual(semanticConflict, {
    ok: false,
    code: "evidence_identity_conflict",
  });

  const duplicateIdStep = must(
    persistence.createOrganizationVerificationStoredEvidence({
      evidenceKind: "workflow_step_record",
      artifact: chain.fixture.queued.workflowStepRecord,
      evidenceEntryId: chain.entries[1]!.evidenceEntryId,
      streamIdentity: chain.streamIdentity,
      streamPosition: 3,
      predecessorEvidenceEntryId: chain.entries[1]!.evidenceEntryId,
      appendedAt: "2026-09-01T00:30:00.000Z",
      provenanceReferences: ["provenance"],
      integrityReferences: ["integrity"],
    }),
  );
  assert.deepEqual(
    persistence.createOrganizationVerificationEvidenceAppendBatch({
      appendId: "append-duplicate-id",
      streamIdentity: chain.streamIdentity,
      expectedStreamVersion: 1,
      expectedHeadEvidenceEntryId: chain.entries[0]!.evidenceEntryId,
      entries: [chain.entries[1]!, duplicateIdStep],
      appendedAt: "2026-09-01T00:31:00.000Z",
      provenanceReferences: ["provenance"],
      integrityReferences: ["integrity"],
    }),
    { ok: false, code: "evidence_identity_conflict" },
  );

  const wrongStep = must(
    persistence.createOrganizationVerificationStoredEvidence({
      evidenceKind: "workflow_step_record",
      artifact: chain.fixture.snapshotExecution.workflowStepRecord,
      evidenceEntryId: "wrong-step-kind",
      streamIdentity: chain.streamIdentity,
      streamPosition: 3,
      predecessorEvidenceEntryId: chain.entries[1]!.evidenceEntryId,
      appendedAt: "2026-09-01T00:30:00.000Z",
      provenanceReferences: ["provenance"],
      integrityReferences: ["integrity"],
    }),
  );
  assert.deepEqual(
    persistence.createOrganizationVerificationEvidenceAppendBatch({
      appendId: "append-wrong-step-kind",
      streamIdentity: chain.streamIdentity,
      expectedStreamVersion: 1,
      expectedHeadEvidenceEntryId: chain.entries[0]!.evidenceEntryId,
      entries: [chain.entries[1]!, wrongStep],
      appendedAt: "2026-09-01T00:31:00.000Z",
      provenanceReferences: ["provenance"],
      integrityReferences: ["integrity"],
    }),
    { ok: false, code: "invalid_evidence_order" },
  );
});

test("classifies exact duplicate, identity, and fingerprint conflicts without storage state", () => {
  const chain = buildEvidenceChain();
  const genesis = chain.fixture.chain.workflowExecution;
  const exactReplay = must(
    persistence.createOrganizationVerificationStoredEvidence({
      ...chain.durableEvidence[0]!,
      evidenceEntryId: chain.entries[0]!.evidenceEntryId,
      streamIdentity: chain.streamIdentity,
      streamPosition: 1,
      appendedAt: chain.entries[0]!.appendedAt,
      provenanceReferences: ["persistence-provenance"],
      integrityReferences: ["persistence-integrity"],
    }),
  );
  assert.deepEqual(
    persistence.classifyOrganizationVerificationStoredEvidenceConflict(
      chain.entries[0]!,
      exactReplay,
    ),
    { ok: true, value: "duplicate_append_idempotent" },
  );

  const alternateGenesis = must(
    workflow.createOrganizationVerificationWorkflowExecution({
      workflowExecutionId: genesis.workflowExecutionId,
      workflowExecutionVersion: genesis.workflowExecutionVersion,
      organizationId: genesis.organizationId,
      recordId: genesis.recordId,
      revisionId: genesis.revisionId,
      attemptId: genesis.attemptId,
      workflowStage: genesis.workflowStage,
      lifecycleExecution: genesis.lifecycleExecution,
      stepRecords: [],
      createdAt: genesis.createdAt,
      provenanceReferences: ["alternate-genesis-provenance"],
      integrityReferences: ["alternate-genesis-integrity"],
    }),
  );
  const fingerprintConflict = must(
    persistence.createOrganizationVerificationStoredEvidence({
      evidenceKind: "workflow_genesis",
      artifact: alternateGenesis,
      evidenceEntryId: "alternate-genesis-entry",
      streamIdentity: chain.streamIdentity,
      streamPosition: 1,
      appendedAt: chain.entries[0]!.appendedAt,
      provenanceReferences: ["persistence-provenance"],
      integrityReferences: ["persistence-integrity"],
    }),
  );
  assert.notEqual(
    fingerprintConflict.artifactFingerprint,
    chain.entries[0]!.artifactFingerprint,
  );
  assert.deepEqual(
    persistence.classifyOrganizationVerificationStoredEvidenceConflict(
      chain.entries[0]!,
      fingerprintConflict,
    ),
    { ok: true, value: "evidence_fingerprint_conflict" },
  );

  const identityConflict = must(
    persistence.createOrganizationVerificationStoredEvidence({
      ...chain.durableEvidence[0]!,
      evidenceEntryId: chain.entries[0]!.evidenceEntryId,
      streamIdentity: chain.streamIdentity,
      streamPosition: 1,
      appendedAt: "2026-09-01T00:31:00.000Z",
      provenanceReferences: ["persistence-provenance"],
      integrityReferences: ["persistence-integrity"],
    }),
  );
  assert.deepEqual(
    persistence.classifyOrganizationVerificationStoredEvidenceConflict(
      chain.entries[0]!,
      identityConflict,
    ),
    { ok: true, value: "evidence_identity_conflict" },
  );
});

test("append batch fingerprint is deterministic and caller mutation cannot alter it", () => {
  const chain = buildEvidenceChain();
  const callerEntries = [chain.entries[0]!];
  const input = {
    appendId: "append-deterministic",
    streamIdentity: chain.streamIdentity,
    expectedStreamVersion: 0,
    entries: callerEntries,
    appendedAt: "2026-09-01T00:31:00.000Z",
    provenanceReferences: ["z-provenance", "a-provenance"],
    integrityReferences: ["z-integrity", "a-integrity"],
  } as const;
  const first = must(
    persistence.createOrganizationVerificationEvidenceAppendBatch(input),
  );
  const second = must(
    persistence.createOrganizationVerificationEvidenceAppendBatch({
      ...input,
      provenanceReferences: ["a-provenance", "z-provenance"],
      integrityReferences: ["a-integrity", "z-integrity"],
    }),
  );
  callerEntries.length = 0;
  assert.equal(first.entries.length, 1);
  assert.equal(first.appendBatchFingerprint, second.appendBatchFingerprint);
  assert.equal(
    persistence.isOrganizationVerificationEvidenceAppendBatch({ ...first }),
    false,
  );
});

test("receipt advances by batch size and distinguishes exact idempotent replay", () => {
  const chain = buildEvidenceChain();
  const genesisBatch = must(
    persistence.createOrganizationVerificationEvidenceAppendBatch({
      appendId: "append-receipt-genesis",
      streamIdentity: chain.streamIdentity,
      expectedStreamVersion: 0,
      entries: [chain.entries[0]!],
      appendedAt: "2026-09-01T00:31:00.000Z",
      provenanceReferences: ["provenance"],
      integrityReferences: ["integrity"],
    }),
  );
  const genesisReceipt = must(
    persistence.createOrganizationVerificationEvidenceAppendReceipt({
      batch: genesisBatch,
      outcome: "appended",
    }),
  );
  assert.equal(genesisReceipt.previousStreamVersion, 0);
  assert.equal(genesisReceipt.resultingStreamVersion, 1);

  const batch = must(
    persistence.createOrganizationVerificationEvidenceAppendBatch({
      appendId: "append-receipt",
      streamIdentity: chain.streamIdentity,
      expectedStreamVersion: 1,
      expectedHeadEvidenceEntryId: chain.entries[0]!.evidenceEntryId,
      entries: chain.entries.slice(1, 3),
      appendedAt: "2026-09-01T00:31:00.000Z",
      provenanceReferences: ["provenance"],
      integrityReferences: ["integrity"],
    }),
  );
  const appended = must(
    persistence.createOrganizationVerificationEvidenceAppendReceipt({
      batch,
      outcome: "appended",
    }),
  );
  const duplicate = must(
    persistence.createOrganizationVerificationEvidenceAppendReceipt({
      batch,
      outcome: "duplicate_append_idempotent",
    }),
  );
  assert.equal(appended.previousStreamVersion, 1);
  assert.equal(appended.resultingStreamVersion, 3);
  assert.equal(appended.firstAppendedPosition, 2);
  assert.equal(appended.lastAppendedPosition, 3);
  assert.equal(appended.idempotentReplay, false);
  assert.equal(duplicate.idempotentReplay, true);
  assert.notEqual(
    appended.appendReceiptFingerprint,
    duplicate.appendReceiptFingerprint,
  );
  assert.equal(
    persistence.isOrganizationVerificationEvidenceAppendReceipt({
      ...appended,
    }),
    false,
  );

  const multiplePairs = must(
    persistence.createOrganizationVerificationEvidenceAppendBatch({
      appendId: "append-receipt-multiple-pairs",
      streamIdentity: chain.streamIdentity,
      expectedStreamVersion: 1,
      expectedHeadEvidenceEntryId: chain.entries[0]!.evidenceEntryId,
      entries: chain.entries.slice(1, 5),
      appendedAt: "2026-09-01T00:31:00.000Z",
      provenanceReferences: ["provenance"],
      integrityReferences: ["integrity"],
    }),
  );
  assert.equal(
    must(
      persistence.createOrganizationVerificationEvidenceAppendReceipt({
        batch: multiplePairs,
        outcome: "appended",
      }),
    ).resultingStreamVersion,
    5,
  );
});

test("append request validation binds the exact stream and expected version", () => {
  const chain = buildEvidenceChain();
  const batch = must(
    persistence.createOrganizationVerificationEvidenceAppendBatch({
      appendId: "append-request",
      streamIdentity: chain.streamIdentity,
      expectedStreamVersion: 0,
      entries: [chain.entries[0]!],
      appendedAt: "2026-09-01T00:31:00.000Z",
      provenanceReferences: ["provenance"],
      integrityReferences: ["integrity"],
    }),
  );
  assert.deepEqual(
    persistence.validateAppendOrganizationVerificationEvidenceRequest({
      streamIdentity: chain.streamIdentity,
      expectedStreamVersion: 0,
      batch,
    }),
    { ok: true, value: true },
  );
  assert.deepEqual(
    persistence.validateAppendOrganizationVerificationEvidenceRequest({
      streamIdentity: chain.streamIdentity,
      expectedStreamVersion: 1,
      batch,
    }),
    { ok: false, code: "expected_stream_version_conflict" },
  );
});

test("validates the complete ordered evidence stream without replaying state", () => {
  const chain = buildEvidenceChain();
  const stream = must(
    persistence.createOrganizationVerificationEvidenceStream({
      streamIdentity: chain.streamIdentity,
      entries: chain.entries,
    }),
  );
  assert.equal(stream.streamVersion, 21);
  assert.notEqual(
    stream.streamVersion,
    stream.entries[0]!.artifactVersionOrSequence,
  );
  assert.notEqual(
    stream.streamVersion,
    chain.fixture.completed.authorityResult.nextLifecycleExecution
      .lifecycleExecutionVersion,
  );
  assert.equal(stream.integrity.verificationStatus, "verified");
  assert.equal(stream.headEvidenceReference.streamPosition, 21);
  assert.equal(Object.isFrozen(stream.entries), true);
  assert.equal(
    persistence.isOrganizationVerificationEvidenceStream(stream),
    true,
  );
  const found = must(
    persistence.organizationVerificationEvidenceStreamFound(stream),
  );
  const missing = must(
    persistence.organizationVerificationEvidenceStreamNotFound(
      chain.streamIdentity,
    ),
  );
  assert.equal(found.status, "found");
  assert.equal(missing.status, "not_found");
});

test("stream integrity fails closed for structural clones, gaps, and incomplete pairs", () => {
  const chain = buildEvidenceChain();
  const cloned = { ...chain.entries[0] };
  assert.deepEqual(
    persistence.validateOrganizationVerificationEvidenceStreamIntegrity(
      chain.streamIdentity,
      [cloned as never],
    ),
    { ok: false, code: "stored_integrity_failure" },
  );
  assert.deepEqual(
    persistence.createOrganizationVerificationEvidenceStream({
      streamIdentity: chain.streamIdentity,
      entries: chain.entries.slice(0, 2),
    }),
    { ok: false, code: "invalid_evidence_order" },
  );
  assert.deepEqual(
    persistence.createOrganizationVerificationEvidenceStream({
      streamIdentity: chain.streamIdentity,
      entries: [chain.entries[0]!, chain.entries[3]!, chain.entries[4]!],
    }),
    { ok: false, code: "stored_integrity_failure" },
  );

  const duplicatePosition = must(
    persistence.createOrganizationVerificationStoredEvidence({
      evidenceKind: "attempt_lifecycle_execution",
      artifact: chain.fixture.queued.authorityResult.nextLifecycleExecution,
      evidenceEntryId: "duplicate-position",
      streamIdentity: chain.streamIdentity,
      streamPosition: 1,
      appendedAt: "2026-09-01T00:30:00.000Z",
      provenanceReferences: ["provenance"],
      integrityReferences: ["integrity"],
    }),
  );
  assert.deepEqual(
    persistence.validateOrganizationVerificationEvidenceStreamIntegrity(
      chain.streamIdentity,
      [chain.entries[0]!, duplicatePosition],
    ),
    { ok: false, code: "stored_integrity_failure" },
  );

  const brokenPredecessor = must(
    persistence.createOrganizationVerificationStoredEvidence({
      evidenceKind: "attempt_lifecycle_execution",
      artifact: chain.fixture.queued.authorityResult.nextLifecycleExecution,
      evidenceEntryId: "broken-predecessor",
      streamIdentity: chain.streamIdentity,
      streamPosition: 2,
      predecessorEvidenceEntryId: "not-the-genesis-head",
      appendedAt: "2026-09-01T00:30:00.000Z",
      provenanceReferences: ["provenance"],
      integrityReferences: ["integrity"],
    }),
  );
  assert.deepEqual(
    persistence.validateOrganizationVerificationEvidenceStreamIntegrity(
      chain.streamIdentity,
      [chain.entries[0]!, brokenPredecessor],
    ),
    { ok: false, code: "invalid_evidence_order" },
  );

  const lateAuthority = must(
    persistence.createOrganizationVerificationStoredEvidence({
      evidenceKind: "attempt_lifecycle_execution",
      artifact: chain.fixture.queued.authorityResult.nextLifecycleExecution,
      evidenceEntryId: "late-authority",
      streamIdentity: chain.streamIdentity,
      streamPosition: 2,
      predecessorEvidenceEntryId: chain.entries[0]!.evidenceEntryId,
      appendedAt: "2026-09-01T00:40:00.000Z",
      provenanceReferences: ["provenance"],
      integrityReferences: ["integrity"],
    }),
  );
  const earlierStep = must(
    persistence.createOrganizationVerificationStoredEvidence({
      evidenceKind: "workflow_step_record",
      artifact: chain.fixture.queued.workflowStepRecord,
      evidenceEntryId: "earlier-step",
      streamIdentity: chain.streamIdentity,
      streamPosition: 3,
      predecessorEvidenceEntryId: lateAuthority.evidenceEntryId,
      appendedAt: "2026-09-01T00:35:00.000Z",
      provenanceReferences: ["provenance"],
      integrityReferences: ["integrity"],
    }),
  );
  assert.deepEqual(
    persistence.validateOrganizationVerificationEvidenceStreamIntegrity(
      chain.streamIdentity,
      [chain.entries[0]!, lateAuthority, earlierStep],
    ),
    { ok: false, code: "invalid_evidence_order" },
  );

  const driftStream = must(
    persistence.createOrganizationVerificationWorkflowStreamIdentity({
      ...chain.streamIdentity,
      workflowExecutionId: "drift-workflow",
    }),
  );
  const driftEntry = must(
    persistence.createOrganizationVerificationStoredEvidence({
      evidenceKind: "attempt_lifecycle_execution",
      artifact: chain.fixture.queued.authorityResult.nextLifecycleExecution,
      evidenceEntryId: "drift-entry",
      streamIdentity: driftStream,
      streamPosition: 2,
      predecessorEvidenceEntryId: chain.entries[0]!.evidenceEntryId,
      appendedAt: "2026-09-01T00:30:00.000Z",
      provenanceReferences: ["provenance"],
      integrityReferences: ["integrity"],
    }),
  );
  assert.deepEqual(
    persistence.validateOrganizationVerificationEvidenceStreamIntegrity(
      chain.streamIdentity,
      [chain.entries[0]!, driftEntry],
    ),
    { ok: false, code: "stored_integrity_failure" },
  );

  const original = chain.entries[1]!;
  const fingerprintTamper = {
    ...original,
    artifactFingerprint: "tampered-fingerprint",
  };
  for (const symbol of Object.getOwnPropertySymbols(original)) {
    const descriptor = Object.getOwnPropertyDescriptor(original, symbol);
    if (descriptor !== undefined) {
      Object.defineProperty(fingerprintTamper, symbol, descriptor);
    }
  }
  Object.freeze(fingerprintTamper);
  assert.deepEqual(
    persistence.validateOrganizationVerificationEvidenceStreamIntegrity(
      chain.streamIdentity,
      [chain.entries[0]!, fingerprintTamper as never],
    ),
    { ok: false, code: "stored_integrity_failure" },
  );

  const competingAuthority = must(
    persistence.createOrganizationVerificationStoredEvidence({
      evidenceKind: "attempt_lifecycle_execution",
      artifact: chain.fixture.queued.authorityResult.nextLifecycleExecution,
      evidenceEntryId: "competing-authority",
      streamIdentity: chain.streamIdentity,
      streamPosition: 4,
      predecessorEvidenceEntryId: chain.entries[2]!.evidenceEntryId,
      appendedAt: "2026-09-01T00:30:00.000Z",
      provenanceReferences: ["provenance"],
      integrityReferences: ["integrity"],
    }),
  );
  assert.deepEqual(
    persistence.validateOrganizationVerificationEvidenceStreamIntegrity(
      chain.streamIdentity,
      [
        chain.entries[0]!,
        chain.entries[1]!,
        chain.entries[2]!,
        competingAuthority,
      ],
    ),
    { ok: false, code: "evidence_identity_conflict" },
  );
});

test("trusted persistence values reject spread, clone, assign, and JSON impersonation", () => {
  const chain = buildEvidenceChain();
  const stream = must(
    persistence.createOrganizationVerificationEvidenceStream({
      streamIdentity: chain.streamIdentity,
      entries: chain.entries,
    }),
  );
  assert.equal(
    persistence.isOrganizationVerificationWorkflowStreamIdentity({
      ...chain.streamIdentity,
    }),
    false,
  );
  assert.equal(
    persistence.isOrganizationVerificationStoredEvidence(
      Object.assign({}, chain.entries[0]),
    ),
    false,
  );
  assert.equal(
    persistence.isOrganizationVerificationStoredEvidence(
      Object.freeze({ ...chain.entries[0] }),
    ),
    false,
  );
  assert.equal(
    persistence.isOrganizationVerificationStoredEvidence(
      structuredClone(chain.entries[0]),
    ),
    false,
  );
  assert.equal(
    persistence.isOrganizationVerificationEvidenceStream(
      JSON.parse(JSON.stringify(stream)),
    ),
    false,
  );
});

test("public surface exposes no seals, constructors, or persistence implementation", async () => {
  const exported = Object.keys(await import("./index.js")).sort();
  assert.deepEqual(exported, [
    "ORGANIZATION_VERIFICATION_ARTIFACT_PERSISTENCE_CLASSIFICATION",
    "ORGANIZATION_VERIFICATION_DURABLE_EVIDENCE_KINDS",
    "classifyOrganizationVerificationStoredEvidenceConflict",
    "createOrganizationVerificationEvidenceAppendBatch",
    "createOrganizationVerificationEvidenceAppendReceipt",
    "createOrganizationVerificationEvidenceStream",
    "createOrganizationVerificationStoredEvidence",
    "createOrganizationVerificationWorkflowStreamIdentity",
    "isOrganizationVerificationDurableEvidenceKind",
    "isOrganizationVerificationEvidenceAppendBatch",
    "isOrganizationVerificationEvidenceAppendReceipt",
    "isOrganizationVerificationEvidenceStream",
    "isOrganizationVerificationStoredEvidence",
    "isOrganizationVerificationWorkflowStreamIdentity",
    "organizationVerificationEvidenceStreamFound",
    "organizationVerificationEvidenceStreamNotFound",
    "sameOrganizationVerificationStoredEvidence",
    "sameOrganizationVerificationWorkflowStreamIdentity",
    "validateAppendOrganizationVerificationEvidenceRequest",
    "validateOrganizationVerificationEvidenceStreamIntegrity",
  ]);
  assert.equal(exported.some((name) => /seal|weakset|internal/i.test(name)), false);
  assert.equal(
    exported.some((name) => /sql|database|orm|adapter|inmemory|filesystem/i.test(name)),
    false,
  );
  assert.equal(exported.includes("fingerprintPersistenceContract"), false);
  assert.equal(exported.includes("expectedStoredEvidenceFingerprint"), false);
});
