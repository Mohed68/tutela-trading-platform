import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRuntimeFixture,
} from "../../../application/workflow-runtime/workflowRuntime.test.js";
import {
  createOrganizationVerificationEvidenceAppendBatch,
  createOrganizationVerificationStoredEvidence,
  createOrganizationVerificationWorkflowStreamIdentity,
  isOrganizationVerificationEvidenceAppendReceipt,
  isOrganizationVerificationEvidenceStream,
  type AppendOrganizationVerificationEvidenceRequest,
  type OrganizationVerificationEvidenceAppendBatch,
  type OrganizationVerificationEvidenceRepositoryPort,
  type OrganizationVerificationDurableEvidence,
  type OrganizationVerificationPersistenceResult,
  type OrganizationVerificationStoredEvidence,
} from "../../../application/persistence-contract/index.js";

type AdapterFactory = () => OrganizationVerificationEvidenceRepositoryPort;

function must<T>(
  result: OrganizationVerificationPersistenceResult<T>,
): T {
  if (!result.ok) throw new Error(result.code);
  return result.value;
}

export function buildEvidenceChain() {
  const fixture = buildRuntimeFixture();
  const genesis = fixture.chain.workflowExecution;
  const streamIdentity = must(
    createOrganizationVerificationWorkflowStreamIdentity({
      workflowExecutionId: genesis.workflowExecutionId,
      organizationId: genesis.organizationId,
      recordId: genesis.recordId,
      revisionId: genesis.revisionId,
      attemptId: genesis.attemptId,
    }),
  );
  const durableEvidence: readonly OrganizationVerificationDurableEvidence[] =
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
  const entries: OrganizationVerificationStoredEvidence[] = [];
  for (const [index, evidence] of durableEvidence.entries()) {
    entries.push(
      must(
        createOrganizationVerificationStoredEvidence({
          ...evidence,
          evidenceEntryId: `in-memory-persistence-entry-${index + 1}`,
          streamIdentity,
          streamPosition: index + 1,
          ...(index === 0
            ? {}
            : {
                predecessorEvidenceEntryId:
                  entries[index - 1]?.evidenceEntryId,
              }),
          appendedAt: "2026-09-01T00:30:00.000Z",
          provenanceReferences: ["in-memory-persistence-provenance"],
          integrityReferences: ["in-memory-persistence-integrity"],
        }),
      ),
    );
  }
  return { fixture, streamIdentity, durableEvidence, entries };
}

export function genesisBatch(
  chain: ReturnType<typeof buildEvidenceChain>,
  appendId = "in-memory-append-genesis",
  appendedAt = "2026-09-01T00:31:00.000Z",
  provenanceReferences: readonly string[] = ["in-memory-provenance"],
  integrityReferences: readonly string[] = ["in-memory-integrity"],
): OrganizationVerificationEvidenceAppendBatch {
  return must(
    createOrganizationVerificationEvidenceAppendBatch({
      appendId,
      streamIdentity: chain.streamIdentity,
      expectedStreamVersion: 0,
      entries: [chain.entries[0]!],
      appendedAt,
      provenanceReferences,
      integrityReferences,
    }),
  );
}

export function pairBatch(
  chain: ReturnType<typeof buildEvidenceChain>,
  pairIndex: number,
  appendId: string,
): OrganizationVerificationEvidenceAppendBatch {
  const firstEntryIndex = 1 + pairIndex * 2;
  const expectedStreamVersion = firstEntryIndex;
  return must(
    createOrganizationVerificationEvidenceAppendBatch({
      appendId,
      streamIdentity: chain.streamIdentity,
      expectedStreamVersion,
      expectedHeadEvidenceEntryId:
        chain.entries[firstEntryIndex - 1]!.evidenceEntryId,
      entries: [
        chain.entries[firstEntryIndex]!,
        chain.entries[firstEntryIndex + 1]!,
      ],
      appendedAt: "2026-09-01T00:31:00.000Z",
      provenanceReferences: ["in-memory-provenance"],
      integrityReferences: ["in-memory-integrity"],
    }),
  );
}

