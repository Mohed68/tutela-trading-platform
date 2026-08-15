import {
  createOrganizationVerificationEvidenceStream,
  isOrganizationVerificationEvidenceStream,
  isOrganizationVerificationWorkflowStreamIdentity,
  type OrganizationVerificationDurableEvidenceKind,
  type OrganizationVerificationEvidenceStream,
  type OrganizationVerificationStoredEvidence,
  type OrganizationVerificationWorkflowStreamIdentity,
} from "../persistence-contract/index.js";
import {
  isOrganizationVerificationAttemptLifecycleExecution,
  type OrganizationVerificationAttemptLifecycleExecution,
} from "../attempt-lifecycle-contract/index.js";
import {
  isOrganizationVerificationWorkflowExecution,
  isOrganizationVerificationWorkflowStepRecord,
  type OrganizationVerificationWorkflowExecution,
  type OrganizationVerificationWorkflowStage,
  type OrganizationVerificationWorkflowStep,
  type OrganizationVerificationWorkflowStepRecord,
} from "../workflow-contract/index.js";
import { fingerprintOrganizationVerificationReplay } from "./replayFingerprint.js";

export type OrganizationVerificationReplayFailureCode =
  | "replay_stream_not_found_input"
  | "replay_unauthentic_stream"
  | "replay_stream_integrity_failure"
  | "replay_missing_genesis"
  | "replay_duplicate_genesis"
  | "replay_invalid_genesis"
  | "replay_unexpected_evidence_kind"
  | "replay_incomplete_step_unit"
  | "replay_stage_mismatch"
  | "replay_authority_result_mismatch"
  | "replay_authority_fingerprint_mismatch"
  | "replay_step_record_mismatch"
  | "replay_workflow_version_conflict"
  | "replay_workflow_fingerprint_conflict"
  | "replay_lifecycle_version_conflict"
  | "replay_lifecycle_identity_conflict"
  | "replay_predecessor_conflict"
  | "replay_chronology_conflict"
  | "replay_duplicate_semantic_evidence"
  | "replay_competing_history"
  | "replay_evidence_after_completion"
  | "replay_reconstructed_integrity_failure";

export interface OrganizationVerificationReplayFailureDiagnostic {
  readonly persistencePosition?: number;
  readonly expectedEvidenceKind?: string;
  readonly actualEvidenceKind?: string;
  readonly expectedWorkflowVersion?: number;
  readonly actualWorkflowVersion?: number;
  readonly expectedWorkflowStage?: OrganizationVerificationWorkflowStage;
  readonly actualWorkflowStage?: OrganizationVerificationWorkflowStage;
  readonly safeIdentityReference?: string;
  readonly expectedFingerprint?: string;
  readonly actualFingerprint?: string;
}

export interface OrganizationVerificationReplayFailure {
  readonly code: OrganizationVerificationReplayFailureCode;
  readonly diagnostic: OrganizationVerificationReplayFailureDiagnostic;
}

export interface CreateOrganizationVerificationReplayRequestInput {
  readonly replayRequestId: string;
  readonly replayExecutionId: string;
  readonly sourceEvidenceStream: unknown;
  readonly replayedAt: string;
  readonly provenanceReferences: readonly string[];
  readonly integrityReferences: readonly string[];
}

export interface OrganizationVerificationReplayRequest {
  readonly replayRequestId: string;
  readonly replayExecutionId: string;
  readonly sourceEvidenceStream: OrganizationVerificationEvidenceStream;
  readonly replayedAt: string;
  readonly provenanceReferences: readonly string[];
  readonly integrityReferences: readonly string[];
  readonly replayRequestFingerprint: string;
}

export type OrganizationVerificationReplayRequestCreationResult =
  | Readonly<{
      ok: true;
      value: OrganizationVerificationReplayRequest;
    }>
  | Readonly<{
      ok: false;
      code: OrganizationVerificationReplayFailureCode;
      diagnostic: OrganizationVerificationReplayFailureDiagnostic;
    }>;

export interface OrganizationVerificationReplayEvidenceBinding {
  readonly workflowStepId: string;
  readonly workflowStep: OrganizationVerificationWorkflowStep;
  readonly workflowStage: OrganizationVerificationWorkflowStage;
  readonly resultingWorkflowStage: OrganizationVerificationWorkflowStage;
  readonly authorityResultEvidenceKind: Exclude<
    OrganizationVerificationDurableEvidenceKind,
    "workflow_genesis" | "workflow_step_record"
  >;
  readonly authorityResultSemanticId: string;
  readonly authorityResultFingerprint: string;
  readonly authorityResultPersistencePosition: number;
  readonly workflowStepRecordId: string;
  readonly workflowStepRecordFingerprint: string;
  readonly workflowStepRecordPersistencePosition: number;
  readonly resultingWorkflowVersion: number;
}

