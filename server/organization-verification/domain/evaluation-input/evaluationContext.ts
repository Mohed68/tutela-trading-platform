import type { OrganizationVerificationEvaluationProjection } from "../evaluation-projection/index.js";
import {
  inputFailure,
  inputSuccess,
  type PolicyEvaluationInputDomainResult,
} from "./errors.js";
import {
  EVALUATION_CONTEXT_CONTRACT_VERSION,
  isCanonicalEvaluationInputTimestampInternal,
  isExactEvaluationInputIdentityInternal,
  type EvaluationContextContractVersion,
  type OrganizationVerificationEvaluationCorrelationReference,
  type OrganizationVerificationEvaluationExecutionReference,
  type OrganizationVerificationEvaluationIntegrityReference,
  type OrganizationVerificationEvaluationProvenanceReference,
} from "./ids.js";

type Projection = OrganizationVerificationEvaluationProjection;

export interface OrganizationVerificationEvaluationContext {
  readonly contextContractVersion: EvaluationContextContractVersion;
  readonly requestedAt: string;
  readonly effectiveAt: string;
  readonly sourceCutoffAt?: string;
  readonly executionReference: OrganizationVerificationEvaluationExecutionReference;
  readonly attemptId: NonNullable<Projection["identity"]["attemptId"]>;
  readonly organizationId: Projection["identity"]["organizationId"];
  readonly recordId: Projection["identity"]["recordId"];
  readonly revisionId: Projection["identity"]["revisionId"];
  readonly profileRevisionId: Projection["identity"]["profileRevisionId"];
  readonly evaluationProjectionId: Projection["evaluationProjectionId"];
  readonly evaluationProjectionFingerprint: Projection["projectionFingerprint"];
  readonly sourceSnapshotId: Projection["source"]["evidenceSnapshotId"];
  readonly sourceSnapshotFingerprint: Projection["source"]["snapshotFingerprint"];
  readonly provenanceReference: OrganizationVerificationEvaluationProvenanceReference;
  readonly correlationReference: OrganizationVerificationEvaluationCorrelationReference;
  readonly integrityReference: OrganizationVerificationEvaluationIntegrityReference;
}

export interface CreateOrganizationVerificationEvaluationContextInput
  extends Omit<
    OrganizationVerificationEvaluationContext,
    "contextContractVersion" | "requestedAt" | "effectiveAt" | "sourceCutoffAt"
  > {
  readonly contextContractVersion: unknown;
  readonly requestedAt: unknown;
  readonly effectiveAt: unknown;
  readonly sourceCutoffAt?: unknown;
}

export function createOrganizationVerificationEvaluationContext(
  input: CreateOrganizationVerificationEvaluationContextInput,
): PolicyEvaluationInputDomainResult<OrganizationVerificationEvaluationContext> {
  if (input.contextContractVersion !== EVALUATION_CONTEXT_CONTRACT_VERSION) {
    return inputFailure("unsupported_evaluation_context_version");
  }
  if (!isExactEvaluationInputIdentityInternal(input.attemptId)) {
    return inputFailure("attempt_id_required");
  }
  if (
    !isCanonicalEvaluationInputTimestampInternal(input.requestedAt) ||
    !isCanonicalEvaluationInputTimestampInternal(input.effectiveAt) ||
    (input.sourceCutoffAt !== undefined &&
      !isCanonicalEvaluationInputTimestampInternal(input.sourceCutoffAt)) ||
    Date.parse(input.effectiveAt as string) <
      Date.parse(input.requestedAt as string) ||
    (input.sourceCutoffAt !== undefined &&
      Date.parse(input.sourceCutoffAt as string) >
        Date.parse(input.effectiveAt as string))
  ) {
    return inputFailure("invalid_evaluation_input_chronology");
  }
  for (const value of [
    input.executionReference,
    input.organizationId,
    input.recordId,
    input.revisionId,
    input.profileRevisionId,
    input.evaluationProjectionId,
    input.evaluationProjectionFingerprint,
    input.sourceSnapshotId,
    input.sourceSnapshotFingerprint,
    input.provenanceReference,
    input.correlationReference,
    input.integrityReference,
  ]) {
    if (!isExactEvaluationInputIdentityInternal(value)) {
      return inputFailure("invalid_evaluation_context");
    }
  }
  return inputSuccess(
    Object.freeze({
      contextContractVersion: EVALUATION_CONTEXT_CONTRACT_VERSION,
      requestedAt: input.requestedAt as string,
      effectiveAt: input.effectiveAt as string,
      ...(input.sourceCutoffAt
        ? { sourceCutoffAt: input.sourceCutoffAt as string }
        : {}),
      executionReference: input.executionReference,
      attemptId: input.attemptId,
      organizationId: input.organizationId,
      recordId: input.recordId,
      revisionId: input.revisionId,
      profileRevisionId: input.profileRevisionId,
      evaluationProjectionId: input.evaluationProjectionId,
      evaluationProjectionFingerprint:
        input.evaluationProjectionFingerprint,
      sourceSnapshotId: input.sourceSnapshotId,
      sourceSnapshotFingerprint: input.sourceSnapshotFingerprint,
      provenanceReference: input.provenanceReference,
      correlationReference: input.correlationReference,
      integrityReference: input.integrityReference,
    }),
  );
}
