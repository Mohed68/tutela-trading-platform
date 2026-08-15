import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  createLoadOrganizationVerificationStateRequest,
  type OrganizationVerificationApplicationServiceDependencies,
} from "../../../application/application-service-contract/index.js";
import { createOrganizationVerificationApplicationService } from "../../../application/application-service/index.js";
import { buildRequests as buildApplicationServiceRequests } from "../../../application/application-service/applicationService.test.js";
import {
  createOrganizationVerificationReplayRequest,
  replayOrganizationVerificationWorkflow,
} from "../../../application/replay-runtime/index.js";
import {
  isOrganizationVerificationEvidenceStream,
  createOrganizationVerificationWorkflowStreamIdentity,
  type OrganizationVerificationEvidenceRepositoryPort,
} from "../../../application/persistence-contract/index.js";
import { executeOrganizationVerificationWorkflowStep } from "../../../application/workflow-runtime/index.js";
import {
  appendRequest,
  buildEvidenceChain,
  genesisBatch,
  pairBatch,
  runOrganizationVerificationPersistenceAdapterConformance,
} from "../in-memory/persistenceAdapterConformance.test.js";
import {
  createPostgresOrganizationVerificationPersistenceAdapter,
  type OrganizationVerificationPostgresDatabase,
  type OrganizationVerificationPostgresQueryClient,
  type OrganizationVerificationPostgresQueryResult,
  type OrganizationVerificationPostgresRow,
} from "./index.js";

interface FakePostgresState {
  readonly streams: Map<string, OrganizationVerificationPostgresRow>;
  readonly appends: Map<string, OrganizationVerificationPostgresRow>;
  readonly evidence: Map<string, OrganizationVerificationPostgresRow>;
}

class FakePostgresError extends Error {
  readonly code: string;

  constructor(code: string) {
    super("simulated PostgreSQL failure");
    this.name = "FakePostgresError";
    this.code = code;
  }
}

function emptyState(): FakePostgresState {
  return {
    streams: new Map(),
    appends: new Map(),
    evidence: new Map(),
  };
}

function cloneState(state: FakePostgresState): FakePostgresState {
  return {
    streams: new Map(state.streams),
    appends: new Map(state.appends),
    evidence: new Map(state.evidence),
  };
}

function result(
  rows: readonly OrganizationVerificationPostgresRow[] = [],
  rowCount = rows.length,
): OrganizationVerificationPostgresQueryResult {
  return Object.freeze({ rows: Object.freeze([...rows]), rowCount });
}

function requiredString(parameters: readonly unknown[], index: number): string {
  const value = parameters[index];
  if (typeof value !== "string") throw new FakePostgresError("22023");
  return value;
}

function requiredNumber(parameters: readonly unknown[], index: number): number {
  const value = parameters[index];
  if (!Number.isSafeInteger(value)) throw new FakePostgresError("22023");
  return Number(value);
}

function nullableString(
  parameters: readonly unknown[],
  index: number,
): string | null {
  const value = parameters[index];
  if (value !== null && typeof value !== "string") {
    throw new FakePostgresError("22023");
  }
  return value;
}

function parsedStringArray(value: string): readonly string[] {
  const parsed: unknown = JSON.parse(value);
  if (
    !Array.isArray(parsed) ||
    parsed.some((item) => typeof item !== "string")
  ) throw new FakePostgresError("22023");
  return Object.freeze([...parsed]);
}