export type OrganizationVerificationReplayEvidenceKindCounts = Readonly<
  Record<OrganizationVerificationDurableEvidenceKind, number>
>;

export interface OrganizationVerificationReplayDiagnostics {
  readonly totalEvidenceEntriesConsumed: number;
  readonly totalWorkflowStepsReconstructed: number;
  readonly finalWorkflowVersion: number;
  readonly finalWorkflowStage: OrganizationVerificationWorkflowStage;
  readonly finalLifecycleExecutionVersion: number;
  readonly firstPersistencePosition: number;
  readonly lastPersistencePosition: number;
  readonly evidenceKindCounts: OrganizationVerificationReplayEvidenceKindCounts;
  readonly terminalCoordinationReached: boolean;
}

export interface OrganizationVerificationReplayExecution {
  readonly replayRequestId: string;
  readonly replayRequestFingerprint: string;
  readonly replayExecutionId: string;
  readonly streamIdentity: OrganizationVerificationWorkflowStreamIdentity;
  readonly persistenceStreamVersion: number;
  readonly sourceEvidenceStreamFingerprint: string;
  readonly reconstructedWorkflowExecution: OrganizationVerificationWorkflowExecution;
  readonly reconstructedAttemptLifecycleExecution: OrganizationVerificationAttemptLifecycleExecution;
  readonly authorityResultBindings: readonly OrganizationVerificationReplayEvidenceBinding[];
  readonly workflowStepRecordBindings: readonly OrganizationVerificationWorkflowStepRecord[];
  readonly replayedEvidenceRange: Readonly<{
    firstPersistencePosition: number;
    lastPersistencePosition: number;
  }>;
  readonly completionStatus: "stream_consumed";
  readonly diagnostics: OrganizationVerificationReplayDiagnostics;
  readonly replayedAt: string;
  readonly provenanceReferences: readonly string[];
  readonly integrityReferences: readonly string[];
  readonly replayFingerprint: string;
}

export type OrganizationVerificationReplayResult =
  | Readonly<{
      outcome: "replay_completed";
      execution: OrganizationVerificationReplayExecution;
    }>
  | Readonly<{
      outcome: "replay_rejected";
      failure: OrganizationVerificationReplayFailure;
    }>;

const replayRequestSeal = Symbol(
  "organization-verification-replay-request",
);
const replayBindingSeal = Symbol(
  "organization-verification-replay-evidence-binding",
);
const replayExecutionSeal = Symbol(
  "organization-verification-replay-execution",
);
const replayResultSeal = Symbol(
  "organization-verification-replay-result",
);

function exactReplayIdentity(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !["latest", "current", "head", "default"].includes(
      value.trim().toLowerCase(),
    )
  );
}

function explicitReplayTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function normalizeReplayReferences(
  values: readonly string[],
): readonly string[] | undefined {
  if (
    !Array.isArray(values) ||
    values.length === 0 ||
    values.some((value) => !exactReplayIdentity(value)) ||
    new Set(values).size !== values.length
  ) {
    return undefined;
  }
  return Object.freeze(
    [...values].sort((left, right) => left.localeCompare(right)),
  );
}

function sealReplayValue<T extends object>(
  value: T,
  seal: symbol,
): Readonly<T> {
  Object.defineProperty(value, seal, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return Object.freeze(value);
}

function frozenDiagnostic(
  diagnostic: OrganizationVerificationReplayFailureDiagnostic,
): OrganizationVerificationReplayFailureDiagnostic {
  return Object.freeze({ ...diagnostic });
}

function requestFailure(
  code: OrganizationVerificationReplayFailureCode,
  diagnostic: OrganizationVerificationReplayFailureDiagnostic = {},
): OrganizationVerificationReplayRequestCreationResult {
  return Object.freeze({
    ok: false,
    code,
    diagnostic: frozenDiagnostic(diagnostic),
  });
}

function notFoundInput(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.getOwnPropertyDescriptor(value, "status")?.value === "not_found"
  );
}