export function appendRequest(
  batch: OrganizationVerificationEvidenceAppendBatch,
): AppendOrganizationVerificationEvidenceRequest {
  return Object.freeze({
    streamIdentity: batch.streamIdentity,
    expectedStreamVersion: batch.expectedStreamVersion,
    batch,
  });
}

async function appendGenesis(
  repository: OrganizationVerificationEvidenceRepositoryPort,
  chain: ReturnType<typeof buildEvidenceChain>,
): Promise<OrganizationVerificationEvidenceAppendBatch> {
  const batch = genesisBatch(chain);
  const result =
    await repository.appendOrganizationVerificationEvidence(
      appendRequest(batch),
    );
  assert.equal(result.ok, true);
  return batch;
}

export function runOrganizationVerificationPersistenceAdapterConformance(
  label: string,
  createAdapter: AdapterFactory,
): void {
  test(`${label}: unknown streams are explicit and genesis is position one`, async () => {
    const chain = buildEvidenceChain();
    const repository = createAdapter();
    const missing =
      await repository.loadOrganizationVerificationEvidenceStream({
        streamIdentity: chain.streamIdentity,
      });
    assert.deepEqual(missing, {
      status: "not_found",
      streamIdentity: chain.streamIdentity,
    });

    const result =
      await repository.appendOrganizationVerificationEvidence(
        appendRequest(genesisBatch(chain)),
      );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.outcome, "appended");
    assert.equal(result.receipt.previousStreamVersion, 0);
    assert.equal(result.receipt.resultingStreamVersion, 1);
    assert.equal(result.receipt.firstAppendedPosition, 1);
    assert.equal(result.receipt.lastAppendedPosition, 1);
    assert.equal(
      isOrganizationVerificationEvidenceAppendReceipt(result.receipt),
      true,
    );

    const loaded =
      await repository.loadOrganizationVerificationEvidenceStream({
        streamIdentity: chain.streamIdentity,
      });
    assert.equal(loaded.status, "found");
    if (loaded.status !== "found") return;
    assert.equal(loaded.stream.streamVersion, 1);
    assert.equal(
      loaded.stream.entries[0]?.storedEvidenceFingerprint,
      chain.entries[0]?.storedEvidenceFingerprint,
    );
    assert.equal(loaded.stream.entries[0]?.evidenceKind, "workflow_genesis");
    assert.equal(loaded.stream.headEvidenceReference.streamPosition, 1);
  });

  test(`${label}: genesis rules and exact stream identity fail closed`, async () => {
    const chain = buildEvidenceChain();
    const repository = createAdapter();
    const nonGenesis = pairBatch(
      chain,
      0,
      "in-memory-non-genesis-first",
    );
    assert.deepEqual(
      await repository.appendOrganizationVerificationEvidence(
        appendRequest(nonGenesis),
      ),
      {
        ok: false,
        code: "expected_stream_version_conflict",
      },
    );

    await appendGenesis(repository, chain);
    const duplicateGenesis = genesisBatch(
      chain,
      "in-memory-second-genesis",
    );
    assert.deepEqual(
      await repository.appendOrganizationVerificationEvidence(
        appendRequest(duplicateGenesis),
      ),
      {
        ok: false,
        code: "expected_stream_version_conflict",
      },
    );

    const otherStream = must(
      createOrganizationVerificationWorkflowStreamIdentity({
        workflowExecutionId: chain.streamIdentity.workflowExecutionId,
        organizationId: "different-organization",
        recordId: chain.streamIdentity.recordId,
        revisionId: chain.streamIdentity.revisionId,
        attemptId: chain.streamIdentity.attemptId,
      }),
    );
    assert.deepEqual(
      await repository.appendOrganizationVerificationEvidence({
        streamIdentity: otherStream,
        expectedStreamVersion: duplicateGenesis.expectedStreamVersion,
        batch: duplicateGenesis,
      }),
      { ok: false, code: "stream_identity_mismatch" },
    );
  });

  test(`${label}: normal appends preserve order and advance by batch size`, async () => {
    const chain = buildEvidenceChain();
    const repository = createAdapter();
    await appendGenesis(repository, chain);
    const firstPair = pairBatch(chain, 0, "in-memory-first-pair");
    const result =
      await repository.appendOrganizationVerificationEvidence(
        appendRequest(firstPair),
      );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.receipt.previousStreamVersion, 1);
    assert.equal(result.receipt.resultingStreamVersion, 3);
    assert.deepEqual(
      result.receipt.appendedEvidenceReferences.map(
        (reference) => reference.streamPosition,
      ),
      [2, 3],
    );

    const loaded =
      await repository.loadOrganizationVerificationEvidenceStream({
        streamIdentity: chain.streamIdentity,
      });
    assert.equal(loaded.status, "found");
    if (loaded.status !== "found") return;
    assert.equal(loaded.stream.streamVersion, 3);
    assert.deepEqual(
      loaded.stream.entries.map((entry) => entry.evidenceEntryId),
      chain.entries
        .slice(0, 3)
        .map((entry) => entry.evidenceEntryId),
    );
    assert.equal(
      loaded.stream.entries[1]?.evidenceKind,
      "attempt_lifecycle_execution",
    );
    assert.equal(
      loaded.stream.entries[2]?.evidenceKind,
      "workflow_step_record",
    );
  });

  test(`${label}: stale, future, and competing versions never overwrite`, async () => {
    const chain = buildEvidenceChain();
    const repository = createAdapter();
    await appendGenesis(repository, chain);
    const firstPair = pairBatch(chain, 0, "in-memory-winning-pair");
    assert.equal(
      (
        await repository.appendOrganizationVerificationEvidence(
          appendRequest(firstPair),
        )
      ).ok,
      true,
    );

    const competing = pairBatch(
      chain,
      0,
      "in-memory-competing-pair",
    );
    assert.deepEqual(
      await repository.appendOrganizationVerificationEvidence(
        appendRequest(competing),
      ),
      {
        ok: false,
        code: "expected_stream_version_conflict",
      },
    );
    const future = pairBatch(chain, 1, "in-memory-future-pair");
    const futureRequest = appendRequest(future);
    assert.deepEqual(
      await repository.appendOrganizationVerificationEvidence({
        ...futureRequest,
        expectedStreamVersion: future.expectedStreamVersion + 2,
      }),
      {
        ok: false,
        code: "expected_stream_version_conflict",
      },
    );

    const loaded =
      await repository.loadOrganizationVerificationEvidenceStream({
        streamIdentity: chain.streamIdentity,
      });
    assert.equal(loaded.status, "found");
    if (loaded.status !== "found") return;
    assert.equal(loaded.stream.streamVersion, 3);
    assert.equal(loaded.stream.entries.length, 3);
  });

  test(`${label}: exact duplicate append is successful and receipt-stable`, async () => {
    const chain = buildEvidenceChain();
    const repository = createAdapter();
    const genesis = genesisBatch(chain);
    const first =
      await repository.appendOrganizationVerificationEvidence(
        appendRequest(genesis),
      );
    const duplicate =
      await repository.appendOrganizationVerificationEvidence(
        appendRequest(genesis),
      );
    assert.equal(first.ok, true);
    assert.equal(duplicate.ok, true);
    if (!first.ok || !duplicate.ok) return;
    assert.equal(duplicate.outcome, "duplicate_append_idempotent");
    assert.equal(
      duplicate.receipt.appendReceiptFingerprint,
      first.receipt.appendReceiptFingerprint,
    );
    assert.deepEqual(
      duplicate.receipt.appendedEvidenceReferences,
      first.receipt.appendedEvidenceReferences,
    );
    assert.equal(duplicate.receipt.resultingStreamVersion, 1);

    const next =
      await repository.appendOrganizationVerificationEvidence(
        appendRequest(pairBatch(chain, 0, "in-memory-after-genesis")),
      );
    assert.equal(next.ok, true);
    const laterDuplicate =
      await repository.appendOrganizationVerificationEvidence(
        appendRequest(genesis),
      );
    assert.equal(laterDuplicate.ok, true);
    if (!laterDuplicate.ok) return;
    assert.equal(
      laterDuplicate.receipt.appendReceiptFingerprint,
      first.receipt.appendReceiptFingerprint,
    );

    const loaded =
      await repository.loadOrganizationVerificationEvidenceStream({
        streamIdentity: chain.streamIdentity,
      });
    assert.equal(loaded.status, "found");
    if (loaded.status !== "found") return;
    assert.equal(loaded.stream.streamVersion, 3);
    assert.equal(loaded.stream.entries.length, 3);
  });

  test(`${label}: same append identity with changed semantics is rejected`, async () => {
    const chain = buildEvidenceChain();
    const repository = createAdapter();
    const original = genesisBatch(chain, "in-memory-stable-append-id");
    assert.equal(
      (
        await repository.appendOrganizationVerificationEvidence(
          appendRequest(original),
        )
      ).ok,
      true,
    );
    const changedMetadata = genesisBatch(
      chain,
      original.appendId,
      "2026-09-01T00:32:00.000Z",
    );
    assert.notEqual(
      changedMetadata.appendBatchFingerprint,
      original.appendBatchFingerprint,
    );
    assert.deepEqual(
      await repository.appendOrganizationVerificationEvidence(
        appendRequest(changedMetadata),
      ),
      { ok: false, code: "evidence_identity_conflict" },
    );
  });

  test(`${label}: reused evidence identity with changed fingerprint is rejected`, async () => {
    const chain = buildEvidenceChain();
    const repository = createAdapter();
    await appendGenesis(repository, chain);
    assert.equal(
      (
        await repository.appendOrganizationVerificationEvidence(
          appendRequest(
            pairBatch(chain, 0, "in-memory-before-identity-conflict"),
          ),
        )
      ).ok,
      true,
    );

    const conflictingAuthority = must(
      createOrganizationVerificationStoredEvidence({
        ...chain.durableEvidence[3]!,
        evidenceEntryId: chain.entries[1]!.evidenceEntryId,
        streamIdentity: chain.streamIdentity,
        streamPosition: 4,
        predecessorEvidenceEntryId: chain.entries[2]!.evidenceEntryId,
        appendedAt: "2026-09-01T00:30:00.000Z",
        provenanceReferences: ["in-memory-persistence-provenance"],
        integrityReferences: ["in-memory-persistence-integrity"],
      }),
    );
    const followingStep = must(
      createOrganizationVerificationStoredEvidence({
        ...chain.durableEvidence[4]!,
        evidenceEntryId: "in-memory-after-conflicting-identity",
        streamIdentity: chain.streamIdentity,
        streamPosition: 5,
        predecessorEvidenceEntryId: conflictingAuthority.evidenceEntryId,
        appendedAt: "2026-09-01T00:30:00.000Z",
        provenanceReferences: ["in-memory-persistence-provenance"],
        integrityReferences: ["in-memory-persistence-integrity"],
      }),
    );
    const conflictingBatch = must(
      createOrganizationVerificationEvidenceAppendBatch({
        appendId: "in-memory-evidence-identity-conflict",
        streamIdentity: chain.streamIdentity,
        expectedStreamVersion: 3,
        expectedHeadEvidenceEntryId:
          chain.entries[2]!.evidenceEntryId,
        entries: [conflictingAuthority, followingStep],
        appendedAt: "2026-09-01T00:31:00.000Z",
        provenanceReferences: ["in-memory-provenance"],
        integrityReferences: ["in-memory-integrity"],
      }),
    );
    assert.deepEqual(
      await repository.appendOrganizationVerificationEvidence(
        appendRequest(conflictingBatch),
      ),
      { ok: false, code: "evidence_identity_conflict" },
    );

    const loaded =
      await repository.loadOrganizationVerificationEvidenceStream({
        streamIdentity: chain.streamIdentity,
      });
    assert.equal(loaded.status, "found");
    if (loaded.status !== "found") return;
    assert.equal(loaded.stream.streamVersion, 3);
    assert.equal(loaded.stream.entries.length, 3);
  });

  test(`${label}: malformed batches roll back by noncommit`, async () => {
    const chain = buildEvidenceChain();
    const repository = createAdapter();
    await appendGenesis(repository, chain);
    const corrected = pairBatch(
      chain,
      0,
      "in-memory-atomic-pair",
    );
    const malformedBatch = Object.freeze({
      ...corrected,
      entries: Object.freeze([
        corrected.entries[0],
        Object.freeze({
          ...corrected.entries[1],
          predecessorEvidenceEntryId: "broken-predecessor",
        }),
      ]),
    });
    const malformedRequest = Object.freeze({
      streamIdentity: chain.streamIdentity,
      expectedStreamVersion: 1,
      batch: malformedBatch,
    }) as AppendOrganizationVerificationEvidenceRequest;
    assert.deepEqual(
      await repository.appendOrganizationVerificationEvidence(
        malformedRequest,
      ),
      { ok: false, code: "malformed_append_metadata" },
    );

    const afterFailure =
      await repository.loadOrganizationVerificationEvidenceStream({
        streamIdentity: chain.streamIdentity,
      });
    assert.equal(afterFailure.status, "found");
    if (afterFailure.status !== "found") return;
    const headBeforeCorrection =
      afterFailure.stream.headEvidenceReference.evidenceEntryId;
    assert.equal(afterFailure.stream.streamVersion, 1);
    assert.equal(afterFailure.stream.entries.length, 1);

    const correction =
      await repository.appendOrganizationVerificationEvidence(
        appendRequest(corrected),
      );
    assert.equal(correction.ok, true);
    const afterCorrection =
      await repository.loadOrganizationVerificationEvidenceStream({
        streamIdentity: chain.streamIdentity,
      });
    assert.equal(afterCorrection.status, "found");
    if (afterCorrection.status !== "found") return;
    assert.equal(afterCorrection.stream.streamVersion, 3);
    assert.notEqual(
      afterCorrection.stream.headEvidenceReference.evidenceEntryId,
      headBeforeCorrection,
    );
  });

  test(`${label}: structural impersonations and unsupported evidence fail closed`, async () => {
    const chain = buildEvidenceChain();
    const repository = createAdapter();
    const genesis = genesisBatch(chain);
    for (const fakeBatch of [
      { ...genesis },
      Object.assign({}, genesis),
      JSON.parse(JSON.stringify(genesis)),
      structuredClone(genesis),
      Object.freeze({ ...genesis }),
    ]) {
      assert.deepEqual(
        await repository.appendOrganizationVerificationEvidence({
          streamIdentity: chain.streamIdentity,
          expectedStreamVersion: 0,
          batch: fakeBatch as OrganizationVerificationEvidenceAppendBatch,
        }),
        { ok: false, code: "malformed_append_metadata" },
      );
    }
    assert.deepEqual(
      createOrganizationVerificationStoredEvidence({
        evidenceKind: "unsupported",
        artifact: chain.fixture.chain.workflowExecution,
        evidenceEntryId: "in-memory-unsupported",
        streamIdentity: chain.streamIdentity,
        streamPosition: 1,
        appendedAt: "2026-09-01T00:30:00.000Z",
        provenanceReferences: ["in-memory-provenance"],
        integrityReferences: ["in-memory-integrity"],
      } as never),
      { ok: false, code: "unsupported_evidence_kind" },
    );
  });

  test(`${label}: loads are authentic, immutable, and repeatable`, async () => {
    const chain = buildEvidenceChain();
    const repository = createAdapter();
    await appendGenesis(repository, chain);
    const first =
      await repository.loadOrganizationVerificationEvidenceStream({
        streamIdentity: chain.streamIdentity,
      });
    const second =
      await repository.loadOrganizationVerificationEvidenceStream({
        streamIdentity: chain.streamIdentity,
      });
    assert.equal(first.status, "found");
    assert.equal(second.status, "found");
    if (first.status !== "found" || second.status !== "found") return;
    assert.equal(isOrganizationVerificationEvidenceStream(first.stream), true);
    assert.equal(Object.isFrozen(first.stream), true);
    assert.equal(Object.isFrozen(first.stream.entries), true);
    assert.equal(Object.isFrozen(first.stream.headEvidenceReference), true);
    assert.equal(Object.isFrozen(first.stream.integrity), true);
    assert.equal(
      first.stream.evidenceStreamFingerprint,
      second.stream.evidenceStreamFingerprint,
    );
    assert.deepEqual(first, second);
    assert.equal(
      Reflect.set(first.stream.entries, "0", Object.freeze({})),
      false,
    );
    assert.equal(
      Reflect.set(
        first.stream.headEvidenceReference,
        "evidenceEntryId",
        "mutated-head",
      ),
      false,
    );
    assert.equal(
      Reflect.set(
        first.stream.entries[0]!.artifact,
        "workflowExecutionId",
        "mutated-workflow",
      ),
      false,
    );

    const third =
      await repository.loadOrganizationVerificationEvidenceStream({
        streamIdentity: chain.streamIdentity,
      });
    assert.equal(third.status, "found");
    if (third.status !== "found") return;
    assert.equal(
      third.stream.headEvidenceReference.evidenceEntryId,
      chain.entries[0]?.evidenceEntryId,
    );
  });

  test(`${label}: metadata, deterministic ordering, and adapter isolation are preserved`, async () => {
    const chain = buildEvidenceChain();
    const provenance = ["z-provenance", "a-provenance"];
    const integrity = ["z-integrity", "a-integrity"];
    const firstBatch = genesisBatch(
      chain,
      "in-memory-deterministic-genesis",
      "2026-09-01T00:31:00.000Z",
      provenance,
      integrity,
    );
    provenance.push("caller-mutation");
    integrity.reverse();
    assert.deepEqual(firstBatch.provenanceReferences, [
      "a-provenance",
      "z-provenance",
    ]);
    assert.deepEqual(firstBatch.integrityReferences, [
      "a-integrity",
      "z-integrity",
    ]);
    assert.equal(Reflect.set(firstBatch, "appendId", "changed"), false);

    const reorderedBatch = genesisBatch(
      chain,
      firstBatch.appendId,
      firstBatch.appendedAt,
      ["a-provenance", "z-provenance"],
      ["a-integrity", "z-integrity"],
    );
    const reorderedPropertyBatch = must(
      createOrganizationVerificationEvidenceAppendBatch({
        integrityReferences: ["a-integrity", "z-integrity"],
        entries: [chain.entries[0]!],
        provenanceReferences: ["a-provenance", "z-provenance"],
        appendedAt: firstBatch.appendedAt,
        expectedStreamVersion: 0,
        streamIdentity: chain.streamIdentity,
        appendId: firstBatch.appendId,
      }),
    );
    assert.equal(
      reorderedBatch.appendBatchFingerprint,
      firstBatch.appendBatchFingerprint,
    );
    assert.equal(
      reorderedPropertyBatch.appendBatchFingerprint,
      firstBatch.appendBatchFingerprint,
    );

    const repositoryA = createAdapter();
    const repositoryB = createAdapter();
    const resultA =
      await repositoryA.appendOrganizationVerificationEvidence(
        appendRequest(firstBatch),
      );
    const resultB =
      await repositoryB.appendOrganizationVerificationEvidence(
        appendRequest(reorderedBatch),
      );
    assert.equal(resultA.ok, true);
    assert.equal(resultB.ok, true);
    if (!resultA.ok || !resultB.ok) return;
    assert.equal(
      resultA.receipt.appendReceiptFingerprint,
      resultB.receipt.appendReceiptFingerprint,
    );
    provenance.push("post-append-caller-mutation");
    integrity.push("post-append-caller-mutation");
    assert.deepEqual(resultA.receipt.provenanceReferences, [
      "a-provenance",
      "z-provenance",
    ]);
    assert.deepEqual(resultA.receipt.integrityReferences, [
      "a-integrity",
      "z-integrity",
    ]);

    const loadA =
      await repositoryA.loadOrganizationVerificationEvidenceStream({
        streamIdentity: chain.streamIdentity,
      });
    const loadB =
      await repositoryB.loadOrganizationVerificationEvidenceStream({
        streamIdentity: chain.streamIdentity,
      });
    assert.equal(loadA.status, "found");
    assert.equal(loadB.status, "found");
    if (loadA.status !== "found" || loadB.status !== "found") return;
    assert.equal(
      loadA.stream.evidenceStreamFingerprint,
      loadB.stream.evidenceStreamFingerprint,
    );

    const secondChain = buildEvidenceChain();
    const isolated = createAdapter();
    const isolatedMissing =
      await isolated.loadOrganizationVerificationEvidenceStream({
        streamIdentity: secondChain.streamIdentity,
      });
    assert.equal(isolatedMissing.status, "not_found");
  });
}