class FakeOrganizationVerificationPostgresDatabase
  implements OrganizationVerificationPostgresDatabase {
  private state = emptyState();
  private transactionTail: Promise<void> = Promise.resolve();
  private failAfterEvidenceInsert: number | undefined;

  failDuringNextEvidenceBatch(afterInsert: number): void {
    this.failAfterEvidenceInsert = afterInsert;
  }

  corruptFirstEnvelope(): void {
    const first = [...this.state.evidence.entries()].sort(
      (left, right) =>
        Number(left[1].stream_position) - Number(right[1].stream_position),
    )[0];
    if (first === undefined) throw new Error("no evidence to corrupt");
    this.state.evidence.set(
      first[0],
      Object.freeze({
        ...first[1],
        canonical_durable_envelope: "{\"corrupted\":true}",
      }),
    );
  }

  query(
    statement: string,
    parameters: readonly unknown[] = [],
  ): Promise<OrganizationVerificationPostgresQueryResult> {
    return this.execute(this.state, statement, parameters);
  }

  transaction<T>(
    operation: (
      client: OrganizationVerificationPostgresQueryClient,
    ) => Promise<T>,
  ): Promise<T> {
    const run = this.transactionTail.then(async () => {
      const candidate = cloneState(this.state);
      let evidenceInserts = 0;
      const client: OrganizationVerificationPostgresQueryClient = Object.freeze({
        query: async (
          statement: string,
          parameters: readonly unknown[] = [],
        ) => {
          if (statement.includes("organization-verification:insert-evidence")) {
            evidenceInserts += 1;
            if (
              this.failAfterEvidenceInsert !== undefined &&
              evidenceInserts === this.failAfterEvidenceInsert
            ) {
              this.failAfterEvidenceInsert = undefined;
              throw new FakePostgresError("XX000");
            }
          }
          return this.execute(candidate, statement, parameters);
        },
      });
      const value = await operation(client);
      this.state = candidate;
      return value;
    });
    this.transactionTail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async execute(
    state: FakePostgresState,
    statement: string,
    parameters: readonly unknown[],
  ): Promise<OrganizationVerificationPostgresQueryResult> {
    if (statement.includes("organization-verification:select-stream")) {
      const row = state.streams.get(requiredString(parameters, 0));
      return result(row === undefined ? [] : [row]);
    }
    if (statement.includes("organization-verification:select-appends")) {
      const stream = requiredString(parameters, 0);
      return result(
        [...state.appends.values()]
          .filter((row) => row.stream_identity_fingerprint === stream)
          .sort(
            (left, right) =>
              Number(left.resulting_stream_version) -
              Number(right.resulting_stream_version),
          ),
      );
    }
    if (statement.includes("organization-verification:select-append")) {
      const row = state.appends.get(requiredString(parameters, 0));
      return result(row === undefined ? [] : [row]);
    }
    if (statement.includes("organization-verification:select-evidence")) {
      const stream = requiredString(parameters, 0);
      return result(
        [...state.evidence.values()]
          .filter((row) => row.stream_identity_fingerprint === stream)
          .sort(
            (left, right) =>
              Number(left.stream_position) - Number(right.stream_position),
          ),
      );
    }
    if (statement.includes("organization-verification:insert-stream")) {
      const fingerprint = requiredString(parameters, 0);
      if (state.streams.has(fingerprint)) return result([], 0);
      const workflowExecutionId = requiredString(parameters, 1);
      if (
        [...state.streams.values()].some(
          (row) => row.workflow_execution_id === workflowExecutionId,
        )
      ) throw new FakePostgresError("23505");
      state.streams.set(
        fingerprint,
        Object.freeze({
          stream_identity_fingerprint: fingerprint,
          workflow_execution_id: workflowExecutionId,
          organization_id: requiredString(parameters, 2),
          record_id: requiredString(parameters, 3),
          revision_id: requiredString(parameters, 4),
          attempt_id: requiredString(parameters, 5),
          current_stream_version: 0,
          head_evidence_entry_id: null,
          creation_fingerprint: requiredString(parameters, 7),
        }),
      );
      return result([], 1);
    }
    if (statement.includes("organization-verification:insert-append")) {
      const appendId = requiredString(parameters, 0);
      if (state.appends.has(appendId)) throw new FakePostgresError("23505");
      state.appends.set(
        appendId,
        Object.freeze({
          append_id: appendId,
          stream_identity_fingerprint: requiredString(parameters, 1),
          append_batch_fingerprint: requiredString(parameters, 2),
          expected_stream_version: requiredNumber(parameters, 3),
          resulting_stream_version: requiredNumber(parameters, 4),
          expected_head_evidence_entry_id: nullableString(parameters, 5),
          resulting_head_evidence_entry_id: requiredString(parameters, 6),
          appended_at_value: requiredString(parameters, 8),
          provenance_references: parsedStringArray(requiredString(parameters, 9)),
          integrity_references: parsedStringArray(requiredString(parameters, 10)),
          append_receipt_fingerprint: requiredString(parameters, 11),
        }),
      );
      return result([], 1);
    }
    if (statement.includes("organization-verification:insert-evidence")) {
      const evidenceEntryId = requiredString(parameters, 0);
      const streamFingerprint = requiredString(parameters, 1);
      const position = requiredNumber(parameters, 2);
      const semanticKey = [
        streamFingerprint,
        requiredString(parameters, 5),
        requiredString(parameters, 6),
        requiredString(parameters, 7),
        requiredString(parameters, 8),
      ].join("|");
      if (
        state.evidence.has(evidenceEntryId) ||
        [...state.evidence.values()].some(
          (row) =>
            row.stream_identity_fingerprint === streamFingerprint &&
            row.stream_position === position,
        ) ||
        [...state.evidence.values()].some((row) => row.semantic_key === semanticKey)
      ) throw new FakePostgresError("23505");
      state.evidence.set(
        evidenceEntryId,
        Object.freeze({
          evidence_entry_id: evidenceEntryId,
          stream_identity_fingerprint: streamFingerprint,
          stream_position: position,
          predecessor_evidence_entry_id: nullableString(parameters, 3),
          append_id: requiredString(parameters, 4),
          evidence_kind: requiredString(parameters, 5),
          semantic_artifact_identity: requiredString(parameters, 6),
          artifact_version_kind: requiredString(parameters, 7),
          artifact_version_or_sequence: requiredString(parameters, 8),
          artifact_fingerprint: requiredString(parameters, 9),
          stored_evidence_fingerprint: requiredString(parameters, 14),
          durable_contract_version: requiredString(parameters, 15),
          durable_payload_fingerprint: requiredString(parameters, 16),
          canonical_durable_envelope: requiredString(parameters, 17),
          semantic_key: semanticKey,
        }),
      );
      return result([], 1);
    }
    if (statement.includes("organization-verification:update-stream")) {
      const fingerprint = requiredString(parameters, 0);
      const row = state.streams.get(fingerprint);
      if (
        row === undefined ||
        row.current_stream_version !== requiredNumber(parameters, 3) ||
        row.head_evidence_entry_id !== nullableString(parameters, 4)
      ) return result([], 0);
      state.streams.set(
        fingerprint,
        Object.freeze({
          ...row,
          current_stream_version: requiredNumber(parameters, 1),
          head_evidence_entry_id: requiredString(parameters, 2),
        }),
      );
      return result([], 1);
    }
    throw new FakePostgresError("0A000");
  }
}

function applicationDependencies(
  evidenceRepository: OrganizationVerificationEvidenceRepositoryPort,
): OrganizationVerificationApplicationServiceDependencies {
  return Object.freeze({
    evidenceRepository,
    replayRuntime: {
      replayHistory: replayOrganizationVerificationWorkflow,
    },
    workflowRuntime: {
      executeOneWorkflowStep: executeOrganizationVerificationWorkflowStep,
    },
  });
}

runOrganizationVerificationPersistenceAdapterConformance(
  "PostgreSQL Organization Verification persistence adapter",
  () =>
    createPostgresOrganizationVerificationPersistenceAdapter(
      new FakeOrganizationVerificationPostgresDatabase(),
    ),
);

test("PostgreSQL adapter recreates authentic evidence and Replay state after adapter restart", async () => {
  const database = new FakeOrganizationVerificationPostgresDatabase();
  const firstAdapter = createPostgresOrganizationVerificationPersistenceAdapter(database);
  const chain = buildEvidenceChain();
  assert.equal(
    (await firstAdapter.appendOrganizationVerificationEvidence(
      appendRequest(genesisBatch(chain, "postgres-restart-genesis")),
    )).ok,
    true,
  );
  assert.equal(
    (await firstAdapter.appendOrganizationVerificationEvidence(
      appendRequest(pairBatch(chain, 0, "postgres-restart-pair")),
    )).ok,
    true,
  );

  const secondAdapter = createPostgresOrganizationVerificationPersistenceAdapter(database);
  assert.notEqual(secondAdapter, firstAdapter);
  const loaded = await secondAdapter.loadOrganizationVerificationEvidenceStream({
    streamIdentity: chain.streamIdentity,
  });
  assert.equal(loaded.status, "found");
  if (loaded.status !== "found") return;
  assert.equal(isOrganizationVerificationEvidenceStream(loaded.stream), true);
  assert.equal(loaded.stream.streamVersion, 3);
  assert.notEqual(loaded.stream.entries[0], chain.entries[0]);
  assert.equal(
    loaded.stream.entries[0]?.storedEvidenceFingerprint,
    chain.entries[0]?.storedEvidenceFingerprint,
  );

  const replayRequest = createOrganizationVerificationReplayRequest({
    replayRequestId: "postgres-restart-replay-request",
    replayExecutionId: "postgres-restart-replay-execution",
    sourceEvidenceStream: loaded.stream,
    replayedAt: "2026-09-01T00:40:00.000Z",
    provenanceReferences: ["postgres-restart-provenance"],
    integrityReferences: ["postgres-restart-integrity"],
  });
  assert.equal(replayRequest.ok, true);
  if (!replayRequest.ok) return;
  const replay = replayOrganizationVerificationWorkflow(replayRequest.value);
  assert.equal(replay.outcome, "replay_completed");
  if (replay.outcome !== "replay_completed") return;
  assert.equal(
    replay.execution.reconstructedWorkflowExecution.workflowStage,
    chain.fixture.queued.nextWorkflowExecution.workflowStage,
  );
  assert.equal(
    replay.execution.reconstructedAttemptLifecycleExecution.processState,
    chain.fixture.queued.authorityResult.nextLifecycleExecution.processState,
  );
});

test("unchanged Application Service starts, advances, and reloads through a fresh PostgreSQL adapter", async () => {
  const database = new FakeOrganizationVerificationPostgresDatabase();
  const requests = buildApplicationServiceRequests();
  const firstService = createOrganizationVerificationApplicationService(
    applicationDependencies(
      createPostgresOrganizationVerificationPersistenceAdapter(database),
    ),
  );
  const started = await firstService.startOrganizationVerification(requests.start);
  assert.equal(started.outcome, "start_completed");
  const advanced = await firstService.advanceOrganizationVerificationWorkflow(
    requests.advance,
  );
  assert.equal(advanced.outcome, "advance_completed");
  if (advanced.outcome !== "advance_completed") return;

  const reconstructedIdentity = createOrganizationVerificationWorkflowStreamIdentity({
    workflowExecutionId: requests.streamIdentity.workflowExecutionId,
    organizationId: requests.streamIdentity.organizationId,
    recordId: requests.streamIdentity.recordId,
    revisionId: requests.streamIdentity.revisionId,
    attemptId: requests.streamIdentity.attemptId,
  });
  assert.equal(reconstructedIdentity.ok, true);
  if (!reconstructedIdentity.ok) return;
  assert.notEqual(reconstructedIdentity.value, requests.streamIdentity);
  const loadRequest = createLoadOrganizationVerificationStateRequest({
    metadata: {
      applicationExecutionId: "postgres-application-restart-execution",
      queryId: "postgres-application-restart-query",
      requestedAt: "2026-09-01T00:02:14.000Z",
      applicationCompletedAt: "2026-09-01T00:02:16.000Z",
      provenanceReferences: ["postgres-application-restart-provenance"],
      integrityReferences: ["postgres-application-restart-integrity"],
      correlationId: "postgres-application-restart-correlation",
    },
    streamIdentity: reconstructedIdentity.value,
    replay: {
      replayRequestId: "postgres-application-restart-replay-request",
      replayExecutionId: "postgres-application-restart-replay-execution",
      replayedAt: "2026-09-01T00:02:15.000Z",
      provenanceReferences: ["postgres-application-replay-provenance"],
      integrityReferences: ["postgres-application-replay-integrity"],
    },
  });
  assert.equal(loadRequest.ok, true);
  if (!loadRequest.ok) return;
  const secondService = createOrganizationVerificationApplicationService(
    applicationDependencies(
      createPostgresOrganizationVerificationPersistenceAdapter(database),
    ),
  );
  assert.notEqual(secondService, firstService);
  const loaded = await secondService.loadOrganizationVerificationState(
    loadRequest.value,
  );
  assert.equal(loaded.outcome, "state_found");
  if (loaded.outcome !== "state_found") return;
  assert.equal(loaded.persistenceStreamVersion, 3);
  assert.equal(
    loaded.currentWorkflowExecution.workflowExecutionFingerprint,
    advanced.currentWorkflowExecution.workflowExecutionFingerprint,
  );
  assert.equal(
    loaded.currentLifecycleExecution.attemptLifecycleExecutionFingerprint,
    advanced.currentLifecycleExecution.attemptLifecycleExecutionFingerprint,
  );
});

test("PostgreSQL transaction rollback leaves no partial evidence", async () => {
  const database = new FakeOrganizationVerificationPostgresDatabase();
  const adapter = createPostgresOrganizationVerificationPersistenceAdapter(database);
  const chain = buildEvidenceChain();
  await adapter.appendOrganizationVerificationEvidence(
    appendRequest(genesisBatch(chain, "postgres-atomic-genesis")),
  );
  database.failDuringNextEvidenceBatch(2);
  const failed = await adapter.appendOrganizationVerificationEvidence(
    appendRequest(pairBatch(chain, 0, "postgres-atomic-pair")),
  );
  assert.deepEqual(failed, { ok: false, code: "stored_integrity_failure" });
  const loaded = await adapter.loadOrganizationVerificationEvidenceStream({
    streamIdentity: chain.streamIdentity,
  });
  assert.equal(loaded.status, "found");
  if (loaded.status !== "found") return;
  assert.equal(loaded.stream.streamVersion, 1);
  assert.equal(loaded.stream.entries.length, 1);
});

test("database-serialized competing writers cannot both commit the same expected version", async () => {
  const database = new FakeOrganizationVerificationPostgresDatabase();
  const first = createPostgresOrganizationVerificationPersistenceAdapter(database);
  const second = createPostgresOrganizationVerificationPersistenceAdapter(database);
  const chain = buildEvidenceChain();
  await first.appendOrganizationVerificationEvidence(
    appendRequest(genesisBatch(chain, "postgres-concurrency-genesis")),
  );
  const [left, right] = await Promise.all([
    first.appendOrganizationVerificationEvidence(
      appendRequest(pairBatch(chain, 0, "postgres-concurrency-left")),
    ),
    second.appendOrganizationVerificationEvidence(
      appendRequest(pairBatch(chain, 0, "postgres-concurrency-right")),
    ),
  ]);
  assert.equal([left, right].filter((item) => item.ok).length, 1);
  assert.equal(
    [left, right].filter(
      (item) => !item.ok && item.code === "expected_stream_version_conflict",
    ).length,
    1,
  );
});

test("stored envelope corruption fails closed without returning plain evidence", async () => {
  const database = new FakeOrganizationVerificationPostgresDatabase();
  const adapter = createPostgresOrganizationVerificationPersistenceAdapter(database);
  const chain = buildEvidenceChain();
  await adapter.appendOrganizationVerificationEvidence(
    appendRequest(genesisBatch(chain, "postgres-corruption-genesis")),
  );
  database.corruptFirstEnvelope();
  await assert.rejects(
    adapter.loadOrganizationVerificationEvidenceStream({
      streamIdentity: chain.streamIdentity,
    }),
    /stored_integrity_failure/,
  );
});

test("migration 0012 is additive, append-only, and schema declarations stay aligned", () => {
  const repositoryRoot = path.resolve(import.meta.dirname, "../../../../..");
  const migration = fs.readFileSync(
    path.join(repositoryRoot, "migrations/0012_organization_verification_persistence.sql"),
    "utf8",
  );
  const schema = fs.readFileSync(path.join(repositoryRoot, "shared/schema.ts"), "utf8");
  for (const table of [
    "organization_verification_persistence_streams",
    "organization_verification_persistence_appends",
    "organization_verification_durable_evidence",
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE public\\.${table}`));
    assert.match(schema, new RegExp(`\"${table}\"`));
  }
  assert.match(migration, /FOR UPDATE|current_stream_version/);
  assert.match(migration, /organization-verification-durable-evidence\/v1/);
  assert.equal(/WorkflowStepExecution/.test(migration), false);
  assert.equal(/(?:DROP|TRUNCATE|ALTER\s+TABLE|DELETE\s+FROM)/i.test(migration), false);
  assert.equal(/current_(?:workflow|lifecycle|trust|decision)_state/i.test(migration), false);
});

test("adapter is a frozen implementation of the unchanged persistence port", () => {
  const adapter: OrganizationVerificationEvidenceRepositoryPort =
    createPostgresOrganizationVerificationPersistenceAdapter(
      new FakeOrganizationVerificationPostgresDatabase(),
    );
  assert.equal(Object.isFrozen(adapter), true);
  assert.deepEqual(Object.keys(adapter).sort(), [
    "appendOrganizationVerificationEvidence",
    "loadOrganizationVerificationEvidenceStream",
  ]);
});