export function createOrganizationVerificationReplayRequest(
  input: CreateOrganizationVerificationReplayRequestInput,
): OrganizationVerificationReplayRequestCreationResult {
  if (notFoundInput(input.sourceEvidenceStream)) {
    return requestFailure("replay_stream_not_found_input");
  }
  if (
    !exactReplayIdentity(input.replayRequestId) ||
    !exactReplayIdentity(input.replayExecutionId) ||
    input.replayRequestId === input.replayExecutionId ||
    !explicitReplayTimestamp(input.replayedAt) ||
    !isOrganizationVerificationEvidenceStream(input.sourceEvidenceStream)
  ) {
    return requestFailure("replay_unauthentic_stream");
  }
  const provenanceReferences = normalizeReplayReferences(
    input.provenanceReferences,
  );
  const integrityReferences = normalizeReplayReferences(
    input.integrityReferences,
  );
  if (
    provenanceReferences === undefined ||
    integrityReferences === undefined
  ) {
    return requestFailure("replay_reconstructed_integrity_failure");
  }

  const verifiedStream = createOrganizationVerificationEvidenceStream({
    streamIdentity: input.sourceEvidenceStream.streamIdentity,
    entries: input.sourceEvidenceStream.entries,
  });
  if (
    !verifiedStream.ok ||
    verifiedStream.value.evidenceStreamFingerprint !==
      input.sourceEvidenceStream.evidenceStreamFingerprint ||
    verifiedStream.value.streamVersion !==
      input.sourceEvidenceStream.streamVersion
  ) {
    return requestFailure("replay_stream_integrity_failure");
  }

  const requestSemantic = {
    scope: "organization_verification_replay_request",
    replayRequestId: input.replayRequestId,
    replayExecutionId: input.replayExecutionId,
    streamIdentityFingerprint:
      input.sourceEvidenceStream.streamIdentity.streamIdentityFingerprint,
    persistenceStreamVersion: input.sourceEvidenceStream.streamVersion,
    sourceEvidenceStreamFingerprint:
      input.sourceEvidenceStream.evidenceStreamFingerprint,
    replayedAt: input.replayedAt,
    provenanceReferences,
    integrityReferences,
  };
  const request = {
    replayRequestId: input.replayRequestId,
    replayExecutionId: input.replayExecutionId,
    sourceEvidenceStream: input.sourceEvidenceStream,
    replayedAt: input.replayedAt,
    provenanceReferences,
    integrityReferences,
    replayRequestFingerprint:
      fingerprintOrganizationVerificationReplay(requestSemantic),
  };
  return Object.freeze({
    ok: true,
    value: sealReplayValue(request, replayRequestSeal),
  });
}

export function isOrganizationVerificationReplayRequest(
  value: unknown,
): value is OrganizationVerificationReplayRequest {
  if (
    typeof value !== "object" ||
    value === null ||
    Object.getOwnPropertyDescriptor(value, replayRequestSeal)?.value !==
      true ||
    !Object.isFrozen(value)
  ) {
    return false;
  }
  const replayRequestId = Object.getOwnPropertyDescriptor(
    value,
    "replayRequestId",
  )?.value;
  const replayExecutionId = Object.getOwnPropertyDescriptor(
    value,
    "replayExecutionId",
  )?.value;
  const sourceEvidenceStream = Object.getOwnPropertyDescriptor(
    value,
    "sourceEvidenceStream",
  )?.value;
  const replayedAt = Object.getOwnPropertyDescriptor(
    value,
    "replayedAt",
  )?.value;
  const provenanceReferences = Object.getOwnPropertyDescriptor(
    value,
    "provenanceReferences",
  )?.value;
  const integrityReferences = Object.getOwnPropertyDescriptor(
    value,
    "integrityReferences",
  )?.value;
  const replayRequestFingerprint = Object.getOwnPropertyDescriptor(
    value,
    "replayRequestFingerprint",
  )?.value;
  return (
    exactReplayIdentity(replayRequestId) &&
    exactReplayIdentity(replayExecutionId) &&
    replayRequestId !== replayExecutionId &&
    explicitReplayTimestamp(replayedAt) &&
    isOrganizationVerificationEvidenceStream(sourceEvidenceStream) &&
    typeof replayRequestFingerprint === "string" &&
    replayRequestFingerprint ===
      fingerprintOrganizationVerificationReplay({
        scope: "organization_verification_replay_request",
        replayRequestId,
        replayExecutionId,
        streamIdentityFingerprint:
          sourceEvidenceStream.streamIdentity.streamIdentityFingerprint,
        persistenceStreamVersion: sourceEvidenceStream.streamVersion,
        sourceEvidenceStreamFingerprint:
          sourceEvidenceStream.evidenceStreamFingerprint,
        replayedAt,
        provenanceReferences,
        integrityReferences,
      })
  );
}

