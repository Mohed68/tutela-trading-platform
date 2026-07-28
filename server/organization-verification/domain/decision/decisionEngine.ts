import type { OrganizationVerificationAttempt } from "../attempt.js";
import type { OrganizationVerificationRecord } from "../record.js";
import type { OrganizationVerificationRevision } from "../revision.js";
import {
  type OrganizationVerificationDecisionData,
  type OrganizationVerificationDecisionOutcome,
} from "./decision.js";
import {
  decisionFailure,
  decisionSuccess,
  type DecisionDomainResult,
} from "./errors.js";
import type {
  DecisionEngineVersion,
  DecisionIntegrityReference,
  OrganizationVerificationDecisionId,
} from "./ids.js";
import {
  readSealedEvaluationCompletion,
  type SealedNormalizedEvaluationCompletion,
} from "./sealedEvaluationCompletion.js";

const decisionSeal: unique symbol = Symbol(
  "organization_verification_decision",
);

export interface OrganizationVerificationDecision
  extends OrganizationVerificationDecisionData {
  readonly [decisionSeal]: true;
}

export function isOrganizationVerificationDecision(
  input: unknown,
): input is OrganizationVerificationDecision {
  if (typeof input !== "object" || input === null) return false;
  const candidate = input as OrganizationVerificationDecision;
  return (
    candidate[decisionSeal] === true &&
    Object.isFrozen(candidate) &&
    Object.isFrozen(candidate.policyProvenance)
  );
}

export interface DecisionConstructionContext {
  readonly decisionId: OrganizationVerificationDecisionId;
  readonly decisionEngineVersion: DecisionEngineVersion;
  readonly decidedAt: string;
  readonly integrityReference: DecisionIntegrityReference;
  readonly record: OrganizationVerificationRecord;
  readonly revision: OrganizationVerificationRevision;
  readonly attempt: OrganizationVerificationAttempt;
  readonly existingDecision?: OrganizationVerificationDecision;
  readonly supersedesDecisionId?: OrganizationVerificationDecisionId;
}

const OUTCOME_BY_CLASSIFICATION = Object.freeze({
  approval_ready: "approved",
  revision_required: "revision_required",
  manual_review_required: "manual_review",
  rejection_required: "rejected",
} satisfies Record<string, OrganizationVerificationDecisionOutcome>);

function createDecisionInternal(
  input: OrganizationVerificationDecisionData,
): OrganizationVerificationDecision {
  return Object.freeze({
    ...input,
    policyProvenance: Object.freeze({ ...input.policyProvenance }),
    [decisionSeal]: true as const,
  });
}

function readDecisionInternal(
  input: OrganizationVerificationDecision,
): OrganizationVerificationDecision {
  if (!isOrganizationVerificationDecision(input)) {
    throw new TypeError("SEALED_ORGANIZATION_VERIFICATION_DECISION_REQUIRED");
  }
  return input;
}

