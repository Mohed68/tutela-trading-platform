import {
  ORGANIZATION_VERIFICATION_DURABLE_EVIDENCE_CONTRACT_VERSION,
  createOrganizationVerificationDurableEvidenceEnvelope,
  createOrganizationVerificationDurableEvidenceRehydrationSession,
  parseOrganizationVerificationDurableEvidence,
  serializeOrganizationVerificationDurableEvidence,
} from "../../../application/durable-evidence-contract/index.js";
import {
  classifyOrganizationVerificationStoredEvidenceConflict,
  createOrganizationVerificationEvidenceAppendBatch,
  createOrganizationVerificationEvidenceAppendReceipt,
  createOrganizationVerificationEvidenceStream,
  createOrganizationVerificationWorkflowStreamIdentity,
  isOrganizationVerificationWorkflowStreamIdentity,
  organizationVerificationEvidenceStreamFound,
  organizationVerificationEvidenceStreamNotFound,
  sameOrganizationVerificationWorkflowStreamIdentity,
  validateAppendOrganizationVerificationEvidenceRequest,
  type AppendOrganizationVerificationEvidenceRequest,
  type AppendOrganizationVerificationEvidenceResult,
  type LoadOrganizationVerificationEvidenceStreamRequest,
  type OrganizationVerificationEvidenceAppendReceipt,
  type OrganizationVerificationEvidenceRepositoryPort,
  type OrganizationVerificationEvidenceStream,
  type OrganizationVerificationEvidenceStreamLoadResult,
  type OrganizationVerificationPersistenceFailureCode,
  type OrganizationVerificationStoredEvidence,
  type OrganizationVerificationWorkflowStreamIdentity,
} from "../../../application/persistence-contract/index.js";
import type {
  OrganizationVerificationPostgresDatabase,
  OrganizationVerificationPostgresQueryClient,
  OrganizationVerificationPostgresRow,
} from "./postgresDatabase.js";

type InternalResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{
      ok: false;
      code: OrganizationVerificationPersistenceFailureCode;
    }>;

interface PreparedEvidence {
  readonly evidence: OrganizationVerificationStoredEvidence;
  readonly canonicalEnvelope: string;
  readonly durablePayloadFingerprint: string;
}

interface StoredStreamHeader {
  readonly identity: OrganizationVerificationWorkflowStreamIdentity;
  readonly currentStreamVersion: number;
  readonly headEvidenceEntryId?: string;
  readonly creationFingerprint: string;
}

interface LoadedEvidenceBinding {
  readonly evidence: OrganizationVerificationStoredEvidence;
  readonly appendId: string;
}

class AppendTransactionAbort extends Error {
  readonly result: AppendOrganizationVerificationEvidenceResult;

  constructor(result: AppendOrganizationVerificationEvidenceResult) {
    super("organization verification append rejected");
    this.name = "AppendTransactionAbort";
    this.result = result;
  }
}

class PostgresPersistenceInvariantError extends Error {
  readonly code: OrganizationVerificationPersistenceFailureCode;

  constructor(code: OrganizationVerificationPersistenceFailureCode) {
    super(code);
    this.name = "PostgresPersistenceInvariantError";
    this.code = code;
  }
}

const SELECT_STREAM = `/* organization-verification:select-stream */
SELECT stream_identity_fingerprint, workflow_execution_id, organization_id,
       record_id, revision_id, attempt_id, current_stream_version,
       head_evidence_entry_id, creation_fingerprint
FROM public.organization_verification_persistence_streams
WHERE stream_identity_fingerprint = $1`;

const SELECT_STREAM_FOR_UPDATE = `${SELECT_STREAM} FOR UPDATE`;

const SELECT_APPEND = `/* organization-verification:select-append */
SELECT append_id, stream_identity_fingerprint, append_batch_fingerprint,
       expected_stream_version, resulting_stream_version,
       append_receipt_fingerprint
FROM public.organization_verification_persistence_appends
WHERE append_id = $1`;

const SELECT_APPENDS = `/* organization-verification:select-appends */
SELECT append_id, stream_identity_fingerprint, append_batch_fingerprint,
       expected_stream_version, resulting_stream_version,
       expected_head_evidence_entry_id, resulting_head_evidence_entry_id,
       appended_at_value, provenance_references, integrity_references,
       append_receipt_fingerprint
FROM public.organization_verification_persistence_appends
WHERE stream_identity_fingerprint = $1
ORDER BY resulting_stream_version ASC`;

