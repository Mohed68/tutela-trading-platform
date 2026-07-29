import {
  classifyOrganizationVerificationStoredEvidenceConflict,
  createOrganizationVerificationEvidenceAppendReceipt,
  createOrganizationVerificationEvidenceStream,
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

interface CommittedAppend {
  readonly streamKey: string;
  readonly appendBatchFingerprint: string;
  readonly receipt: OrganizationVerificationEvidenceAppendReceipt;
}

interface InMemoryRepositoryState {
  readonly streams: ReadonlyMap<
    string,
    OrganizationVerificationEvidenceStream
  >;
  readonly committedAppends: ReadonlyMap<string, CommittedAppend>;
}

class InMemoryPersistenceInvariantError extends Error {
  readonly code: OrganizationVerificationPersistenceFailureCode;

  constructor(
    code: OrganizationVerificationPersistenceFailureCode,
    detail?: string,
  ) {
    super(detail === undefined ? code : `${code}: ${detail}`);
    this.name = "InMemoryPersistenceInvariantError";
    this.code = code;
  }
}

function appendFailure(
  code: OrganizationVerificationPersistenceFailureCode,
  detail?: string,
): AppendOrganizationVerificationEvidenceResult {
  return Object.freeze({
    ok: false,
    code,
    ...(detail === undefined ? {} : { detail }),
  });
}

function appendSuccess(
  outcome: "appended" | "duplicate_append_idempotent",
  receipt: OrganizationVerificationEvidenceAppendReceipt,
): AppendOrganizationVerificationEvidenceResult {
  return Object.freeze({ ok: true, outcome, receipt });
}

function canonicalStreamKey(
  identity: OrganizationVerificationWorkflowStreamIdentity,
): string {
  return [
    identity.workflowExecutionId,
    identity.organizationId,
    identity.recordId,
    identity.revisionId,
    identity.attemptId,
  ]
    .map((part) => `${part.length}:${part}`)
    .join("|");
}

function emptyRepositoryState(): InMemoryRepositoryState {
  return Object.freeze({
    streams: new Map<string, OrganizationVerificationEvidenceStream>(),
    committedAppends: new Map<string, CommittedAppend>(),
  });
}

function firstExistingEvidenceConflict(
  existingEntries: readonly OrganizationVerificationStoredEvidence[],
  incomingEntries: readonly OrganizationVerificationStoredEvidence[],
): OrganizationVerificationPersistenceFailureCode | undefined {
  for (const incoming of incomingEntries) {
    for (const existing of existingEntries) {
      const classification =
        classifyOrganizationVerificationStoredEvidenceConflict(
          existing,
          incoming,
        );
      if (!classification.ok) {
        return classification.code;
      }
      if (classification.value === "stream_identity_mismatch") {
        return "stream_identity_mismatch";
      }
      if (classification.value === "evidence_identity_conflict") {
        return "evidence_identity_conflict";
      }
      if (classification.value === "evidence_fingerprint_conflict") {
        return "evidence_fingerprint_conflict";
      }
      if (classification.value === "duplicate_append_idempotent") {
        return "evidence_identity_conflict";
      }
    }
  }
  return undefined;
}

function requireLoadResult(
  result:
    | ReturnType<typeof organizationVerificationEvidenceStreamNotFound>
    | ReturnType<typeof organizationVerificationEvidenceStreamFound>,
): OrganizationVerificationEvidenceStreamLoadResult {
  if (!result.ok) {
    throw new InMemoryPersistenceInvariantError(result.code, result.detail);
  }
  return result.value;
}

export function createInMemoryOrganizationVerificationEvidenceRepository(): OrganizationVerificationEvidenceRepositoryPort {
  let repositoryState = emptyRepositoryState();

  async function appendOrganizationVerificationEvidence(
    request: AppendOrganizationVerificationEvidenceRequest,
  ): Promise<AppendOrganizationVerificationEvidenceResult> {
    const requestValidation =
      validateAppendOrganizationVerificationEvidenceRequest(request);
    if (!requestValidation.ok) {
      return appendFailure(
        requestValidation.code,
        requestValidation.detail,
      );
    }

    const streamKey = canonicalStreamKey(request.streamIdentity);
    const priorAppend = repositoryState.committedAppends.get(
      request.batch.appendId,
    );
    if (priorAppend !== undefined) {
      if (priorAppend.streamKey !== streamKey) {
        return appendFailure("stream_identity_mismatch");
      }
      if (
        priorAppend.appendBatchFingerprint ===
        request.batch.appendBatchFingerprint
      ) {
        return appendSuccess(
          "duplicate_append_idempotent",
          priorAppend.receipt,
        );
      }
      return appendFailure("evidence_identity_conflict");
    }

    const currentStream = repositoryState.streams.get(streamKey);
    const actualStreamVersion = currentStream?.streamVersion ?? 0;
    if (actualStreamVersion !== request.expectedStreamVersion) {
      return appendFailure("expected_stream_version_conflict");
    }
    if (
      currentStream !== undefined &&
      !sameOrganizationVerificationWorkflowStreamIdentity(
        currentStream.streamIdentity,
        request.streamIdentity,
      )
    ) {
      return appendFailure("stream_identity_mismatch");
    }
    if (
      currentStream !== undefined &&
      request.batch.expectedHeadEvidenceEntryId !==
        currentStream.headEvidenceReference.evidenceEntryId
    ) {
      return appendFailure("expected_stream_version_conflict");
    }

    const existingEntries = currentStream?.entries ?? [];
    const evidenceConflict = firstExistingEvidenceConflict(
      existingEntries,
      request.batch.entries,
    );
    if (evidenceConflict !== undefined) {
      return appendFailure(evidenceConflict);
    }

    const candidateEntries = Object.freeze([
      ...existingEntries,
      ...request.batch.entries,
    ]);
    const candidateStreamResult =
      createOrganizationVerificationEvidenceStream({
        streamIdentity: request.streamIdentity,
        entries: candidateEntries,
      });
    if (!candidateStreamResult.ok) {
      return appendFailure(
        candidateStreamResult.code,
        candidateStreamResult.detail,
      );
    }

    const receiptResult =
      createOrganizationVerificationEvidenceAppendReceipt({
        batch: request.batch,
        outcome: "appended",
      });
    if (!receiptResult.ok) {
      return appendFailure(receiptResult.code, receiptResult.detail);
    }

    const nextStreams = new Map(repositoryState.streams);
    nextStreams.set(streamKey, candidateStreamResult.value);
    const nextCommittedAppends = new Map(
      repositoryState.committedAppends,
    );
    nextCommittedAppends.set(
      request.batch.appendId,
      Object.freeze({
        streamKey,
        appendBatchFingerprint: request.batch.appendBatchFingerprint,
        receipt: receiptResult.value,
      }),
    );

    repositoryState = Object.freeze({
      streams: nextStreams,
      committedAppends: nextCommittedAppends,
    });

    return appendSuccess("appended", receiptResult.value);
  }

  async function loadOrganizationVerificationEvidenceStream(
    request: LoadOrganizationVerificationEvidenceStreamRequest,
  ): Promise<OrganizationVerificationEvidenceStreamLoadResult> {
    if (
      !isOrganizationVerificationWorkflowStreamIdentity(
        request.streamIdentity,
      )
    ) {
      throw new InMemoryPersistenceInvariantError(
        "stream_identity_mismatch",
      );
    }

    const streamKey = canonicalStreamKey(request.streamIdentity);
    const storedStream = repositoryState.streams.get(streamKey);
    if (storedStream === undefined) {
      return requireLoadResult(
        organizationVerificationEvidenceStreamNotFound(
          request.streamIdentity,
        ),
      );
    }
    if (
      !sameOrganizationVerificationWorkflowStreamIdentity(
        storedStream.streamIdentity,
        request.streamIdentity,
      )
    ) {
      throw new InMemoryPersistenceInvariantError(
        "stored_integrity_failure",
      );
    }

    const verifiedStream = createOrganizationVerificationEvidenceStream({
      streamIdentity: request.streamIdentity,
      entries: storedStream.entries,
    });
    if (!verifiedStream.ok) {
      throw new InMemoryPersistenceInvariantError(
        "stored_integrity_failure",
        verifiedStream.detail,
      );
    }
    return requireLoadResult(
      organizationVerificationEvidenceStreamFound(verifiedStream.value),
    );
  }

  return Object.freeze({
    appendOrganizationVerificationEvidence,
    loadOrganizationVerificationEvidenceStream,
  });
}
