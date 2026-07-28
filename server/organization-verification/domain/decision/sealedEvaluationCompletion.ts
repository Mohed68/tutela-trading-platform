import {
  decisionFailure,
  decisionSuccess,
  type DecisionDomainResult,
} from "./errors.js";
import {
  NORMALIZED_EVALUATION_CLASSIFICATIONS,
  type NormalizedEvaluationClassification,
  type RawNormalizedOrganizationVerificationEvaluation,
} from "./normalizedEvaluation.js";

const evaluationSeal: unique symbol = Symbol(
  "organization_verification_evaluation_completion",
);

export interface SealedNormalizedEvaluationCompletion
  extends Omit<
    RawNormalizedOrganizationVerificationEvaluation,
    | "approvalReady"
    | "revisionRequired"
    | "manualReviewRequired"
    | "rejectionRequired"
    | "evaluationComplete"
    | "evaluationIntegrityValid"
    | "categorySummaries"
  > {
  readonly classification: NormalizedEvaluationClassification;
  readonly categorySummaries: readonly string[];
  readonly [evaluationSeal]: true;
}

export function sealNormalizedEvaluationCompletion(
  input: RawNormalizedOrganizationVerificationEvaluation,
): DecisionDomainResult<SealedNormalizedEvaluationCompletion> {
  if (
    typeof input !== "object" ||
    input === null ||
    [
      input.evaluationComplete,
      input.evaluationIntegrityValid,
      input.approvalReady,
      input.revisionRequired,
      input.manualReviewRequired,
      input.rejectionRequired,
    ].some((signal) => typeof signal !== "boolean")
  ) {
    return decisionFailure("decision_context_invalid");
  }
  if ("classification" in input) {
    return decisionFailure("unsupported_evaluation_classification");
  }
  if (input.evaluationComplete !== true) {
    return decisionFailure("evaluation_incomplete");
  }
  if (input.evaluationIntegrityValid !== true) {
    return decisionFailure("evaluation_integrity_invalid");
  }
  if (
    [
      input.recordId,
      input.revisionId,
      input.attemptId,
      input.organizationId,
      input.snapshotId,
      input.snapshotFingerprint,
      input.evaluationCompletionId,
      input.correlationId,
    ].some((value) => typeof value !== "string" || value.trim().length === 0)
  ) {
    return decisionFailure("decision_context_invalid");
  }
  if (
    typeof input.policySetReference !== "string" ||
    input.policySetReference.trim().length === 0 ||
    ["latest", "current", "head"].includes(
      String(input.policySetReference).trim().toLowerCase(),
    )
  ) {
    return decisionFailure("policy_set_reference_invalid");
  }
  if (
    typeof input.policySetVersion !== "string" ||
    input.policySetVersion.trim().length === 0 ||
    ["latest", "current", "head"].includes(
      String(input.policySetVersion).trim().toLowerCase(),
    )
  ) {
    return decisionFailure("policy_set_version_invalid");
  }
  if (!Number.isFinite(Date.parse(input.completedAt))) {
    return decisionFailure("decision_context_invalid");
  }
  const selected = [
    input.approvalReady ? "approval_ready" : undefined,
    input.revisionRequired ? "revision_required" : undefined,
    input.manualReviewRequired ? "manual_review_required" : undefined,
    input.rejectionRequired ? "rejection_required" : undefined,
  ].filter(
    (value): value is NormalizedEvaluationClassification => value !== undefined,
  );
  if (selected.length === 0) {
    return decisionFailure("missing_evaluation_classification");
  }
  if (selected.length !== 1) {
    return decisionFailure("contradictory_evaluation_classification");
  }
  if (!NORMALIZED_EVALUATION_CLASSIFICATIONS.includes(selected[0])) {
    return decisionFailure("unsupported_evaluation_classification");
  }
  if (
    input.categorySummaries !== undefined &&
    (!Array.isArray(input.categorySummaries) ||
      input.categorySummaries.some(
      (summary) => typeof summary !== "string" || summary.trim().length === 0,
      ))
  ) {
    return decisionFailure("decision_context_invalid");
  }
  return decisionSuccess(
    Object.freeze({
      recordId: input.recordId,
      revisionId: input.revisionId,
      attemptId: input.attemptId,
      organizationId: input.organizationId,
      snapshotId: input.snapshotId,
      snapshotFingerprint: input.snapshotFingerprint,
      evaluationCompletionId: input.evaluationCompletionId,
      policySetReference: input.policySetReference,
      policySetVersion: input.policySetVersion,
      completedAt: input.completedAt,
      classification: selected[0],
      categorySummaries: Object.freeze([...(input.categorySummaries ?? [])]),
      correlationId: input.correlationId,
      [evaluationSeal]: true as const,
    }),
  );
}

export function readSealedEvaluationCompletion(
  input: SealedNormalizedEvaluationCompletion,
): SealedNormalizedEvaluationCompletion {
  if (input[evaluationSeal] !== true || !Object.isFrozen(input)) {
    throw new TypeError("SEALED_EVALUATION_COMPLETION_REQUIRED");
  }
  return input;
}