const SELECT_EVIDENCE = `/* organization-verification:select-evidence */
SELECT evidence_entry_id, stream_identity_fingerprint, stream_position,
       predecessor_evidence_entry_id, append_id, evidence_kind,
       semantic_artifact_identity, artifact_version_kind,
       artifact_version_or_sequence, artifact_fingerprint,
       stored_evidence_fingerprint, durable_contract_version,
       durable_payload_fingerprint, canonical_durable_envelope
FROM public.organization_verification_durable_evidence
WHERE stream_identity_fingerprint = $1
ORDER BY stream_position ASC`;

const INSERT_STREAM = `/* organization-verification:insert-stream */
INSERT INTO public.organization_verification_persistence_streams (
  stream_identity_fingerprint, workflow_execution_id, organization_id,
  record_id, revision_id, attempt_id, current_stream_version,
  head_evidence_entry_id, created_at, creation_fingerprint
) VALUES ($1, $2, $3, $4, $5, $6, 0, NULL, $7, $8)
ON CONFLICT (stream_identity_fingerprint) DO NOTHING`;

const INSERT_APPEND = `/* organization-verification:insert-append */
INSERT INTO public.organization_verification_persistence_appends (
  append_id, stream_identity_fingerprint, append_batch_fingerprint,
  expected_stream_version, resulting_stream_version,
  expected_head_evidence_entry_id, resulting_head_evidence_entry_id,
  appended_at, appended_at_value, provenance_references, integrity_references,
  append_receipt_fingerprint
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12)`;

const INSERT_EVIDENCE = `/* organization-verification:insert-evidence */
INSERT INTO public.organization_verification_durable_evidence (
  evidence_entry_id, stream_identity_fingerprint, stream_position,
  predecessor_evidence_entry_id, append_id, evidence_kind,
  semantic_artifact_identity, artifact_version_kind,
  artifact_version_or_sequence, artifact_fingerprint,
  artifact_occurred_at, appended_at, provenance_references,
  integrity_references, stored_evidence_fingerprint,
  durable_contract_version, durable_payload_fingerprint,
  canonical_durable_envelope
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
  $13::jsonb, $14::jsonb, $15, $16, $17, $18
)`;

const UPDATE_STREAM = `/* organization-verification:update-stream */
UPDATE public.organization_verification_persistence_streams
SET current_stream_version = $2, head_evidence_entry_id = $3
WHERE stream_identity_fingerprint = $1
  AND current_stream_version = $4
  AND head_evidence_entry_id IS NOT DISTINCT FROM $5`;

function success<T>(value: T): InternalResult<T> {
  return Object.freeze({ ok: true, value });
}

function failure(
  code: OrganizationVerificationPersistenceFailureCode,
): InternalResult<never> {
  return Object.freeze({ ok: false, code });
}

function appendFailure(
  code: OrganizationVerificationPersistenceFailureCode,
): AppendOrganizationVerificationEvidenceResult {
  return Object.freeze({ ok: false, code });
}

function appendSuccess(
  outcome: "appended" | "duplicate_append_idempotent",
  receipt: OrganizationVerificationEvidenceAppendReceipt,
): AppendOrganizationVerificationEvidenceResult {
  return Object.freeze({ ok: true, outcome, receipt });
}

function abort(
  code: OrganizationVerificationPersistenceFailureCode,
): never {
  throw new AppendTransactionAbort(appendFailure(code));
}

function stringField(
  row: OrganizationVerificationPostgresRow,
  field: string,
): string | undefined {
  const value = row[field];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function nullableStringField(
  row: OrganizationVerificationPostgresRow,
  field: string,
): string | null | undefined {
  const value = row[field];
  return value === null || typeof value === "string" ? value : undefined;
}

function integerField(
  row: OrganizationVerificationPostgresRow,
  field: string,
): number | undefined {
  const value = row[field];
  return Number.isSafeInteger(value) ? Number(value) : undefined;
}

function stringArrayField(
  row: OrganizationVerificationPostgresRow,
  field: string,
): readonly string[] | undefined {
  const value = row[field];
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((item) => typeof item !== "string" || item.length === 0)
  ) return undefined;
  return Object.freeze([...value]);
}

function postgresFailureCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const value = Object.getOwnPropertyDescriptor(error, "code")?.value;
  return typeof value === "string" ? value : undefined;
}

function requireLoadResult(
  result: ReturnType<typeof organizationVerificationEvidenceStreamFound>
    | ReturnType<typeof organizationVerificationEvidenceStreamNotFound>,
): OrganizationVerificationEvidenceStreamLoadResult {
  if (!result.ok) throw new PostgresPersistenceInvariantError(result.code);
  return result.value;
}

function parseStreamHeader(
  row: OrganizationVerificationPostgresRow,
): InternalResult<StoredStreamHeader> {
  const workflowExecutionId = stringField(row, "workflow_execution_id");
  const organizationId = stringField(row, "organization_id");
  const recordId = stringField(row, "record_id");
  const revisionId = stringField(row, "revision_id");
  const attemptId = stringField(row, "attempt_id");
  const storedFingerprint = stringField(row, "stream_identity_fingerprint");
  const currentStreamVersion = integerField(row, "current_stream_version");
  const headEvidenceEntryId = nullableStringField(
    row,
    "head_evidence_entry_id",
  );
  const creationFingerprint = stringField(row, "creation_fingerprint");
  if (
    workflowExecutionId === undefined ||
    organizationId === undefined ||
    recordId === undefined ||
    revisionId === undefined ||
    attemptId === undefined ||
    storedFingerprint === undefined ||
    currentStreamVersion === undefined ||
    currentStreamVersion < 0 ||
    headEvidenceEntryId === undefined ||
    creationFingerprint === undefined
  ) {
    return failure("stored_integrity_failure");
  }
  const identity = createOrganizationVerificationWorkflowStreamIdentity({
    workflowExecutionId,
    organizationId,
    recordId,
    revisionId,
    attemptId,
  });
  if (!identity.ok || identity.value.streamIdentityFingerprint !== storedFingerprint) {
    return failure("stored_integrity_failure");
  }
  if (
    (currentStreamVersion === 0 && headEvidenceEntryId !== null) ||
    (currentStreamVersion > 0 && headEvidenceEntryId === null)
  ) {
    return failure("stored_integrity_failure");
  }
  return success(Object.freeze({
    identity: identity.value,
    currentStreamVersion,
    ...(headEvidenceEntryId === null ? {} : { headEvidenceEntryId }),
    creationFingerprint,
  }));
}

async function selectStreamHeader(
  client: OrganizationVerificationPostgresQueryClient,
  streamFingerprint: string,
  forUpdate: boolean,
): Promise<InternalResult<StoredStreamHeader | undefined>> {
  const result = await client.query(
    forUpdate ? SELECT_STREAM_FOR_UPDATE : SELECT_STREAM,
    [streamFingerprint],
  );
  if (result.rows.length === 0) return success(undefined);
  if (result.rows.length !== 1 || result.rows[0] === undefined) {
    return failure("stored_integrity_failure");
  }
  return parseStreamHeader(result.rows[0]);
}

function evidenceRowMatches(
  row: OrganizationVerificationPostgresRow,
  evidence: OrganizationVerificationStoredEvidence,
  durablePayloadFingerprint: string,
): boolean {
  const versionKind = typeof evidence.artifactVersionOrSequence;
  return (
    stringField(row, "evidence_entry_id") === evidence.evidenceEntryId &&
    stringField(row, "stream_identity_fingerprint") ===
      evidence.streamIdentity.streamIdentityFingerprint &&
    integerField(row, "stream_position") === evidence.streamPosition &&
    nullableStringField(row, "predecessor_evidence_entry_id") ===
      (evidence.predecessorEvidenceEntryId ?? null) &&
    stringField(row, "evidence_kind") === evidence.evidenceKind &&
    stringField(row, "semantic_artifact_identity") ===
      evidence.semanticArtifactIdentity &&
    stringField(row, "artifact_version_kind") === versionKind &&
    stringField(row, "artifact_version_or_sequence") ===
      String(evidence.artifactVersionOrSequence) &&
    stringField(row, "artifact_fingerprint") === evidence.artifactFingerprint &&
    stringField(row, "stored_evidence_fingerprint") ===
      evidence.storedEvidenceFingerprint &&
    stringField(row, "durable_contract_version") ===
      ORGANIZATION_VERIFICATION_DURABLE_EVIDENCE_CONTRACT_VERSION &&
    stringField(row, "durable_payload_fingerprint") ===
      durablePayloadFingerprint
  );
}