export function createReplayEvidenceBindingInternal(
  input: OrganizationVerificationReplayEvidenceBinding,
): OrganizationVerificationReplayEvidenceBinding | undefined {
  if (
    !exactReplayIdentity(input.workflowStepId) ||
    !exactReplayIdentity(input.authorityResultSemanticId) ||
    !exactReplayIdentity(input.authorityResultFingerprint) ||
    !exactReplayIdentity(input.workflowStepRecordId) ||
    !exactReplayIdentity(input.workflowStepRecordFingerprint) ||
    !Number.isSafeInteger(input.authorityResultPersistencePosition) ||
    input.authorityResultPersistencePosition < 2 ||
    input.workflowStepRecordPersistencePosition !==
      input.authorityResultPersistencePosition + 1 ||
    !Number.isSafeInteger(input.resultingWorkflowVersion) ||
    input.resultingWorkflowVersion < 2
  ) {
    return undefined;
  }
  return sealReplayValue({ ...input }, replayBindingSeal);
}

export function isOrganizationVerificationReplayEvidenceBinding(
  value: unknown,
): value is OrganizationVerificationReplayEvidenceBinding {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.getOwnPropertyDescriptor(value, replayBindingSeal)?.value ===
      true &&
    Object.isFrozen(value)
  );
}

interface CreateReplayExecutionInternalInput {
  readonly request: OrganizationVerificationReplayRequest;
  readonly reconstructedWorkflowExecution: OrganizationVerificationWorkflowExecution;
  readonly reconstructedAttemptLifecycleExecution: OrganizationVerificationAttemptLifecycleExecution;
  readonly authorityResultBindings: readonly OrganizationVerificationReplayEvidenceBinding[];
  readonly workflowStepRecordBindings: readonly OrganizationVerificationWorkflowStepRecord[];
  readonly diagnostics: OrganizationVerificationReplayDiagnostics;
}