export function decideOrganizationVerification(
  sealedInput: SealedNormalizedEvaluationCompletion,
  context: DecisionConstructionContext,
): DecisionDomainResult<OrganizationVerificationDecision> {
  let evaluation: SealedNormalizedEvaluationCompletion;
  try {
    evaluation = readSealedEvaluationCompletion(sealedInput);
  } catch {
    return decisionFailure("decision_context_invalid");
  }
  if (context.attempt.processState !== "completed") {
    return decisionFailure("attempt_not_completed");
  }
  if (context.attempt.attemptId !== evaluation.attemptId) {
    return decisionFailure("attempt_id_mismatch");
  }
  if (
    context.record.recordId !== evaluation.recordId ||
    context.revision.recordId !== evaluation.recordId ||
    context.attempt.recordId !== evaluation.recordId
  ) {
    return decisionFailure("verification_record_id_mismatch");
  }
  if (
    context.revision.revisionId !== evaluation.revisionId ||
    context.attempt.revisionId !== evaluation.revisionId
  ) {
    return decisionFailure("verification_revision_id_mismatch");
  }
  if (
    context.record.organizationId !== evaluation.organizationId ||
    context.revision.organizationId !== evaluation.organizationId
  ) {
    return decisionFailure("organization_id_mismatch");
  }
  if (
    context.attempt.snapshotId === undefined ||
    context.attempt.snapshotId !== evaluation.snapshotId
  ) {
    return decisionFailure("snapshot_id_mismatch");
  }
  if (
    context.attempt.snapshotFingerprint === undefined ||
    context.attempt.snapshotFingerprint !== evaluation.snapshotFingerprint
  ) {
    return decisionFailure("snapshot_fingerprint_mismatch");
  }
  if (
    context.attempt.completionReference === undefined ||
    String(context.attempt.completionReference) !==
      String(evaluation.evaluationCompletionId)
  ) {
    return decisionFailure("decision_context_invalid");
  }
  if (!Number.isFinite(Date.parse(context.decidedAt))) {
    return decisionFailure("invalid_decision_timestamp");
  }
  if (
    typeof context.decisionId !== "string" ||
    context.decisionId.trim().length === 0
  ) {
    return decisionFailure("decision_id_invalid");
  }
  if (
    typeof context.decisionEngineVersion !== "string" ||
    context.decisionEngineVersion.trim().length === 0 ||
    ["latest", "current", "head"].includes(
      context.decisionEngineVersion.trim().toLowerCase(),
    )
  ) {
    return decisionFailure("decision_engine_version_invalid");
  }
  if (
    typeof context.integrityReference !== "string" ||
    context.integrityReference.trim().length === 0 ||
    (context.supersedesDecisionId !== undefined &&
      (typeof context.supersedesDecisionId !== "string" ||
        context.supersedesDecisionId.trim().length === 0))
  ) {
    return decisionFailure("decision_context_invalid");
  }

  const outcome = OUTCOME_BY_CLASSIFICATION[evaluation.classification];
  if (!outcome) {
    return decisionFailure("unsupported_evaluation_classification");
  }

  if (context.existingDecision) {
    let existingDecision: OrganizationVerificationDecision;
    try {
      existingDecision = readDecisionInternal(context.existingDecision);
    } catch {
      return decisionFailure("decision_context_invalid");
    }
    if (
      existingDecision.evaluationCompletionId !==
      evaluation.evaluationCompletionId
    ) {
      return decisionFailure("decision_context_invalid");
    }
    if (
      existingDecision.outcome !== outcome ||
      existingDecision.attemptId !== evaluation.attemptId ||
      existingDecision.recordId !== evaluation.recordId ||
      existingDecision.revisionId !== evaluation.revisionId ||
      existingDecision.organizationId !== evaluation.organizationId ||
      existingDecision.snapshotId !== evaluation.snapshotId ||
      existingDecision.snapshotFingerprint !== evaluation.snapshotFingerprint ||
      existingDecision.decisionEngineVersion !==
        context.decisionEngineVersion ||
      existingDecision.policyProvenance.policySetReference !==
        evaluation.policySetReference ||
      existingDecision.policyProvenance.policySetVersion !==
        evaluation.policySetVersion ||
      existingDecision.decidedAt !== context.decidedAt ||
      existingDecision.correlationId !== evaluation.correlationId ||
      existingDecision.integrityReference !== context.integrityReference ||
      existingDecision.supersedesDecisionId !== context.supersedesDecisionId
    ) {
      return decisionFailure("conflicting_decision_for_completion");
    }
    if (existingDecision.decisionId !== context.decisionId) {
      return decisionFailure("duplicate_decision_for_completion");
    }
    return decisionSuccess(existingDecision);
  }

  return decisionSuccess(
    createDecisionInternal({
      decisionId: context.decisionId,
      recordId: evaluation.recordId,
      revisionId: evaluation.revisionId,
      attemptId: evaluation.attemptId,
      organizationId: evaluation.organizationId,
      snapshotId: evaluation.snapshotId,
      snapshotFingerprint: evaluation.snapshotFingerprint,
      evaluationCompletionId: evaluation.evaluationCompletionId,
      outcome,
      decisionEngineVersion: context.decisionEngineVersion,
      policyProvenance: {
        policySetReference: evaluation.policySetReference,
        policySetVersion: evaluation.policySetVersion,
      },
      decidedAt: context.decidedAt,
      correlationId: evaluation.correlationId,
      integrityReference: context.integrityReference,
      ...(context.supersedesDecisionId
        ? { supersedesDecisionId: context.supersedesDecisionId }
        : {}),
    }),
  );
}