async function loadEntries(
  client: OrganizationVerificationPostgresQueryClient,
  header: StoredStreamHeader,
): Promise<InternalResult<readonly LoadedEvidenceBinding[]>> {
  const result = await client.query(SELECT_EVIDENCE, [
    header.identity.streamIdentityFingerprint,
  ]);
  const session = createOrganizationVerificationDurableEvidenceRehydrationSession();
  const entries: LoadedEvidenceBinding[] = [];
  for (const row of result.rows) {
    const serialized = stringField(row, "canonical_durable_envelope");
    const appendId = stringField(row, "append_id");
    if (serialized === undefined || appendId === undefined) {
      return failure("stored_integrity_failure");
    }
    const parsed = parseOrganizationVerificationDurableEvidence(serialized);
    if (!parsed.ok) return failure(parsed.code);
    const rehydrated = session.rehydrate(parsed.value);
    if (
      !rehydrated.ok ||
      !evidenceRowMatches(
        row,
        rehydrated.value,
        parsed.value.payloadFingerprint,
      )
    ) {
      return failure("stored_integrity_failure");
    }
    entries.push(Object.freeze({ evidence: rehydrated.value, appendId }));
  }
  if (entries.length !== header.currentStreamVersion) {
    return failure("stored_integrity_failure");
  }
  return success(Object.freeze(entries));
}

async function validateCommittedAppends(
  client: OrganizationVerificationPostgresQueryClient,
  header: StoredStreamHeader,
  bindings: readonly LoadedEvidenceBinding[],
): Promise<InternalResult<true>> {
  const result = await client.query(SELECT_APPENDS, [
    header.identity.streamIdentityFingerprint,
  ]);
  let expectedVersion = 0;
  let expectedHead: string | undefined;
  let firstAppendFingerprint: string | undefined;
  for (const row of result.rows) {
    const appendId = stringField(row, "append_id");
    const streamFingerprint = stringField(row, "stream_identity_fingerprint");
    const appendBatchFingerprint = stringField(row, "append_batch_fingerprint");
    const storedExpectedVersion = integerField(row, "expected_stream_version");
    const resultingVersion = integerField(row, "resulting_stream_version");
    const storedExpectedHead = nullableStringField(
      row,
      "expected_head_evidence_entry_id",
    );
    const resultingHead = stringField(row, "resulting_head_evidence_entry_id");
    const appendedAt = stringField(row, "appended_at_value");
    const provenanceReferences = stringArrayField(row, "provenance_references");
    const integrityReferences = stringArrayField(row, "integrity_references");
    const appendReceiptFingerprint = stringField(
      row,
      "append_receipt_fingerprint",
    );
    if (
      appendId === undefined ||
      streamFingerprint !== header.identity.streamIdentityFingerprint ||
      appendBatchFingerprint === undefined ||
      storedExpectedVersion !== expectedVersion ||
      resultingVersion === undefined ||
      resultingVersion <= expectedVersion ||
      storedExpectedHead === undefined ||
      storedExpectedHead !== (expectedHead ?? null) ||
      resultingHead === undefined ||
      appendedAt === undefined ||
      provenanceReferences === undefined ||
      integrityReferences === undefined ||
      appendReceiptFingerprint === undefined
    ) return failure("stored_integrity_failure");
    const appendBindings = bindings.slice(expectedVersion, resultingVersion);
    if (
      appendBindings.length !== resultingVersion - expectedVersion ||
      appendBindings.some((binding) => binding.appendId !== appendId) ||
      appendBindings.at(-1)?.evidence.evidenceEntryId !== resultingHead
    ) return failure("stored_integrity_failure");
    const batch = createOrganizationVerificationEvidenceAppendBatch({
      appendId,
      streamIdentity: header.identity,
      expectedStreamVersion: expectedVersion,
      ...(expectedHead === undefined
        ? {}
        : { expectedHeadEvidenceEntryId: expectedHead }),
      entries: appendBindings.map((binding) => binding.evidence),
      appendedAt,
      provenanceReferences,
      integrityReferences,
    });
    if (!batch.ok || batch.value.appendBatchFingerprint !== appendBatchFingerprint) {
      return failure("stored_integrity_failure");
    }
    const receipt = createOrganizationVerificationEvidenceAppendReceipt({
      batch: batch.value,
      outcome: "appended",
    });
    if (
      !receipt.ok ||
      receipt.value.appendReceiptFingerprint !== appendReceiptFingerprint ||
      receipt.value.resultingStreamVersion !== resultingVersion
    ) return failure("stored_integrity_failure");
    firstAppendFingerprint ??= appendBatchFingerprint;
    expectedVersion = resultingVersion;
    expectedHead = resultingHead;
  }
  if (
    expectedVersion !== header.currentStreamVersion ||
    expectedHead !== header.headEvidenceEntryId ||
    firstAppendFingerprint !== header.creationFingerprint
  ) return failure("stored_integrity_failure");
  return success(true);
}