export function createReplayExecutionInternal(
  input: CreateReplayExecutionInternalInput,
): OrganizationVerificationReplayExecution | undefined {
  if (
    !isOrganizationVerificationReplayRequest(input.request) ||
    !isOrganizationVerificationWorkflowExecution(
      input.reconstructedWorkflowExecution,
    ) ||
    !isOrganizationVerificationAttemptLifecycleExecution(
      input.reconstructedAttemptLifecycleExecution,
    ) ||
    !input.authorityResultBindings.every(
      isOrganizationVerificationReplayEvidenceBinding,
    ) ||
    !input.workflowStepRecordBindings.every(
      isOrganizationVerificationWorkflowStepRecord,
    ) ||
    input.authorityResultBindings.length !==
      input.workflowStepRecordBindings.length
  ) {
    return undefined;
  }
  const stream = input.request.sourceEvidenceStream;
  if (
    !isOrganizationVerificationWorkflowStreamIdentity(
      stream.streamIdentity,
    ) ||
    input.diagnostics.totalEvidenceEntriesConsumed !==
      stream.streamVersion ||
    input.diagnostics.finalWorkflowVersion !==
      input.reconstructedWorkflowExecution.workflowExecutionVersion ||
    input.diagnostics.finalWorkflowStage !==
      input.reconstructedWorkflowExecution.workflowStage ||
    input.diagnostics.finalLifecycleExecutionVersion !==
      input.reconstructedAttemptLifecycleExecution.lifecycleExecutionVersion
  ) {
    return undefined;
  }

  const authorityResultBindings = Object.freeze([
    ...input.authorityResultBindings,
  ]);
  const workflowStepRecordBindings = Object.freeze([
    ...input.workflowStepRecordBindings,
  ]);
  const evidenceKindCounts = Object.freeze({
    ...input.diagnostics.evidenceKindCounts,
  });
  const diagnostics = Object.freeze({
    ...input.diagnostics,
    evidenceKindCounts,
  });
  const replayedEvidenceRange = Object.freeze({
    firstPersistencePosition:
      input.diagnostics.firstPersistencePosition,
    lastPersistencePosition: input.diagnostics.lastPersistencePosition,
  });
  const replayFingerprint = fingerprintOrganizationVerificationReplay({
    scope: "organization_verification_replay_execution",
    replayRequestId: input.request.replayRequestId,
    replayRequestFingerprint: input.request.replayRequestFingerprint,
    replayExecutionId: input.request.replayExecutionId,
    streamIdentityFingerprint:
      stream.streamIdentity.streamIdentityFingerprint,
    persistenceStreamVersion: stream.streamVersion,
    sourceEvidenceStreamFingerprint: stream.evidenceStreamFingerprint,
    reconstructedWorkflowExecutionFingerprint:
      input.reconstructedWorkflowExecution.workflowExecutionFingerprint,
    reconstructedLifecycleExecutionFingerprint:
      input.reconstructedAttemptLifecycleExecution
        .attemptLifecycleExecutionFingerprint,
    orderedAuthorityResultBindings: authorityResultBindings,
    orderedWorkflowStepRecordFingerprints: workflowStepRecordBindings.map(
      (record) => record.workflowStepBindingFingerprint,
    ),
    replayedEvidenceRange,
    completionStatus: "stream_consumed",
    diagnostics,
    replayedAt: input.request.replayedAt,
    provenanceReferences: input.request.provenanceReferences,
    integrityReferences: input.request.integrityReferences,
  });
  return sealReplayValue(
    {
      replayRequestId: input.request.replayRequestId,
      replayRequestFingerprint: input.request.replayRequestFingerprint,
      replayExecutionId: input.request.replayExecutionId,
      streamIdentity: stream.streamIdentity,
      persistenceStreamVersion: stream.streamVersion,
      sourceEvidenceStreamFingerprint: stream.evidenceStreamFingerprint,
      reconstructedWorkflowExecution:
        input.reconstructedWorkflowExecution,
      reconstructedAttemptLifecycleExecution:
        input.reconstructedAttemptLifecycleExecution,
      authorityResultBindings,
      workflowStepRecordBindings,
      replayedEvidenceRange,
      completionStatus: "stream_consumed",
      diagnostics,
      replayedAt: input.request.replayedAt,
      provenanceReferences: input.request.provenanceReferences,
      integrityReferences: input.request.integrityReferences,
      replayFingerprint,
    },
    replayExecutionSeal,
  );
}

export function isOrganizationVerificationReplayExecution(
  value: unknown,
): value is OrganizationVerificationReplayExecution {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.getOwnPropertyDescriptor(value, replayExecutionSeal)?.value ===
      true &&
    Object.isFrozen(value) &&
    isOrganizationVerificationWorkflowExecution(
      Object.getOwnPropertyDescriptor(
        value,
        "reconstructedWorkflowExecution",
      )?.value,
    )
  );
}

export function replayCompletedInternal(
  execution: OrganizationVerificationReplayExecution,
): OrganizationVerificationReplayResult {
  if (!isOrganizationVerificationReplayExecution(execution)) {
    return replayRejectedInternal(
      "replay_reconstructed_integrity_failure",
    );
  }
  return sealReplayValue(
    { outcome: "replay_completed", execution },
    replayResultSeal,
  );
}

export function replayRejectedInternal(
  code: OrganizationVerificationReplayFailureCode,
  diagnostic: OrganizationVerificationReplayFailureDiagnostic = {},
): OrganizationVerificationReplayResult {
  return sealReplayValue(
    {
      outcome: "replay_rejected",
      failure: Object.freeze({
        code,
        diagnostic: frozenDiagnostic(diagnostic),
      }),
    },
    replayResultSeal,
  );
}

export function isOrganizationVerificationReplayResult(
  value: unknown,
): value is OrganizationVerificationReplayResult {
  if (
    typeof value !== "object" ||
    value === null ||
    Object.getOwnPropertyDescriptor(value, replayResultSeal)?.value !==
      true ||
    !Object.isFrozen(value)
  ) {
    return false;
  }
  const outcome = Object.getOwnPropertyDescriptor(value, "outcome")?.value;
  if (outcome === "replay_completed") {
    return isOrganizationVerificationReplayExecution(
      Object.getOwnPropertyDescriptor(value, "execution")?.value,
    );
  }
  return outcome === "replay_rejected";
}

export type ReplayAuthorityEvidence = Exclude<
  OrganizationVerificationStoredEvidence,
  { evidenceKind: "workflow_genesis" | "workflow_step_record" }
>;