async function loadValidatedStream(
  client: OrganizationVerificationPostgresQueryClient,
  header: StoredStreamHeader,
): Promise<InternalResult<OrganizationVerificationEvidenceStream>> {
  const entries = await loadEntries(client, header);
  if (!entries.ok || entries.value.length === 0) {
    return failure(entries.ok ? "stored_integrity_failure" : entries.code);
  }
  const appends = await validateCommittedAppends(client, header, entries.value);
  if (!appends.ok) return appends;
  const stream = createOrganizationVerificationEvidenceStream({
    streamIdentity: header.identity,
    entries: entries.value.map((binding) => binding.evidence),
  });
  if (
    !stream.ok ||
    stream.value.streamVersion !== header.currentStreamVersion ||
    stream.value.headEvidenceReference.evidenceEntryId !==
      header.headEvidenceEntryId
  ) {
    return failure("stored_integrity_failure");
  }
  return success(stream.value);
}

function prepareEvidence(
  entries: readonly OrganizationVerificationStoredEvidence[],
): InternalResult<readonly PreparedEvidence[]> {
  const prepared: PreparedEvidence[] = [];
  for (const evidence of entries) {
    const envelope = createOrganizationVerificationDurableEvidenceEnvelope(evidence);
    if (!envelope.ok) return failure(envelope.code);
    const serialized = serializeOrganizationVerificationDurableEvidence(
      envelope.value,
    );
    if (!serialized.ok) return failure(serialized.code);
    prepared.push(Object.freeze({
      evidence,
      canonicalEnvelope: serialized.value,
      durablePayloadFingerprint: envelope.value.payloadFingerprint,
    }));
  }
  return success(Object.freeze(prepared));
}

function firstEvidenceConflict(
  existing: readonly OrganizationVerificationStoredEvidence[],
  incoming: readonly OrganizationVerificationStoredEvidence[],
): OrganizationVerificationPersistenceFailureCode | undefined {
  for (const candidate of incoming) {
    for (const committed of existing) {
      const classification =
        classifyOrganizationVerificationStoredEvidenceConflict(
          committed,
          candidate,
        );
      if (!classification.ok) return classification.code;
      if (classification.value !== "none") {
        return classification.value === "duplicate_append_idempotent"
          ? "evidence_identity_conflict"
          : classification.value;
      }
    }
  }
  return undefined;
}

function appendRowIsExactDuplicate(
  row: OrganizationVerificationPostgresRow,
  request: AppendOrganizationVerificationEvidenceRequest,
  receipt: OrganizationVerificationEvidenceAppendReceipt,
): "exact" | "different_stream" | "conflict" {
  if (
    stringField(row, "stream_identity_fingerprint") !==
    request.streamIdentity.streamIdentityFingerprint
  ) {
    return "different_stream";
  }
  return stringField(row, "append_batch_fingerprint") ===
      request.batch.appendBatchFingerprint &&
    integerField(row, "expected_stream_version") ===
      request.expectedStreamVersion &&
    integerField(row, "resulting_stream_version") ===
      receipt.resultingStreamVersion &&
    stringField(row, "append_receipt_fingerprint") ===
      receipt.appendReceiptFingerprint
    ? "exact"
    : "conflict";
}

async function existingAppend(
  client: OrganizationVerificationPostgresQueryClient,
  request: AppendOrganizationVerificationEvidenceRequest,
  receipt: OrganizationVerificationEvidenceAppendReceipt,
): Promise<AppendOrganizationVerificationEvidenceResult | undefined> {
  const result = await client.query(SELECT_APPEND, [request.batch.appendId]);
  if (result.rows.length === 0) return undefined;
  if (result.rows.length !== 1 || result.rows[0] === undefined) {
    return appendFailure("stored_integrity_failure");
  }
  const classification = appendRowIsExactDuplicate(
    result.rows[0],
    request,
    receipt,
  );
  if (classification === "different_stream") {
    return appendFailure("stream_identity_mismatch");
  }
  if (classification === "conflict") {
    return appendFailure("evidence_identity_conflict");
  }
  return appendSuccess("duplicate_append_idempotent", receipt);
}

async function insertPreparedEvidence(
  client: OrganizationVerificationPostgresQueryClient,
  request: AppendOrganizationVerificationEvidenceRequest,
  prepared: readonly PreparedEvidence[],
): Promise<void> {
  for (const item of prepared) {
    const evidence = item.evidence;
    await client.query(INSERT_EVIDENCE, [
      evidence.evidenceEntryId,
      evidence.streamIdentity.streamIdentityFingerprint,
      evidence.streamPosition,
      evidence.predecessorEvidenceEntryId ?? null,
      request.batch.appendId,
      evidence.evidenceKind,
      evidence.semanticArtifactIdentity,
      typeof evidence.artifactVersionOrSequence,
      String(evidence.artifactVersionOrSequence),
      evidence.artifactFingerprint,
      evidence.artifactOccurredAt,
      evidence.appendedAt,
      JSON.stringify(evidence.provenanceReferences),
      JSON.stringify(evidence.integrityReferences),
      evidence.storedEvidenceFingerprint,
      ORGANIZATION_VERIFICATION_DURABLE_EVIDENCE_CONTRACT_VERSION,
      item.durablePayloadFingerprint,
      item.canonicalEnvelope,
    ]);
  }
}

export function createPostgresOrganizationVerificationPersistenceAdapter(
  database: OrganizationVerificationPostgresDatabase,
): OrganizationVerificationEvidenceRepositoryPort {
  async function appendOrganizationVerificationEvidence(
    request: AppendOrganizationVerificationEvidenceRequest,
  ): Promise<AppendOrganizationVerificationEvidenceResult> {
    const validation = validateAppendOrganizationVerificationEvidenceRequest(request);
    if (!validation.ok) return appendFailure(validation.code);
    const prepared = prepareEvidence(request.batch.entries);
    if (!prepared.ok) return appendFailure(prepared.code);
    const receiptResult = createOrganizationVerificationEvidenceAppendReceipt({
      batch: request.batch,
      outcome: "appended",
    });
    if (!receiptResult.ok) return appendFailure(receiptResult.code);
    const receipt = receiptResult.value;

    try {
      return await database.transaction(async (client) => {
        const earlyDuplicate = await existingAppend(client, request, receipt);
        if (earlyDuplicate !== undefined) {
          if (earlyDuplicate.ok) return earlyDuplicate;
          throw new AppendTransactionAbort(earlyDuplicate);
        }

        if (request.expectedStreamVersion === 0) {
          await client.query(INSERT_STREAM, [
            request.streamIdentity.streamIdentityFingerprint,
            request.streamIdentity.workflowExecutionId,
            request.streamIdentity.organizationId,
            request.streamIdentity.recordId,
            request.streamIdentity.revisionId,
            request.streamIdentity.attemptId,
            request.batch.appendedAt,
            request.batch.appendBatchFingerprint,
          ]);
        }

        const selected = await selectStreamHeader(
          client,
          request.streamIdentity.streamIdentityFingerprint,
          true,
        );
        if (!selected.ok) abort(selected.code);
        if (selected.value === undefined) abort("expected_stream_version_conflict");
        const header = selected.value;
        if (!sameOrganizationVerificationWorkflowStreamIdentity(
          header.identity,
          request.streamIdentity,
        )) abort("stream_identity_mismatch");

        const concurrentDuplicate = await existingAppend(client, request, receipt);
        if (concurrentDuplicate !== undefined) {
          if (concurrentDuplicate.ok) return concurrentDuplicate;
          throw new AppendTransactionAbort(concurrentDuplicate);
        }

        if (
          header.currentStreamVersion !== request.expectedStreamVersion ||
          header.headEvidenceEntryId !== request.batch.expectedHeadEvidenceEntryId
        ) abort("expected_stream_version_conflict");

        let existingEntries: readonly OrganizationVerificationStoredEvidence[] = [];
        if (header.currentStreamVersion > 0) {
          const existingStream = await loadValidatedStream(client, header);
          if (!existingStream.ok) abort(existingStream.code);
          existingEntries = existingStream.value.entries;
        }
        const conflict = firstEvidenceConflict(existingEntries, request.batch.entries);
        if (conflict !== undefined) abort(conflict);
        const candidate = createOrganizationVerificationEvidenceStream({
          streamIdentity: request.streamIdentity,
          entries: Object.freeze([...existingEntries, ...request.batch.entries]),
        });
        if (!candidate.ok) abort(candidate.code);
        if (candidate.value.streamVersion !== receipt.resultingStreamVersion) {
          abort("stored_integrity_failure");
        }

        await client.query(INSERT_APPEND, [
          request.batch.appendId,
          request.streamIdentity.streamIdentityFingerprint,
          request.batch.appendBatchFingerprint,
          request.expectedStreamVersion,
          receipt.resultingStreamVersion,
          request.batch.expectedHeadEvidenceEntryId ?? null,
          candidate.value.headEvidenceReference.evidenceEntryId,
          request.batch.appendedAt,
          request.batch.appendedAt,
          JSON.stringify(request.batch.provenanceReferences),
          JSON.stringify(request.batch.integrityReferences),
          receipt.appendReceiptFingerprint,
        ]);
        await insertPreparedEvidence(client, request, prepared.value);
        const updated = await client.query(UPDATE_STREAM, [
          request.streamIdentity.streamIdentityFingerprint,
          receipt.resultingStreamVersion,
          candidate.value.headEvidenceReference.evidenceEntryId,
          request.expectedStreamVersion,
          request.batch.expectedHeadEvidenceEntryId ?? null,
        ]);
        if (updated.rowCount !== 1) abort("expected_stream_version_conflict");
        return appendSuccess("appended", receipt);
      });
    } catch (error) {
      if (error instanceof AppendTransactionAbort) return error.result;
      const postgresCode = postgresFailureCode(error);
      if (postgresCode === "23505") {
        return appendFailure("evidence_identity_conflict");
      }
      if (postgresCode === "23514") {
        return appendFailure("malformed_append_metadata");
      }
      return appendFailure("stored_integrity_failure");
    }
  }

  async function loadOrganizationVerificationEvidenceStream(
    request: LoadOrganizationVerificationEvidenceStreamRequest,
  ): Promise<OrganizationVerificationEvidenceStreamLoadResult> {
    if (!isOrganizationVerificationWorkflowStreamIdentity(request.streamIdentity)) {
      throw new PostgresPersistenceInvariantError("stream_identity_mismatch");
    }
    try {
      const selected = await selectStreamHeader(
        database,
        request.streamIdentity.streamIdentityFingerprint,
        false,
      );
      if (!selected.ok) throw new PostgresPersistenceInvariantError(selected.code);
      if (selected.value === undefined) {
        return requireLoadResult(
          organizationVerificationEvidenceStreamNotFound(request.streamIdentity),
        );
      }
      if (!sameOrganizationVerificationWorkflowStreamIdentity(
        selected.value.identity,
        request.streamIdentity,
      )) {
        throw new PostgresPersistenceInvariantError("stored_integrity_failure");
      }
      const stream = await loadValidatedStream(database, selected.value);
      if (!stream.ok) throw new PostgresPersistenceInvariantError(stream.code);
      return requireLoadResult(
        organizationVerificationEvidenceStreamFound(stream.value),
      );
    } catch (error) {
      if (error instanceof PostgresPersistenceInvariantError) throw error;
      throw new PostgresPersistenceInvariantError("stored_integrity_failure");
    }
  }

  return Object.freeze({
    appendOrganizationVerificationEvidence,
    loadOrganizationVerificationEvidenceStream,
  });
}
